import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import AnalysisResultCard from './AnalysisResultCard'; // Import the new card component

// Updated DataAnalysisPage component for new retro theme
function DataAnalysisPage({ datasetId, messages, setMessages, onCloseAnalysis, authToken, handleLogout, isAuthenticated, switchToAuthView }) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [processUpdates, setProcessUpdates] = useState([]);
  const chatEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Scroll to bottom
  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
  }, [messages, processUpdates, isLoading]);

  // Effect to handle SSE connection (logic remains the same)
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
                     setProcessUpdates(prev => prev.includes(newLog) ? prev : [...prev, newLog]);
                     const statusMatch = newLog.match(/\]\s*(.*)/);
                     if (statusMatch && statusMatch[1] && !newLog.includes('---') && !newLog.includes('[Python]')) {
                        setLoadingStatus(statusMatch[1]);
                     }
                 }
                 if (data.result) {
                    const finalProcessLogs = [...processUpdates];
                     if (data.rawLogLine && !finalProcessLogs.includes(data.rawLogLine)) finalProcessLogs.push(data.rawLogLine);
                     if (!finalProcessLogs.some(p => p.includes('Analysis complete.'))) finalProcessLogs.push(`[${currentAnalysisId}] Analysis complete.`);
                    setMessages(prev => [...prev, { sender: 'bot', content: { ...data.result, processUpdates: finalProcessLogs } }]);
                    setIsLoading(false); setLoadingStatus(''); setProcessUpdates([]); setCurrentAnalysisId(null);
                    if (eventSourceRef.current) eventSourceRef.current.close(); eventSourceRef.current = null;
                }
                 else if (data.error) {
                     const errorMessage = `Error: ${data.error}`;
                     const finalProcessLogs = [...processUpdates];
                      if (data.rawLogLine && !finalProcessLogs.includes(data.rawLogLine)) finalProcessLogs.push(data.rawLogLine);
                      if (!finalProcessLogs.some(p => p.includes(data.error))) finalProcessLogs.push(`[${currentAnalysisId || 'System'}] ${errorMessage}`);
                     setError(`Analysis failed: ${data.error}`);
                     setMessages(prev => [...prev, { sender: 'bot', content: { error: data.error, processUpdates: finalProcessLogs } }]);
                    setIsLoading(false); setLoadingStatus(''); setProcessUpdates([]); setCurrentAnalysisId(null);
                    if (eventSourceRef.current) eventSourceRef.current.close(); eventSourceRef.current = null;
                }
            } catch (parseError) {
                console.error('Failed to parse SSE message:', event.data, parseError);
                 const errorMsg = '[System] Failed to process analysis update.';
                 setError(errorMsg.replace('[System] ', ''));
                 setProcessUpdates(prev => [...prev, errorMsg]);
                 setIsLoading(false); setLoadingStatus('Update error.');
                 if (eventSourceRef.current) eventSourceRef.current.close(); eventSourceRef.current = null;
            }
        };
        es.onerror = (err) => {
             if (!isMounted) return;
            console.error('EventSource failed:', err);
            const errorMsg = '[System] Connection error during analysis. Please try again.';
            setError(errorMsg.replace('[System] ', ''));
            setProcessUpdates(prev => [...prev, errorMsg]);
            setIsLoading(false); setLoadingStatus('Connection error.'); setCurrentAnalysisId(null);
            if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
            console.warn('SSE connection error, potentially auth-related. Triggering logout.');
            if (handleLogout) handleLogout();
        };
    } else {
         if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    }
    return () => {
        isMounted = false;
        if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    };
  }, [currentAnalysisId, isLoading, handleLogout]); // Keep handleLogout dependency

  // Submit handler (logic remains the same)
  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    const currentQuery = query.trim();
    if (!currentQuery || isLoading || !datasetId) {
        if (!datasetId) setError('Dataset ID is missing.');
        return;
    }
    setMessages(prev => [...prev, { sender: 'user', content: currentQuery }]);
    setQuery(''); setIsLoading(true); setError(null); setProcessUpdates([]);
    setLoadingStatus('Initiating analysis...'); setCurrentAnalysisId(null);
    try {
      const startResponse = await fetch('/api/start-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authToken && { 'Authorization': `Bearer ${authToken}` }) },
          body: JSON.stringify({ query: currentQuery, datasetId }),
      });
      const startData = await startResponse.json();
      if (!startResponse.ok) throw new Error(startData.error || `Failed to start analysis (${startResponse.status})`);
      setCurrentAnalysisId(startData.analysisId);
    } catch (err) {
      console.error('Error initiating analysis request:', err);
      const errorMsg = `Failed to initiate analysis: ${err.message}`;
      setError(errorMsg); setProcessUpdates([`[System] ${errorMsg}`]);
      setIsLoading(false); setLoadingStatus('Failed to start.');
      if (err.message.includes('401') || err.message.includes('403')) {
          if (handleLogout) handleLogout();
      }
    }
  }, [query, datasetId, isLoading, authToken, handleLogout, setMessages]); // Added dependencies

  // Helper to render bot message content with distinct sections
  const renderBotContent = (content) => {
    // Retro styles for sections within the bot message
    const sectionStyle = {
        border: '1px dashed #00FFFF', // Cyan dashed border
        padding: '5px',
        margin: '8px 0',
        backgroundColor: '#000033', // Dark blue background
        color: '#FFFFFF', // White text
        fontSize: '11px',
    };
     const plotContainerStyle = {
        display: 'flex',
        overflowX: 'auto',
        gap: '10px',
        marginTop: '5px',
        paddingBottom: '5px',
    };
    const plotImageStyle = {
        maxHeight: '200px', // Keep plots reasonably sized in the main flow
        width: 'auto',
        border: '2px ridge #FF00FF', // Magenta ridge border
        flexShrink: 0
    };
     const summaryPreStyle = {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '11px', // Slightly larger for summary
        marginTop: '5px',
        color: '#FFFFFF',
        fontFamily: 'Arial, sans-serif', // Non-monospace for summary
        backgroundColor: 'transparent',
        border: 'none',
        padding: 0
    };

    // Data to pass specifically to the card component
    const cardData = {
        stats: content.stats,
        generatedCode: content.generatedCode,
        processUpdates: content.processUpdates,
        error: content.error // Pass error in case it needs to be shown in the card too? Or handle outside? Let's pass it for now.
    };

    // Check if there's any data relevant for the card
    const hasCardData = cardData.stats || cardData.generatedCode || cardData.processUpdates || cardData.error;

    return (
        <div style={{ marginTop: '5px' }}>
            {/* 1. Summary Section */}
            {content.summary && (
                <div style={sectionStyle}>
                    <b>Summary:</b>
                    <pre style={summaryPreStyle}>
                        {content.summary}
                    </pre>
                </div>
            )}

            {/* 2. Generated Plots Section */}
            {content.imageUris && content.imageUris.length > 0 && (
                <div style={sectionStyle}>
                    <b>Generated Plots:</b>
                    <div style={plotContainerStyle}>
                        {content.imageUris.map((uri, imgIndex) => (
                            <img
                                key={imgIndex}
                                src={uri}
                                alt={`Generated plot ${imgIndex + 1}`}
                                style={plotImageStyle}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Details Card Section (Statistics, Code, Log) */}
            {hasCardData && (
                 <AnalysisResultCard analysisData={cardData} />
            )}

            {/* Optional: Display top-level error if not handled within card */}
            {content.error && !hasCardData && (
                 <p style={{ color: 'red', fontWeight: 'bold', border: '1px dashed red', padding: '3px', backgroundColor: '#330000', fontSize: '11px' }}>Error: {content.error}</p>
            )}
        </div>
    );
  };

  return (
    // Use content-cell style for consistency
    <div className="content-cell" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' /* Adjust height based on header/footer */ }}>
        {/* Header - Apply retro styles */}
        <div style={{ padding: '5px 10px', borderBottom: '3px double #FF00FF', backgroundColor: '#C0C0C0', color: '#000000', flexShrink: 0 }}>
            <h2 className="form-title" style={{ margin: 0, display: 'inline-block', color: '#FF0000' }}>
                LLM Data Analysis {datasetId ? <span style={{ fontSize: '0.8em', fontWeight: 'normal' }}>({datasetId})</span> : ''}
            </h2>
            <button
                onClick={onCloseAnalysis}
                className="button" // Use button class
                style={{ float: 'right', padding: '2px 8px', fontSize: '12px', backgroundColor: '#FFFF00', borderColor: '#AAAA00' }} // Yellow button
                title="Back to Dashboard"
            >
               &lt; Back
            </button>
        </div>

       {/* Chat Messages Area - Apply retro background */}
       <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#EEEEEE', border: '1px solid #000000' }}>
            {messages.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#000080' }}>
                <h3 style={{ marginTop: 0, fontFamily: '"Comic Sans MS", cursive, sans-serif' }}>How can I help you analyze the data?</h3>
                <p style={{ fontSize: '11px' }}><i>(e.g., "Show summary statistics", "Plot distribution of Age", "Count missing values")</i></p>
            </div>
            )}

            {messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: '10px', clear: 'both', overflow: 'hidden' /* Contain floats */ }}>
                <div
                    style={{
                        maxWidth: '75%',
                        padding: '8px 12px',
                        border: msg.sender === 'user' ? '2px outset #00AA00' : '2px outset #0055AA', // Different borders
                        float: msg.sender === 'user' ? 'right' : 'left',
                        backgroundColor: msg.sender === 'user' ? '#D0FFD0' : '#D0D0FF', // Light green/blue backgrounds
                        color: '#000000', // Black text
                        // Add some margin based on sender
                        marginLeft: msg.sender === 'bot' ? '5px' : 'auto',
                        marginRight: msg.sender === 'user' ? '5px' : 'auto',
                    }}
                >
                {msg.sender === 'user' && <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>}
                {msg.sender === 'bot' && renderBotContent(msg.content)}
                </div>
            </div>
            ))}

            {/* Loading Indicator */}
             {isLoading && (
                 <div style={{ marginBottom: '10px', clear: 'both', overflow: 'hidden' }}>
                     <div style={{ maxWidth: '75%', padding: '8px 12px', border: '2px outset #888888', float: 'left', backgroundColor: '#C0C0C0', color: '#000000' }}>
                         <p style={{ margin: '0 0 5px 0', fontStyle: 'italic' }}>
                            <span className="blink">***</span> {loadingStatus || 'Analyzing...'} <span className="blink">***</span>
                         </p>
                         {/* Show live process updates during loading */}
                         {processUpdates.length > 0 && (
                             <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '10px', maxHeight: '100px', overflowY: 'auto', backgroundColor: '#000000', padding: '5px', border: '1px solid #FFFF00', color: '#CCCCCC', marginTop: '5px', fontFamily: 'monospace' }}>
                                 {processUpdates.join('\n')}
                             </pre>
                         )}
                     </div>
                 </div>
             )}
            <div ref={chatEndRef} />
        </div>

       {/* Input Area - Apply retro styles */}
       <div style={{ padding: '10px', borderTop: '3px double #FF00FF', backgroundColor: '#C0C0C0', flexShrink: 0 }}>
         {error && (
           <div style={{ marginBottom: '5px', padding: '5px', color: 'red', backgroundColor: '#330000', border: '1px solid red', fontSize: '11px', fontWeight: 'bold' }}>
             Error: {error}
           </div>
         )}
         {!isAuthenticated && datasetId && (
           <div style={{ marginBottom: '5px', padding: '5px', color: '#000080', backgroundColor: '#ADD8E6', border: '1px solid #000080', fontSize: '11px' }}>
             Log in or register to save analysis sessions.
             <button
               onClick={switchToAuthView}
               className="button" // Use button class
               style={{ marginLeft: '10px', padding: '1px 5px', fontSize: '11px', backgroundColor: '#FF00FF', borderColor: '#AA00AA' }} // Magenta button
             >
               Login / Register
             </button>
           </div>
         )}
        <form onSubmit={handleSubmit} style={{ display: 'flex' }}>
          {/* Use basic input styles */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flexGrow: 1, marginRight: '10px' }}
            placeholder="Ask about the data..."
            disabled={isLoading || !datasetId}
            aria-label="Data analysis query"
          />
          {/* Use .button class */}
          <button
            type="submit"
            disabled={isLoading || !query.trim() || !datasetId}
            className="button" // Lime green button
            style={{ padding: '6px 12px' }} // Adjust padding if needed
          >
            Send!
          </button>
        </form>
         {!datasetId && ( <p style={{ marginTop: '5px', fontSize: '10px', color: '#8B4513', fontWeight: 'bold' }}>Analysis disabled: Please upload a dataset first.</p> )}
      </div>
    </div>
  );
}

// Simplified PropTypes
DataAnalysisPage.propTypes = {
  datasetId: PropTypes.string,
  messages: PropTypes.array.isRequired,
  setMessages: PropTypes.func.isRequired,
  onCloseAnalysis: PropTypes.func.isRequired,
  authToken: PropTypes.string,
  handleLogout: PropTypes.func.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  switchToAuthView: PropTypes.func.isRequired,
};

DataAnalysisPage.defaultProps = {
  datasetId: null,
  authToken: null,
};


export default DataAnalysisPage;
