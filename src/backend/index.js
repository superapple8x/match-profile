// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = require('fs').promises; // Use fs.promises
const path = require('path');
const crypto = require('crypto'); // For generating unique IDs
const Docker = require('dockerode');
const { query, pool } = require('./config/db'); // Import query function and pool
const Papa = require('papaparse'); // Import papaparse for CSV stringifying
const fileOperationsRoutes = require('./routes/fileOperations');
const authRoutes = require('./routes/auth'); // Import auth routes
const sessionRoutes = require('./routes/sessions'); // Import session routes
const metadataService = require('./services/metadataService');
const { getLLMServiceInstance } = require('./llm/llmFactory');
const dockerExecutor = require('./services/dockerExecutor');
const helmet = require('helmet'); // Import helmet
const rateLimit = require('express-rate-limit'); // Import express-rate-limit
const logger = require('./config/logger'); // Import the winston logger
const { body, validationResult } = require('express-validator'); // Import validation functions
const compression = require('compression'); // Import compression middleware
const swaggerUi = require('swagger-ui-express'); // Import Swagger UI
const swaggerSpec = require('./config/swaggerOptions'); // Import Swagger config

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
  logger.info(`Successfully initialized LLM Service for provider: ${process.env.LLM_PROVIDER}`);
} catch (error) {
  logger.error(`Failed to initialize LLM Service: ${error.message}`, { error });
  llmService = null;
}
// --- ---

const app = express();

// 2. Analysis Stream Endpoint (GET - SSE) - Defined BEFORE buffering middleware
app.get('/api/analysis-stream/:analysisId', (req, res) => {
    const { analysisId } = req.params;
    logger.info('SSE connection requested.', { analysisId: analysisId });

    const analysisData = activeAnalyses[analysisId];

    if (!analysisData) {
        logger.warn('Invalid or expired analysis ID.', { analysisId: analysisId });
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
        logger.info('SSE client disconnected.', { analysisId: analysisId });
        // If analysis data still exists, it means performAnalysis hasn't finished/cleaned up
        if (activeAnalyses[analysisId]) {
             logger.info('Cleaning up analysis data due to client disconnect.', { analysisId: analysisId });
             delete activeAnalyses[analysisId];
             // TODO: Implement cancellation logic for dockerExecutor if possible/needed
        }
        // Ensure the response is ended if not already
        if (!res.writableEnded) {
            res.end();
        }
    });
});

const port = process.env.PORT || 3001;

// --- Validation Middleware ---
// Middleware to handle validation errors from express-validator
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors
    logger.warn('Validation failed for request', { url: req.originalUrl, errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware
app.use(cors());
app.use(helmet()); // Apply helmet middleware for security headers
app.use(compression()); // Apply compression middleware

// Configure rate limiting
const apiLimiter = rateLimit({
 windowMs: 15 * 60 * 1000, // 15 minutes
 max: 100, // Limit each IP to 100 requests per windowMs
 message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(apiLimiter); // Apply the rate limiting middleware to all requests

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Log request headers
app.use((req, res, next) => {
  // Use logger.http for request logging (or logger.info if http level isn't needed elsewhere)
  logger.http(`Request received: ${req.method} ${req.url}`, { ip: req.ip });
  next();
});

// --- Swagger API Docs ---
// Serve interactive API documentation using Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
logger.info('Swagger UI available at /api-docs');
// --- End Swagger API Docs ---

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
      logger.warn(`[SSE] Attempted to write to closed stream for analysis ID (unknown at this point).`);
  }
}
// ---

// --- Analysis Logic (Refactored) ---
async function performAnalysis(res, analysisId, analysisPrompt, datasetId) { // Renamed 'query' parameter to 'analysisPrompt'
    let tempDirToClean = null;
    let pythonLogs = ''; // Store logs specifically from python execution

    // --- Local Logger & SSE Emitter ---
    const logMeta = { analysisId: analysisId }; // Metadata for logger

    // Log levels for analysis steps: debug (verbose), info (key milestones), warn, error
    const logAndEmit = (level, message, ...optionalParams) => {
        // 1. Log using Winston logger with metadata
        const logDetails = optionalParams.length > 0 ? optionalParams : [];
        // Ensure level is valid, default to 'debug' if not
        const validLevel = ['error', 'warn', 'info', 'http', 'verbose', 'debug'].includes(level) ? level : 'debug';
        logger[validLevel](message, ...logDetails, logMeta);

        // 2. Send raw log line via SSE (keep analysisId prefix for UI clarity)
        const sseMessage = typeof optionalParams[0] === 'object' ? message + ' (details in server log)' : `${message}${optionalParams.length > 0 ? ' ' + optionalParams.join(' ') : ''}`;
        sendSseUpdate(res, { rawLogLine: `[${analysisId}] ${sseMessage}` });
    };

    const errorAndEmit = (message, error, ...optionalParams) => { // Pass error object explicitly
        // 1. Log using Winston logger with metadata and error object
        logger.error(message, { error: error, ...logMeta }, ...optionalParams); // Pass error object for stack trace

        // 2. Send raw log line via SSE (keep analysisId prefix for UI clarity)
        const sseMessage = typeof optionalParams[0] === 'object' ? message + ' (error details in server log)' : `${message}${optionalParams.length > 0 ? ' ' + optionalParams.join(' ') : ''}`;
        // Add ERROR prefix for SSE to make it stand out
        sendSseUpdate(res, { rawLogLine: `[${analysisId}] [ERROR] ${sseMessage}` });
    };
    // ---

    try {
        logAndEmit('info', 'Fetching dataset metadata...');
        const metadata = await metadataService.getMetadata(datasetId); // Assumes this returns { dbTableName, columnsMetadata, ... }
        if (!metadata || !metadata.dbTableName || !metadata.columnsMetadata) {
            throw new Error(`Failed to retrieve valid metadata for dataset ID: ${datasetId}`);
        }
        logAndEmit('info', `Metadata fetched for table: ${metadata.dbTableName}`);

        // --- Fetch Data from DB ---
        logAndEmit('debug', `Fetching data from table: ${metadata.dbTableName}...`);
        const dataSql = `SELECT * FROM "${metadata.dbTableName}";`; // Select all columns
        const dataResult = await query(dataSql);
        const datasetRows = dataResult.rows;
        logAndEmit('debug', `Fetched ${datasetRows.length} rows.`);
        // ---

        // --- Convert Data to CSV String ---
        let datasetCsvString = '';
        if (datasetRows.length > 0) {
            logAndEmit('debug', 'Converting data to CSV format...');
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
            logAndEmit('debug', 'Data converted to CSV string.');
        } else {
            logAndEmit('info', 'Dataset is empty, creating empty CSV string.');
            // Create CSV with only headers if the table is empty
             const originalHeaders = metadata.columnsMetadata.map(col => col.originalName);
             datasetCsvString = Papa.unparse([], { header: true, columns: originalHeaders });
        }
        // ---

        if (!llmService) throw new Error("LLM Service is not initialized.");

        logAndEmit('info', `Generating Python code using ${llmService.serviceName}...`);
        const pythonCode = await llmService.generatePythonCode(analysisPrompt, metadata); // Use analysisPrompt
        // Store the generated code to send later
        logAndEmit('info', 'Python code generated.'); // Don't log full code via SSE for brevity
        logger.debug(`Full Generated Python Code:\n${pythonCode}`, logMeta); // Log full code only to server debug log

        // --- Save generated code to a temporary file for inspection ---
        const tempCodePath = path.join(__dirname, 'generated_code.py');
        await fsp.writeFile(tempCodePath, pythonCode, 'utf8');
        logAndEmit('debug', `Saved generated code to ${tempCodePath}`);
        // ---

        logAndEmit('info', 'Preparing analysis environment (Docker)...');
        // Pass the CSV string instead of the datasetId
        const execResult = await dockerExecutor.runPythonInSandbox(pythonCode, datasetCsvString);
        tempDirToClean = execResult.tempDir; // Store for potential cleanup
        pythonLogs = execResult.logs || ''; // Capture logs

        logAndEmit('info', 'Docker execution finished.');
        if (pythonLogs.trim()) {
            logAndEmit('debug', '--- Python Script Output ---');
            pythonLogs.split('\n').forEach(line => {
                if (line.trim()) logAndEmit('debug', `[Python] ${line}`); // Prefix Python logs, log as debug
            });
            logAndEmit('debug', '--- End Python Script Output ---');
        }

        // Handle explicit errors from Docker executor
        if (execResult.error) {
            // Add python logs to the error context if available
            throw new Error(`Execution failed: ${execResult.error}${pythonLogs ? `\nLogs:\n${pythonLogs}` : ''}`);
        }

        let imageUris = [];
        let stats = null;

        logAndEmit('info', 'Processing analysis results...');

        // Read images
        if (execResult.imagePaths && execResult.imagePaths.length > 0) {
            logAndEmit('debug', `Found ${execResult.imagePaths.length} plot image(s). Reading...`);
            for (const imagePath of execResult.imagePaths) {
                try {
                    const imageBuffer = await readFileAsync(imagePath);
                    const imageUri = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                    imageUris.push(imageUri);
                    logAndEmit('debug', `Successfully read and encoded ${path.basename(imagePath)}`);
                } catch (readError) {
                    // Pass the actual error object to errorAndEmit
                    errorAndEmit(`Error reading image file ${imagePath}`, readError);
                }
            }
        } else {
             logger.debug('No plot images found.', logMeta);
             logAndEmit('info', 'No plot images generated.');
        }

        // Read stats - CRITICAL CHECK
        if (execResult.statsPath) {
            try {
                const statsBuffer = await readFileAsync(execResult.statsPath);
                stats = JSON.parse(statsBuffer.toString('utf8'));
                logger.debug('Successfully read and parsed stats.json', logMeta);
                logAndEmit('info', 'Successfully processed statistics (stats.json).');
            } catch (readError) {
                // Pass the actual error object to errorAndEmit
                errorAndEmit(`Error reading/parsing stats file ${execResult.statsPath}`, readError);
                // Treat failure to read/parse stats as an error, including logs
                throw new Error(`Failed to process results (stats.json): ${readError.message}${pythonLogs ? `\nLogs:\n${pythonLogs}` : ''}`);
            }
        } else {
             // *** If execution succeeded BUT stats.json is missing, it's an implicit error ***
             const warnMsg = 'Execution succeeded (exit 0) but stats.json was not generated.';
             logger.warn(warnMsg, logMeta);
             logAndEmit('warn', warnMsg); // Send warning via SSE as well
             // Throw an error including the Python logs
             throw new Error(`Analysis script ran but did not produce the expected stats output.${pythonLogs ? `\nScript Output:\n${pythonLogs}` : '\n(No script output captured)'}`);
        }

        // Cleanup temp dir *before* summary generation
        if (tempDirToClean) {
            try {
                logAndEmit('debug', `Cleaning up temporary directory: ${tempDirToClean}`);
                await rmAsync(tempDirToClean, { recursive: true, force: true });
                tempDirToClean = null;
            } catch (rmError) {
                // Pass the actual error object to errorAndEmit
                errorAndEmit(`Error cleaning up temporary directory ${tempDirToClean}`, rmError);
            }
        }
        // Generate Summary (Only if stats were successfully loaded)
        let summary = 'Analysis complete.';
        if (stats && llmService) { // Check if stats object exists
            try {
                logAndEmit('info', `Generating summary using ${llmService.serviceName}...`);
                summary = await llmService.generateTextSummary(analysisPrompt, stats); // Use analysisPrompt
                logAndEmit('info', 'Summary generated.');
            } catch (summaryError) {
                // Pass the actual error object to errorAndEmit
                errorAndEmit(`LLM summary generation failed`, summaryError);
                summary = `Analysis complete, but summary generation failed: ${summaryError.message}`;
            }
        } else if (!stats) {
            summary = "Analysis complete, but no statistics were generated to summarize.";
        } else { // llmService missing
            const warnMsg = 'LLM Service not initialized, skipping summary generation.';
            logger.warn(warnMsg, logMeta);
            logAndEmit('warn', warnMsg);
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
        logger.debug(`Sending final result. Summary length: ${summary?.length || 0}, Code length: ${pythonCode?.length || 0}`, logMeta);
        sendSseUpdate(res, {
            result: finalResult
        });
        logAndEmit('info', 'Analysis complete.'); // Send final completion message

    } catch (error) {
        // Pass the actual error object to errorAndEmit
        errorAndEmit(`Error during analysis`, error); // Send error via SSE
        // Send error details, potentially including logs captured within the error message itself
        sendSseUpdate(res, { error: error.message || "An unknown error occurred during analysis." }); // Keep sending structured error too
    } finally {
        // Always clean up stored analysis data and temp dir if not already cleaned
        delete activeAnalyses[analysisId];
        logger.debug('Removed analysis data from memory.', logMeta);
        if (tempDirToClean) {
            try {
                logger.debug(`Cleaning up leftover temporary directory: ${tempDirToClean}`, logMeta);
                await rmAsync(tempDirToClean, { recursive: true, force: true });
            } catch (rmError) {
                logger.error(`Error cleaning up leftover temp directory ${tempDirToClean}`, { error: rmError, ...logMeta });
            }
        }
        // Close the SSE connection if it wasn't already closed by an error
        if (!res.writableEnded) {
            res.end();
            logger.debug('SSE connection closed.', logMeta);
        }
    }
}
// ---

// --- New Endpoints ---

// 1. Start Analysis Endpoint (POST)
// Define validation rules
const startAnalysisValidationRules = [
  body('query', 'Analysis query is required').notEmpty().trim(),
  body('datasetId', 'Dataset ID is required').notEmpty().trim() // Assuming datasetId is a string; add .isUUID() or .isInt() if applicable
];

app.post('/api/start-analysis', startAnalysisValidationRules, validateRequest, (req, res) => {
    logger.info('Received request for /api/start-analysis');
    // Validation handled by middleware, access validated data via req.body
    const { query, datasetId } = req.body;

    // Old check removed as validation middleware handles it
    // if (!query || !datasetId) {
    //     return res.status(400).json({ error: 'Missing query or datasetId' });
    // }

    const analysisId = crypto.randomUUID();
    activeAnalyses[analysisId] = { query, datasetId, startTime: Date.now() };

    logger.info(`Analysis started`, { analysisId: analysisId, datasetId: datasetId });
    res.json({ analysisId });
});

// SSE route handler moved to before middleware definitions

// --- Remove old /api/analyze-data endpoint ---
// (Code removed)

// Test route
app.get('/', (req, res) => {
 res.send('Profile Matching API is running');
});

// Health Check Endpoints
app.get('/healthz', (req, res) => {
  // Basic liveness check - is the server process running?
  res.status(200).send('OK');
});

app.get('/readyz', async (req, res) => {
  // Readiness check - is the server ready to accept traffic? (e.g., DB connected)
  try {
    const client = await pool.connect();
    await client.query('SELECT 1'); // Simple query to check connection
    client.release();
    res.status(200).send('OK');
  } catch (err) {
    logger.error('Readiness check failed: Database connection error', { error: err });
    res.status(503).send('Service Unavailable'); // 503 Service Unavailable
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  // Add any cleanup logic here (e.g., close database connections)
  // Give time for ongoing requests to finish if needed
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Optional: Handle unhandled promise rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider exiting the process depending on the error severity
  // process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  // It's generally recommended to exit after an uncaught exception
  process.exit(1);
});
