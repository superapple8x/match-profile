import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon, ExclamationCircleIcon, InformationCircleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown

// Simple Collapsible Card Component
function CollapsibleCard({ title, children, initiallyOpen = false }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <div className="border rounded-md dark:border-gray-700 overflow-hidden bg-indigo-50/70 dark:bg-gray-800/50 shadow-sm"> {/* Light: indigo-50 tint */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 bg-indigo-100/50 dark:bg-gray-700/50 hover:bg-indigo-100 dark:hover:bg-gray-600/50 focus:outline-none" // Light: indigo-100 tint
      >
        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{title}</span>
        {isOpen ? (
          <ChevronUpIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-3 bg-indigo-50/50 dark:bg-gray-800/30"> {/* Light: indigo-50 tint */}
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
                        const newMessages = [...prev];
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
        };
    }
  }, [currentAnalysisId, isLoading, setMessages, messages]);


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
      setMessages(prev => [...prev, { sender: 'bot', content: { error: errorMsg } }]);
      setIsLoading(false);
      setLoadingStatus('');
    }
  }, [query, datasetId, setMessages, isLoading]);

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
                // Increased max width
                className={`max-w-3xl lg:max-w-5xl px-5 py-3 rounded-xl shadow ${
                    msg.sender === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-indigo-50/90 dark:bg-gray-700/80 text-gray-900 dark:text-gray-100'
                }`}
                >
                {msg.sender === 'user' && <p className="text-sm">{msg.content}</p>}
                {msg.sender === 'bot' && ( <div className="space-y-4 text-sm"> {/* Added text-sm for consistent size */}
                    {msg.content.error && ( <div className="text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-3 rounded-md shadow-inner">
                        <p className="font-semibold text-sm flex items-center mb-1"><ExclamationCircleIcon className="h-5 w-5 mr-1.5"/>Error:</p>
                        <p className="text-sm">{msg.content.error}</p>
                        {msg.content.logs && ( <CollapsibleCard title="Error Logs" initiallyOpen={false}>
                            <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-40">{msg.content.logs}</pre>
                         </CollapsibleCard> )}
                    </div> )}
                    {/* Render summary using ReactMarkdown, removed className */}
                    {msg.content.summary && (
                         <ReactMarkdown>
                            {msg.content.summary}
                         </ReactMarkdown>
                    )}
                    {/* Horizontal scroll for images */}
                    {msg.content.imageUris && msg.content.imageUris.length > 0 && (
                        <div className="flex overflow-x-auto space-x-3 py-2">
                            {msg.content.imageUris.map((uri, imgIndex) => (
                                <img
                                    key={imgIndex}
                                    src={uri}
                                    alt={`Generated plot ${imgIndex + 1}`}
                                    // Adjust image styling for horizontal layout
                                    className="max-h-80 w-auto object-contain border rounded dark:border-gray-600 shadow-md flex-shrink-0"
                                />
                            ))}
                        </div>
                    )}
                    {msg.content.stats && ( <CollapsibleCard title="Calculated Statistics">
                         {/* Light: indigo-100 tint */}
                        <pre className="bg-indigo-100/60 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(msg.content.stats, null, 2)}</pre>
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
                 {/* Light: indigo-50 tint */}
                <div className="px-4 py-2 rounded-lg shadow-sm bg-indigo-50/90 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-indigo-100 dark:border-gray-600">
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
        {/* Light: indigo-50 tint */}
       <div className="p-4 border-t border-gray-200 dark:border-gray-700/80 bg-indigo-50/80 dark:bg-gray-800/80 backdrop-blur-sm sticky bottom-0 z-10">
        <div className="max-w-3xl mx-auto"> {/* Centering and max-width container */}
        {/* Global Error Display */}
        {error && !messages.some(msg => msg.sender === 'bot' && msg.content.error) && ( <div className="mb-2 p-2 text-sm bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md flex items-center shadow-sm">
            <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" /> <span>{error}</span>
        </div> )}
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
             // Light: indigo-50 bg
            className="flex-grow px-4 py-2 border border-indigo-200 dark:border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-indigo-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm placeholder-gray-500 dark:placeholder-gray-500"
            placeholder="Ask about the data..."
            disabled={isLoading || !datasetId}
            aria-label="Data analysis query"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim() || !datasetId}
            // Subtle Dark Gray Style for Send button (round) - Adjusted focus for consistency
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

export default DataAnalysisPage;
