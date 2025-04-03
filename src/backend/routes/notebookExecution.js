const express = require('express');
const router = express.Router();
const kernelManager = require('../services/kernelManager');
const metadataService = require('../services/metadataService'); // Import metadataService
const authMiddleware = require('../middleware/authMiddleware'); // Assuming this middleware adds user info to req.user
const { PassThrough } = require('stream');

// Middleware to check session ownership (basic example)
// In a real app, associate sessionId with userId more securely
const checkSessionOwnership = (req, res, next) => {
  const { sessionId } = req.body; // For POST requests
  const paramSessionId = req.params.sessionId; // For GET requests like streaming

  const targetSessionId = sessionId || paramSessionId;

  if (!targetSessionId) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  // TODO: Implement proper ownership check. This is a placeholder.
  // Example: Check if kernelManager.kernels[targetSessionId]?.userId === req.user.id
  // For now, we assume the session exists and proceed.
  if (!kernelManager.kernels[targetSessionId]) {
     // Allow starting even if kernel doesn't exist yet for the /start route
     if (req.path !== '/start') {
        return res.status(404).json({ error: `Session ${targetSessionId} not found.` });
     }
  }
  // Add more robust check here based on how you link sessions to users
  console.log(`[Auth Check - Placeholder] User ${req.user?.id} accessing session ${targetSessionId}`);

  req.sessionId = targetSessionId; // Attach validated sessionId to request
  next();
};


// POST /api/notebook/start - Start a new kernel session
router.post('/start', authMiddleware, async (req, res) => {
  const { datasetId } = req.body;
  // TODO: Add validation for datasetId format and user access rights to it

  if (!datasetId) {
    return res.status(400).json({ error: 'datasetId is required.' });
  }

  // Generate a unique session ID (could use user ID + timestamp, etc.)
  // For simplicity, using kernelManager internal handling for now if it generates one,
  // otherwise generate here. Let's assume we generate it here for clarity.
  const sessionId = `session-${req.user.id}-${Date.now()}`; // Example generation

  try {
    // --- Get filename from datasetId ---
    console.log(`[API /notebook/start] Fetching metadata for dataset ID: ${datasetId}`);
    const metadata = await metadataService.getMetadata(datasetId); // Use numeric ID here
    // Use the correct property name 'datasetIdentifier' based on the updated metadataService
    if (!metadata || !metadata.datasetIdentifier) {
        throw new Error(`Could not find filename (datasetIdentifier) for dataset ID ${datasetId}.`);
    }
    const datasetFilename = metadata.datasetIdentifier; // Get the actual filename (string)
    console.log(`[API /notebook/start] Found filename: ${datasetFilename} for dataset ID: ${datasetId}`);
    // ---

    // Pass the *filename* (string) to startKernel
    await kernelManager.startKernel(sessionId, datasetFilename);

    // TODO: Associate sessionId with req.user.id securely if needed beyond manager state
    res.status(200).json({ sessionId });
  } catch (error) {
    console.error(`API Error starting kernel ${sessionId}:`, error);
    // Check if the error is the specific TypeError we were seeing, log differently if needed
    if (error.code === 'ERR_INVALID_ARG_TYPE') {
        console.error(">>> Potential issue: TypeError encountered, check if datasetFilename is correctly retrieved as a string.");
    }
    res.status(500).json({ error: error.message || 'Failed to start notebook session.' });
  }
});

// POST /api/notebook/prepare - Prepare code for execution in a session
// Apply auth and ownership check
router.post('/prepare', authMiddleware, checkSessionOwnership, (req, res) => { // Renamed route
    const { code } = req.body;
    const sessionId = req.sessionId; // Get sessionId from middleware

    if (typeof code !== 'string') {
        return res.status(400).json({ error: 'Code must be a string.' });
    }

    try {
        // Call prepareCode, which is synchronous (or throws)
        console.log(`API: Requesting code preparation in session ${sessionId}`);
        kernelManager.prepareCode(sessionId, code);

        // Respond immediately indicating the execution has started.
        // Respond immediately indicating the code is prepared.
        // The client must connect to the /stream endpoint to trigger execution and get results.
        res.status(200).json({ message: 'Code prepared. Connect to the stream to execute.' });

    } catch (error) {
        console.error(`API Error preparing code in kernel ${sessionId}:`, error);
        // Handle specific errors like kernel not ready
        const statusCode = error.message.includes('not ready') ? 409 : 500; // 409 Conflict if not ready
        res.status(statusCode).json({ error: error.message || 'Failed to prepare code.' });
    }
});


// GET /api/notebook/stream/:sessionId - SSE stream for kernel output
// Connect to this *after* successfully POSTing to /prepare

// Placeholder for streaming endpoint - requires KernelManager changes
router.get('/stream/:sessionId', authMiddleware, checkSessionOwnership, (req, res) => {
    const sessionId = req.sessionId;
    console.log(`API: Client connected to stream for session ${sessionId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush the headers to establish the connection

    let isClosed = false; // Flag to prevent writing to closed connection

    const sendEvent = (event, data) => {
        if (isClosed) return;
        try {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            console.error(`API Stream: Error writing to SSE stream for ${sessionId}:`, error);
            closeConnection(); // Attempt to close gracefully on write error
        }
    };

    const closeConnection = () => {
        if (isClosed) return;
        isClosed = true;
        // Remove listeners
        kernelManager.off('kernelOutput', onKernelOutput);
        kernelManager.off('kernelError', onKernelError);
        kernelManager.off('kernelExecutionComplete', onExecutionComplete);
        kernelManager.off('kernelStopped', onKernelStopped);
        res.end(); // Close the SSE connection
        console.log(`API Stream: Closed connection for session ${sessionId}`);
    };

    // --- Listener functions that filter by sessionId ---
    const onKernelOutput = (targetSessionId, outputData) => {
        if (targetSessionId === sessionId) {
            console.log(`API Stream DEBUG (${sessionId}): Received kernelOutput event, sending 'output' SSE.`); // Log event receipt
            sendEvent('output', outputData); // Forward {type, content, format}
        }
    };

    const onKernelError = (targetSessionId, errorData) => {
        if (targetSessionId === sessionId) {
            // Send structured error { message, traceback? }
            console.log(`API Stream DEBUG (${sessionId}): Received kernelError event, sending 'error' SSE.`); // Log event receipt
            sendEvent('error', errorData);
            // Don't close connection here, wait for kernelExecutionComplete or kernelStopped
        }
    };

    const onExecutionComplete = (targetSessionId, completionData) => {
         if (targetSessionId === sessionId) {
             console.log(`API Stream DEBUG (${sessionId}): Received kernelExecutionComplete event, status: ${completionData.status}, sending 'done' SSE.`); // Log event receipt
             sendEvent('done', completionData); // Forward { status: 'success'|'error', result?, error? }
             closeConnection();
         }
    };

    const onKernelStopped = (targetSessionId, code, signal) => {
        if (targetSessionId === sessionId) {
            console.warn(`API Stream DEBUG (${sessionId}): Received kernelStopped event (code: ${code}, signal: ${signal}). Closing stream.`); // Log event receipt
            sendEvent('error', { message: `Kernel stopped unexpectedly (code: ${code}, signal: ${signal})` });
            sendEvent('done', { status: 'error', error: { message: 'Kernel stopped unexpectedly' } });
            closeConnection();
        }
    };

    // --- Subscribe to KernelManager events ---
    kernelManager.on('kernelOutput', onKernelOutput);
    kernelManager.on('kernelError', onKernelError);
    kernelManager.on('kernelExecutionComplete', onExecutionComplete);
    kernelManager.on('kernelStopped', onKernelStopped);

    // Send an initial connected message
    sendEvent('connected', { message: 'Streaming connection established.' });

    // --- Trigger Execution ---
    // Now that listeners are attached, tell the kernel manager to run the prepared code
    try {
        console.log(`API Stream DEBUG (${sessionId}): Triggering runPreparedCode.`);
        kernelManager.runPreparedCode(sessionId);
    } catch (runError) {
        console.error(`API Stream: Error triggering runPreparedCode for ${sessionId}:`, runError);
        // Send an immediate error event and close the connection if triggering fails
        sendEvent('error', { message: `Failed to start execution: ${runError.message}` });
        sendEvent('done', { status: 'error', error: { message: 'Failed to start execution' } });
        closeConnection();
        return; // Stop further processing for this route
    }

    // --- Cleanup on client disconnect ---
    req.on('close', () => {
        console.log(`API Stream: Client disconnected for session ${sessionId}`);
        closeConnection(); // Ensure listeners are removed and connection is marked closed
    });

    // Keep connection open, actual data sending relies on KernelManager events
});


// POST /api/notebook/stop - Stop a kernel session
// Apply auth and ownership check
router.post('/stop', authMiddleware, checkSessionOwnership, async (req, res) => {
  const sessionId = req.sessionId; // Get sessionId from middleware
  try {
    await kernelManager.stopKernel(sessionId); // Use await if stopKernel becomes async
    res.status(200).json({ message: `Kernel session ${sessionId} stopped.` });
  } catch (error) {
    console.error(`API Error stopping kernel ${sessionId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to stop kernel session.' });
  }
});

module.exports = router;