const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
// const { v4: uuidv4 } = require('uuid'); // Execution IDs not needed with current 'busy' logic

// Configuration
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads'); // Assumed location of uploaded datasets
const KERNEL_SCRIPT_PATH = path.join(__dirname, '..', 'python-kernel', 'kernel_runner.py');
const PYTHON_COMMAND = 'python3'; // Or just 'python', depending on system setup
const KERNEL_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle timeout
const KERNEL_STARTUP_TIMEOUT_MS = 10000; // 10 seconds for kernel to start

class KernelManager extends EventEmitter {
  constructor() {
    super();
    this.kernels = {}; // Store: { sessionId: { process, datasetId, status, buffer, lastActivity, startupTimer, idleTimer, pendingCode: null } }
    this.kernelCheckInterval = setInterval(this.cleanupIdleKernels.bind(this), 60 * 1000); // Check every minute
    console.log('KernelManager initialized.');
  }

  // --- Public Methods ---

  startKernel(sessionId, datasetId) {
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

    console.log(`KernelManager: Starting kernel for session ${sessionId}, dataset ${datasetId}`);
    this.kernels[sessionId] = {
      process: null,
      datasetId: datasetId,
      status: 'starting',
      buffer: '',
      lastActivity: Date.now(),
      startupTimer: null,
      idleTimer: null,
      // executionCallback: null, // Removed for event-based streaming
    };

    try {
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
      console.log(`KernelManager: File access confirmed for: ${datasetPath}`);

      // Pass the *actual path* to the kernel runner script
      const kernelProcess = spawn(PYTHON_COMMAND, [KERNEL_SCRIPT_PATH, datasetPath], {
        stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
        // Consider security implications if running outside Docker
        // cwd: path.dirname(KERNEL_SCRIPT_PATH), // Optional: set working directory
      });

      // (spawn call moved up)

      this.kernels[sessionId].process = kernelProcess;
      this._setupKernelListeners(sessionId, kernelProcess);

      // Timeout for kernel startup
      this.kernels[sessionId].startupTimer = setTimeout(() => {
        if (this.kernels[sessionId] && this.kernels[sessionId].status === 'starting') {
          console.error(`KernelManager: Kernel ${sessionId} startup timed out.`);
          this._handleKernelError(sessionId, new Error('Kernel startup timed out.'));
          this.stopKernel(sessionId, true); // Force stop
        }
      }, KERNEL_STARTUP_TIMEOUT_MS);

      // Set initial idle timer
      this._resetIdleTimer(sessionId);

      console.log(`KernelManager: Kernel process ${kernelProcess.pid} spawned for session ${sessionId}. Waiting for ready signal...`);

      // --- Wait for Ready Signal ---
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
      this._handleKernelError(sessionId, error);
      delete this.kernels[sessionId]; // Clean up state entry
      // If initial spawn/setup failed, reject the promise
      reject(new Error(`Failed to start kernel: ${error.message}`));
    }
   }); // End of Promise constructor
  }

  prepareCode(sessionId, code) {
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo || !kernelInfo.process) {
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
    if (!kernelInfo || !kernelInfo.process) {
      throw new Error(`Kernel session ${sessionId} not found for running code.`);
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
    kernelInfo.status = 'busy'; // Mark as busy *now*
    kernelInfo.lastActivity = Date.now();
    this._resetIdleTimer(sessionId);

    const command = { type: 'execute', code: codeToRun };
    try {
      console.log(`KernelManager DEBUG (${sessionId}): Writing command to kernel stdin.`);
      kernelInfo.process.stdin.write(JSON.stringify(command) + '\n');
    } catch (writeError) {
      console.error(`KernelManager: Error writing prepared code to kernel ${sessionId} stdin:`, writeError);
      this.emit('kernelError', sessionId, { message: `Failed to send prepared code to kernel: ${writeError.message}` });
      this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: { message: 'Failed to send prepared code to kernel' } });
      kernelInfo.status = 'ready'; // Reset status
      this._resetIdleTimer(sessionId);
      // Should we throw here? The stream handler might be waiting. Let's not throw, rely on events.
    }
  }

  stopKernel(sessionId, force = false) {
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) {
      // console.warn(`KernelManager: Attempted to stop non-existent kernel ${sessionId}`);
      return;
    }

    console.log(`KernelManager: Stopping kernel ${sessionId} (force: ${force})`);
    kernelInfo.status = 'stopping';
    clearTimeout(kernelInfo.startupTimer);
    clearTimeout(kernelInfo.idleTimer);

    if (kernelInfo.process) {
      if (force) {
        kernelInfo.process.kill('SIGKILL'); // Force kill immediately
      } else {
        // Attempt graceful shutdown first
        try {
          const command = { type: 'shutdown' };
          kernelInfo.process.stdin.write(JSON.stringify(command) + '\n');
          // Set a timeout to force kill if graceful shutdown fails
          setTimeout(() => {
            if (this.kernels[sessionId] && this.kernels[sessionId].process) {
              console.warn(`KernelManager: Kernel ${sessionId} did not exit gracefully, forcing kill.`);
              this.kernels[sessionId].process.kill('SIGKILL');
            }
          }, 2000); // 2 seconds grace period
        } catch (e) {
          // If writing fails (e.g., pipe closed), force kill
          console.warn(`KernelManager: Error sending shutdown to kernel ${sessionId}, forcing kill.`, e);
          kernelInfo.process.kill('SIGKILL');
        }
      }
    } else {
      // Process doesn't exist, just clean up state
      delete this.kernels[sessionId];
      this.emit('kernelStopped', sessionId);
    }
    // State cleanup happens in the 'exit' listener (_handleKernelExit)
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

  _setupKernelListeners(sessionId, process) {
    process.stdout.on('data', (data) => this._handleKernelStdout(sessionId, data));
    process.stderr.on('data', (data) => this._handleKernelStderr(sessionId, data));
    process.on('exit', (code, signal) => this._handleKernelExit(sessionId, code, signal));
    process.on('error', (err) => this._handleKernelError(sessionId, err));
  }

  _handleKernelStdout(sessionId, data) {
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) return;
    console.log(`KernelManager DEBUG (${sessionId}): Received raw stdout data chunk.`); // Log raw data receipt
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
            case 'result':
              // Execution finished successfully, emit final result and completion event
              // this.emit('kernelOutput', sessionId, result); // Don't emit the raw 'result' type, just completion
              console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (success) event.`); // Log event emission
              this.emit('kernelExecutionComplete', sessionId, { status: 'success', result: result.output });
              kernelInfo.status = 'ready'; // Kernel is ready for next command
              this._resetIdleTimer(sessionId);
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
        // console.error(`KernelManager: Kernel ${sessionId} stderr: ${stderrText}`); // Already emitted as output event
        // Emit stderr as a structured output event
        console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelOutput event (stderr).`); // Log event emission
        this.emit('kernelOutput', sessionId, { type: 'stderr', content: stderrText });
        // Don't automatically fail the execution just on stderr, let the kernel decide
    }
  }

  _handleKernelExit(sessionId, code, signal) {
    const kernelInfo = this.kernels[sessionId];
    if (!kernelInfo) return;

    console.log(`KernelManager: Kernel ${sessionId} exited with code ${code}, signal ${signal}.`);
    clearTimeout(kernelInfo.startupTimer);
    clearTimeout(kernelInfo.idleTimer);

    // If an execution was in progress ('busy'), emit a completion event indicating it was cut short
    if (kernelInfo.status === 'busy') {
        console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelError event (unexpected exit).`); // Log event emission
        this.emit('kernelError', sessionId, { message: `Kernel process exited unexpectedly during execution (code: ${code}, signal: ${signal}).` });
        console.log(`KernelManager DEBUG (${sessionId}): Emitting kernelExecutionComplete (error - unexpected exit) event.`); // Log event emission
        this.emit('kernelExecutionComplete', sessionId, { status: 'error', error: { message: 'Kernel exited unexpectedly' } });
    }

    delete this.kernels[sessionId]; // Clean up state
    this.emit('kernelStopped', sessionId, code, signal);
  }

  _handleKernelError(sessionId, error) {
    const kernelInfo = this.kernels[sessionId];
    console.error(`KernelManager: Kernel ${sessionId} encountered error:`, error);
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

    // Attempt to kill the process if it exists and isn't already exiting
    if (kernelInfo.process && kernelInfo.process.exitCode === null) {
        kernelInfo.process.kill('SIGKILL');
    }

    delete this.kernels[sessionId]; // Clean up state
    this.emit('kernelError', sessionId, error);
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