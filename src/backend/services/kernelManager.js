const { spawn } = require('child_process'); // Keep spawn for now as fallback/reference, but will replace core logic
const Docker = require('dockerode'); // Import Dockerode
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const { PassThrough } = require('stream'); // For handling Docker streams

// Configuration
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads'); // Assumed location of uploaded datasets
const KERNEL_SCRIPT_PATH = path.join(__dirname, '..', 'python-kernel', 'kernel_runner.py');
const PYTHON_COMMAND = 'python3'; // Fallback/reference, not used for Docker
const KERNEL_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle timeout
const KERNEL_STARTUP_TIMEOUT_MS = 20000; // Increased startup timeout for Docker (20 seconds)
const DOCKER_IMAGE_NAME = 'python-analysis-sandbox:latest'; // Image used by dockerExecutor
// Base directory for kernel temporary files (output dirs)
const KERNEL_TEMP_BASE_DIR = path.join(__dirname, '..', 'docker_temp', 'match-profile-kernels');

const docker = new Docker(); // Instantiate Dockerode

class KernelManager extends EventEmitter {
  constructor() {
    super();
    // Store: { sessionId: { container, stream, datasetId, status, buffer, lastActivity, startupTimer, idleTimer, pendingCode: null, userId } }
    this.kernels = {};
    this.kernelCheckInterval = setInterval(this.cleanupIdleKernels.bind(this), 60 * 1000); // Check every minute
    console.log('KernelManager initialized.');
  }

  // --- Public Methods ---

  startKernel(sessionId, datasetId, userId) { // Add userId parameter
    // Return a promise that resolves when the kernel is ready or rejects on error/timeout
    return new Promise(async (resolve, reject) => {
    if (this.kernels[sessionId]) {
      console.warn(`KernelManager: Kernel for session ${sessionId} already exists or starting.`);
      // Could return existing session if status is 'ready' or 'busy'
      if (['ready', 'busy'].includes(this.kernels[sessionId].status)) {
        return sessionId; // Indicate success, session already running
      }
      throw new Error(`Kernel for session ${sessionId} is already starting/stopping.`);
    }

    console.log(`KernelManager: Starting kernel in Docker for session ${sessionId}, dataset ${datasetId}`);
    this.kernels[sessionId] = {
      userId: userId, // Store the userId
      container: null, // Changed from process
      stream: null, // To store the attached stream
      datasetId: datasetId,
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
      console.log(`KernelManager: Created temp output dir: ${tempOutputDir}`);
      // ---

      // datasetId here is the original filename (datasetIdentifier) passed from the route
      const originalFileName = datasetId;

      // Apply the SAME sanitization logic used elsewhere (e.g., fileOperations)
      // to get the expected filename on disk.
      const sanitizedDiskFileName = path.basename(originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      console.log(`KernelManager: Original filename "${originalFileName}", Sanitized for disk access: "${sanitizedDiskFileName}"`);

      const datasetPath = path.join(UPLOAD_DIR, sanitizedDiskFileName); // Use sanitized name for path
      console.log(`KernelManager: Checking access for path: ${datasetPath}`);
      // Basic check if dataset file exists (using the sanitized name)
      await fs.access(datasetPath);
      console.log(`KernelManager: File access confirmed for host path: ${datasetPath}`);
      await fs.access(KERNEL_SCRIPT_PATH);
      console.log(`KernelManager: Kernel script access confirmed for host path: ${KERNEL_SCRIPT_PATH}`);

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
            // Mount dataset file read-only
            `${datasetPath}:/input/data.csv:ro,z`,
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

      console.log(`KernelManager: Creating container for session ${sessionId}...`);
      const container = await docker.createContainer(containerOptions);
      this.kernels[sessionId].container = container; // Store container object

      console.log(`KernelManager: Attaching stream to container ${container.id}...`);
      // Attach streams BEFORE starting
      const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
      this.kernels[sessionId].stream = stream; // Store the stream

      console.log(`KernelManager: Starting container ${container.id}...`);
      await container.start();

      this._setupKernelListeners(sessionId, stream); // Setup listeners on the stream

      // Timeout for kernel startup (wait for 'ready' message via stream)
      this.kernels[sessionId].startupTimer = setTimeout(() => {
        if (this.kernels[sessionId] && this.kernels[sessionId].status === 'starting') {
          console.error(`KernelManager: Kernel ${sessionId} startup timed out.`);
          this._handleKernelError(sessionId, new Error('Kernel startup timed out.'));
          this.stopKernel(sessionId, true); // Force stop
        }
      }, KERNEL_STARTUP_TIMEOUT_MS);

      // Set initial idle timer
      this._resetIdleTimer(sessionId);

      console.log(`KernelManager: Container ${container.id} started for session ${sessionId}. Waiting for ready signal via stream...`);

      // --- Wait for Ready Signal (via stream listener) ---
      const readyListener = (readySessionId) => {
        if (readySessionId === sessionId) {
          console.log(`KernelManager: Received ready signal for kernel ${sessionId}.`);
          clearTimeout(this.kernels[sessionId]?.startupTimer); // Clear startup timeout
          this.kernels[sessionId].status = 'ready'; // Set status officially
          this.off('kernelReady', readyListener); // Remove this listener
          this.off('kernelError', errorListener); // Remove error listener
          resolve(sessionId); // Resolve the promise
        }
      };
      const errorListener = (errorSessionId, error) => {
         if (errorSessionId === sessionId) {
            console.error(`KernelManager: Kernel ${sessionId} errored before becoming ready.`);
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
      console.error(`KernelManager: Error starting kernel ${sessionId}:`, error);
      // Clean up temp output dir if created before error
      if (tempOutputDir) {
          fs.rm(tempOutputDir, { recursive: true, force: true }).catch(rmErr => console.error(`KernelManager: Error cleaning up temp output dir ${tempOutputDir} after start error:`, rmErr));
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

    console.log(`KernelManager: Preparing code for session ${sessionId}`);
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
       console.warn(`KernelManager: Attempted to run code for session ${sessionId}, but no code was prepared.`);
       // Emit a completion event immediately indicating nothing ran? Or just ignore? Let's ignore for now.
       // this.emit('kernelExecutionComplete', sessionId, { status: 'success', result: {} }); // Indicate immediate completion
       return; // Or throw new Error('No code prepared to run.');
    }

    console.log(`KernelManager: Running prepared code in session ${sessionId}`);
    const codeToRun = kernelInfo.pendingCode;
    kernelInfo.pendingCode = null; // Clear pending code
    kernelInfo.finalResultReceived = false; // Reset flag for new execution
    kernelInfo.status = 'busy'; // Mark as busy *now*
    kernelInfo.lastActivity = Date.now();
    this._resetIdleTimer(sessionId);

    const command = { type: 'execute', code: codeToRun };
    try {
      console.log(`KernelManager DEBUG (${sessionId}): Writing command to kernel container stream.`);
      // Write to the container's stream (stdin)
      kernelInfo.stream.write(JSON.stringify(command) + '\n');
    } catch (writeError) {
      console.error(`KernelManager: Error writing prepared code to kernel ${sessionId} stream:`, writeError);
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
      // console.warn(`KernelManager: Attempted to stop non-existent kernel ${sessionId}`);
      return;
    }
    // Prevent multiple stop attempts
    if (kernelInfo.status === 'stopping' || kernelInfo.status === 'stopped') {
        console.log(`KernelManager: Kernel ${sessionId} is already stopping or stopped.`);
        return;
    }

    console.log(`KernelManager: Stopping kernel container ${kernelInfo.container?.id} for session ${sessionId} (force: ${force})`);
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
            console.warn(`KernelManager: Error ending stream for ${sessionId}:`, streamError);
        }
        kernelInfo.stream = null; // Clear stream reference
    }

    if (container) {
      try {
        // Attempt to stop the container (Docker handles graceful shutdown with timeout)
        // Docker's stop command sends SIGTERM, then SIGKILL after a timeout (default 10s)
        console.log(`KernelManager: Attempting to stop container ${container.id}...`);
        await container.stop({ t: force ? 0 : 10 }); // Force immediately if force=true, else 10s timeout
        console.log(`KernelManager: Container ${container.id} stopped.`);
      } catch (stopError) {
        // Handle errors, e.g., container already stopped (common)
        if (stopError.statusCode === 304) { // 304 Not Modified often means already stopped
          console.log(`KernelManager: Container ${container.id} was already stopped.`);
        } else if (stopError.statusCode === 404) { // 404 Not Found
           console.log(`KernelManager: Container ${container.id} not found (likely already removed).`);
        } else {
          console.error(`KernelManager: Error stopping container ${container.id}:`, stopError);
          // Continue to removal attempt even if stop fails
        }
      }
      // AutoRemove handles removal, no explicit remove needed.
    } else {
      console.log(`KernelManager: No container object found for session ${sessionId} during stop.`);
    }

    // Clean up the temporary output directory
    const outputDirToClean = kernelInfo.tempOutputDir;
    if (outputDirToClean) {
        fs.rm(outputDirToClean, { recursive: true, force: true })
            .then(() => console.log(`KernelManager: Cleaned up temp output dir: ${outputDirToClean}`))
            .catch(rmErr => console.error(`KernelManager: Error cleaning up temp output dir ${outputDirToClean}:`, rmErr));
    }

    // Clean up state regardless of container stop success/failure
    delete this.kernels[sessionId];
    this.emit('kernelStopped', sessionId); // Emit stopped event
    console.log(`KernelManager: Kernel state cleaned up for session ${sessionId}.`);
  }

  getKernelStatus(sessionId) {
    return this.kernels[sessionId]?.status || 'stopped';
  }

  destroy() {
    console.log('KernelManager: Shutting down...');
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
        console.error(`KernelManager: Cannot demux stream for ${sessionId}, kernelInfo or container not found.`);
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
    // console.log(`KernelManager DEBUG (${sessionId}): Received raw stdout data chunk.`); // Log raw data receipt
    kernelInfo.lastActivity = Date.now();
    kernelInfo.buffer += data.toString('utf8');

    // Process buffer line by line (JSON messages are newline-terminated)
    let newlineIndex;
    while ((newlineIndex = kernelInfo.buffer.indexOf('\n')) !== -1) {
      const jsonLine = kernelInfo.buffer.substring(0, newlineIndex).trim();
      kernelInfo.buffer = kernelInfo.buffer.substring(newlineIndex + 1); // Remove processed line

      if (jsonLine) {
        try {
          console.log(`KernelManager DEBUG (${sessionId}): Processing line: ${jsonLine}`); // Log line being processed
          const result = JSON.parse(jsonLine);
          // console.log(`KernelManager: Received from kernel ${sessionId}:`, result); // Debug

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
              console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelOutput event:`, result.type); // Log event emission
              this.emit('kernelOutput', sessionId, result);
              break;
            case 'final_result': // Handle the specific result JSON from stdout
              if (kernelInfo.status === 'busy') { // Only process if we were expecting a result
                console.log(`KernelManager DEBUG (${sessionId}): Received final_result.`);
                kernelInfo.finalResultReceived = true; // Mark that we got the real result
                const actualResult = result.data; // Extract the data payload
                console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (success - final_result) event.`);
                this.emit('kernelExecutionComplete', sessionId, { status: 'success', result: actualResult });
                kernelInfo.status = 'ready'; // Kernel is ready for next command
                this._resetIdleTimer(sessionId);
              } else {
                 console.warn(`KernelManager WARN (${sessionId}): Received final_result when not busy. Ignoring.`);
              }
              break;
            case 'result': // Handle the generic completion message from kernel_runner.py
              // This signals the Python script exited cleanly, but might not contain the actual data
              // if 'final_result' was already handled.
              if (kernelInfo.status === 'busy' && !kernelInfo.finalResultReceived) {
                // If we were busy AND haven't received the specific 'final_result',
                // then emit completion with the (likely empty) output from this message.
                console.log(`KernelManager DEBUG (${sessionId}): Received standard 'result' message without prior 'final_result'. Emitting completion.`);
                this.emit('kernelExecutionComplete', sessionId, { status: 'success', result: result.output });
                kernelInfo.status = 'ready'; // Kernel is ready for next command
                this._resetIdleTimer(sessionId);
              } else if (kernelInfo.status === 'busy' && kernelInfo.finalResultReceived) {
                 // We already handled the 'final_result', just log that the script exit signal was received.
                 console.log(`KernelManager DEBUG (${sessionId}): Received standard 'result' message after 'final_result'. Script exit confirmed.`);
                 // Status was already set to 'ready' by 'final_result' handler.
              } else {
                 console.warn(`KernelManager WARN (${sessionId}): Received standard 'result' message when not busy or after final result. Ignoring completion signal.`);
              }
              break;
            case 'error':
              // Execution failed, emit error details and completion event
              console.error(`KernelManager: Kernel ${sessionId} reported execution error: ${result.message}`); // Keep this error log
              console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelError event.`); // Log event emission
              this.emit('kernelError', sessionId, result); // Emit the specific error
              console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error) event.`); // Log event emission
              this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: result });
              kernelInfo.status = 'ready'; // Kernel is ready for next command (even after error)
              this._resetIdleTimer(sessionId);
              break;
            case 'status':
                // Optional: Handle status updates from kernel if implemented
                // console.log(`KernelManager: Kernel ${sessionId} status update: ${result.status}`);
                // Could potentially update kernelInfo.status based on this
                if (result.status === 'ready' && kernelInfo.status === 'starting') {
                    // Kernel explicitly signals ready after startup
                    console.log(`KernelManager DEBUG (${sessionId}): Received 'ready' status message.`);
                    // Emit 'kernelReady' - the listener in startKernel will handle state change and promise resolution
                    this.emit('kernelReady', sessionId);
                } else if (result.status) {
                    // Log other status updates if needed
                    console.log(`KernelManager INFO (${sessionId}): Received status update: ${result.status}`);
                }
                break;
            case 'shutdown_ack': // Kernel acknowledges shutdown command
                console.log(`KernelManager: Kernel ${sessionId} acknowledged shutdown.`);
                // Actual cleanup happens on 'exit' event
                break;
            default:
              console.warn(`KernelManager: Received unknown message type from kernel ${sessionId}:`, result.type); // Log only type for brevity
              // this.emit('kernelOutput', sessionId, { type: 'unknown', data: result }); // Avoid sending unknown types
          }

        } catch (parseError) {
          console.error(`KernelManager: Failed to parse JSON from kernel ${sessionId}: >>>${jsonLine}<<<`, parseError); // Add markers to see whitespace issues
          // Emit a generic error event if parsing fails
          console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelError event (parse failure).`); // Log event emission
          this.emit('kernelError', sessionId, { message: `Failed to parse kernel output.` }); // Simpler message
          // If we were busy, we might be stuck. Reset to ready cautiously.
          if (kernelInfo.status === 'busy') {
              console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error - parse failure) event.`); // Log event emission
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
        console.error(`KernelManager: Kernel ${sessionId} stderr: ${stderrText}`); // Log stderr directly
        // Emit stderr as a structured output event
        console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelOutput event (stderr).`); // Log event emission
        this.emit('kernelOutput', sessionId, { type: 'stderr', content: stderrText });
        // Don't automatically fail the execution just on stderr, let the kernel decide
    }
  }

  _handleKernelStreamEnd(sessionId) {
    // This indicates the container stream has closed, usually because the container stopped.
    // The actual exit code/status should be retrieved via container.wait() if needed,
    // but often the cleanup logic is triggered by stopKernel or errors.
    console.log(`KernelManager: Container stream ended for session ${sessionId}.`);
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) return;

    // If the kernel was busy, it means it stopped unexpectedly during execution.
    if (kernelInfo.status === 'busy') {
        console.warn(`KernelManager: Stream ended while kernel ${sessionId} was busy. Assuming unexpected exit.`);
        console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelError event (unexpected stream end).`);
        this.emit('kernelError', sessionId, { message: `Kernel stream ended unexpectedly during execution.` });
        console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error - unexpected stream end) event.`);
        this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: { message: 'Kernel stream ended unexpectedly' } });
    }
    // Don't delete kernelInfo here, let stopKernel handle container removal and state cleanup.
    // We might need the container reference in stopKernel.
    // Mark as stopped internally? Or rely on stopKernel being called?
    // For now, assume stopKernel will be called or has been called.
  }

  _handleKernelError(sessionId, error) { // Handles stream errors or container errors passed here
    const kernelInfo = this.kernels[sessionId];
    console.error(`KernelManager: Kernel/Stream ${sessionId} encountered error:`, error);
    if (!kernelInfo) return; // Already cleaned up?

    clearTimeout(kernelInfo.startupTimer);
    clearTimeout(kernelInfo.idleTimer);

    // If an execution was in progress ('busy'), emit a completion event indicating failure
    if (kernelInfo.status === 'busy') {
        console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelError event (execution error).`); // Log event emission
        this.emit('kernelError', sessionId, { message: `Kernel error during execution: ${error.message}` });
        console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error - execution error) event.`); // Log event emission
        this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: { message: error.message } });
    }

    // Attempt to stop the container if it exists and seems to be running
    if (kernelInfo.container && kernelInfo.status !== 'stopping' && kernelInfo.status !== 'stopped') { // Check container
       console.log(`KernelManager: Attempting to stop container ${kernelInfo.container.id} due to error.`);
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
        console.log(`KernelManager: Kernel ${sessionId} timed out due to inactivity.`);
        this.stopKernel(sessionId); // Attempt graceful stop
      }
    }, KERNEL_IDLE_TIMEOUT_MS);
  }

  cleanupIdleKernels() {
    const now = Date.now();
    Object.keys(this.kernels).forEach(sessionId => {
      const kernelInfo = this.kernels[sessionId];
      if (kernelInfo.status === 'ready' && (now - kernelInfo.lastActivity > KERNEL_IDLE_TIMEOUT_MS)) {
        console.log(`KernelManager: Cleaning up idle kernel ${sessionId}.`);
        this.stopKernel(sessionId);
      }
    });
  }
}

// Export a singleton instance
module.exports = new KernelManager();
