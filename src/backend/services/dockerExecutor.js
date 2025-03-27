const Docker = require('dockerode');
const fs = require('fs').promises; // Use promises for async operations
const path = require('path');
const os = require('os');

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
 * @returns {Promise<{imagePath: string|null, statsPath: string|null, logs: string, error: string|null}>}
 *          Paths to the generated plot and stats files (if successful), logs, and any error message.
 */
async function runPythonInSandbox(pythonCode, datasetId) {
  await ensureImageExists(); // Make sure the image is ready

  let tempDir;
  let container;
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  let outputPaths = { imagePath: null, statsPath: null };
  let executionLogs = '';
  let executionError = null;

  try {
    // 1. Prepare Host Environment
    // Ensure the base temp directory exists
    await fs.mkdir(TEMP_BASE_DIR, { recursive: true });
    // Now create the unique execution directory within the base temp dir
    tempDir = await fs.mkdtemp(path.join(TEMP_BASE_DIR, `${executionId}-`));
    const scriptPath = path.join(tempDir, 'script.py');
    const inputDirPath = path.join(tempDir, 'input');
    const outputDirPath = path.join(tempDir, 'output');
    const inputDataHostPath = path.join(inputDirPath, 'data.csv');
    const sourceDataPath = path.join(UPLOAD_DIR, datasetId); // SECURITY: Ensure datasetId is sanitized earlier

    await fs.mkdir(inputDirPath);
    await fs.mkdir(outputDirPath);
    // Ensure the output directory on the host is writable by the container user (UID 1001)
    // Setting 777 is easiest for now, but consider more specific permissions if needed.
    await fs.chmod(outputDirPath, 0o777);
    await fs.writeFile(scriptPath, pythonCode);

    // Copy dataset (consider linking for large files if appropriate)
    // Ensure source file exists before copying
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
      User: 'pythonuser', // Run as non-root user defined in Dockerfile
      WorkingDir: '/app',
      HostConfig: {
        Binds: [
          `${scriptPath}:/app/script.py:ro`, // Mount script read-only
          `${inputDataHostPath}:/input/data.csv:ro`, // Mount data read-only
          `${outputDirPath}:/output`, // Mount output directory writable
        ],
        NetworkMode: 'none', // Disable networking
        Memory: MEMORY_LIMIT_MB * 1024 * 1024, // Memory limit in bytes
        // CpuShares: CPU_SHARES, // Adjust CPU allocation if needed
        // Consider adding --pids-limit if necessary
        AutoRemove: false, // Keep container for log retrieval, remove manually
      },
      Tty: false,
      AttachStdout: true, // Capture stdout
      AttachStderr: true, // Capture stderr
    });

    console.log(`Docker Executor [${executionId}]: Starting container ${container.id}...`);

    // Timeout mechanism
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${EXECUTION_TIMEOUT_MS / 1000} seconds.`)), EXECUTION_TIMEOUT_MS)
    );

    const executionPromise = new Promise(async (resolve, reject) => {
        try {
            const stream = await container.attach({ stream: true, stdout: true, stderr: true });
            stream.on('data', (chunk) => {
                executionLogs += chunk.toString('utf8');
            });
            stream.on('end', () => console.log(`Docker Executor [${executionId}]: Container stream ended.`));

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
      const potentialImagePath = path.join(outputDirPath, 'plot.png');
      const potentialStatsPath = path.join(outputDirPath, 'stats.json');
      try {
        await fs.access(potentialImagePath);
        outputPaths.imagePath = potentialImagePath;
        console.log(`Docker Executor [${executionId}]: Found output plot: ${potentialImagePath}`);
      } catch { /* File doesn't exist */ }
      try {
        await fs.access(potentialStatsPath);
        outputPaths.statsPath = potentialStatsPath;
         console.log(`Docker Executor [${executionId}]: Found output stats: ${potentialStatsPath}`);
      } catch { /* File doesn't exist */ }
    }

  } catch (error) {
    console.error(`Docker Executor [${executionId}]: Error during execution:`, error);
    executionError = error.message;
  } finally {
    // 4. Cleanup
    if (container) {
      try {
        console.log(`Docker Executor [${executionId}]: Removing container ${container.id}...`);
        // Ensure container is stopped before removing, especially after timeout
        try { await container.stop({ t: 5 }); } catch { /* Ignore error if already stopped */ }
        await container.remove();
      } catch (cleanupError) {
        console.error(`Docker Executor [${executionId}]: Error removing container ${container?.id}:`, cleanupError);
        // Log but don't throw, prioritize returning results/main error
      }
    }
    // Keep temp dir for now if files were generated, remove otherwise or if error?
    // For simplicity now, let's keep it if successful, remove on error.
    // A better approach might involve returning paths and letting the caller manage cleanup.
    if (executionError && tempDir) {
        try {
            console.log(`Docker Executor [${executionId}]: Removing temporary directory due to error: ${tempDir}`);
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (rmError) {
            console.error(`Docker Executor [${executionId}]: Error removing temporary directory ${tempDir}:`, rmError);
        }
    } else if (tempDir) {
         console.log(`Docker Executor [${executionId}]: Temporary directory with results kept at: ${tempDir}`);
         // Caller will need to handle cleanup later based on returned paths.
         // Or modify to return file contents (e.g., base64 image) and delete here.
    }
  }

  // Return results
  return {
    ...outputPaths, // imagePath, statsPath (paths on the host machine)
    logs: executionLogs,
    error: executionError,
    tempDir: !executionError ? tempDir : null // Return tempDir path only on success for potential cleanup by caller
  };
}

module.exports = {
  runPythonInSandbox,
};