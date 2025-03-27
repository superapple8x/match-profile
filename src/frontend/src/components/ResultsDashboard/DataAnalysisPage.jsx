import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon, ExclamationCircleIcon, InformationCircleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/solid';

// Simple Collapsible Card Component
function CollapsibleCard({ title, children, initiallyOpen = false }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <div className="border rounded-md dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800/50 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600/50 focus:outline-none"
      >
        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{title}</span>
        {isOpen ? (
          <ChevronUpIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-3 bg-white dark:bg-gray-800/30">
          {children}
        </div>
      )}
    </div>
  );
}
// --- End CollapsibleCard ---

function DataAnalysisPage({ datasetId, messages, setMessages, onCloseAnalysis }) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const chatEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Effect to handle SSE connection
  useEffect(() => {
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
            try {
                const data = JSON.parse(event.data);
                console.log('SSE Message Received:', data);

                if (data.status) {
                    setLoadingStatus(data.status);
                } else if (data.logs) {
                    setMessages(prev => {
                        const lastMsgIndex = prev.length - 1;
                        if (lastMsgIndex >= 0 && prev[lastMsgIndex].sender === 'bot') {
                            const updatedMessages = [...prev];
                            const lastMsg = updatedMessages[lastMsgIndex];
                            // Ensure logs are part of content, even if error exists
                            const currentContent = lastMsg.content || {};
                            updatedMessages[lastMsgIndex] = {
                                ...lastMsg,
                                content: {
                                    ...currentContent,
                                    logs: (currentContent.logs || '') + data.logs
                                }
                            };
                            return updatedMessages;
                        }
                        // If no bot message yet, maybe queue logs? Or ignore for now.
                        return prev;
                    });
                } else if (data.result) {
                    setMessages(prev => [...prev, {
                        sender: 'bot',
                        content: {
                            imageUris: data.result.imageUris || [],
                            summary: data.result.summary,
                            stats: data.result.stats,
                            logs: '', // Assume logs were sent incrementally
                        }
                    }]);
                    setIsLoading(false);
                    setLoadingStatus('');
                    setCurrentAnalysisId(null);
                    es.close();
                    eventSourceRef.current = null;
                } else if (data.error) {
                    setError(`Analysis failed: ${data.error}`);
                    setMessages(prev => {
                         // Check if last message was the user's query, if so append error bot message
                         // Otherwise, if last message was already an error or status, maybe update it?
                         // For simplicity, just add a new error message for now.
                        const newMessages = [...prev];
                        // Append logs received *before* the error to the error message content
                        const lastMsgIndex = newMessages.length - 1;
                        let logsWithError = '';
                        if (lastMsgIndex >=0 && newMessages[lastMsgIndex].sender === 'bot' && newMessages[lastMsgIndex].content?.logs) {
                            logsWithError = newMessages[lastMsgIndex].content.logs;
                        }

                        newMessages.push({
                            sender: 'bot',
                            content: { error: data.error, logs: logsWithError }
                        });
                         return newMessages;
                    });

                    setIsLoading(false);
                    setLoadingStatus('');
                    setCurrentAnalysisId(null);
                    es.close();
                    eventSourceRef.current = null;
                }
            } catch (parseError) {
                console.error('Failed to parse SSE message:', event.data, parseError);
            }
        };

        es.onerror = (err) => {
            console.error('EventSource failed:', err);
            const errorMsg = 'Connection error during analysis. Please try again.';
            setError(errorMsg);
             if (!messages.some(msg => msg.sender === 'bot' && msg.content.error === errorMsg)) {
                 setMessages(prev => [...prev, {
                     sender: 'bot',
                     content: { error: errorMsg }
                 }]);
             }
            setIsLoading(false);
            setLoadingStatus('');
            setCurrentAnalysisId(null);
            es.close();
            eventSourceRef.current = null;
        };

        return () => {
            console.log('Closing EventSource connection due to cleanup.');
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            // Don't reset isLoading here, might cause flicker if component re-renders fast
        };
    }
  }, [currentAnalysisId, isLoading, setMessages, messages]); // Added messages dependency for log appending


  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    const currentQuery = query.trim();
    if (!currentQuery || isLoading) return; // Prevent submit if empty or already loading
    if (!datasetId) {
        setError('Dataset ID is missing. Cannot perform analysis.');
        return;
    }

    setMessages(prev => [...prev, { sender: 'user', content: currentQuery }]);
    setQuery('');
    setIsLoading(true);
    setError(null);
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
      setCurrentAnalysisId(startData.analysisId); // Trigger SSE connection

    } catch (err) {
      console.error('Error initiating analysis request:', err);
      const errorMsg = `Failed to initiate analysis: ${err.message}`;
      setError(errorMsg);
      setMessages(prev => [...prev, { sender: 'bot', content: { error: errorMsg } }]);
      setIsLoading(false);
      setLoadingStatus('');
    }
  }, [query, datasetId, setMessages, isLoading]); // Added isLoading dependency

  // Define button styles based on reference
  const baseButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";
  const primaryButtonStyle = "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-900";
  const sendButtonStyle = "p-2.5 rounded-full"; // Specific style for round send button
  const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200/80 dark:border-gray-700/50 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                LLM Data Analysis {datasetId ? <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({datasetId})</span> : ''}
            </h2>
            {/* Using lighter gray secondary style for back button */}
            <button
                onClick={onCloseAnalysis}
                className="flex items-center px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md shadow-sm hover:shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                aria-label="Back to Dashboard"
            >
               <ArrowUturnLeftIcon className="h-4 w-4 mr-1" />
               Back
            </button>
        </div>

       {/* Chat Messages Area */}
       <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {/* Initial helper message */}
            {messages.length === 0 && !isLoading && !error && (
            <div className="flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600/50">
                <InformationCircleIcon className="h-5 w-5 mr-2" />
                <span>Enter a query below to analyze the dataset...</span>
            </div>
            )}

            {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                // Subtle dark gray for user bubble, standard white/gray for bot
                className={`max-w-xl lg:max-w-3xl px-4 py-2.5 rounded-lg shadow-md ${
                    msg.sender === 'user'
                    ? 'bg-gray-700 dark:bg-gray-600 text-white' // User bubble dark gray
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600' // Bot bubble standard bg
                }`}
                >
                {msg.sender === 'user' && <p className="text-sm">{msg.content}</p>}
                {msg.sender === 'bot' && ( <div className="space-y-4">
                    {msg.content.error && ( <div className="text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-3 rounded-md shadow-inner">
                        <p className="font-semibold text-sm flex items-center mb-1"><ExclamationCircleIcon className="h-5 w-5 mr-1.5"/>Error:</p>
                        <p className="text-sm">{msg.content.error}</p>
                        {msg.content.logs && ( <CollapsibleCard title="Error Logs" initiallyOpen={false}>
                            <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-40">{msg.content.logs}</pre>
                         </CollapsibleCard> )}
                    </div> )}
                    {msg.content.summary && <p className="text-sm whitespace-pre-wrap">{msg.content.summary}</p>}
                    {msg.content.imageUris && msg.content.imageUris.length > 0 && ( <div className="space-y-3 pt-2">
                        {msg.content.imageUris.map((uri, imgIndex) => ( <img key={imgIndex} src={uri} alt={`Generated plot ${imgIndex + 1}`} className="max-w-full h-auto border rounded dark:border-gray-600 shadow-md"/> ))}
                    </div> )}
                    {msg.content.stats && ( <CollapsibleCard title="Calculated Statistics">
                        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(msg.content.stats, null, 2)}</pre>
                    </CollapsibleCard> )}
                    {msg.content.logs && !msg.content.error && ( <CollapsibleCard title="Execution Logs">
                        <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-40">{msg.content.logs}</pre>
                    </CollapsibleCard> )}
                </div> )}
                </div>
            </div>
            ))}
            {/* Loading Indicator */}
            {isLoading && ( <div className="flex justify-start">
                <div className="px-4 py-2 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400"> {/* Neutral loading text */}
                        <svg className="animate-spin h-4 w-4 text-gray-600 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{loadingStatus || 'Analyzing...'}</span>
                    </div>
                </div>
            </div> )}
            <div ref={chatEndRef} />
        </div>

       {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky bottom-0 z-10">
        {/* Global Error Display */}
        {error && !messages.some(msg => msg.sender === 'bot' && msg.content.error) && ( <div className="mb-2 p-2 text-sm bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md flex items-center shadow-sm">
            <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" /> <span>{error}</span>
        </div> )}
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Subtle input style
            className="flex-grow px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 sm:text-sm placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Ask about the data..."
            disabled={isLoading || !datasetId}
            aria-label="Data analysis query"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim() || !datasetId}
            // Subtle Dark Gray Style for Send button (round)
            className={`${baseButtonClasses.replace('px-4 py-2', 'p-2.5').replace('rounded-md','rounded-full')} ${primaryButtonStyle} ${disabledClasses}`}
            aria-label="Run Analysis"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
         {!datasetId && ( <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">Analysis disabled: Please upload a dataset first via the sidebar.</p> )}
      </div>
    </div>
  );
}

export default DataAnalysisPage;
