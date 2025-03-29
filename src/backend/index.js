// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = require('fs').promises; // Use fs.promises
const path = require('path');
const crypto = require('crypto'); // For generating unique IDs
const Docker = require('dockerode');
const { query } = require('./config/db'); // Import query function directly
const Papa = require('papaparse'); // Import papaparse for CSV stringifying
const fileOperationsRoutes = require('./routes/fileOperations');
const authRoutes = require('./routes/auth'); // Import auth routes
const sessionRoutes = require('./routes/sessions'); // Import session routes
const metadataService = require('./services/metadataService');
const { getLLMServiceInstance } = require('./llm/llmFactory');
const dockerExecutor = require('./services/dockerExecutor');

const docker = new Docker();
const readFileAsync = fsp.readFile;
const rmAsync = fsp.rm;

// --- In-memory store for active analysis requests ---
const activeAnalyses = {};
// ---

 // --- Initialize LLM Service ---
let llmService;
try {
  llmService = getLLMServiceInstance();
  console.log(`Successfully initialized LLM Service for provider: ${process.env.LLM_PROVIDER}`);
} catch (error) {
  console.error(`Failed to initialize LLM Service: ${error.message}`);
  llmService = null;
}
// --- ---

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Log request headers
app.use((req, res, next) => {
  console.log('Request received:', req.method, req.url);
  next();
});

// Mount the file operations routes
app.use('/api', fileOperationsRoutes);
// Mount the authentication routes
app.use('/api/auth', authRoutes);
// Mount the session routes (protected by middleware defined within sessions.js)
app.use('/api/sessions', sessionRoutes);

// --- Helper Function to send SSE updates ---
function sendSseUpdate(res, data) {
  // Ensure connection is still open before writing
  if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
  } else {
      console.log(`[SSE] Attempted to write to closed stream for analysis ID (unknown at this point).`);
  }
}
// ---

// --- Analysis Logic (Refactored) ---
async function performAnalysis(res, analysisId, analysisPrompt, datasetId) { // Renamed 'query' parameter to 'analysisPrompt'
    let tempDirToClean = null;
    let pythonLogs = ''; // Store logs specifically from python execution

    // --- Local Logger & SSE Emitter ---
    const logAndEmit = (message, ...optionalParams) => {
        const logMessage = `[${analysisId}] ${message}`;
        // 1. Log to console (as before)
        console.log(logMessage, ...optionalParams);
        // 2. Send raw log line via SSE
        // Avoid sending overly large objects/details via SSE log lines
        const sseMessage = typeof optionalParams[0] === 'object' ? logMessage + ' (details in server log)' : `${logMessage}${optionalParams.length > 0 ? ' ' + optionalParams.join(' ') : ''}`;
        sendSseUpdate(res, { rawLogLine: sseMessage });
    };
    const errorAndEmit = (message, ...optionalParams) => {
        const logMessage = `[${analysisId}] ${message}`;
        console.error(logMessage, ...optionalParams); // Log error to console
        // Send raw log line via SSE
         const sseMessage = typeof optionalParams[0] === 'object' ? logMessage + ' (error details in server log)' : `${logMessage}${optionalParams.length > 0 ? ' ' + optionalParams.join(' ') : ''}`;
         sendSseUpdate(res, { rawLogLine: sseMessage }); // Send errors as log lines too
    };
    // ---

    try {
        logAndEmit('Fetching dataset metadata...');
        const metadata = await metadataService.getMetadata(datasetId); // Assumes this returns { dbTableName, columnsMetadata, ... }
        if (!metadata || !metadata.dbTableName || !metadata.columnsMetadata) {
            throw new Error(`Failed to retrieve valid metadata for dataset ID: ${datasetId}`);
        }
        logAndEmit(`Metadata fetched for table: ${metadata.dbTableName}`);

        // --- Fetch Data from DB ---
        logAndEmit(`Fetching data from table: ${metadata.dbTableName}...`);
        const dataSql = `SELECT * FROM "${metadata.dbTableName}";`; // Select all columns
        const dataResult = await query(dataSql);
        const datasetRows = dataResult.rows;
        logAndEmit(`Fetched ${datasetRows.length} rows.`);
        // ---

        // --- Convert Data to CSV String ---
        let datasetCsvString = '';
        if (datasetRows.length > 0) {
            logAndEmit('Converting data to CSV format...');
            // Get original column names in the correct order from metadata
            const originalHeaders = metadata.columnsMetadata.map(col => col.originalName);

            // Map DB rows (with sanitized keys) back to objects with original keys for CSV generation
            const originalKeyRows = datasetRows.map(row => {
                const newRow = {};
                metadata.columnsMetadata.forEach(colMeta => {
                    // Handle potential nulls/undefined if a column was missing in a row (shouldn't happen with SELECT *)
                    newRow[colMeta.originalName] = row[colMeta.sanitizedName] !== undefined ? row[colMeta.sanitizedName] : null;
                });
                return newRow;
            });

            datasetCsvString = Papa.unparse(originalKeyRows, {
                header: true,
                columns: originalHeaders // Ensure CSV headers match original names and order
            });
            logAndEmit('Data converted to CSV string.');
        } else {
            logAndEmit('Dataset is empty, creating empty CSV string.');
            // Create CSV with only headers if the table is empty
             const originalHeaders = metadata.columnsMetadata.map(col => col.originalName);
             datasetCsvString = Papa.unparse([], { header: true, columns: originalHeaders });
        }
        // ---

        if (!llmService) throw new Error("LLM Service is not initialized.");

        logAndEmit(`Generating Python code using ${llmService.serviceName}...`);
        const pythonCode = await llmService.generatePythonCode(analysisPrompt, metadata); // Use analysisPrompt
        // Store the generated code to send later
        logAndEmit('Python code generated.'); // Don't log full code via SSE for brevity
        console.log(`[${analysisId}] Full Generated Python Code:\n${pythonCode}`); // Log full code only to server console

        // --- Save generated code to a temporary file for inspection ---
        const tempCodePath = path.join(__dirname, 'generated_code.py');
        await fsp.writeFile(tempCodePath, pythonCode, 'utf8');
        logAndEmit(`Saved generated code to ${tempCodePath}`);
        // ---

        logAndEmit('Preparing analysis environment (Docker)...');
        // Pass the CSV string instead of the datasetId
        const execResult = await dockerExecutor.runPythonInSandbox(pythonCode, datasetCsvString);
        tempDirToClean = execResult.tempDir; // Store for potential cleanup
        pythonLogs = execResult.logs || ''; // Capture logs

        logAndEmit('Docker execution finished.');
        if (pythonLogs.trim()) {
            logAndEmit('--- Python Script Output ---');
            pythonLogs.split('\n').forEach(line => {
                if (line.trim()) logAndEmit(`[Python] ${line}`); // Prefix Python logs
            });
            logAndEmit('--- End Python Script Output ---');
        }

        // Handle explicit errors from Docker executor
        if (execResult.error) {
            // Add python logs to the error context if available
            throw new Error(`Execution failed: ${execResult.error}${pythonLogs ? `\nLogs:\n${pythonLogs}` : ''}`);
        }

        let imageUris = [];
        let stats = null;

        logAndEmit('Processing analysis results...');

        // Read images
        if (execResult.imagePaths && execResult.imagePaths.length > 0) {
            logAndEmit(`Found ${execResult.imagePaths.length} plot image(s). Reading...`);
            for (const imagePath of execResult.imagePaths) {
                try {
                    const imageBuffer = await readFileAsync(imagePath);
                    const imageUri = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                    imageUris.push(imageUri);
                    logAndEmit(`Successfully read and encoded ${path.basename(imagePath)}`);
                } catch (readError) {
                    errorAndEmit(`Error reading image file ${imagePath}: ${readError.message}`);
                }
            }
        } else {
             console.log(`[${analysisId}] No plot images found.`);
             logAndEmit('No plot images generated.');
        }

        // Read stats - CRITICAL CHECK
        if (execResult.statsPath) {
            try {
                const statsBuffer = await readFileAsync(execResult.statsPath);
                stats = JSON.parse(statsBuffer.toString('utf8'));
                console.log(`[${analysisId}] Successfully read and parsed stats.json`);
                logAndEmit('Successfully processed statistics (stats.json).');
            } catch (readError) {
                errorAndEmit(`Error reading/parsing stats file ${execResult.statsPath}: ${readError.message}`);
                // Treat failure to read/parse stats as an error, including logs
                throw new Error(`Failed to process results (stats.json): ${readError.message}${pythonLogs ? `\nLogs:\n${pythonLogs}` : ''}`);
            }
        } else {
             // *** If execution succeeded BUT stats.json is missing, it's an implicit error ***
             const warnMsg = 'Execution succeeded (exit 0) but stats.json was not generated.';
             console.warn(`[${analysisId}] ${warnMsg}`);
             logAndEmit(`Warning: ${warnMsg}`); // Send warning via SSE as well
             // Throw an error including the Python logs
             throw new Error(`Analysis script ran but did not produce the expected stats output.${pythonLogs ? `\nScript Output:\n${pythonLogs}` : '\n(No script output captured)'}`);
        }

        // Cleanup temp dir *before* summary generation
        if (tempDirToClean) {
            try {
                logAndEmit(`Cleaning up temporary directory: ${tempDirToClean}`);
                await rmAsync(tempDirToClean, { recursive: true, force: true });
                tempDirToClean = null;
            } catch (rmError) {
                errorAndEmit(`Error cleaning up temporary directory ${tempDirToClean}: ${rmError.message}`);
            }
        }
        // Generate Summary (Only if stats were successfully loaded)
        let summary = 'Analysis complete.';
        if (stats && llmService) { // Check if stats object exists
            try {
                logAndEmit(`Generating summary using ${llmService.serviceName}...`);
                summary = await llmService.generateTextSummary(analysisPrompt, stats); // Use analysisPrompt
                logAndEmit('Summary generated.');
            } catch (summaryError) {
                errorAndEmit(`LLM summary generation failed: ${summaryError.message}`);
                summary = `Analysis complete, but summary generation failed: ${summaryError.message}`;
            }
        } else if (!stats) {
            summary = "Analysis complete, but no statistics were generated to summarize.";
        } else { // llmService missing
            const warnMsg = 'LLM Service not initialized, skipping summary generation.';
            console.warn(`[${analysisId}] ${warnMsg}`);
            logAndEmit(warnMsg);
             summary = "Analysis complete. LLM Service not available for summary generation.";
        }

        // Construct final result
        const finalResult = {
            imageUris: imageUris,
            summary: summary,
            stats: stats, // Send the actual stats object
            logs: null, // Logs were sent via rawLogLine
            generatedCode: pythonCode // Include the generated code
        };
        // Don't log result lengths/summary via logAndEmit to avoid flooding SSE
        console.log(`[${analysisId}] Sending final result. Summary length: ${summary?.length || 0}, Code length: ${pythonCode?.length || 0}`);
        sendSseUpdate(res, {
            result: finalResult
        });
        logAndEmit('Analysis complete.'); // Send final completion message

    } catch (error) {
        errorAndEmit(`Error during analysis: ${error.message}`); // Send error via SSE
        // Send error details, potentially including logs captured within the error message itself
        sendSseUpdate(res, { error: error.message || "An unknown error occurred during analysis." }); // Keep sending structured error too
    } finally {
        // Always clean up stored analysis data and temp dir if not already cleaned
        delete activeAnalyses[analysisId];
        console.log(`[${analysisId}] Removed analysis data from memory.`);
        if (tempDirToClean) {
            try {
                console.log(`[${analysisId}] Cleaning up leftover temporary directory: ${tempDirToClean}`);
                await rmAsync(tempDirToClean, { recursive: true, force: true });
            } catch (rmError) {
                console.error(`[${analysisId}] Error cleaning up leftover temp directory ${tempDirToClean}:`, rmError);
            }
        }
        // Close the SSE connection if it wasn't already closed by an error
        if (!res.writableEnded) {
            res.end();
            console.log(`[${analysisId}] SSE connection closed.`);
        }
    }
}
// ---

// --- New Endpoints ---

// 1. Start Analysis Endpoint (POST)
app.post('/api/start-analysis', (req, res) => {
    console.log('Received request for /api/start-analysis');
    const { query, datasetId } = req.body;

    if (!query || !datasetId) {
        return res.status(400).json({ error: 'Missing query or datasetId' });
    }

    const analysisId = crypto.randomUUID();
    activeAnalyses[analysisId] = { query, datasetId, startTime: Date.now() };

    console.log(`[${analysisId}] Analysis started for dataset: ${datasetId}`);
    res.json({ analysisId });
});

// 2. Analysis Stream Endpoint (GET - SSE)
app.get('/api/analysis-stream/:analysisId', (req, res) => {
    const { analysisId } = req.params;
    console.log(`[${analysisId}] SSE connection requested.`);

    const analysisData = activeAnalyses[analysisId];

    if (!analysisData) {
        console.error(`[${analysisId}] Invalid or expired analysis ID.`);
        // Ensure SSE headers aren't sent if connection is immediately closed
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or expired analysis ID' }));
    }

    // Set headers for SSE *only if* analysis ID is valid
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        // Optional: Add CORS headers if needed, although CORS middleware might handle it
        'Access-Control-Allow-Origin': '*',
    });

    // Send initial confirmation
    sendSseUpdate(res, { status: 'Connected, starting analysis...' });

    // Start the analysis process asynchronously
    performAnalysis(res, analysisId, analysisData.query, analysisData.datasetId);

    // Keep connection open, but handle client disconnect
    req.on('close', () => {
        console.log(`[${analysisId}] SSE client disconnected.`);
        // If analysis data still exists, it means performAnalysis hasn't finished/cleaned up
        if (activeAnalyses[analysisId]) {
             console.log(`[${analysisId}] Cleaning up analysis data due to client disconnect.`);
             delete activeAnalyses[analysisId];
             // TODO: Implement cancellation logic for dockerExecutor if possible/needed
        }
        // Ensure the response is ended if not already
        if (!res.writableEnded) {
            res.end();
        }
    });
});

// --- Remove old /api/analyze-data endpoint ---
// (Code removed)

 // Test route
 app.get('/', (req, res) => {
  res.send('Profile Matching API is running');
});

// Start server and logging setup
const logStream = fs.createWriteStream('server.log', { flags: 'a' });

app.listen(port, () => {
  const logMessage = `Server running on port ${port} at ${new Date().toISOString()}\n`;
  logStream.write(logMessage);
  console.log(logMessage.trim()); // Log to console as well
});

// Monkey-patch console.log and console.error to write to file
const originalConsoleLog = console.log;
console.log = function (...args) {
  originalConsoleLog.apply(console, args);
  const logString = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg)).join(' '); // Pretty print objects
  try {
    logStream.write(`[LOG] ${new Date().toISOString()} - ${logString}\n`);
  } catch (err) {
    originalConsoleError('Error writing to log file (console.log):', err);
  }
};

const originalConsoleError = console.error;
console.error = function (...args) {
  originalConsoleError.apply(console, args);
   // Include stack trace for Error objects
   const logString = args.map(arg => {
       if (arg instanceof Error) {
           return arg.stack || arg.toString();
       }
       return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg;
   }).join(' ');
  try {
    logStream.write(`[ERROR] ${new Date().toISOString()} - ${logString}\n`);
  } catch (err) {
    originalConsoleError('Error writing to log file (console.error):', err);
  }
};

process.on('exit', () => {
    logStream.end();
});
process.on('SIGINT', () => {
    console.log("SIGINT received, closing log stream...");
    logStream.end(() => { process.exit(0); });
});
process.on('SIGTERM', () => {
    console.log("SIGTERM received, closing log stream...");
    logStream.end(() => { process.exit(0); });
});
