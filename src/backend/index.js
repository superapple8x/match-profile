// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); // Added for path resolution if needed
const Docker = require('dockerode');
const { promisify } = require('util');
const db = require('./config/db');
const fileOperationsRoutes = require('./routes/fileOperations');
const metadataService = require('./services/metadataService'); // Import Metadata Service
const { getLLMServiceInstance } = require('./llm/llmFactory'); // Import LLM Factory
const dockerExecutor = require('./services/dockerExecutor'); // Import Docker Executor Service

const docker = new Docker();
const writeFileAsync = promisify(fs.writeFile); // Note: fs.promises is generally preferred now
const readFileAsync = promisify(fs.readFile); // Needed for reading results
const unlinkAsync = promisify(fs.unlink);
const rmAsync = promisify(fs.rm); // Needed for cleaning up temp dir
 
 // --- Initialize LLM Service ---
 // This will throw an error until a provider is implemented and uncommented in the factory
let llmService;
try {
  llmService = getLLMServiceInstance();
  console.log(`Successfully initialized LLM Service for provider: ${process.env.LLM_PROVIDER}`);
} catch (error) {
  console.error(`Failed to initialize LLM Service: ${error.message}`);
  // Decide if the application should exit or continue with limited functionality
  // For now, we'll log the error and continue, but the analyze endpoint will fail if called.
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
  console.log('Request Headers:', req.headers);
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
 //     await writeFileAsync(tempFileName, code);
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
 //     await unlinkAsync(tempFileName);
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
 //       await unlinkAsync(tempFileName);
 //     } catch(unlinkError) {
 //       // ignore error
 //     }
 //     throw error;
 //   }
 // }
 
 // New Data Analysis Endpoint (Phase 1)
 app.post('/api/analyze-data', async (req, res) => {
   console.log('Received request for /api/analyze-data');
   try {
     const { query, datasetId } = req.body; // Assuming datasetId identifies the uploaded data
 
     if (!query || !datasetId) {
       return res.status(400).json({ error: 'Missing query or datasetId in request body' });
     }

     // --- Phase 1 ---
     console.log(`Fetching metadata for dataset: ${datasetId}`);
     const metadata = await metadataService.getMetadata(datasetId); // Call Metadata Service
     console.log('Metadata fetched:', metadata); // Log fetched metadata (optional)

     if (!llmService) {
       throw new Error("LLM Service is not initialized. Check configuration and implementation.");
     }
     console.log(`Generating Python code using ${process.env.LLM_PROVIDER} for query: "${query}"`);
     const pythonCode = await llmService.generatePythonCode(query, metadata); // Call LLM Service
     console.log('Python code generated (first 100 chars):', pythonCode.substring(0, 100)); // Log snippet (optional)
     // --- ---

     // --- Phase 3: Execute Code in Docker ---
     console.log(`Executing Python code in Docker sandbox for dataset: ${datasetId}`);
     const execResult = await dockerExecutor.runPythonInSandbox(pythonCode, datasetId);

     console.log('Docker execution finished. Logs:', execResult.logs); // Log execution output

     if (execResult.error) {
       console.error(`Docker execution error: ${execResult.error}`);
       // Optionally include logs in the error response to the client for debugging
       return res.status(500).json({
           error: `Error executing analysis code: ${execResult.error}`,
           logs: execResult.logs // Be cautious about exposing detailed logs
       });
     }

     let imageUri = null;
     let stats = null;

     // Read generated image if it exists
     if (execResult.imagePath) {
       try {
         const imageBuffer = await readFileAsync(execResult.imagePath);
         imageUri = `data:image/png;base64,${imageBuffer.toString('base64')}`;
         console.log('Successfully read and encoded plot.png');
       } catch (readError) {
         console.error(`Error reading generated image file ${execResult.imagePath}:`, readError);
         // Decide if this is a critical error - maybe just log and continue without image
       }
     }

     // Read generated stats if it exists
     if (execResult.statsPath) {
       try {
         const statsBuffer = await readFileAsync(execResult.statsPath);
         stats = JSON.parse(statsBuffer.toString('utf8'));
         console.log('Successfully read and parsed stats.json:', stats);
       } catch (readError) {
         console.error(`Error reading or parsing stats file ${execResult.statsPath}:`, readError);
         // Decide if this is critical - maybe just log and continue without stats
       }
     }

     // Cleanup the temporary directory now that we've read the files
     if (execResult.tempDir) {
       try {
         console.log(`Cleaning up temporary directory: ${execResult.tempDir}`);
         await rmAsync(execResult.tempDir, { recursive: true, force: true });
       } catch (rmError) {
         console.error(`Error cleaning up temporary directory ${execResult.tempDir}:`, rmError);
       }
     }
     // --- ---

     // TODO: Phase 4 - Implement LLM Summary Generation (using stats)
     // const summary = await llmService.generateTextSummary(query, stats);
     const summary = `Summary generation pending (Phase 4). Stats received: ${JSON.stringify(stats)}`; // Placeholder

     // Final Response (Phase 3 - without summary)
     res.json({
       imageUri: imageUri, // data:image/png;base64,... or null
       summary: summary, // Placeholder text for now
       stats: stats, // The actual stats object or null
       logs: execResult.logs // Optionally include logs for debugging
     });

   } catch (error) {
     // Catch errors from metadata, LLM, or Docker execution setup
     console.error("Error in /api/analyze-data:", error);
     res.status(500).json({ error: "An error occurred during data analysis." });
   }
 });
 
 // Test route
 app.get('/', (req, res) => {
  res.send('Profile Matching API is running');
});

// Start server
app.listen(port, () => {
  const logMessage = `Server running on port ${port}\n`;
  fs.appendFile('server.log', logMessage, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
    console.log(logMessage.trim());
  });
});

//const originalConsoleLog = console.log;
const originalConsoleLog = console.log;
console.log = function (...args) {
  originalConsoleLog.apply(console, args);
  const logString = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  try {
    fs.appendFileSync('server.log', logString + '\n');
  } catch (err) {
    originalConsoleError('Error writing to log file:', err);
  }
};

const originalConsoleError = console.error;

console.error = function (...args) {
  originalConsoleError.apply(console, args);
  const logString = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
try {
    fs.appendFileSync('server.log', logString + '\n');
  } catch (err) {
    originalConsoleError('Error writing to log file:', err);
  }
};
