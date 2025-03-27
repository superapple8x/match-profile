const Docker = require('dockerode');
const fs = require('fs').promises; // Use promises for async operations
const path = require('path');
const os = require('os');
const { PassThrough } = require('stream'); // Import PassThrough for log streaming

const docker = new Docker();

// Configuration
const IMAGE_NAME = 'python-analysis-sandbox:latest'; // Tag for the sandbox image
const DOCKERFILE_PATH = path.join(__dirname, '..', 'python-sandbox'); // Path to the Dockerfile directory
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads'); // Assumed location of uploaded datasets
const TEMP_BASE_DIR = path.join(os.tmpdir(), 'match-profile-analysis'); // Base for temporary execution dirs
const EXECUTION_TIMEOUT_MS = 30000; // 30 seconds timeout for script execution
const MEMORY_LIMIT_MB = 256; // Max memory for the container
const CPU_SHARES = 512; // Relative CPU weight (default is 1024)

/**
 * Builds the Docker image if it doesn't exist.
 */
async function ensureImageExists() {
  try {
    await docker.getImage(IMAGE_NAME).inspect();
    console.log(`Docker Executor: Image ${IMAGE_NAME} already exists.`);
  } catch (error) {
    // Image not found, let's build it
    if (error.statusCode === 404) {
      console.log(`Docker Executor: Image ${IMAGE_NAME} not found. Building...`);
      try {
        const stream = await docker.buildImage(
          { context: DOCKERFILE_PATH, src: ['Dockerfile'] },
          { t: IMAGE_NAME }
        );
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res), (event) => {
            console.log(event.stream ? event.stream.trim() : event.status); // Log build progress
          });
        });
        console.log(`Docker Executor: Image ${IMAGE_NAME} built successfully.`);
      } catch (buildError) {
        console.error(`Docker Executor: Failed to build image ${IMAGE_NAME}`, buildError);
        throw new Error(`Failed to build Docker image: ${buildError.message}`);
      }
    } else {
      // Other error inspecting image
      console.error(`Docker Executor: Error checking for image ${IMAGE_NAME}`, error);
      throw error;
    }
  }
}

/**
 * Executes Python code in a secure, isolated Docker container.
 *
 * @param {string} pythonCode The Python code to execute.
 * @param {string} datasetId The identifier (filename) of the dataset to use.
 * @returns {Promise<{imagePaths: string[], statsPath: string|null, logs: string, error: string|null, tempDir: string|null}>}
 *          Paths to the generated plot(s) and stats file (if successful), logs, any error message, and temp dir path on success.
 */
async function runPythonInSandbox(pythonCode, datasetId) {
  await ensureImageExists(); // Make sure the image is ready

  let tempDir;
  let container;
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  let outputPaths = { imagePaths: [], statsPath: null }; // Changed imagePath to imagePaths array
  let executionLogs = '';
  let executionError = null;

  try {
    // 1. Prepare Host Environment
    await fs.mkdir(TEMP_BASE_DIR, { recursive: true });
    tempDir = await fs.mkdtemp(path.join(TEMP_BASE_DIR, `${executionId}-`));
    const scriptPath = path.join(tempDir, 'script.py');
    const inputDirPath = path.join(tempDir, 'input');
    const outputDirPath = path.join(tempDir, 'output');
    const inputDataHostPath = path.join(inputDirPath, 'data.csv');
    const sourceDataPath = path.join(UPLOAD_DIR, datasetId); // SECURITY: Ensure datasetId is sanitized earlier

    await fs.mkdir(inputDirPath);
    await fs.mkdir(outputDirPath);
    await fs.chmod(outputDirPath, 0o777); // Make output dir writable by container user
    await fs.writeFile(scriptPath, pythonCode);

    // Copy dataset
    try {
        await fs.access(sourceDataPath);
        await fs.copyFile(sourceDataPath, inputDataHostPath);
    } catch (fileError) {
        throw new Error(`Dataset file not found or inaccessible: ${sourceDataPath} (${fileError.message})`);
    }


    console.log(`Docker Executor [${executionId}]: Prepared temp directory: ${tempDir}`);

    // 2. Create and Start Container
    console.log(`Docker Executor [${executionId}]: Creating container...`);
    container = await docker.createContainer({
      Image: IMAGE_NAME,
      Cmd: ['python', '/app/script.py'],
      User: 'pythonuser',
      WorkingDir: '/app',
      HostConfig: {
        Binds: [
          `${scriptPath}:/app/script.py:ro`,
          `${inputDataHostPath}:/input/data.csv:ro`,
          `${outputDirPath}:/output`,
        ],
        NetworkMode: 'none',
        Memory: MEMORY_LIMIT_MB * 1024 * 1024,
        // CpuShares: CPU_SHARES,
        AutoRemove: false,
      },
      Tty: false,
      AttachStdout: true,
      AttachStderr: true,
    });

    console.log(`Docker Executor [${executionId}]: Starting container ${container.id}...`);

    // Timeout mechanism
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${EXECUTION_TIMEOUT_MS / 1000} seconds.`)), EXECUTION_TIMEOUT_MS)
    );

    const executionPromise = new Promise(async (resolve, reject) => {
        try {
            // Use PassThrough to capture logs reliably
            const logStream = new PassThrough();
            logStream.on('data', (chunk) => {
                executionLogs += chunk.toString('utf8');
            });

            const stream = await container.attach({ stream: true, stdout: true, stderr: true });
            container.modem.demuxStream(stream, logStream, logStream); // Demux stdout/stderr into one stream

            stream.on('end', () => {
                logStream.end(); // End the PassThrough stream when Docker stream ends
                console.log(`Docker Executor [${executionId}]: Container stream ended.`);
            });

            await container.start();
            const status = await container.wait(); // Wait for container to finish
            console.log(`Docker Executor [${executionId}]: Container finished with status code ${status.StatusCode}.`);
            resolve(status);
        } catch (err) {
            reject(err);
        }
    });


    // Race execution against timeout
    const result = await Promise.race([executionPromise, timeoutPromise]);


    // 3. Process Results
    if (result.StatusCode !== 0) {
      executionError = `Python script exited with non-zero status code: ${result.StatusCode}.`;
      console.error(`Docker Executor [${executionId}]: ${executionError}`);
    } else {
      console.log(`Docker Executor [${executionId}]: Script executed successfully.`);
      // Check for output files
      try {
        const files = await fs.readdir(outputDirPath);
        for (const file of files) {
          // Find all PNG images
          if (file.toLowerCase().endsWith('.png')) {
            const imagePath = path.join(outputDirPath, file);
            outputPaths.imagePaths.push(imagePath);
            console.log(`Docker Executor [${executionId}]: Found output plot: ${imagePath}`);
          }
          // Find stats file
          else if (file === 'stats.json') {
            const statsPath = path.join(outputDirPath, file);
            outputPaths.statsPath = statsPath;
            console.log(`Docker Executor [${executionId}]: Found output stats: ${statsPath}`);
          }
        }
        // Sort image paths numerically if possible (plot_1.png, plot_2.png, plot_10.png)
        outputPaths.imagePaths.sort((a, b) => {
            const numA = parseInt(a.match(/_(\d+)\.png$/)?.[1] || '0');
            const numB = parseInt(b.match(/_(\d+)\.png$/)?.[1] || '0');
            return numA - numB;
        });

      } catch (readDirError) {
        console.error(`Docker Executor [${executionId}]: Error reading output directory ${outputDirPath}:`, readDirError);
        // executionError = `Failed to read output directory: ${readDirError.message}`; // Optionally set error
      }
    }

  } catch (error) {
    console.error(`Docker Executor [${executionId}]: Error during execution:`, error);
    executionError = error.message;
    // If timeout occurred, make sure the container is stopped
     if (error.message.includes('timed out') && container) {
        try {
            console.log(`Docker Executor [${executionId}]: Attempting to stop container ${container.id} due to timeout...`);
            await container.stop({ t: 5 }); // Force stop after 5 seconds
            console.log(`Docker Executor [${executionId}]: Container ${container.id} stopped.`);
        } catch (stopError) {
            console.error(`Docker Executor [${executionId}]: Error stopping timed out container ${container.id}:`, stopError);
        }
    }
  } finally {
    // 4. Cleanup
    if (container) {
      try {
        console.log(`Docker Executor [${executionId}]: Removing container ${container.id}...`);
        // Container should be stopped already from wait() or timeout handling
        await container.remove({ force: true }); // Force remove just in case
      } catch (cleanupError) {
        console.error(`Docker Executor [${executionId}]: Error removing container ${container?.id}:`, cleanupError);
      }
    }

    if (executionError && tempDir) {
        try {
            console.log(`Docker Executor [${executionId}]: Removing temporary directory due to error: ${tempDir}`);
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (rmError) {
            console.error(`Docker Executor [${executionId}]: Error removing temporary directory ${tempDir}:`, rmError);
        }
    } else if (tempDir && !outputPaths.imagePaths.length && !outputPaths.statsPath) {
         try {
            console.log(`Docker Executor [${executionId}]: Removing empty temporary directory: ${tempDir}`);
            await fs.rm(tempDir, { recursive: true, force: true });
            tempDir = null; // Nullify tempDir as it's removed
        } catch (rmError) {
            console.error(`Docker Executor [${executionId}]: Error removing empty temporary directory ${tempDir}:`, rmError);
        }
    } else if (tempDir) {
         console.log(`Docker Executor [${executionId}]: Temporary directory with results kept at: ${tempDir}`);
         // The caller needs to handle cleanup using the returned tempDir path.
    }
  }

  // Return results
  return {
    ...outputPaths, // imagePaths (array), statsPath
    logs: executionLogs,
    error: executionError,
    tempDir: !executionError && (outputPaths.imagePaths.length > 0 || outputPaths.statsPath) ? tempDir : null // Return tempDir only on success with results
  };
}

module.exports = {
  runPythonInSandbox,
  ensureImageExists, // Export ensureImageExists if needed elsewhere (e.g., initial setup)
};