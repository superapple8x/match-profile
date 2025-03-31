import React, { useState } from 'react';
import PropTypes from 'prop-types';

// Retro Tab Component
const RetroTabButton = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 8px',
      border: isActive ? '2px inset #888888' : '2px outset #FFFFFF',
      backgroundColor: isActive ? '#A0A0A0' : '#C0C0C0', // Indicate active tab
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: isActive ? 'bold' : 'normal',
      color: '#000000',
      marginRight: '3px',
      marginBottom: '-1px', // Overlap bottom border slightly
      position: 'relative',
      zIndex: isActive ? 2 : 1,
    }}
  >
    {label}
  </button>
);

RetroTabButton.propTypes = {
    label: PropTypes.string.isRequired,
    isActive: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired,
};


// Main Card Component
function AnalysisResultCard({ analysisData }) {
  const [isExpanded, setIsExpanded] = useState(true); // Expanded by default
  const [activeTab, setActiveTab] = useState('Statistics'); // Default tab

  const toggleExpansion = () => setIsExpanded(!isExpanded);

  // --- Styling (Retro Theme) ---
  const cardStyle = {
    border: '2px outset #C0C0C0',
    backgroundColor: '#C0C0C0', // Silver background
    marginBottom: '10px',
    color: '#000000',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
  };

  const headerStyle = {
    backgroundColor: '#000080', // Navy blue title bar
    color: '#FFFFFF',
    padding: '3px 8px',
    fontWeight: 'bold',
    cursor: 'pointer', // Indicate clickable to expand/collapse
    borderBottom: '1px solid #000000',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '24px',
  };

  const contentAreaStyle = {
    padding: '0', // Padding will be inside tab content
    borderTop: '1px solid #888888', // Separator line below tabs
    backgroundColor: '#FFFFFF', // White background for content area
    display: isExpanded ? 'block' : 'none',
  };

   const tabContainerStyle = {
    padding: '5px 5px 0 5px', // Padding around tabs, no bottom padding
    borderBottom: '2px solid #888888', // Border below tabs
    backgroundColor: '#C0C0C0', // Match card background
    position: 'relative',
    zIndex: 1,
  };

  const tabContentStyle = {
    padding: '10px',
    minHeight: '100px', // Ensure some minimum height
    maxHeight: '400px', // Limit height and make scrollable
    overflowY: 'auto',
    backgroundColor: '#FFFFFF', // White background for content
  };

   const preStyle = {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '10px',
        marginTop: '5px',
        backgroundColor: '#000000', // Black background for pre
        padding: '8px',
        border: '1px solid #FFFF00', // Yellow border
        color: '#00FF00', // Lime text
        fontFamily: 'monospace',
        maxHeight: '300px', // Limit height within tab
        overflowY: 'auto',
    };

    const plotContainerStyle = {
        display: 'flex',
        overflowX: 'auto',
        gap: '10px',
        marginTop: '5px',
        paddingBottom: '5px',
        border: '1px dashed #AAAAAA',
        padding: '5px',
        backgroundColor: '#F0F0F0',
    };

    const plotImageStyle = {
        maxHeight: '250px',
        width: 'auto',
        border: '2px ridge #FF00FF', // Magenta ridge border
        flexShrink: 0
    };

  // --- Content Rendering Logic ---
  const renderTabContent = () => {
    switch (activeTab) {
      case 'Statistics':
        // Summary and Plots are now rendered directly in DataAnalysisPage
        return (
          <div>
            {/* Removed Summary rendering */}
            {analysisData.stats && Object.keys(analysisData.stats).length > 0 && (
                <div style={{ marginBottom: '10px' /* Removed borderBottom */ }}>
                    <b>Raw Statistics:</b>
                    <pre style={preStyle}>
                        {JSON.stringify(analysisData.stats, null, 2)}
                    </pre>
                </div>
             )}
             {/* Removed Plots rendering */}
             {(!analysisData.stats || Object.keys(analysisData.stats).length === 0) && (
                <p style={{ fontStyle: 'italic', color: '#555' }}>No statistics available.</p>
             )}
          </div>
        );
      case 'Generated Code':
        return (
          <div>
            {analysisData.generatedCode ? (
              <pre style={preStyle}>{analysisData.generatedCode}</pre>
            ) : (
              <p style={{ fontStyle: 'italic', color: '#555' }}>No generated code available.</p>
            )}
          </div>
        );
      case 'Process Log':
        return (
          <div>
            {analysisData.processUpdates && analysisData.processUpdates.length > 0 ? (
              <pre style={{...preStyle, color: '#CCCCCC' }}>{analysisData.processUpdates.join('\n')}</pre>
            ) : (
              <p style={{ fontStyle: 'italic', color: '#555' }}>No process log available.</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Determine if there's any content to display besides error/summary
  const hasAnalysisContent = analysisData.stats || analysisData.imageUris || analysisData.generatedCode || analysisData.processUpdates;

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={headerStyle} onClick={toggleExpansion}>
        <span>Analysis Results</span>
        {/* Use Webdings/Wingdings for expand/collapse icons */}
        <span style={{ fontFamily: '"Webdings", "Wingdings", sans-serif', fontSize: '16px' }}>
          {isExpanded ? '6' : '5'} {/* Down arrow : Right arrow */}
        </span>
      </div>

      {/* Content Area (Tabs + Content) */}
      {isExpanded && hasAnalysisContent && (
        <div style={{ borderTop: '1px solid #888888' }}>
            {/* Tabs */}
            <div style={tabContainerStyle}>
                <RetroTabButton label="Statistics" isActive={activeTab === 'Statistics'} onClick={() => setActiveTab('Statistics')} />
                <RetroTabButton label="Generated Code" isActive={activeTab === 'Generated Code'} onClick={() => setActiveTab('Generated Code')} />
                <RetroTabButton label="Process Log" isActive={activeTab === 'Process Log'} onClick={() => setActiveTab('Process Log')} />
            </div>
            {/* Tab Content */}
            <div style={tabContentStyle}>
                {renderTabContent()}
            </div>
        </div>
      )}
       {/* Show only summary/error if no other content and expanded */}
       {isExpanded && !hasAnalysisContent && (
           <div style={{...tabContentStyle, borderTop: '1px solid #888888'}}>
               {analysisData.summary && (
                   <div><b>Summary:</b><pre style={{...preStyle, color: '#333333', backgroundColor: '#F8F8F8', border: '1px solid #CCCCCC' }}>{analysisData.summary}</pre></div>
               )}
               {analysisData.error && (
                   <p style={{ color: 'red', fontWeight: 'bold', border: '1px dashed red', padding: '3px', backgroundColor: '#330000' }}>Error: {analysisData.error}</p>
               )}
               {!analysisData.summary && !analysisData.error && (
                   <p style={{ fontStyle: 'italic', color: '#555' }}>No analysis results to display.</p>
               )}
           </div>
       )}
    </div>
  );
}

AnalysisResultCard.propTypes = {
  analysisData: PropTypes.shape({
    // summary: PropTypes.string, // Removed
    stats: PropTypes.object,
    // imageUris: PropTypes.arrayOf(PropTypes.string), // Removed
    generatedCode: PropTypes.string,
    processUpdates: PropTypes.arrayOf(PropTypes.string),
    error: PropTypes.string,
  }).isRequired,
};

export default AnalysisResultCard;