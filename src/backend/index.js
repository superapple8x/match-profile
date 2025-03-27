// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = require('fs').promises; // Use fs.promises
const path = require('path'); // Added for path resolution if needed
const Docker = require('dockerode');
// const { promisify } = require('util'); // No longer needed with fs.promises
const db = require('./config/db');
const fileOperationsRoutes = require('./routes/fileOperations');
const metadataService = require('./services/metadataService'); // Import Metadata Service
const { getLLMServiceInstance } = require('./llm/llmFactory'); // Import LLM Factory
const dockerExecutor = require('./services/dockerExecutor'); // Import Docker Executor Service

const docker = new Docker();
const readFileAsync = fsp.readFile; // Use fsp.readFile directly
const rmAsync = fsp.rm; // Use fsp.rm directly

 // --- Initialize LLM Service ---
let llmService;
try {
  llmService = getLLMServiceInstance();
  console.log(`Successfully initialized LLM Service for provider: ${process.env.LLM_PROVIDER}`);
} catch (error) {
  console.error(`Failed to initialize LLM Service: ${error.message}`);
  llmService = null; // Ensure llmService is null if initialization fails
}
// --- ---

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Log request headers
app.use((req, res, next) => {
  console.log('Request received:', req.method, req.url);
  // console.log('Request Headers:', req.headers); // Optional: Can be verbose
  next();
});

// Mount the file operations routes
app.use('/api', fileOperationsRoutes);

 // // Data Analysis Endpoint (Old MCP/Plotly version - commented out)
 // app.post('/api/analyze', async (req, res) => {
 //   try {
 //     // 1. Receive request (user's request and data)
 //     const { request: userRequest, data } = req.body;
 //
 //     // 2. Call the analyze_data tool on the ollama-data-analysis MCP server
 //     // (This part will use the MCP SDK to call the tool)
 //     const mcpResult = await use_mcp_tool(
 //       "ollama-data-analysis",
 //       "analyze_data",
 //       {
 //         request: userRequest,
 //         data: data,
 //       }
 //     );
 //
 //
 //     // 3. Receive result (JSON string: { code: "...", analysis: "..." })
 //     const { code, analysis } = JSON.parse(mcpResult.content[0].text);
 //
 //     // 4. Execute the Python code using Docker (Placeholder)
 //     // 4. Execute the Python code using Docker
 //     const chartJson = await executePythonCode(code);
 //
 //     // 5. Return the Plotly chart JSON and LLM analysis
 //     res.json({
 //       chart: chartJson,
 //       analysis: analysis
 //     });
 //
 //   } catch (error) {
 //     console.error("Error in /api/analyze:", error);
 //     res.status(500).json({ error: "An error occurred during analysis." });
 //   }
 // });
 // async function executePythonCode(code) {
 //   const imageName = 'python-plotly-executor';
 //   const containerName = `python-plotly-executor-${Date.now()}`;
 //   const tempFileName = `temp_script_${Date.now()}.py`;
 //
 //   try {
 //     // Write the code to a temporary file
 //     await fsp.writeFile(tempFileName, code);
 //
 //     // Build the Docker image (if it doesn't exist)
 //     const images = await docker.listImages({ filters: { reference: [imageName] } });
 //     if (images.length === 0) {
 //       const buildStream = await docker.buildImage({ context: __dirname, src: ['Dockerfile'] }, { t: imageName });
 //       await new Promise((resolve, reject) => {
 //         docker.modem.followProgress(buildStream, (err, res) => err ? reject(err) : resolve(res));
 //       });
 //     }
 //
 //     // Create a container
 //     const container = await docker.createContainer({
 //       Image: imageName,
 //       Cmd: ['python', `/app/${tempFileName}`],
 //       HostConfig: {
 //         Binds: [
 //           `${__dirname}/${tempFileName}:/app/${tempFileName}`
 //         ],
 //         NetworkMode: 'none', // No network access
 //         Memory: 128 * 1024 * 1024, // 128MB memory limit
 //         CpuShares: 102,  // Limit CPU usage (relative to other containers)
 //       },
 //       Tty: false,
 //     });
 //
 //     // Start the container
 //     await container.start();
 //
 //     // Wait for the container to finish
 //     const data = await container.wait();
 //
 //      // Get the container's output
 //     const logs = await container.logs({ stdout: true, stderr: true });
 //     const output = logs.toString('utf8');
 //
 //     // Remove the container
 //     await container.remove();
 //     // Remove the temporary file
 //     await fsp.unlink(tempFileName);
 //
 //     // Attempt to parse the output as JSON (Plotly chart)
 //     try {
 //       const chartJson = JSON.parse(output);
 //       return chartJson;
 //     } catch (error) {
 //       console.error("Error parsing Plotly output:", error);
 //       console.error("Container output:", output);
 //       throw new Error("Invalid Plotly output from Python code.");
 //     }
 //
 //   } catch (error) {
 //     console.error("Error executing Python code in Docker:", error);
 //      // Attempt to remove the temporary file
 //     try {
 //       await fsp.unlink(tempFileName);
 //     } catch(unlinkError) {
 //       // ignore error
 //     }
 //     throw error;
 //   }
 // }

 // New Data Analysis Endpoint (Updated for multiple images)
 app.post('/api/analyze-data', async (req, res) => {
   console.log('Received request for /api/analyze-data');
   let tempDirToClean = null; // Keep track of temp dir for cleanup on error

   try {
     const { query, datasetId } = req.body;

     if (!query || !datasetId) {
       return res.status(400).json({ error: 'Missing query or datasetId in request body' });
     }

     // --- Phase 1 ---
     console.log(`Fetching metadata for dataset: ${datasetId}`);
     const metadata = await metadataService.getMetadata(datasetId);
     console.log('Metadata fetched');

     if (!llmService) {
       throw new Error("LLM Service is not initialized. Check configuration and implementation.");
     }
     console.log(`Generating Python code using ${process.env.LLM_PROVIDER} for query: "${query}"`);
     const pythonCode = await llmService.generatePythonCode(query, metadata);
     console.log('Python code generated (first 100 chars):', pythonCode.substring(0, 100));
     // --- ---

     // --- Phase 3: Execute Code in Docker ---
     console.log(`Executing Python code in Docker sandbox for dataset: ${datasetId}`);
     const execResult = await dockerExecutor.runPythonInSandbox(pythonCode, datasetId);
     tempDirToClean = execResult.tempDir;

     console.log('Docker execution finished. Logs:', execResult.logs);

     if (execResult.error) {
       console.error(`Docker execution error: ${execResult.error}`);
       return res.status(500).json({
           error: `Error executing analysis code: ${execResult.error}`,
           logs: execResult.logs
       });
     }

     let imageUris = []; // Array to hold multiple image data URIs
     let stats = null;

     // Read generated images if they exist
     if (execResult.imagePaths && execResult.imagePaths.length > 0) {
       console.log(`Found ${execResult.imagePaths.length} plot image(s). Reading...`);
       for (const imagePath of execResult.imagePaths) {
           try {
             const imageBuffer = await readFileAsync(imagePath);
             const imageUri = `data:image/png;base64,${imageBuffer.toString('base64')}`;
             imageUris.push(imageUri);
             console.log(`Successfully read and encoded ${path.basename(imagePath)}`);
           } catch (readError) {
             console.error(`Error reading generated image file ${imagePath}:`, readError);
             // Log error but continue without this specific image
           }
       }
     } else {
        console.log('No plot images found in execution results.');
     }

     // Read generated stats if it exists
     if (execResult.statsPath) {
       try {
         const statsBuffer = await readFileAsync(execResult.statsPath);
         stats = JSON.parse(statsBuffer.toString('utf8'));
         console.log('Successfully read and parsed stats.json');
       } catch (readError) {
         console.error(`Error reading or parsing stats file ${execResult.statsPath}:`, readError);
         // Log error but continue without stats
       }
     } else {
        console.log('No stats file found in execution results.');
     }

     // Cleanup the temporary directory
     if (tempDirToClean) {
       try {
         console.log(`Cleaning up temporary directory: ${tempDirToClean}`);
         await rmAsync(tempDirToClean, { recursive: true, force: true });
         tempDirToClean = null; // Nullify after successful removal
       } catch (rmError) {
         console.error(`Error cleaning up temporary directory ${tempDirToClean}:`, rmError);
       }
     }
     // --- ---

     // --- Phase 4: Generate Text Summary ---
     let summary = 'Analysis complete. Summary generation skipped or failed.';
     if (llmService) {
       try {
         console.log(`Generating text summary using ${process.env.LLM_PROVIDER} for query: "${query}"`);
         summary = await llmService.generateTextSummary(query, stats);
         console.log('Text summary generated:', summary);
       } catch (summaryError) {
         console.error(`LLM summary generation failed: ${summaryError.message}`);
         summary = `Analysis complete, but summary generation failed: ${summaryError.message}`;
       }
     } else {
        console.warn("LLM Service not initialized, skipping summary generation.");
        summary = "Analysis complete. LLM Service not available for summary generation.";
     }
     // --- ---

     // Final Response (Updated)
     res.json({
       imageUris: imageUris, // Send array of image URIs
       summary: summary,
       stats: stats,
       logs: execResult.logs
     });

   } catch (error) {
     console.error("Error in /api/analyze-data:", error);
     // Attempt cleanup if tempDirToClean was set before the error
     if (tempDirToClean) {
       try {
         console.error(`Cleaning up temporary directory ${tempDirToClean} due to error...`);
         await rmAsync(tempDirToClean, { recursive: true, force: true });
       } catch (rmError) {
         console.error(`Error cleaning up temporary directory ${tempDirToClean} during error handling:`, rmError);
       }
     }
     res.status(500).json({ error: `An error occurred during data analysis: ${error.message}` });
   }
 });

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
    logStream.end();
    process.exit();
});
process.on('SIGTERM', () => {
    logStream.end();
    process.exit();
});
