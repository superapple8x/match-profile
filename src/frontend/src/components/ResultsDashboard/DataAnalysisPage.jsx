import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon, ExclamationCircleIcon, InformationCircleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/solid'; // Added ArrowUturnLeftIcon

// Simple Collapsible Card Component
function CollapsibleCard({ title, children, initiallyOpen = false }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    // Add slight shadow for depth
    <div className="border rounded-md dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800/50 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600/50 focus:outline-none"
      >
        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{title}</span> {/* Slightly smaller title */}
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

// Updated DataAnalysisPage props
function DataAnalysisPage({ datasetId, messages, setMessages, onCloseAnalysis }) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  // Scroll to bottom whenever messages change (using prop messages)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    const currentQuery = query.trim();
    if (!currentQuery) {
      setError('Please enter a query.');
      return;
    }
    if (!datasetId) {
        setError('Dataset ID is missing. Cannot perform analysis.');
        return;
    }

    setMessages(prev => [...prev, { sender: 'user', content: currentQuery }]);
    setQuery('');
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Sending query: "${currentQuery}" for dataset: "${datasetId}"`);
      const response = await fetch('/api/analyze-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, datasetId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error Response:', data);
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      console.log('API Success Response:', data);
      setMessages(prev => [...prev, {
        sender: 'bot',
        content: {
          imageUris: data.imageUris || [],
          summary: data.summary,
          stats: data.stats,
          logs: data.logs || '',
        }
      }]);

    } catch (err) {
      console.error('Error during analysis request:', err);
      const errorMessage = `Analysis failed: ${err.message}`;
      setError(errorMessage);
      setMessages(prev => [...prev, {
          sender: 'bot',
          content: { error: errorMessage, logs: err.response?.data?.logs }
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [query, datasetId, setMessages]);

  return (
    // Use full height of parent container
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200/80 dark:border-gray-700/50 rounded-lg shadow-lg overflow-hidden">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                LLM Data Analysis {datasetId ? <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({datasetId})</span> : ''}
            </h2>
            <button
                onClick={onCloseAnalysis}
                className="flex items-center px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-100 text-sm font-medium rounded-md shadow-sm hover:shadow-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
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
            <span>Enter a query below to analyze the dataset (e.g., "Plot Age distribution", "Show general EDA").</span>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              // Reverted to solid indigo for user bubble
              className={`max-w-xl lg:max-w-3xl px-4 py-2.5 rounded-lg shadow-md ${ // Kept shadow for depth
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white' // User bubble solid indigo
                  : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600' // Bot bubble standard bg
              }`}
            >
              {/* User Message */}
              {msg.sender === 'user' && (
                <p className="text-sm">{msg.content}</p>
              )}

              {/* Bot Message */}
              {msg.sender === 'bot' && (
                <div className="space-y-4">
                  {/* Error Display */}
                  {msg.content.error && (
                    <div className="text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-3 rounded-md shadow-inner">
                      <p className="font-semibold text-sm flex items-center mb-1"><ExclamationCircleIcon className="h-5 w-5 mr-1.5"/>Error:</p>
                      <p className="text-sm">{msg.content.error}</p>
                       {msg.content.logs && (
                         <CollapsibleCard title="Error Logs" initiallyOpen={false}>
                            <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-40">
                                {msg.content.logs}
                            </pre>
                         </CollapsibleCard>
                       )}
                    </div>
                  )}

                  {/* Summary */}
                  {msg.content.summary && (
                     <p className="text-sm whitespace-pre-wrap">{msg.content.summary}</p>
                  )}

                  {/* Plots - Iterate over imageUris */}
                  {msg.content.imageUris && msg.content.imageUris.length > 0 && (
                    <div className="space-y-3 pt-2">
                      {msg.content.imageUris.map((uri, imgIndex) => (
                          <img
                              key={imgIndex}
                              src={uri}
                              alt={`Generated data analysis plot ${imgIndex + 1}`}
                              className="max-w-full h-auto border rounded dark:border-gray-600 shadow-md"
                          />
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  {msg.content.stats && (
                     <CollapsibleCard title="Calculated Statistics">
                        <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">
                         {JSON.stringify(msg.content.stats, null, 2)}
                        </pre>
                     </CollapsibleCard>
                  )}

                  {/* Logs (Only show if no error logs were shown) */}
                   {msg.content.logs && !msg.content.error && (
                     <CollapsibleCard title="Execution Logs">
                        <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-40">
                            {msg.content.logs}
                        </pre>
                     </CollapsibleCard>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Loading Indicator - Reverted to Indigo */}
        {isLoading && (
          <div className="flex justify-start">
              <div className="px-4 py-2 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center space-x-2 text-sm text-indigo-600 dark:text-indigo-400"> {/* Reverted to indigo */}
                    <svg className="animate-spin h-4 w-4 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> {/* Reverted to indigo */}
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Analyzing...</span>
                </div>
              </div>
          </div>
        )}
        {/* Invisible element to scroll to */}
        <div ref={chatEndRef} />
      </div>

       {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky bottom-0 z-10">
        {/* Global Error Display (outside chat) */}
        {error && !messages.some(msg => msg.sender === 'bot' && msg.content.error) && (
            <div className="mb-2 p-2 text-sm bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md flex items-center shadow-sm">
                <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
            </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Reverted input focus ring to indigo
            className="flex-grow px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
            placeholder="Ask about the data..."
            disabled={isLoading || !datasetId}
            aria-label="Data analysis query"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim() || !datasetId}
            // Reverted send button style - Solid Indigo, round
            className={`inline-flex items-center justify-center p-2.5 border border-transparent rounded-full shadow-sm text-white transition-colors duration-200 ease-in-out ${
              (isLoading || !query.trim() || !datasetId)
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-70' // Disabled style
                : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800' // Active solid indigo
            }`}
            aria-label="Run Analysis"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
         {!datasetId && (
             <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">Analysis disabled: Please upload a dataset first via the sidebar.</p>
         )}
      </div>
    </div>
  );
}

export default DataAnalysisPage;
