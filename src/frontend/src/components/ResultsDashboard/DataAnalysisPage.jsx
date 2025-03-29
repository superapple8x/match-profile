import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import { PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon, ExclamationCircleIcon, InformationCircleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown

// --- Tab Constants for Details Card ---
const DETAIL_TABS = {
  STATS: 'stats',
  CODE: 'code',
  PROCESS: 'process',
};

// --- Tabbed Collapsible Card Component ---
function TabbedDetailsCard({ stats, generatedCode, processUpdates, initiallyOpen = false, initialTab = DETAIL_TABS.STATS }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [activeTab, setActiveTab] = useState(initialTab);
  const processEndRef = useRef(null); // Ref for scrolling process updates
  const isJustOpened = useRef(false); // Ref to track initial opening

  // Scroll to bottom of process updates when new ones arrive and tab is active
  useEffect(() => {
      if (activeTab === DETAIL_TABS.PROCESS && isOpen) {
          processEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
  }, [processUpdates, activeTab, isOpen]);

  // Handle initiallyOpen prop changes
  useEffect(() => {
     // Track when the card is opened via prop change
     if (initiallyOpen && !isOpen) {
         isJustOpened.current = true;
     }
     setIsOpen(initiallyOpen);
  }, [initiallyOpen]); // Dependency only on the prop

   // Set initial active tab ONLY when card opens or relevant data availability changes
   useEffect(() => {
     if (isOpen) {
        const hasStats = stats && Object.keys(stats).length > 0;
        const hasCode = !!generatedCode;
        const hasProcessUpdates = processUpdates && processUpdates.length > 0;

        let newInitialTab = initialTab; // Start with the prop

        // Validate if the intended initial tab has content, choose a fallback if not
        if (newInitialTab === DETAIL_TABS.STATS && !hasStats) {
            newInitialTab = hasCode ? DETAIL_TABS.CODE : (hasProcessUpdates ? DETAIL_TABS.PROCESS : DETAIL_TABS.STATS);
        } else if (newInitialTab === DETAIL_TABS.CODE && !hasCode) {
            newInitialTab = hasStats ? DETAIL_TABS.STATS : (hasProcessUpdates ? DETAIL_TABS.PROCESS : DETAIL_TABS.CODE);
        } else if (newInitialTab === DETAIL_TABS.PROCESS && !hasProcessUpdates) {
            newInitialTab = hasStats ? DETAIL_TABS.STATS : (hasCode ? DETAIL_TABS.CODE : DETAIL_TABS.PROCESS);
        }

        // Set the active tab IF the card was just opened OR if the *currently active* tab's content disappeared
        if (isJustOpened.current ||
            (activeTab === DETAIL_TABS.STATS && !hasStats) ||
            (activeTab === DETAIL_TABS.CODE && !hasCode) ||
            (activeTab === DETAIL_TABS.PROCESS && !hasProcessUpdates))
        {
             setActiveTab(newInitialTab);
             isJustOpened.current = false; // Reset the flag after initial set
        }
     }
     // Re-run ONLY when card opens, initialTab prop changes, or data availability changes.
     // DO NOT include activeTab here.
   }, [isOpen, initialTab, stats, generatedCode, processUpdates]);


  const renderTabButton = (tabKey, label, disabled = false) => (
    <button
      key={tabKey}
      onClick={() => !disabled && setActiveTab(tabKey)} // Direct user click sets the state
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
        activeTab === tabKey
          ? 'bg-primary-500 text-white shadow-sm'
          : disabled
          ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-100 dark:bg-gray-700/50'
          : 'text-gray-600 dark:text-gray-300 hover:bg-indigo-100/80 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  // Determine which tabs should be enabled based on available data
  const hasStats = stats && Object.keys(stats).length > 0;
  const hasCode = !!generatedCode;
  const hasProcessUpdates = processUpdates && processUpdates.length > 0;


  // Don't render the card at all if there's nothing to show (and it's not meant to be open initially e.g. during loading)
   if (!initiallyOpen && !hasStats && !hasCode && !hasProcessUpdates) {
       return null;
   }


  return (
    <div className="mt-2 border rounded-md dark:border-gray-700 overflow-hidden bg-indigo-50/70 dark:bg-gray-800/50 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-2 bg-indigo-100/50 dark:bg-gray-700/50 hover:bg-indigo-100 dark:hover:bg-gray-600/50 focus:outline-none" // Slightly smaller padding
      >
        <span className="font-medium text-gray-700 dark:text-gray-300 text-xs">Details</span> {/* Smaller title */}
        {isOpen ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="bg-indigo-50/50 dark:bg-gray-800/30">
          {/* Tab Buttons Area */}
          <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600 flex space-x-2">
            {renderTabButton(DETAIL_TABS.STATS, 'Statistics', !hasStats)}
            {renderTabButton(DETAIL_TABS.CODE, 'Generated Code', !hasCode)}
            {renderTabButton(DETAIL_TABS.PROCESS, 'Process Log', !hasProcessUpdates)}
          </div>
          {/* Tab Content Area */}
          <div className="p-2">
            {activeTab === DETAIL_TABS.STATS && hasStats && (
              <pre className="bg-indigo-100/60 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto max-h-60 overflow-y-auto">{JSON.stringify(stats, null, 2)}</pre>
            )}
            {activeTab === DETAIL_TABS.CODE && hasCode && (
              <pre className="bg-indigo-100/60 dark:bg-gray-900 p-2 rounded text-xs whitespace-pre-wrap break-all max-h-60 overflow-y-auto">{generatedCode}</pre>
            )}
            {activeTab === DETAIL_TABS.PROCESS && hasProcessUpdates && (
              <div className="bg-indigo-100/60 dark:bg-gray-900 p-2 rounded text-xs max-h-60 overflow-y-auto">
                {processUpdates.map((update, index) => (
                    // Use more stable key combining index and partial content
                    <p key={`${index}-${update ? update.substring(0, 20) : 'null'}`} className="whitespace-pre-wrap break-words font-mono text-gray-600 dark:text-gray-400">{update}</p>
                ))}
                <div ref={processEndRef} /> {/* Anchor for scrolling */}
               </div>
            )}
            {/* Placeholder if the active tab has no content */}
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
// Added handleLogout prop
function DataAnalysisPage({ datasetId, messages, setMessages, onCloseAnalysis, handleLogout }) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(''); // For spinner text only now
  const chatEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const [processUpdates, setProcessUpdates] = useState([]); // Stores raw log lines

  // Scroll to bottom whenever messages change or loading starts/stops
  useEffect(() => {
    const behavior = isLoading ? 'auto' : 'smooth'; // Use 'auto' during loading for less jumpiness
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior, block: 'end' }), 100); // Slight delay helps
  }, [messages, processUpdates, isLoading]);

  // Effect to handle SSE connection
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

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
            if (!isMounted) return; // Don't update state if component unmounted

            try {
                const data = JSON.parse(event.data);
                console.log('SSE Message Received:', data);

                 // *** Handle Raw Log Lines ***
                 if (data.rawLogLine) {
                     const newLog = data.rawLogLine;
                     setProcessUpdates(prev => {
                        // Prevent duplicates of final messages if they arrive late
                        if ((newLog.includes('Analysis complete.') && prev.some(p => p.includes('Analysis complete.'))) ||
                            (newLog.includes('Error during analysis:') && prev.some(p => p.includes('Error during analysis:')))) {
                           return prev;
                        }
                         return [...prev, newLog];
                     });
                     // Update simple loading status (optional, can remove if raw logs are enough)
                     if (!newLog.includes('---') && !newLog.includes('[Python]')) {
                         // Extract message part after analysis ID for spinner
                         const statusMatch = newLog.match(/\]\s*(.*)/);
                         if (statusMatch && statusMatch[1]) {
                            setLoadingStatus(statusMatch[1]);
                         }
                     }
                 }

                 // Handle Final Result (contains final data + code + summary)
                 if (data.result) {
                    // Final raw log might arrive slightly after result, ensure it's captured
                    const finalProcessLogs = [...processUpdates];
                     if (data.rawLogLine && !finalProcessLogs.includes(data.rawLogLine)) {
                         finalProcessLogs.push(data.rawLogLine);
                     }
                     // Ensure 'Analysis complete.' is the last log if successful
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
                            processUpdates: finalProcessLogs // Persist raw logs
                        }
                    }]);
                    setIsLoading(false);
                    setLoadingStatus('Analysis complete.'); // Final status for spinner text
                    setCurrentAnalysisId(null);
                    if (eventSourceRef.current) eventSourceRef.current.close();
                    eventSourceRef.current = null;
                }
                 // Handle Error Result (contains error message)
                 else if (data.error) {
                     const errorMessage = `Error: ${data.error}`;
                     // Final raw log might arrive slightly after error, ensure it's captured
                     const finalProcessLogs = [...processUpdates];
                      if (data.rawLogLine && !finalProcessLogs.includes(data.rawLogLine)) {
                         finalProcessLogs.push(data.rawLogLine);
                     }
                     // Ensure error message is included if not already in raw logs
                     if (!finalProcessLogs.some(p => p.includes(data.error))) {
                         finalProcessLogs.push(`[${currentAnalysisId || 'System'}] ${errorMessage}`); // Add analysis ID if available
                     }

                     setError(`Analysis failed: ${data.error}`);
                     setMessages(prev => [...prev, {
                        sender: 'bot',
                        content: { error: data.error, processUpdates: finalProcessLogs } // Persist raw logs on error too
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
            // Also attempt logout on SSE connection error, as it might be auth-related
            console.warn('SSE connection error, potentially auth-related. Triggering logout.');
            if (handleLogout) handleLogout();
        };

    } else {
         // Cleanup if loading stops for other reasons
         if (eventSourceRef.current) {
            console.log('Closing EventSource connection because loading stopped.');
            eventSourceRef.current.close();
            eventSourceRef.current = null;
         }
    }

    // Cleanup function
    return () => {
        isMounted = false; // Mark as unmounted
        console.log('DataAnalysisPage unmounting or dependencies changed. Cleaning up EventSource.');
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    };
  }, [currentAnalysisId, isLoading]); // Dependency array only includes triggers for setting up/tearing down


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
    setProcessUpdates([]); // Clear previous process logs
    setLoadingStatus('Initiating analysis...'); // Initial status for spinner
    setCurrentAnalysisId(null); // Reset analysis ID to ensure effect re-runs

    try {
      console.log(`Requesting analysis start for query: "${currentQuery}" dataset: "${datasetId}"`);
       // No initial processUpdates here, wait for SSE
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
       // Set the analysis ID to trigger the useEffect for SSE connection
      setCurrentAnalysisId(startData.analysisId);

    } catch (err) {
      console.error('Error initiating analysis request:', err);
      const errorMsg = `Failed to initiate analysis: ${err.message}`;
      setError(errorMsg);
      setProcessUpdates([`[System] ${errorMsg}`]); // Log initiation error with prefix
      setIsLoading(false);
      setLoadingStatus('Failed to start.');
      // Check for 401/403 errors
      if (err.message.includes('401') || err.message.includes('403')) {
          console.warn('Analysis start failed due to invalid/expired token.');
          if (handleLogout) handleLogout(); // Trigger logout
      }
    }
  }, [query, datasetId, isLoading]);


  // Define button styles based on reference
  const baseButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";
  const primaryButtonStyle = "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-900";
  const sendButtonStyle = "p-2.5 rounded-full";
  const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    // Light: indigo gradient
    <div className="flex flex-col h-full bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200/80 dark:border-gray-700/50 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
         {/* Light: indigo-50 tint */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700/80 bg-indigo-50/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                LLM Data Analysis {datasetId ? <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({datasetId})</span> : ''}
            </h2>
            {/* Light: indigo button */}
            <button
                onClick={onCloseAnalysis}
                className="flex items-center px-3 py-1 bg-indigo-100 hover:bg-indigo-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-indigo-800 dark:text-gray-200 text-sm font-medium rounded-md shadow-sm hover:shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-800"
                aria-label="Back to Dashboard"
            >
               <ArrowUturnLeftIcon className="h-4 w-4 mr-1" />
               Back
            </button>
        </div>

       {/* Chat Messages Area */}
       <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {/* Initial helper message */}
            {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center text-center pt-16 pb-8">
                <h2 className="text-2xl font-semibold mb-6 text-gray-700 dark:text-gray-300">How can I help you analyze the data?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg lg:max-w-xl">
                    {/* Example Suggestion Buttons - Light: indigo */}
                    <button onClick={() => setQuery('Show summary statistics')} className="p-3 bg-indigo-50/80 dark:bg-gray-700/80 border border-indigo-200 dark:border-gray-600/80 rounded-lg hover:bg-indigo-100 dark:hover:bg-gray-700 text-sm text-indigo-800 dark:text-gray-300 transition-colors text-left">
                        Show summary statistics
                    </button>
                    <button onClick={() => setQuery('Plot the distribution of [column_name]')} className="p-3 bg-indigo-50/80 dark:bg-gray-700/80 border border-indigo-200 dark:border-gray-600/80 rounded-lg hover:bg-indigo-100 dark:hover:bg-gray-700 text-sm text-indigo-800 dark:text-gray-300 transition-colors text-left">
                        Plot the distribution of...
                    </button>
                    <button onClick={() => setQuery('Show the top 5 rows with the highest [column_name]')} className="p-3 bg-indigo-50/80 dark:bg-gray-700/80 border border-indigo-200 dark:border-gray-600/80 rounded-lg hover:bg-indigo-100 dark:hover:bg-gray-700 text-sm text-indigo-800 dark:text-gray-300 transition-colors text-left">
                        Show the top 5 rows with the highest...
                    </button>
                    <button onClick={() => setQuery('Count missing values per column')} className="p-3 bg-indigo-50/80 dark:bg-gray-700/80 border border-indigo-200 dark:border-gray-600/80 rounded-lg hover:bg-indigo-100 dark:hover:bg-gray-700 text-sm text-indigo-800 dark:text-gray-300 transition-colors text-left">
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
                    ? 'bg-primary-600 text-white'
                    : 'bg-indigo-50/90 dark:bg-gray-700/80 text-gray-900 dark:text-gray-100'
                }`}
                >
                {msg.sender === 'user' && <p className="text-sm whitespace-normal break-words">{msg.content}</p>}
                {msg.sender === 'bot' && ( <div className="space-y-4 text-sm whitespace-normal break-words">
                    {/* Summary */}
                     {msg.content.summary && (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>
                            {msg.content.summary}
                            </ReactMarkdown>
                        </div>
                    )}
                    {/* Images */}
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
                     {/* Tabbed Details (Includes Error state via processUpdates) */}
                     {(msg.content.stats || msg.content.generatedCode || msg.content.processUpdates?.length > 0) && (
                        <TabbedDetailsCard
                            stats={msg.content.stats}
                            generatedCode={msg.content.generatedCode}
                            processUpdates={msg.content.processUpdates || []}
                            initiallyOpen={false} // Bot message details card starts closed
                            // Default to process tab if error occurred, otherwise stats/code
                            initialTab={msg.content.error ? DETAIL_TABS.PROCESS : (msg.content.stats ? DETAIL_TABS.STATS : (msg.content.generatedCode ? DETAIL_TABS.CODE : DETAIL_TABS.PROCESS))}
                        />
                     )}
                </div> )}
                </div>
            </div>
            ))}
            {/* Loading Indicator & Live Process Updates */}
             {isLoading && (
                 <div className="flex justify-start">
                     <div className="px-4 py-2 rounded-lg shadow-sm bg-indigo-50/90 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-indigo-100 dark:border-gray-600 w-full max-w-3xl lg:max-w-5xl">
                         {/* Spinner and Status Text */}
                         <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                             <svg className="animate-spin h-4 w-4 text-gray-600 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>{loadingStatus || 'Analyzing...'}</span>
                         </div>
                         {/* Details Card shown during loading, defaulting to Process tab, starts CLOSED */}
                         <TabbedDetailsCard
                             processUpdates={processUpdates} // Show live raw logs
                             initiallyOpen={false} // Starts closed during loading
                             initialTab={DETAIL_TABS.PROCESS}
                         />
                     </div>
                 </div>
             )}
            <div ref={chatEndRef} />
        </div>

       {/* Input Area */}
        {/* Light: indigo-50 tint */}
       <div className="p-4 border-t border-gray-200 dark:border-gray-700/80 bg-indigo-50/80 dark:bg-gray-800/80 backdrop-blur-sm sticky bottom-0 z-10">
        <div className="max-w-3xl mx-auto">
        {/* Global Error Display (outside messages) */}
         {error && !messages.some(msg => msg.sender === 'bot' && msg.content.error) && (
           <div className="mb-2 p-2 text-sm bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md flex items-center shadow-sm">
             <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" /> <span>{error}</span>
           </div>
         )}
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-grow px-4 py-2 border border-indigo-200 dark:border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-indigo-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm placeholder-gray-500 dark:placeholder-gray-500"
            placeholder="Ask about the data..."
            disabled={isLoading || !datasetId}
            aria-label="Data analysis query"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim() || !datasetId}
            className={`${baseButtonClasses.replace('px-4 py-2', 'p-2.5').replace('rounded-md','rounded-full')} ${primaryButtonStyle.replace('focus:ring-gray-500', 'focus:ring-primary-500')} ${disabledClasses}`}
            aria-label="Run Analysis"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
         {!datasetId && ( <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">Analysis disabled: Please upload a dataset first via the sidebar.</p> )}
      </div>
      </div>
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
};

// PropTypes for DataAnalysisPage
DataAnalysisPage.propTypes = {
  datasetId: PropTypes.string,
  messages: PropTypes.arrayOf(PropTypes.shape({
    sender: PropTypes.oneOf(['user', 'bot']).isRequired,
    content: PropTypes.oneOfType([
      PropTypes.string, // User message content
      PropTypes.shape({ // Bot message content
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
  handleLogout: PropTypes.func.isRequired, // Added handleLogout
};

// DefaultProps for DataAnalysisPage
DataAnalysisPage.defaultProps = {
  datasetId: null,
};


export default DataAnalysisPage;
