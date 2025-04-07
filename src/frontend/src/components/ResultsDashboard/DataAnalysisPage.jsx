import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import { PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon, ExclamationCircleIcon, InformationCircleIcon, ArrowUturnLeftIcon, CodeBracketSquareIcon, ChatBubbleLeftRightIcon, PencilSquareIcon } from '@heroicons/react/24/solid';
// import { v4 as uuidv4 } from 'uuid'; // No longer needed here
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import CodeNotebook from '../Notebook/CodeNotebook'; // Import CodeNotebook

// Base URL for API calls (adjust if needed)
const API_BASE_URL = '/api';

// --- Tab Constants for Details Card ---
const DETAIL_TABS = {
  STATS: 'stats',
  CODE: 'code',
  PROCESS: 'process',
};

// --- Tabbed Collapsible Card Component ---
// (This component remains unchanged from the previous version)
function TabbedDetailsCard({ stats, generatedCode, processUpdates, initiallyOpen = false, initialTab = DETAIL_TABS.STATS, onEditCode }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [activeTab, setActiveTab] = useState(initialTab);
  const processEndRef = useRef(null);
  const isJustOpened = useRef(false);

  useEffect(() => {
      if (activeTab === DETAIL_TABS.PROCESS && isOpen) {
          processEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
  }, [processUpdates, activeTab, isOpen]);

  useEffect(() => {
     if (initiallyOpen && !isOpen) {
         isJustOpened.current = true;
     }
     setIsOpen(initiallyOpen);
  }, [initiallyOpen]);

   useEffect(() => {
     if (isOpen) {
        const hasStats = stats && Object.keys(stats).length > 0;
        const hasCode = !!generatedCode;
        const hasProcessUpdates = processUpdates && processUpdates.length > 0;
        let newInitialTab = initialTab;
        if (newInitialTab === DETAIL_TABS.STATS && !hasStats) {
            newInitialTab = hasCode ? DETAIL_TABS.CODE : (hasProcessUpdates ? DETAIL_TABS.PROCESS : DETAIL_TABS.STATS);
        } else if (newInitialTab === DETAIL_TABS.CODE && !hasCode) {
            newInitialTab = hasStats ? DETAIL_TABS.STATS : (hasProcessUpdates ? DETAIL_TABS.PROCESS : DETAIL_TABS.CODE);
        } else if (newInitialTab === DETAIL_TABS.PROCESS && !hasProcessUpdates) {
            newInitialTab = hasStats ? DETAIL_TABS.STATS : (hasCode ? DETAIL_TABS.CODE : DETAIL_TABS.PROCESS);
        }
        if (isJustOpened.current ||
            (activeTab === DETAIL_TABS.STATS && !hasStats) ||
            (activeTab === DETAIL_TABS.CODE && !hasCode) ||
            (activeTab === DETAIL_TABS.PROCESS && !hasProcessUpdates))
        {
             setActiveTab(newInitialTab);
             isJustOpened.current = false;
        }
     }
   }, [isOpen, initialTab, stats, generatedCode, processUpdates, activeTab]); // Added activeTab back here


  const renderTabButton = (tabKey, label, disabled = false) => (
    <button
      key={tabKey}
      onClick={() => !disabled && setActiveTab(tabKey)}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-kde-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
        activeTab === tabKey
          ? 'bg-kde-blue-500 text-white shadow-sm' // Use KDE Blue for active tab
          : disabled
          ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-100 dark:bg-gray-700/50'
          : 'text-gray-600 dark:text-gray-300 hover:bg-kde-blue-100/80 dark:hover:bg-gray-700' // Use KDE Blue for hover
      }`}
    >
      {label}
    </button>
  );

  const hasStats = stats && Object.keys(stats).length > 0;
  const hasCode = !!generatedCode;
  const hasProcessUpdates = processUpdates && processUpdates.length > 0;

   if (!initiallyOpen && !hasStats && !hasCode && !hasProcessUpdates) {
       return null;
   }

  return (
    <div className="mt-2 border rounded-md dark:border-gray-700 overflow-hidden bg-kde-blue-50/70 dark:bg-gray-800/50 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-2 bg-kde-blue-100/50 dark:bg-gray-700/50 hover:bg-kde-blue-100 dark:hover:bg-gray-600/50 focus:outline-none"
      >
        <span className="font-medium text-gray-700 dark:text-gray-300 text-xs">Details</span>
        {isOpen ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="bg-kde-blue-50/50 dark:bg-gray-800/30">
          <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600 flex space-x-2">
            {renderTabButton(DETAIL_TABS.STATS, 'Statistics', !hasStats)}
            {renderTabButton(DETAIL_TABS.CODE, 'Generated Code', !hasCode)}
            {renderTabButton(DETAIL_TABS.PROCESS, 'Process Log', !hasProcessUpdates)}
          </div>
          <div className="p-2">
            {activeTab === DETAIL_TABS.STATS && hasStats && (
              <pre className="bg-kde-blue-100/60 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto max-h-60 overflow-y-auto">{JSON.stringify(stats, null, 2)}</pre>
            )}
            {activeTab === DETAIL_TABS.CODE && hasCode && (
              <div className="relative">
                <pre className="bg-kde-blue-100/60 dark:bg-gray-900 p-2 rounded text-xs whitespace-pre-wrap break-all max-h-60 overflow-y-auto">{generatedCode}</pre>
                <button
                  onClick={() => onEditCode(generatedCode)}
                  className="absolute top-1 right-1 p-1 bg-kde-blue-500 hover:bg-kde-blue-600 text-white rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-kde-blue-400 focus:ring-offset-1 dark:focus:ring-offset-gray-900"
                  title="Edit Code in Notebook"
                >
                  <PencilSquareIcon className="h-3 w-3" />
                </button>
              </div>
            )}
            {activeTab === DETAIL_TABS.PROCESS && hasProcessUpdates && (
              <div className="bg-kde-blue-100/60 dark:bg-gray-900 p-2 rounded text-xs max-h-60 overflow-y-auto">
                {processUpdates.map((update, index) => (
                    <p key={`${index}-${update ? update.substring(0, 20) : 'null'}`} className="whitespace-pre-wrap break-words font-mono text-gray-600 dark:text-gray-400">{update}</p>
                ))}
                <div ref={processEndRef} />
               </div>
            )}
            {((activeTab === DETAIL_TABS.STATS && !hasStats) ||
              (activeTab === DETAIL_TABS.CODE && !hasCode) ||
              (activeTab === DETAIL_TABS.PROCESS && !hasProcessUpdates)) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic p-2">No {activeTab} details available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// --- End TabbedDetailsCard ---

// --- Main DataAnalysisPage Component ---
// Receive notebook state and handlers from App.jsx
function DataAnalysisPage({
  datasetId, messages, setMessages, onCloseAnalysis, handleLogout, isAuthenticated, switchToAuthView,
  notebookCells, onAddNotebookCell, onDeleteNotebookCell, onNotebookCodeChange, setNotebookCellsForDataset // Props from App.jsx
}) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const chatEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const [processUpdates, setProcessUpdates] = useState([]);

  // --- Notebook State ---
  const [viewMode, setViewMode] = useState('chat'); // 'chat' or 'notebook'
  const [notebookSessionId, setNotebookSessionId] = useState(null);
  // const [codeToEdit, setCodeToEdit] = useState(null); // No longer needed, handled by handleEditCode directly
  const [notebookError, setNotebookError] = useState(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  // const [notebookCells, setNotebookCells] = useState([{ id: uuidv4(), code: '' }]); // State lifted to App.jsx

  // Scroll to bottom whenever messages change or loading starts/stops
  useEffect(() => {
    const behavior = isLoading ? 'auto' : 'smooth';
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior, block: 'end' }), 100);
  }, [messages, processUpdates, isLoading, viewMode]);

  // Effect to handle SSE connection for LLM Analysis (remains the same)
  useEffect(() => {
    let isMounted = true;

    if (eventSourceRef.current) {
        console.log('Closing previous EventSource connection.');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }

    if (currentAnalysisId && isLoading) {
        console.log(`Establishing SSE connection for analysis ID: ${currentAnalysisId}`);
        const es = new EventSource(`/api/analysis-stream/${currentAnalysisId}`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            if (!isMounted) return;
            try {
                const data = JSON.parse(event.data);
                console.log('SSE Message Received:', data);
                 if (data.rawLogLine) {
                     const newLog = data.rawLogLine;
                     setProcessUpdates(prev => {
                        if ((newLog.includes('Analysis complete.') && prev.some(p => p.includes('Analysis complete.'))) ||
                            (newLog.includes('Error during analysis:') && prev.some(p => p.includes('Error during analysis:')))) {
                           return prev;
                        }
                         return [...prev, newLog];
                     });
                     if (!newLog.includes('---') && !newLog.includes('[Python]')) {
                         const statusMatch = newLog.match(/\]\s*(.*)/);
                         if (statusMatch && statusMatch[1]) {
                            setLoadingStatus(statusMatch[1]);
                         }
                     }
                 }
                 if (data.result) {
                    const finalProcessLogs = [...processUpdates];
                     if (data.rawLogLine && !finalProcessLogs.includes(data.rawLogLine)) {
                         finalProcessLogs.push(data.rawLogLine);
                     }
                     if (!finalProcessLogs.some(p => p.includes('Analysis complete.'))) {
                        finalProcessLogs.push(`[${currentAnalysisId}] Analysis complete.`);
                     }
                    setMessages(prev => [...prev, {
                        sender: 'bot',
                        content: {
                            imageUris: data.result.imageUris || [],
                            summary: data.result.summary,
                            stats: data.result.stats,
                            generatedCode: data.result.generatedCode,
                            processUpdates: finalProcessLogs
                        }
                    }]);
                    setIsLoading(false);
                    setLoadingStatus('Analysis complete.');
                    setCurrentAnalysisId(null);
                    if (eventSourceRef.current) eventSourceRef.current.close();
                    eventSourceRef.current = null;
                }
                 else if (data.error) {
                     const errorMessage = `Error: ${data.error}`;
                     const finalProcessLogs = [...processUpdates];
                      if (data.rawLogLine && !finalProcessLogs.includes(data.rawLogLine)) {
                         finalProcessLogs.push(data.rawLogLine);
                     }
                     if (!finalProcessLogs.some(p => p.includes(data.error))) {
                         finalProcessLogs.push(`[${currentAnalysisId || 'System'}] ${errorMessage}`);
                     }
                     setError(`Analysis failed: ${data.error}`);
                     setMessages(prev => [...prev, {
                        sender: 'bot',
                        content: { error: data.error, processUpdates: finalProcessLogs }
                    }]);
                    setIsLoading(false);
                    setLoadingStatus('Analysis failed.');
                    setCurrentAnalysisId(null);
                    if (eventSourceRef.current) eventSourceRef.current.close();
                    eventSourceRef.current = null;
                }
            } catch (parseError) {
                console.error('Failed to parse SSE message:', event.data, parseError);
                 const errorMsg = '[System] Failed to process analysis update.';
                 setError(errorMsg.replace('[System] ', ''));
                 setProcessUpdates(prev => [...prev, errorMsg]);
                 setIsLoading(false);
                 setLoadingStatus('Update error.');
                 if (eventSourceRef.current) eventSourceRef.current.close();
                 eventSourceRef.current = null;
            }
        };

        es.onerror = (err) => {
             if (!isMounted) return;
            console.error('EventSource failed:', err);
            const errorMsg = '[System] Connection error during analysis. Please try again.';
            setError(errorMsg.replace('[System] ', ''));
            setProcessUpdates(prev => [...prev, errorMsg]);
            setIsLoading(false);
            setLoadingStatus('Connection error.');
            setCurrentAnalysisId(null);
            if (eventSourceRef.current) {
                 eventSourceRef.current.close();
                 eventSourceRef.current = null;
             }
            // Removed logout trigger here. A connection error isn't necessarily an auth issue,
            // especially if the component remounted. The error message is displayed to the user.
            console.warn('SSE connection error.');
            // if (handleLogout) handleLogout(); // Removed logout trigger
        };

    } else {
         if (eventSourceRef.current) {
            console.log('Closing EventSource connection because loading stopped.');
            eventSourceRef.current.close();
            eventSourceRef.current = null;
         }
    }

    return () => {
        isMounted = false;
        console.log('DataAnalysisPage unmounting or dependencies changed. Cleaning up EventSource.');
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    };
  // Removed processUpdates and setMessages from dependencies to prevent re-renders causing SSE disconnects.
  // handleLogout is stable from App.jsx props.
  }, [currentAnalysisId, isLoading, handleLogout]);


  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    const currentQuery = query.trim();
    if (!currentQuery || isLoading) return;
    if (!datasetId) {
        setError('Dataset ID is missing. Cannot perform analysis.');
        return;
    }

    setMessages(prev => [...prev, { sender: 'user', content: currentQuery }]);
    setQuery('');
    setIsLoading(true);
    setError(null);
    setProcessUpdates([]);
    setLoadingStatus('Initiating analysis...');
    setCurrentAnalysisId(null);

    try {
      console.log(`Requesting analysis start for query: "${currentQuery}" dataset: "${datasetId}"`);
      const startResponse = await fetch('/api/start-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: currentQuery, datasetId }),
      });
      const startData = await startResponse.json();
      if (!startResponse.ok) {
          throw new Error(startData.error || `Failed to start analysis (${startResponse.status})`);
      }
      console.log('Analysis started with ID:', startData.analysisId);
      setCurrentAnalysisId(startData.analysisId);
    } catch (err) {
      console.error('Error initiating analysis request:', err);
      const errorMsg = `Failed to initiate analysis: ${err.message}`;
      setError(errorMsg);
      setProcessUpdates([`[System] ${errorMsg}`]);
      setIsLoading(false);
      setLoadingStatus('Failed to start.');
      if (err.message.includes('401') || err.message.includes('403')) {
          console.warn('Analysis start failed due to invalid/expired token.');
          if (handleLogout) handleLogout();
      }
    }
  }, [query, datasetId, isLoading, handleLogout, setMessages]); // Added setMessages

// --- Notebook Session Management ---
const startNotebookSession = useCallback(async () => {
  if (!datasetId || isStartingSession || notebookSessionId) return;
  console.log('Starting notebook session...');
  setIsStartingSession(true);
  setNotebookError(null);
  try {
    const token = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/notebook/start`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ datasetId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to start session.' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    const { sessionId } = await response.json();
    setNotebookSessionId(sessionId);
    console.log('Notebook session started:', sessionId);
  } catch (err) {
    console.error('Error starting notebook session:', err);
    setNotebookError(err.message || 'Unknown error starting session.');
    setNotebookSessionId(null);
  } finally {
    setIsStartingSession(false);
  }
}, [datasetId, isStartingSession, notebookSessionId]);

const stopNotebookSession = useCallback(async (sessionIdToStop) => {
  if (!sessionIdToStop) return;
  console.log('Stopping notebook session:', sessionIdToStop);
  if (sessionIdToStop === notebookSessionId) {
      setNotebookSessionId(null);
  }
  try {
    const token = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    await fetch(`${API_BASE_URL}/notebook/stop`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ sessionId: sessionIdToStop }),
    });
  } catch (err) {
    console.error('Error stopping notebook session:', err);
  }
}, [notebookSessionId]);

// Cleanup notebook session on unmount
useEffect(() => {
  const idToStop = notebookSessionId;
  return () => {
    if (idToStop) {
      stopNotebookSession(idToStop);
    }
  };
}, [notebookSessionId, stopNotebookSession]);

// --- View Toggling ---
const handleToggleView = useCallback(() => {
  const newMode = viewMode === 'chat' ? 'notebook' : 'chat';
  setNotebookError(null);
  if (newMode === 'notebook' && !notebookSessionId && !isStartingSession) {
    startNotebookSession();
  }
  setViewMode(newMode);
}, [viewMode, notebookSessionId, isStartingSession, startNotebookSession]);

 // --- Notebook Cell State Handlers are passed as props ---
 // onAddNotebookCell
 // onDeleteNotebookCell
 // onNotebookCodeChange

 // --- Update handleEditCode to use the passed setter ---
 const handleEditCode = useCallback((code) => {
     console.log("Switching to notebook to edit code...");
     // Use the setter passed from App.jsx to update the state for the current datasetId
     setNotebookCellsForDataset(prevCells => {
         const currentCells = prevCells || []; // Handle case where state might be undefined initially
         if (currentCells.length > 0) {
             const updatedCells = [...currentCells];
             // Use uuidv4 from import if needed for new cells
             updatedCells[0] = { ...updatedCells[0], code: code };
             return updatedCells;
         } else {
             // Use uuidv4 from import if needed for new cells
             return [{ id: 'initial-cell-' + Date.now(), code: code }]; // Use a temporary ID or import uuidv4
         }
     });

     // setCodeToEdit(null); // No longer needed
     setNotebookError(null);
     if (!notebookSessionId && !isStartingSession) {
         startNotebookSession(); // Start session if needed
     }
     setViewMode('notebook'); // Switch view
 }, [notebookSessionId, isStartingSession, startNotebookSession, setNotebookCellsForDataset]); // Use setNotebookCellsForDataset prop


// Define button styles based on reference
const baseButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";
const primaryButtonStyle = "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-900";
const sendButtonStyle = "p-2.5 rounded-full";
const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-kde-blue-50 to-kde-blue-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200/80 dark:border-gray-700/50 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700/80 bg-kde-blue-50/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {viewMode === 'chat' ? 'LLM Data Analysis' : 'Python Notebook'}
                {datasetId ? <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">({datasetId})</span> : ''}
            </h2>
             <div className="flex items-center space-x-2">
                 {/* Toggle View Button */}
                 <button
                     onClick={handleToggleView}
                     disabled={!datasetId || isStartingSession}
                     className={`flex items-center px-3 py-1 bg-kde-blue-100 hover:bg-kde-blue-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-kde-blue-800 dark:text-gray-200 text-sm font-medium rounded-md shadow-sm hover:shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-kde-blue-400 focus:ring-offset-2 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-800 ${disabledClasses}`}
                     aria-label={viewMode === 'chat' ? "Switch to Notebook View" : "Switch to Chat View"}
                     title={viewMode === 'chat' ? "Switch to Notebook View" : "Switch to Chat View"}
                 >
                     {isStartingSession ? (
                         <svg className="animate-spin h-4 w-4 mr-1 text-kde-blue-800 dark:text-gray-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                     ) : viewMode === 'chat' ? (
                         <CodeBracketSquareIcon className="h-4 w-4 mr-1" />
                     ) : (
                         <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                     )}
                     {isStartingSession ? 'Starting...' : (viewMode === 'chat' ? 'Notebook' : 'Chat')}
                 </button>
                 {/* Back Button */}
                 <button
                     onClick={onCloseAnalysis}
                     className="flex items-center px-3 py-1 bg-kde-blue-100 hover:bg-kde-blue-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-kde-blue-800 dark:text-gray-200 text-sm font-medium rounded-md shadow-sm hover:shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-kde-blue-400 focus:ring-offset-2 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-800"
                     aria-label="Back to Dashboard"
                 >
                    <ArrowUturnLeftIcon className="h-4 w-4 mr-1" />
                    Back
                 </button>
             </div>
        </div>

        {/* --- Conditional Rendering: Chat View --- */}
        {viewMode === 'chat' && (
            <>
                {/* Chat Messages Area */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                    {/* Initial helper message */}
                    {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center text-center pt-16 pb-8">
                        <h2 className="text-2xl font-semibold mb-6 text-gray-700 dark:text-gray-300">How can I help you analyze the data?</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg lg:max-w-xl">
                            <button onClick={() => setQuery('Show summary statistics')} className="p-3 bg-kde-blue-50/80 dark:bg-gray-700/80 border border-kde-blue-200 dark:border-gray-600/80 rounded-lg hover:bg-kde-blue-100 dark:hover:bg-gray-700 text-sm text-kde-blue-800 dark:text-gray-300 transition-colors text-left">
                                Show summary statistics
                            </button>
                            <button onClick={() => setQuery('Plot the distribution of [column_name]')} className="p-3 bg-kde-blue-50/80 dark:bg-gray-700/80 border border-kde-blue-200 dark:border-gray-600/80 rounded-lg hover:bg-kde-blue-100 dark:hover:bg-gray-700 text-sm text-kde-blue-800 dark:text-gray-300 transition-colors text-left">
                                Plot the distribution of...
                            </button>
                            <button onClick={() => setQuery('Show the top 5 rows with the highest [column_name]')} className="p-3 bg-kde-blue-50/80 dark:bg-gray-700/80 border border-kde-blue-200 dark:border-gray-600/80 rounded-lg hover:bg-kde-blue-100 dark:hover:bg-gray-700 text-sm text-kde-blue-800 dark:text-gray-300 transition-colors text-left">
                                Show the top 5 rows with the highest...
                            </button>
                            <button onClick={() => setQuery('Count missing values per column')} className="p-3 bg-kde-blue-50/80 dark:bg-gray-700/80 border border-kde-blue-200 dark:border-gray-600/80 rounded-lg hover:bg-kde-blue-100 dark:hover:bg-gray-700 text-sm text-kde-blue-800 dark:text-gray-300 transition-colors text-left">
                                Count missing values per column
                            </button>
                        </div>
                    </div>
                    )}

                    {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                        className={`max-w-3xl lg:max-w-5xl px-5 py-3 rounded-xl shadow ${
                            msg.sender === 'user'
                            ? 'bg-kde-blue-600 text-white' // Use KDE Blue for user message
                            : 'bg-kde-blue-50/90 dark:bg-gray-700/80 text-gray-900 dark:text-gray-100' // Use KDE Blue light for bot message
                        }`}
                        >
                        {msg.sender === 'user' && <p className="text-sm whitespace-normal break-words">{msg.content}</p>}
                        {msg.sender === 'bot' && ( <div className="space-y-4 text-sm whitespace-normal break-words">
                             {msg.content.summary && (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown>
                                    {msg.content.summary}
                                    </ReactMarkdown>
                                </div>
                            )}
                             {msg.content.imageUris && msg.content.imageUris.length > 0 && (
                                <div className="flex overflow-x-auto space-x-3 py-2">
                                    {msg.content.imageUris.map((uri, imgIndex) => (
                                        <img
                                            key={imgIndex}
                                            src={uri}
                                            alt={`Generated plot ${imgIndex + 1}`}
                                            className="max-h-80 w-auto object-contain border rounded dark:border-gray-600 shadow-md flex-shrink-0"
                                        />
                                    ))}
                                </div>
                            )}
                             {(msg.content.stats || msg.content.generatedCode || msg.content.processUpdates?.length > 0) && (
                                <TabbedDetailsCard
                                    stats={msg.content.stats}
                                    generatedCode={msg.content.generatedCode}
                                    processUpdates={msg.content.processUpdates || []}
                                    initiallyOpen={false}
                                    initialTab={msg.content.error ? DETAIL_TABS.PROCESS : (msg.content.stats ? DETAIL_TABS.STATS : (msg.content.generatedCode ? DETAIL_TABS.CODE : DETAIL_TABS.PROCESS))}
                                    onEditCode={handleEditCode}
                                />
                             )}
                        </div> )}
                        </div>
                    </div>
                    ))}
                     {isLoading && (
                         <div className="flex justify-start">
                             <div className="px-4 py-2 rounded-lg shadow-sm bg-kde-blue-50/90 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-kde-blue-100 dark:border-gray-600 w-full max-w-3xl lg:max-w-5xl">
                                 <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                     <svg className="animate-spin h-4 w-4 text-gray-600 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>{loadingStatus || 'Analyzing...'}</span>
                                 </div>
                                 <TabbedDetailsCard
                                     processUpdates={processUpdates}
                                     initiallyOpen={false}
                                     initialTab={DETAIL_TABS.PROCESS}
                                     onEditCode={handleEditCode}
                                 />
                             </div>
                         </div>
                     )}
                    <div ref={chatEndRef} />
                </div>

               {/* Input Area */}
               <div className="p-4 border-t border-gray-200 dark:border-gray-700/80 bg-kde-blue-50/80 dark:bg-gray-800/80 backdrop-blur-sm sticky bottom-0 z-10">
                <div className="max-w-3xl mx-auto">
                 {error && !messages.some(msg => msg.sender === 'bot' && msg.content.error) && (
                   <div className="mb-2 p-2 text-sm bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md flex items-center shadow-sm">
                     <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" /> <span>{error}</span>
                   </div>
                 )}
                 {!isAuthenticated && datasetId && (
                   <div className="mb-3 p-3 text-sm bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-gray-600 text-blue-700 dark:text-blue-200 rounded-md flex items-center justify-between shadow-sm">
                     <span>
                      <InformationCircleIcon className="h-5 w-5 mr-2 inline-block align-middle" />
                      Log in or register to save analysis sessions and access full features.
                    </span>
                    <button
                      onClick={switchToAuthView}
                      className="ml-4 px-3 py-1 bg-kde-blue-500 hover:bg-kde-blue-600 text-white text-xs font-medium rounded shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-kde-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-700"
                     >
                       Login / Register
                     </button>
                   </div>
                 )}
                <form onSubmit={handleSubmit} className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-grow px-4 py-2 border border-kde-blue-200 dark:border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-kde-blue-500 focus:border-transparent bg-kde-blue-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm placeholder-gray-500 dark:placeholder-gray-500"
                    placeholder="Ask about the data..."
                    disabled={isLoading || !datasetId}
                    aria-label="Data analysis query"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !query.trim() || !datasetId}
                    className={`${baseButtonClasses.replace('px-4 py-2', 'p-2.5').replace('rounded-md','rounded-full')} ${primaryButtonStyle.replace('focus:ring-gray-500', 'focus:ring-kde-blue-500')} ${disabledClasses}`}
                    aria-label="Run Analysis"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </form>
                 {!datasetId && ( <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">Analysis disabled: Please upload a dataset first via the sidebar.</p> )}
              </div>
               </div>
            </>
        )}

        {/* --- Conditional Rendering: Notebook View --- */}
         {viewMode === 'notebook' && (
             <div className="flex-grow overflow-y-auto"> {/* Ensure notebook takes up space */}
                 {isStartingSession && (
                     <div className="p-4 text-center text-gray-600 dark:text-gray-400">Starting notebook session...</div>
                 )}
                 {notebookError && (
                     <div className="m-4 p-3 text-sm bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md flex items-center shadow-sm">
                         <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" /> <span>Notebook Error: {notebookError}</span>
                     </div>
                 )}
                 {notebookSessionId && !notebookError && (
                     <CodeNotebook
                         sessionId={notebookSessionId}
                         datasetId={datasetId}
                         // initialCode prop removed
                         cells={notebookCells} // Pass down cells from App state
                         onAddCell={onAddNotebookCell} // Pass down handler from App
                         onDeleteCell={onDeleteNotebookCell} // Pass down handler from App
                         onCodeChange={onNotebookCodeChange} // Pass down handler from App
                     />
                 )}
                 {!notebookSessionId && !isStartingSession && !notebookError && (
                      <div className="p-4 text-center text-gray-600 dark:text-gray-400">Notebook session not started.</div>
                 )}
             </div>
         )}
    </div>
  );
}

// PropTypes for TabbedDetailsCard
TabbedDetailsCard.propTypes = {
  stats: PropTypes.object,
  generatedCode: PropTypes.string,
  processUpdates: PropTypes.arrayOf(PropTypes.string),
  initiallyOpen: PropTypes.bool,
  initialTab: PropTypes.oneOf(Object.values(DETAIL_TABS)),
  onEditCode: PropTypes.func,
};
TabbedDetailsCard.defaultProps = {
  onEditCode: () => {},
};

// PropTypes for DataAnalysisPage
DataAnalysisPage.propTypes = {
  datasetId: PropTypes.string,
  messages: PropTypes.arrayOf(PropTypes.shape({
    sender: PropTypes.oneOf(['user', 'bot']).isRequired,
    content: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        imageUris: PropTypes.arrayOf(PropTypes.string),
        summary: PropTypes.string,
        stats: PropTypes.object,
        generatedCode: PropTypes.string,
        processUpdates: PropTypes.arrayOf(PropTypes.string),
        error: PropTypes.string,
      })
    ]).isRequired,
  })).isRequired,
  setMessages: PropTypes.func.isRequired,
  onCloseAnalysis: PropTypes.func.isRequired,
  handleLogout: PropTypes.func.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  switchToAuthView: PropTypes.func.isRequired,
  // Add prop types for notebook state/handlers
  notebookCells: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      code: PropTypes.string.isRequired,
  })).isRequired,
  onAddNotebookCell: PropTypes.func.isRequired,
  onDeleteNotebookCell: PropTypes.func.isRequired,
  onNotebookCodeChange: PropTypes.func.isRequired,
  setNotebookCellsForDataset: PropTypes.func.isRequired,
};

// DefaultProps for DataAnalysisPage
DataAnalysisPage.defaultProps = {
  datasetId: null,
};


export default DataAnalysisPage;
