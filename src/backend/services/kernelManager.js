const { spawn } = require('child_process'); // Keep spawn for now as fallback/reference, but will replace core logic
const Docker = require('dockerode'); // Import Dockerode
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const { PassThrough } = require('stream'); // For handling Docker streams

// Configuration
// const UPLOAD_DIR = path.join(__dirname, '..', 'uploads'); // Assumed location of uploaded datasets - No longer used for reading
const KERNEL_SCRIPT_PATH = path.join(__dirname, '..', 'python-kernel', 'kernel_runner.py');
const PYTHON_COMMAND = 'python3'; // Fallback/reference, not used for Docker
const KERNEL_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle timeout
const KERNEL_STARTUP_TIMEOUT_MS = 20000; // Increased startup timeout for Docker (20 seconds)
const DOCKER_IMAGE_NAME = 'python-analysis-sandbox:latest'; // Image used by dockerExecutor
// Base directory for kernel temporary files (output dirs)
const KERNEL_TEMP_BASE_DIR = path.join(__dirname, '..', 'docker_temp', 'match-profile-kernels');

const docker = new Docker(); // Instantiate Dockerode
// Removed: const { query } = require('../config/db'); // Import the query function
const supabase = require('../config/supabaseClient'); // Import the Supabase client
const Papa = require('papaparse'); // Import PapaParse for CSV formatting
const logger = require('../config/logger'); // Import logger

class KernelManager extends EventEmitter {
  constructor() {
    super();
    // Store: { sessionId: { container, stream, datasetId, status, buffer, lastActivity, startupTimer, idleTimer, pendingCode: null, userId } }
    this.kernels = {};
    this.kernelCheckInterval = setInterval(this.cleanupIdleKernels.bind(this), 60 * 1000); // Check every minute
    logger.info('KernelManager initialized.'); // Use logger
  }

  // --- Public Methods ---

  startKernel(sessionId, datasetId, userId) { // Add userId parameter (UUID or null)
    // Return a promise that resolves when the kernel is ready or rejects on error/timeout
    return new Promise(async (resolve, reject) => {
    if (this.kernels[sessionId]) {
      logger.warn(`KernelManager: Kernel for session ${sessionId} already exists or starting.`); // Use logger
      // Could return existing session if status is 'ready' or 'busy'
      if (['ready', 'busy'].includes(this.kernels[sessionId].status)) {
        resolve(sessionId); // Resolve instead of return for promise consistency
        return;
      }
      // Use reject for promise error handling
      reject(new Error(`Kernel for session ${sessionId} is already starting/stopping.`));
      return;
    }

    // Check if Supabase client is available
    if (!supabase) {
        logger.error('KernelManager: Supabase client not initialized. Cannot start kernel.');
        reject(new Error('Supabase client is not initialized.'));
        return;
    }

    logger.info(`KernelManager: Starting kernel in Docker for session ${sessionId}, dataset identifier ${datasetId}, user ${userId}`); // Use logger
    this.kernels[sessionId] = {
      userId: userId, // Store the userId (UUID or null)
      container: null, // Changed from process
      stream: null, // To store the attached stream
      datasetId: datasetId, // Store the original identifier (filename)
      status: 'starting',
      buffer: '',
      lastActivity: Date.now(),
      startupTimer: null,
      idleTimer: null,
      pendingCode: null, // Ensure pendingCode is initialized
      tempOutputDir: null, // To store the path to the host output directory
      finalResultReceived: false, // Track if the specific result JSON was received
      // executionCallback: null, // Removed for event-based streaming
    };

    let tempOutputDir = null; // Define here for cleanup in catch block

    try {
      // --- Create Temp Output Directory ---
      await fs.mkdir(KERNEL_TEMP_BASE_DIR, { recursive: true });
      // Create a unique output directory for this session on the host
      tempOutputDir = await fs.mkdtemp(path.join(KERNEL_TEMP_BASE_DIR, `${sessionId}-output-`));
      await fs.chmod(tempOutputDir, 0o777); // Ensure container user can write
      this.kernels[sessionId].tempOutputDir = tempOutputDir; // Store path for cleanup
      logger.info(`KernelManager: Created temp output dir: ${tempOutputDir}`); // Use logger
      // ---

      // datasetId here is the original filename (datasetIdentifier) passed from the route
      const originalFileName = datasetId; // Keep original name for metadata lookup
      logger.info(`KernelManager: Looking up metadata for dataset identifier: "${originalFileName}" and user ID: ${userId}`); // Use logger

      // --- Fetch Dataset from Database (Refactored for Supabase) ---
      // 1. Get metadata (table name, columns) based on original filename and user ID
      // Removed old SQL query
      let metaQuery = supabase
          .from('dataset_metadata')
          .select('id, db_table_name, columns_metadata')
          .eq('dataset_identifier', originalFileName);

      if (userId) {
          metaQuery = metaQuery.eq('user_id', userId);
      } else {
          metaQuery = metaQuery.is('user_id', null);
      }
      // Get the latest if duplicates exist (shouldn't happen with overwrite logic)
      metaQuery = metaQuery.order('created_at', { ascending: false }).limit(1);

      const { data: metaData, error: metaError } = await metaQuery;

      if (metaError) {
          throw new Error(`Error fetching dataset metadata: ${metaError.message}`);
      }
      if (!metaData || metaData.length === 0) {
        throw new Error(`Dataset metadata not found for identifier "${originalFileName}" and user ${userId}.`);
      }

      const { db_table_name: dbTableName, columns_metadata: columnsMetadataJson } = metaData[0];
      const columnsMetadata = typeof columnsMetadataJson === 'string'
          ? JSON.parse(columnsMetadataJson)
          : columnsMetadataJson; // Handle if already JSONB
      logger.info(`KernelManager: Found metadata. DB Table: ${dbTableName}`); // Use logger

      // 2. Fetch all data from the table
      // Build select string mapping sanitized names back to original names for PapaParse
      const selectString = columnsMetadata.map(col => `"${col.sanitizedName}":${col.originalName}`).join(', ');
      logger.info(`KernelManager: Fetching data from table ${dbTableName}...`); // Use logger

      const { data: datasetData, error: dataError } = await supabase
          .from(dbTableName)
          .select(selectString); // Select with aliases for original names

      if (dataError) {
          throw new Error(`Error fetching data from table ${dbTableName}: ${dataError.message}`);
      }

      logger.info(`KernelManager: Fetched ${datasetData ? datasetData.length : 0} rows from database.`); // Use logger

      // 3. Convert data to CSV string
      const csvData = Papa.unparse(datasetData || [], { // Handle null data case
          header: true, // Include headers based on object keys (original names)
          quotes: true, // Ensure fields are quoted
      });

      // 4. Write CSV data to a temporary file within the session's output directory
      const tempDatasetPath = path.join(tempOutputDir, 'data.csv');
      await fs.writeFile(tempDatasetPath, csvData);
      await fs.chmod(tempDatasetPath, 0o666); // Ensure container user can read
      logger.info(`KernelManager: Wrote dataset to temporary file: ${tempDatasetPath}`); // Use logger
      // --- End Fetch Dataset ---

      // Check kernel script access
      await fs.access(KERNEL_SCRIPT_PATH);
      logger.info(`KernelManager: Kernel script access confirmed for host path: ${KERNEL_SCRIPT_PATH}`); // Use logger

      // --- Docker Container Setup ---
      const containerOptions = {
        Image: DOCKER_IMAGE_NAME,
        Cmd: ['python', '/app/kernel_runner.py', '/input/data.csv'], // Command to run inside container
        User: 'pythonuser', // Run as non-root user defined in Dockerfile
        WorkingDir: '/app', // Set working directory inside container
        Env: [], // Add any necessary environment variables
        HostConfig: {
          Binds: [
            // Mount kernel script read-only
            `${KERNEL_SCRIPT_PATH}:/app/kernel_runner.py:ro,z`,
            // Mount the TEMPORARY dataset file read-only
            `${tempDatasetPath}:/input/data.csv:ro,z`,
            // Mount the temporary output directory read-write
            `${tempOutputDir}:/output:rw,z`,
            // Mount passwd for user info (optional but helpful for diagnostics)
            `/etc/passwd:/etc/passwd:ro`,
          ],
          NetworkMode: 'none', // No network access for the kernel container
          AutoRemove: true, // Automatically remove container on exit
          // Add resource limits if needed (Memory, CPU)
          // Memory: 256 * 1024 * 1024, // Example: 256MB
        },
        Tty: false, // Don't allocate TTY
        OpenStdin: true, // Keep stdin open to send commands
        StdinOnce: false, // Keep stdin open after first write
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
      };

      logger.info(`KernelManager: Creating container for session ${sessionId}...`); // Use logger
      const container = await docker.createContainer(containerOptions);
      this.kernels[sessionId].container = container; // Store container object

      logger.info(`KernelManager: Attaching stream to container ${container.id}...`); // Use logger
      // Attach streams BEFORE starting
      const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
      this.kernels[sessionId].stream = stream; // Store the stream

      logger.info(`KernelManager: Starting container ${container.id}...`); // Use logger
      await container.start();

      this._setupKernelListeners(sessionId, stream); // Setup listeners on the stream

      // Timeout for kernel startup (wait for 'ready' message via stream)
      this.kernels[sessionId].startupTimer = setTimeout(() => {
        if (this.kernels[sessionId] && this.kernels[sessionId].status === 'starting') {
          logger.error(`KernelManager: Kernel ${sessionId} startup timed out.`); // Use logger
          this._handleKernelError(sessionId, new Error('Kernel startup timed out.'));
          this.stopKernel(sessionId, true); // Force stop
        }
      }, KERNEL_STARTUP_TIMEOUT_MS);

      // Set initial idle timer
      this._resetIdleTimer(sessionId);

      logger.info(`KernelManager: Container ${container.id} started for session ${sessionId}. Waiting for ready signal via stream...`); // Use logger

      // --- Wait for Ready Signal (via stream listener) ---
      const readyListener = (readySessionId) => {
        if (readySessionId === sessionId) {
          logger.info(`KernelManager: Received ready signal for kernel ${sessionId}.`); // Use logger
          clearTimeout(this.kernels[sessionId]?.startupTimer); // Clear startup timeout
          this.kernels[sessionId].status = 'ready'; // Set status officially
          this.off('kernelReady', readyListener); // Remove this listener
          this.off('kernelError', errorListener); // Remove error listener
          resolve(sessionId); // Resolve the promise
        }
      };
      const errorListener = (errorSessionId, error) => {
         if (errorSessionId === sessionId) {
            logger.error(`KernelManager: Kernel ${sessionId} errored before becoming ready.`); // Use logger
            clearTimeout(this.kernels[sessionId]?.startupTimer);
            this.off('kernelReady', readyListener);
            this.off('kernelError', errorListener);
            // _handleKernelError already cleans up state
            reject(error); // Reject the promise
         }
      };

      this.on('kernelReady', readyListener);
      this.on('kernelError', errorListener); // Listen for errors during startup

      // The promise will resolve/reject via the listeners or the startup timeout

    } catch (error) {
      logger.error(`KernelManager: Error starting kernel ${sessionId}:`, { error }); // Use logger
      // Clean up temp output dir if created before error
      if (tempOutputDir) {
          fs.rm(tempOutputDir, { recursive: true, force: true }).catch(rmErr => logger.error(`KernelManager: Error cleaning up temp output dir ${tempOutputDir} after start error:`, { error: rmErr })); // Use logger
      }
      this._handleKernelError(sessionId, error); // This will also delete kernel state
      // delete this.kernels[sessionId]; // Clean up state entry - _handleKernelError does this
      // If initial container creation/start failed, reject the promise
      reject(new Error(`Failed to start kernel container: ${error.message}`));
    }
   }); // End of Promise constructor
  }

  prepareCode(sessionId, code) {
    const kernelInfo = this.kernels[sessionId];
    // Check for container existence
    if (!kernelInfo || !kernelInfo.container) { // Check container
      throw new Error(`Kernel session ${sessionId} not found.`);
    }
    // Allow preparation even if busy? Or only if ready? Let's restrict to ready for now.
    if (kernelInfo.status !== 'ready') {
      throw new Error(`Kernel session ${sessionId} cannot prepare code, not ready (status: ${kernelInfo.status}).`);
    }
    // The 'busy' status now prevents concurrent writes/executions implicitly
    // because _handleKernelStdout won't reset to 'ready' until a completion message arrives.

    logger.info(`KernelManager: Preparing code for session ${sessionId}`); // Use logger
    kernelInfo.pendingCode = code; // Store the code
    // Don't change status or timers here yet

    // Code is stored, nothing more to do in this function
  }

  runPreparedCode(sessionId) {
    const kernelInfo = this.kernels[sessionId];
    // Check for container and stream
    if (!kernelInfo || !kernelInfo.container || !kernelInfo.stream) { // Check container and stream
      throw new Error(`Kernel session ${sessionId} not found or stream not attached for running code.`);
    }
    // Can only run if ready and there's pending code
    if (kernelInfo.status !== 'ready') {
      throw new Error(`Kernel session ${sessionId} is not ready to run code (status: ${kernelInfo.status}).`);
    }
    if (!kernelInfo.pendingCode) {
       logger.warn(`KernelManager: Attempted to run code for session ${sessionId}, but no code was prepared.`); // Use logger
       // Emit a completion event immediately indicating nothing ran? Or just ignore? Let's ignore for now.
       // this.emit('kernelExecutionComplete', sessionId, { status: 'success', result: {} }); // Indicate immediate completion
       return; // Or throw new Error('No code prepared to run.');
    }

    logger.info(`KernelManager: Running prepared code in session ${sessionId}`); // Use logger
    const codeToRun = kernelInfo.pendingCode;
    kernelInfo.pendingCode = null; // Clear pending code
    kernelInfo.finalResultReceived = false; // Reset flag for new execution
    kernelInfo.status = 'busy'; // Mark as busy *now*
    kernelInfo.lastActivity = Date.now();
    this._resetIdleTimer(sessionId);

    const command = { type: 'execute', code: codeToRun };
    try {
      logger.debug(`KernelManager DEBUG (${sessionId}): Writing command to kernel container stream.`); // Use logger
      // Write to the container's stream (stdin)
      kernelInfo.stream.write(JSON.stringify(command) + '\n');
    } catch (writeError) {
      logger.error(`KernelManager: Error writing prepared code to kernel ${sessionId} stream:`, { error: writeError }); // Use logger
      this.emit('kernelError', sessionId, { message: `Failed to send prepared code to kernel container: ${writeError.message}` });
      this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: { message: 'Failed to send prepared code to kernel container' } });
      kernelInfo.status = 'ready'; // Reset status
      this._resetIdleTimer(sessionId);
      // Should we throw here? The stream handler might be waiting. Let's not throw, rely on events.
    }
  }

  async stopKernel(sessionId, force = false) { // Made async
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) {
      // logger.warn(`KernelManager: Attempted to stop non-existent kernel ${sessionId}`); // Use logger
      return;
    }
    // Prevent multiple stop attempts
    if (kernelInfo.status === 'stopping' || kernelInfo.status === 'stopped') {
        logger.info(`KernelManager: Kernel ${sessionId} is already stopping or stopped.`); // Use logger
        return;
    }

    logger.info(`KernelManager: Stopping kernel container ${kernelInfo.container?.id} for session ${sessionId} (force: ${force})`); // Use logger
    kernelInfo.status = 'stopping';
    clearTimeout(kernelInfo.startupTimer);
    clearTimeout(kernelInfo.idleTimer);

    const container = kernelInfo.container;
    const stream = kernelInfo.stream;

    // Close the stream first to prevent further writes
    if (stream) {
        try {
            stream.end();
            // stream.destroy(); // More forceful closure if needed
        } catch (streamError) {
            logger.warn(`KernelManager: Error ending stream for ${sessionId}:`, { error: streamError }); // Use logger
        }
        kernelInfo.stream = null; // Clear stream reference
    }

    if (container) {
      try {
        // Attempt to stop the container (Docker handles graceful shutdown with timeout)
        // Docker's stop command sends SIGTERM, then SIGKILL after a timeout (default 10s)
        logger.info(`KernelManager: Attempting to stop container ${container.id}...`); // Use logger
        await container.stop({ t: force ? 0 : 10 }); // Force immediately if force=true, else 10s timeout
        logger.info(`KernelManager: Container ${container.id} stopped.`); // Use logger
      } catch (stopError) {
        // Handle errors, e.g., container already stopped (common)
        if (stopError.statusCode === 304) { // 304 Not Modified often means already stopped
          logger.info(`KernelManager: Container ${container.id} was already stopped.`); // Use logger
        } else if (stopError.statusCode === 404) { // 404 Not Found
           logger.info(`KernelManager: Container ${container.id} not found (likely already removed).`); // Use logger
        } else {
          logger.error(`KernelManager: Error stopping container ${container.id}:`, { error: stopError }); // Use logger
          // Continue to removal attempt even if stop fails
        }
      }
      // AutoRemove handles removal, no explicit remove needed.
    } else {
      logger.info(`KernelManager: No container object found for session ${sessionId} during stop.`); // Use logger
    }

    // Clean up the temporary output directory
    const outputDirToClean = kernelInfo.tempOutputDir;
    if (outputDirToClean) {
        fs.rm(outputDirToClean, { recursive: true, force: true })
            .then(() => logger.info(`KernelManager: Cleaned up temp output dir: ${outputDirToClean}`)) // Use logger
            .catch(rmErr => logger.error(`KernelManager: Error cleaning up temp output dir ${outputDirToClean}:`, { error: rmErr })); // Use logger
    }

    // Clean up state regardless of container stop success/failure
    delete this.kernels[sessionId];
    this.emit('kernelStopped', sessionId); // Emit stopped event
    logger.info(`KernelManager: Kernel state cleaned up for session ${sessionId}.`); // Use logger
  }

  getKernelStatus(sessionId) {
    return this.kernels[sessionId]?.status || 'stopped';
  }

  destroy() {
    logger.info('KernelManager: Shutting down...'); // Use logger
    clearInterval(this.kernelCheckInterval);
    Object.keys(this.kernels).forEach(sessionId => {
      this.stopKernel(sessionId, true); // Force stop all kernels on manager shutdown
    });
  }

  // --- Private Methods ---

  _setupKernelListeners(sessionId, stream) { // Changed 'process' to 'stream'
    // Use docker.modem.demuxStream to separate stdout and stderr from the container stream
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    // Handle stdout stream data
    stdout.on('data', (data) => this._handleKernelStdout(sessionId, data));
    // Handle stderr stream data
    stderr.on('data', (data) => this._handleKernelStderr(sessionId, data));

    // Get the kernelInfo for this session
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo || !kernelInfo.container) {
        logger.error(`KernelManager: Cannot demux stream for ${sessionId}, kernelInfo or container not found.`); // Use logger
        return; // Exit if kernelInfo or container is missing
    }

    // Demultiplex the container stream into stdout and stderr PassThrough streams
    kernelInfo.container.modem.demuxStream(stream, stdout, stderr);

    // Listen for the stream to end (container stopped/exited)
    stream.on('end', () => this._handleKernelStreamEnd(sessionId));
    stream.on('error', (err) => this._handleKernelError(sessionId, err)); // Handle stream errors directly

    // Note: Container exit/error events are handled separately via container.wait() or errors during start/attach
  }

  _handleKernelStdout(sessionId, data) {
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) return;
    // logger.debug(`KernelManager DEBUG (${sessionId}): Received raw stdout data chunk.`); // Use logger
    kernelInfo.lastActivity = Date.now();
    kernelInfo.buffer += data.toString('utf8');

    // Process buffer line by line (JSON messages are newline-terminated)
    let newlineIndex;
    while ((newlineIndex = kernelInfo.buffer.indexOf('\n')) !== -1) {
      const jsonLine = kernelInfo.buffer.substring(0, newlineIndex).trim();
      kernelInfo.buffer = kernelInfo.buffer.substring(newlineIndex + 1); // Remove processed line

      if (jsonLine) {
        try {
          logger.debug(`KernelManager DEBUG (${sessionId}): Processing line: ${jsonLine}`); // Use logger
          const result = JSON.parse(jsonLine);
          // logger.debug(`KernelManager: Received from kernel ${sessionId}:`, result); // Debug

          // Process the received JSON message from the kernel
          // Expected message types from kernel_runner.py (to be implemented):
          // { type: 'stdout', content: '...' }
          // { type: 'stderr', content: '...' }
          // { type: 'image', format: 'png', content: 'base64...' }
          // { type: 'result', output: { stdout: [...], stderr: [...], images: [...] } } // Final result bundle
          // { type: 'error', message: '...', traceback: '...' }
          // { type: 'status', status: 'idle' | 'busy' | 'ready' } // Optional status updates

          switch (result.type) {
            case 'stdout':
            case 'stderr':
            case 'image':
              // Emit partial output as it arrives
              logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelOutput event:`, { type: result.type }); // Use logger
              this.emit('kernelOutput', sessionId, result);
              break;
            case 'final_result': // Handle the specific result JSON from stdout
              if (kernelInfo.status === 'busy') { // Only process if we were expecting a result
                logger.debug(`KernelManager DEBUG (${sessionId}): Received final_result.`); // Use logger
                kernelInfo.finalResultReceived = true; // Mark that we got the real result
                const actualResult = result.data; // Extract the data payload
                logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (success - final_result) event.`); // Use logger
                this.emit('kernelExecutionComplete', sessionId, { status: 'success', result: actualResult });
                kernelInfo.status = 'ready'; // Kernel is ready for next command
                this._resetIdleTimer(sessionId);
              } else {
                 logger.warn(`KernelManager WARN (${sessionId}): Received final_result when not busy. Ignoring.`); // Use logger
              }
              break;
            case 'result': // Handle the generic completion message from kernel_runner.py
              // This signals the Python script exited cleanly, but might not contain the actual data
              // if 'final_result' was already handled.
              if (kernelInfo.status === 'busy' && !kernelInfo.finalResultReceived) {
                // If we were busy AND haven't received the specific 'final_result',
                // then emit completion with the (likely empty) output from this message.
                logger.debug(`KernelManager DEBUG (${sessionId}): Received standard 'result' message without prior 'final_result'. Emitting completion.`); // Use logger
                this.emit('kernelExecutionComplete', sessionId, { status: 'success', result: result.output });
                kernelInfo.status = 'ready'; // Kernel is ready for next command
                this._resetIdleTimer(sessionId);
              } else if (kernelInfo.status === 'busy' && kernelInfo.finalResultReceived) {
                 // We already handled the 'final_result', just log that the script exit signal was received.
                 logger.debug(`KernelManager DEBUG (${sessionId}): Received standard 'result' message after 'final_result'. Script exit confirmed.`); // Use logger
                 // Status was already set to 'ready' by 'final_result' handler.
              } else {
                 logger.warn(`KernelManager WARN (${sessionId}): Received standard 'result' message when not busy or after final result. Ignoring completion signal.`); // Use logger
              }
              break;
            case 'error':
              // Execution failed, emit error details and completion event
              logger.error(`KernelManager: Kernel ${sessionId} reported execution error: ${result.message}`); // Use logger
              logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelError event.`); // Use logger
              this.emit('kernelError', sessionId, result); // Emit the specific error
              logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error) event.`); // Use logger
              this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: result });
              kernelInfo.status = 'ready'; // Kernel is ready for next command (even after error)
              this._resetIdleTimer(sessionId);
              break;
            case 'status':
                // Optional: Handle status updates from kernel if implemented
                // logger.debug(`KernelManager: Kernel ${sessionId} status update: ${result.status}`);
                // Could potentially update kernelInfo.status based on this
                if (result.status === 'ready' && kernelInfo.status === 'starting') {
                    // Kernel explicitly signals ready after startup
                    logger.debug(`KernelManager DEBUG (${sessionId}): Received 'ready' status message.`); // Use logger
                    // Emit 'kernelReady' - the listener in startKernel will handle state change and promise resolution
                    this.emit('kernelReady', sessionId);
                } else if (result.status) {
                    // Log other status updates if needed
                    logger.info(`KernelManager INFO (${sessionId}): Received status update: ${result.status}`); // Use logger
                }
                break;
            case 'shutdown_ack': // Kernel acknowledges shutdown command
                logger.info(`KernelManager: Kernel ${sessionId} acknowledged shutdown.`); // Use logger
                // Actual cleanup happens on 'exit' event
                break;
            default:
              logger.warn(`KernelManager: Received unknown message type from kernel ${sessionId}:`, { type: result.type }); // Use logger
              // this.emit('kernelOutput', sessionId, { type: 'unknown', data: result }); // Avoid sending unknown types
          }

        } catch (parseError) {
          logger.error(`KernelManager: Failed to parse JSON from kernel ${sessionId}: >>>${jsonLine}<<<`, { error: parseError }); // Use logger
          // Emit a generic error event if parsing fails
          logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelError event (parse failure).`); // Use logger
          this.emit('kernelError', sessionId, { message: `Failed to parse kernel output.` }); // Simpler message
          // If we were busy, we might be stuck. Reset to ready cautiously.
          if (kernelInfo.status === 'busy') {
              logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error - parse failure) event.`); // Use logger
              this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: { message: 'Kernel output parsing failed' } });
              kernelInfo.status = 'ready';
              this._resetIdleTimer(sessionId);
          }
        }
      }
    }
  }

  _handleKernelStderr(sessionId, data) {
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) return;
    kernelInfo.lastActivity = Date.now();
    const stderrText = data.toString('utf8').trim();
    if (stderrText) {
        logger.error(`KernelManager: Kernel ${sessionId} stderr: ${stderrText}`); // Use logger
        // Emit stderr as a structured output event
        logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelOutput event (stderr).`); // Use logger
        this.emit('kernelOutput', sessionId, { type: 'stderr', content: stderrText });
        // Don't automatically fail the execution just on stderr, let the kernel decide
    }
  }

  _handleKernelStreamEnd(sessionId) {
    // This indicates the container stream has closed, usually because the container stopped.
    // The actual exit code/status should be retrieved via container.wait() if needed,
    // but often the cleanup logic is triggered by stopKernel or errors.
    logger.info(`KernelManager: Container stream ended for session ${sessionId}.`); // Use logger
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) return;

    // If the kernel was busy, it means it stopped unexpectedly during execution.
    if (kernelInfo.status === 'busy') {
        logger.warn(`KernelManager: Stream ended while kernel ${sessionId} was busy. Assuming unexpected exit.`); // Use logger
        logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelError event (unexpected stream end).`); // Use logger
        this.emit('kernelError', sessionId, { message: `Kernel stream ended unexpectedly during execution.` });
        logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error - unexpected stream end) event.`); // Use logger
        this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: { message: 'Kernel stream ended unexpectedly' } });
    }
    // Don't delete kernelInfo here, let stopKernel handle container removal and state cleanup.
    // We might need the container reference in stopKernel.
    // Mark as stopped internally? Or rely on stopKernel being called?
    // For now, assume stopKernel will be called or has been called.
  }

  _handleKernelError(sessionId, error) { // Handles stream errors or container errors passed here
    const kernelInfo = this.kernels[sessionId];
    logger.error(`KernelManager: Kernel/Stream ${sessionId} encountered error:`, { error }); // Use logger
    if (!kernelInfo) return; // Already cleaned up?

    clearTimeout(kernelInfo.startupTimer);
    clearTimeout(kernelInfo.idleTimer);

    // If an execution was in progress ('busy'), emit a completion event indicating failure
    if (kernelInfo.status === 'busy') {
        logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelError event (execution error).`); // Use logger
        this.emit('kernelError', sessionId, { message: `Kernel error during execution: ${error.message}` });
        logger.debug(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error - execution error) event.`); // Use logger
        this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: { message: error.message } });
    }

    // Attempt to stop the container if it exists and seems to be running
    if (kernelInfo.container && kernelInfo.status !== 'stopping' && kernelInfo.status !== 'stopped') { // Check container
       logger.info(`KernelManager: Attempting to stop container ${kernelInfo.container.id} due to error.`); // Use logger
       this.stopKernel(sessionId, true); // Force stop the container
    } else {
       // If already stopping or stopped, or no container, just ensure state is cleaned
       delete this.kernels[sessionId];
       this.emit('kernelStopped', sessionId); // Emit stopped event if not already handled by stopKernel
    }
    // Emit the error that triggered this handler
    this.emit('kernelError', sessionId, error); // Ensure original error is emitted
  }

  _resetIdleTimer(sessionId) {
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) return;

    clearTimeout(kernelInfo.idleTimer);
    kernelInfo.idleTimer = setTimeout(() => {
      if (this.kernels[sessionId] && this.kernels[sessionId].status === 'ready') { // Only stop idle 'ready' kernels
        logger.info(`KernelManager: Kernel ${sessionId} timed out due to inactivity.`); // Use logger
        this.stopKernel(sessionId); // Attempt graceful stop
      }
    }, KERNEL_IDLE_TIMEOUT_MS);
  }

  cleanupIdleKernels() {
    const now = Date.now();
    Object.keys(this.kernels).forEach(sessionId => {
      const kernelInfo = this.kernels[sessionId];
      if (kernelInfo.status === 'ready' && (now - kernelInfo.lastActivity > KERNEL_IDLE_TIMEOUT_MS)) {
        logger.info(`KernelManager: Cleaning up idle kernel ${sessionId}.`); // Use logger
        this.stopKernel(sessionId);
      }
    });
  }
}

// Export a singleton instance
module.exports = new KernelManager();
