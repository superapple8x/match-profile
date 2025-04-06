import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import CodeMirror from '@uiw/react-codemirror';
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark"; // Using oneDark theme
import { EditorView } from "@codemirror/view"; // Import EditorView for theme customization
import { PlayIcon, TrashIcon, ExclamationCircleIcon, SparklesIcon, PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/solid"; // Added SparklesIcon, PaperAirplaneIcon, XMarkIcon

// Base URL for API calls (adjust if needed)
const API_BASE_URL = "/api";

// Custom CodeMirror theme extension based on oneDark
const customTheme = EditorView.theme(
  {
    "&": {
      // Ensure the main editor container has no outline/border itself
      outline: "none !important",
      border: "none !important",
    },
    ".cm-content": {
      padding: "10px 0", // Add vertical padding inside the content area
    },
    ".cm-gutters": {
      // Style the gutter (line numbers)
      borderRight: "none !important", // Remove default border
      paddingLeft: "10px", // Padding left of numbers
      paddingRight: "10px", // Padding between numbers and code
      backgroundColor: "transparent !important", // Ensure gutter matches editor bg
    },
    ".cm-activeLineGutter": {
        backgroundColor: "transparent !important", // Ensure active line gutter matches
    },
    ".cm-line": {
        paddingLeft: "10px", // Add padding to the left of the code lines themselves
        paddingRight: "10px", // Add padding to the right of the code lines
    }
  },
  { dark: true } // Apply this theme in dark mode
);

// Destructure datasetId from props directly
function NotebookCell({ cellData, sessionId, datasetId, onCodeChange, onDeleteCell }) {
  const [outputLines, setOutputLines] = useState([]);
  // const [isRunning, setIsRunning] = useState(false); // Replaced by executionStatus
  const [executionStatus, setExecutionStatus] = useState('idle'); // 'idle', 'queued', 'preparing', 'connecting', 'running', 'success', 'error'
  const executionStatusRef = useRef(executionStatus); // Ref to track status in callbacks
  const [showGenerator, setShowGenerator] = useState(false); // State for generator visibility
  const [generatorPrompt, setGeneratorPrompt] = useState(''); // State for generator prompt input
  const [isGenerating, setIsGenerating] = useState(false); // State for generation loading
  const [generatorError, setGeneratorError] = useState(null); // State for generation errors

  // Keep the ref updated
  useEffect(() => {
    executionStatusRef.current = executionStatus;
  }, [executionStatus]);
  const [executionError, setExecutionError] = useState(null); // For setup/network errors
  const eventSourceRef = useRef(null); // Ref to hold the EventSource instance

  // --- CodeMirror Change Handler ---
  const handleCodeMirrorChange = useCallback((value) => {
    onCodeChange(cellData.id, value);
  }, [onCodeChange, cellData.id]);

  // --- Cleanup SSE Connection ---
  const cleanupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      console.log(`[Cell ${cellData.id}] Closing SSE connection.`);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    // Reset status based on whether an error occurred during cleanup or normal finish
    // If called from 'done' or successful cleanup, it should be 'success' or 'idle'
    // If called from an error handler, it should be 'error'
    // For simplicity now, reset to idle if not already in a final state. Error/success set explicitly elsewhere.
    if (!['error', 'success', 'idle'].includes(executionStatusRef.current)) { // Use ref for latest status
        setExecutionStatus('idle');
    }
  }, [cellData.id]);

  // Effect for component unmount cleanup
  useEffect(() => {
    return () => {
      cleanupEventSource();
    };
  }, [cleanupEventSource]);

  // --- Run Button Handler ---
  const handleRunClick = async () => {
    // Check if already executing based on status
    if (['queued', 'preparing', 'connecting', 'running'].includes(executionStatus) || !sessionId) return;

    console.log(`[Cell ${cellData.id}] Initiating execution for session: ${sessionId}`);
    setExecutionStatus('queued'); // Set status to queued
    setOutputLines([]); // Clear previous output
    setExecutionError(null); // Clear previous setup/network errors
    cleanupEventSource(); // Close any existing connection before starting new

    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 1. Prepare Code (Backend responds with 200 OK)
      setExecutionStatus('preparing'); // Set status to preparing before fetch
      const prepareResponse = await fetch(`${API_BASE_URL}/notebook/prepare`, { // Use new endpoint
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ sessionId: sessionId, code: cellData.code }),
      });

      if (!prepareResponse.ok) {
        // Handle errors like 409 Conflict (kernel not ready), 404 (session not found), 500
        const errorData = await prepareResponse.json().catch(() => ({ error: 'Failed to prepare code.' }));
        throw new Error(errorData.error || `HTTP error! status: ${prepareResponse.status}`);
      }

      // 2. Code Prepared - Connect to SSE Stream (which will trigger execution)
      console.log(`[Cell ${cellData.id}] Code prepared. Connecting to SSE stream to execute...`);
      setExecutionStatus('connecting'); // Set status to connecting
      let sseUrl = `${API_BASE_URL}/notebook/stream/${sessionId}`;
      // Append token as query parameter for EventSource authentication
      if (token) {
          sseUrl += `?token=${encodeURIComponent(token)}`;
      }
      eventSourceRef.current = new EventSource(sseUrl); // No direct headers support, auth needs setup

      eventSourceRef.current.onopen = () => {
        console.log(`[Cell ${cellData.id}] SSE connection opened, kernel should be running code.`);
        setExecutionStatus('running'); // Set status to running
      };

      eventSourceRef.current.addEventListener('connected', (event) => {
          const data = JSON.parse(event.data);
          console.log(`[Cell ${cellData.id}] SSE connected message:`, data.message);
          // You could add a specific 'connected' message to outputLines if desired
          // setOutputLines(prev => [...prev, { type: 'info', content: data.message, key: `info-${Date.now()}` }]);
      });

      eventSourceRef.current.addEventListener('output', (event) => {
        const data = JSON.parse(event.data);
        console.log(`[Cell ${cellData.id}] SSE output received:`, data);
        // Append new output line, generating a unique key
        setOutputLines(prev => [...prev, { ...data, key: `${data.type}-${Date.now()}-${Math.random()}` }]);
      });

      eventSourceRef.current.addEventListener('error', (event) => {
          // This listener handles *kernel execution* errors sent via SSE 'error' event type
          console.log(`[Cell ${cellData.id}] SSE 'error' event received:`, event);
          let errorContent = 'An unknown kernel error occurred.';
          if (event.data) {
              try {
                  const data = JSON.parse(event.data);
                  console.error(`[Cell ${cellData.id}] Parsed SSE kernel error data:`, data);
                  const message = data.message || 'Unknown kernel error details.';
                  errorContent = data.traceback ? `${message}\n${data.traceback}` : message;
              } catch (parseError) {
                  console.error(`[Cell ${cellData.id}] Failed to parse SSE error event data:`, event.data, parseError);
                  // Use raw data if parsing fails, might be plain text error
                  errorContent = `Received unparsable error data from kernel: ${event.data}`;
              }
          } else {
              console.error(`[Cell ${cellData.id}] SSE 'error' event received with no data.`);
              errorContent = 'Received an unspecified error event from the kernel stream.';
          }
          setOutputLines(prev => [...prev, { type: 'error', content: errorContent, key: `kernel-error-${Date.now()}` }]);
          // Don't close connection here, wait for 'done' event or connection error
      });

      eventSourceRef.current.addEventListener('done', (event) => {
        const data = JSON.parse(event.data);
        console.log(`[Cell ${cellData.id}] SSE 'done' event received:`, data);
        // Execution finished (successfully or with error reported via 'error' event before this)
        setExecutionStatus(data.status === 'success' ? 'success' : 'error'); // Set final status based on kernel report
        cleanupEventSource(); // Close connection
      });

      eventSourceRef.current.onerror = (error) => {
        // This handles *connection* errors with the EventSource itself (e.g., network issue, server not available)
        console.error(`[Cell ${cellData.id}] EventSource connection error:`, error);
        // Check if it's already closed to avoid duplicate state updates
        if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.CLOSED) {
           console.log(`[Cell ${cellData.id}] SSE connection already closed.`);
        } else {
           setExecutionError('Connection to the output stream failed. The server might be down or unreachable.');
        }
        setExecutionStatus('error'); // Set status to error on connection failure
        cleanupEventSource(); // Close connection
      };

    } catch (error) {
      // This catches errors from the initial /prepare fetch or EventSource setup
      console.error(`[Cell ${cellData.id}] Failed to prepare code or connect to stream:`, error);
      setExecutionError(error.message || 'An unknown error occurred preparing code.');
      setExecutionStatus('error'); // Ensure status is error if setup fails
      cleanupEventSource(); // Clean up just in case
    }
    // Note: 'finally' block removed as isRunning state is now managed by SSE events/errors
  };

  // --- Generate Code Handler ---
  const handleGenerateCode = async () => {
    if (!generatorPrompt.trim() || isGenerating) return;

    console.log(`[Cell ${cellData.id}] Initiating code generation with prompt: "${generatorPrompt}"`);
    setIsGenerating(true);
    setGeneratorError(null);

    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/notebook/generate-code`, {
        method: 'POST',
        headers: headers,
        // Send datasetId (received as a direct prop) along with the prompt
        body: JSON.stringify({ prompt: generatorPrompt, datasetId: datasetId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.generatedCode) {
        onCodeChange(cellData.id, data.generatedCode); // Update cell content
        setShowGenerator(false); // Close the generator bar
        setGeneratorPrompt(''); // Clear the prompt
      } else {
        throw new Error('No code generated by the LLM.');
      }

    } catch (error) {
      console.error(`[Cell ${cellData.id}] Failed to generate code:`, error);
      setGeneratorError(error.message || 'An unknown error occurred during code generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Delete Button Handler ---
   const handleDeleteClick = () => {
       // Optional: Add confirmation dialog here
       onDeleteCell(cellData.id);
   };

  // --- Render Output Lines ---
  const renderOutputLine = (line) => {
    switch (line.type) {
      case 'stdout':
        return <pre key={line.key} className="text-sm whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{line.content}</pre>;
      case 'stderr':
        return <pre key={line.key} className="text-sm whitespace-pre-wrap break-words text-red-600 dark:text-red-400">{line.content}</pre>;
      case 'image':
        // Assuming line.content is base64 encoded PNG
        return <img key={line.key} src={`data:image/png;base64,${line.content}`} alt="Generated plot" className="max-w-full h-auto my-2 border dark:border-gray-600" />;
      case 'error': {
         // Kernel execution errors (from 'error' SSE event) - Use enhanced styling
         // Extract message and traceback if available (assuming content is the stringified version)
         let message = line.content;
         let traceback = null;
         // Basic check if content looks like our structured error string
         if (typeof line.content === 'string' && line.content.includes('\n')) {
             const lines = line.content.split('\n');
             message = lines[0]; // Assume first line is the message
             if (lines.length > 1) {
                 traceback = lines.slice(1).join('\n'); // Rest is traceback
             }
         }

         return (
           <div key={line.key} className="mb-1 p-2 text-sm bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 rounded-md shadow-sm">
             <div className="flex items-start">
                <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-red-500 dark:text-red-400" />
                <span className="font-medium break-words">{message}</span>
             </div>
             {traceback && (
               <pre className="mt-1 ml-7 text-xs whitespace-pre-wrap break-words font-mono">{traceback}</pre>
             )}
           </div>
         );
       }
       // --- Add case for display_data ---
       case 'display_data':
         // Render based on mimetype, default to plain text preformatted
         if (line.mimetype === 'text/html') {
           // Be cautious with dangerouslySetInnerHTML - ensure backend sanitizes if needed
           return <div key={line.key} className="text-sm" dangerouslySetInnerHTML={{ __html: line.content }} />;
         }
         // Default to plain text
         return <pre key={line.key} className="text-sm whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{line.content}</pre>;
       // --- End case for display_data ---
      default:
        return <pre key={line.key} className="text-xs text-gray-500">Unknown output type: {line.type}</pre>;
    }
  };

  return (
    // --- Cell Container ---
    // Increased rounding, darker background in dark mode
    <div className="mb-4 border border-gray-300 dark:border-gray-700 rounded-xl shadow-md overflow-hidden bg-white dark:bg-gray-900">
       {/* --- Toolbar --- */}
       <div className="flex items-center justify-end space-x-2 p-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            {/* Status Indicator (Moved to Toolbar) */}
            {executionStatus !== 'idle' && executionStatus !== 'success' && !isGenerating && ( // Hide status if generating
                <div className={`mr-auto px-1.5 py-0.5 text-xs font-medium rounded-md
                ${executionStatus === 'queued' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : ''}
                ${executionStatus === 'preparing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : ''}
                ${executionStatus === 'connecting' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' : ''}
                ${executionStatus === 'running' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 animate-pulse' : ''}
                ${executionStatus === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : ''}
                `}>
                {executionStatus.charAt(0).toUpperCase() + executionStatus.slice(1)}
                </div>
            )}
             {/* Generating Indicator */}
             {isGenerating && (
                 <div className="mr-auto px-1.5 py-0.5 text-xs font-medium rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex items-center animate-pulse">
                     <SparklesIcon className="h-3 w-3 mr-1" />
                     Generating...
                 </div>
             )}
            {/* Generate Button */}
            <button
                onClick={() => { setShowGenerator(!showGenerator); setGeneratorError(null); }} // Toggle generator bar
                disabled={isGenerating || ['queued', 'preparing', 'connecting', 'running'].includes(executionStatus)} // Disable if running or generating
                className={`p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-gray-200 dark:focus:bg-gray-700`}
                title="Generate code with AI"
            >
                <SparklesIcon className="h-4 w-4" />
            </button>
            {/* Run Button */}
            <button
                onClick={handleRunClick}
                disabled={isGenerating || ['queued', 'preparing', 'connecting', 'running'].includes(executionStatus) || !sessionId} // Disable if running or generating
                className={`p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-green-500 focus:bg-gray-200 dark:focus:bg-gray-700`}
                title={executionStatus === 'running' ? "Running..." : ['queued', 'preparing', 'connecting'].includes(executionStatus) ? "Executing..." : "Run cell (Shift+Enter)"}
            >
                {['queued', 'preparing', 'connecting', 'running'].includes(executionStatus) ? (
                     <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                 ) : (
                     <PlayIcon className="h-4 w-4" />
                 )}
            </button>
            {/* Delete Button */}
             <button
                 onClick={handleDeleteClick}
                 disabled={isGenerating || ['queued', 'preparing', 'connecting', 'running'].includes(executionStatus)} // Disable if running or generating
                 className="p-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-gray-200 dark:focus:bg-gray-700"
                 title="Delete cell"
             >
                 <TrashIcon className="h-4 w-4" />
             </button>
       </div>

       {/* --- Generator Input Bar (Conditional) --- */}
       {showGenerator && (
         <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-850">
           {generatorError && (
             <div className="mb-2 p-1.5 text-xs bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded flex items-center shadow-sm">
               <ExclamationCircleIcon className="h-4 w-4 mr-1 flex-shrink-0" /> <span>{generatorError}</span>
             </div>
           )}
           <div className="flex items-center space-x-2">
             <SparklesIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
             <input
               type="text"
               value={generatorPrompt}
               onChange={(e) => setGeneratorPrompt(e.target.value)}
               placeholder="Enter a prompt to generate code..."
               disabled={isGenerating}
               className="flex-grow px-2 py-1 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-500 dark:placeholder-gray-400"
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   handleGenerateCode();
                 }
                 if (e.key === 'Escape') {
                   setShowGenerator(false);
                 }
               }}
             />
             <button
               onClick={handleGenerateCode}
               disabled={isGenerating || !generatorPrompt.trim()}
               className="p-1.5 rounded text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-purple-500 focus:ring-offset-1 dark:focus:ring-offset-gray-850"
               title="Generate Code"
             >
               {isGenerating ? (
                 <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
               ) : (
                 <PaperAirplaneIcon className="h-4 w-4" />
               )}
             </button>
             <button
               onClick={() => setShowGenerator(false)}
               disabled={isGenerating}
               className="p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-gray-200 dark:focus:bg-gray-700"
               title="Close Generator"
             >
               <XMarkIcon className="h-4 w-4" />
             </button>
           </div>
         </div>
       )}

      {/* Editor Area */}
      <div className="code-editor-area"> {/* Added a class for potential specific styling */}
         {/* CodeMirror component remains largely the same */}
         <CodeMirror
           value={cellData.code}
           height="auto"
           minHeight="50px"
           // Combine oneDark with the custom theme adjustments
           extensions={[python(), oneDark, customTheme]}
           theme={oneDark}
           onChange={handleCodeMirrorChange}
           className="text-sm" // Base styling
           // Apply specific styling to CodeMirror container if needed via its parent or extensions
           onKeyDown={(event) => {
             if (event.shiftKey && event.key === 'Enter') {
               event.preventDefault();
               handleRunClick();
             }
           }}
         />
      </div>

      {/* Output Area */}
      {(outputLines.length > 0 || executionError) && (
        // Adjusted padding, removed top border as toolbar provides separation
        <div className="output-area p-3 bg-gray-50 dark:bg-gray-850 min-h-[30px]">
          {/* Display global execution error first if it exists */}
          {executionError && (
             <div className="mb-2 p-2 text-sm bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md flex items-center shadow-sm">
               <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" /> <span>Execution Setup Error: {executionError}</span>
             </div>
           )}
          {/* Render individual output lines */}
          {outputLines.map(renderOutputLine)}
        </div>
      )}
    </div>
  );
}

NotebookCell.propTypes = {
  cellData: PropTypes.shape({
    id: PropTypes.string.isRequired,
    code: PropTypes.string.isRequired,
    // datasetId is no longer expected inside cellData
  }).isRequired,
  sessionId: PropTypes.string, // Can be null initially
  datasetId: PropTypes.string, // datasetId is a direct prop
  onCodeChange: PropTypes.func.isRequired,
  onDeleteCell: PropTypes.func.isRequired,
};

export default NotebookCell;
