const express = require('express');
const cors = require('cors');
const fs = require('fs');
const Docker = require('dockerode');
const { promisify } = require('util');
const db = require('./config/db');
const fileOperationsRoutes = require('./routes/fileOperations');

const docker = new Docker();
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

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

// Data Analysis Endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    // 1. Receive request (user's request and data)
    const { request: userRequest, data } = req.body;

    // 2. Call the analyze_data tool on the ollama-data-analysis MCP server
    // (This part will use the MCP SDK to call the tool)
    const mcpResult = await use_mcp_tool(
      "ollama-data-analysis",
      "analyze_data",
      {
        request: userRequest,
        data: data,
      }
    );


    // 3. Receive result (JSON string: { code: "...", analysis: "..." })
    const { code, analysis } = JSON.parse(mcpResult.content[0].text);

    // 4. Execute the Python code using Docker (Placeholder)
    // 4. Execute the Python code using Docker
    const chartJson = await executePythonCode(code);

    // 5. Return the Plotly chart JSON and LLM analysis
    res.json({
      chart: chartJson,
      analysis: analysis
    });

  } catch (error) {
    console.error("Error in /api/analyze:", error);
    res.status(500).json({ error: "An error occurred during analysis." });
  }
});
async function executePythonCode(code) {
  const imageName = 'python-plotly-executor';
  const containerName = `python-plotly-executor-${Date.now()}`;
  const tempFileName = `temp_script_${Date.now()}.py`;

  try {
    // Write the code to a temporary file
    await writeFileAsync(tempFileName, code);

    // Build the Docker image (if it doesn't exist)
    const images = await docker.listImages({ filters: { reference: [imageName] } });
    if (images.length === 0) {
      const buildStream = await docker.buildImage({ context: __dirname, src: ['Dockerfile'] }, { t: imageName });
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(buildStream, (err, res) => err ? reject(err) : resolve(res));
      });
    }

    // Create a container
    const container = await docker.createContainer({
      Image: imageName,
      Cmd: ['python', `/app/${tempFileName}`],
      HostConfig: {
        Binds: [
          `${__dirname}/${tempFileName}:/app/${tempFileName}`
        ],
        NetworkMode: 'none', // No network access
        Memory: 128 * 1024 * 1024, // 128MB memory limit
        CpuShares: 102,  // Limit CPU usage (relative to other containers)
      },
      Tty: false,
    });

    // Start the container
    await container.start();

    // Wait for the container to finish
    const data = await container.wait();

     // Get the container's output
    const logs = await container.logs({ stdout: true, stderr: true });
    const output = logs.toString('utf8');

    // Remove the container
    await container.remove();
    // Remove the temporary file
    await unlinkAsync(tempFileName);

    // Attempt to parse the output as JSON (Plotly chart)
    try {
      const chartJson = JSON.parse(output);
      return chartJson;
    } catch (error) {
      console.error("Error parsing Plotly output:", error);
      console.error("Container output:", output);
      throw new Error("Invalid Plotly output from Python code.");
    }

  } catch (error) {
    console.error("Error executing Python code in Docker:", error);
     // Attempt to remove the temporary file
    try {
      await unlinkAsync(tempFileName);
    } catch(unlinkError) {
      // ignore error
    }
    throw error;
  }
}

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
