import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

// DetailsWindow component - Fixed data display and dragging
function DetailsWindow({ matchData, datasetAttributes, onClose }) {
  // Ensure initial position is reasonable (e.g., slightly offset from top-left)
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef(null);

  // --- Dragging Logic ---
  const handleMouseMove = useCallback((e) => {
    // Calculate new top-left corner position
    const newX = e.clientX - dragStartOffset.current.x;
    const newY = e.clientY - dragStartOffset.current.y;
    setPosition({ x: newX, y: newY });
  }, []); // No dependencies needed

  const handleMouseUp = useCallback(() => {
    // Check if still dragging before removing listeners
    // This check might not be strictly necessary if handleMouseDown always sets isDragging=true
    // but can prevent issues if mouseup fires without a preceding drag start in some edge cases.
    // if (!isDragging) return; // Removed this check as setIsDragging(false) handles it

    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    // Reset cursor styles
    if (windowRef.current) {
        windowRef.current.style.cursor = 'default';
    }
    document.body.style.cursor = 'default';
  }, [handleMouseMove]); // Depends on handleMouseMove

  const handleMouseDown = useCallback((e) => {
    // Prevent dragging on buttons
    if (e.target.tagName === 'BUTTON') return;
    // Prevent text selection during drag
    e.preventDefault();

    setIsDragging(true);
    const rect = windowRef.current.getBoundingClientRect();
    // Calculate offset from the element's top-left corner to the mouse click point
    dragStartOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    // Set cursor styles
    if (windowRef.current) {
        windowRef.current.style.cursor = 'grabbing';
    }
     document.body.style.cursor = 'grabbing';

  }, [handleMouseMove, handleMouseUp]); // Depends on the handlers it adds/removes

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      // Ensure listeners are removed if component unmounts while dragging
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
       // Reset body cursor if component unmounts during drag
       if (isDragging) {
           document.body.style.cursor = 'default';
       }
    };
  }, [handleMouseMove, handleMouseUp, isDragging]); // Add isDragging dependency for cleanup logic

  // --- Minimize/Restore Logic ---
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // --- Styling ---
  const windowStyle = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
    width: isMinimized ? '250px' : '450px',
    minHeight: '30px', // Only enforce min-height for title bar
    border: '3px outset #C0C0C0',
    backgroundColor: '#C0C0C0',
    zIndex: 100,
    boxShadow: '5px 5px 5px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    color: '#000000',
    fontSize: '12px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    userSelect: 'none', // Prevent text selection during drag
  };

  const titleBarStyle = {
    backgroundColor: '#000080',
    color: '#FFFFFF',
    padding: '3px 5px',
    fontWeight: 'bold',
    cursor: 'grab', // Default grab cursor
    borderBottom: '1px solid #000000',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '24px',
  };

  const titleBarButtonsStyle = {
    display: 'flex',
    gap: '3px',
  };

  const windowButtonStyle = {
    fontFamily: '"Webdings", "Wingdings", sans-serif',
    fontSize: '14px',
    width: '18px',
    height: '18px',
    border: '1px outset #FFFFFF',
    backgroundColor: '#C0C0C0',
    color: '#000000',
    padding: '0',
    lineHeight: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const contentStyle = {
    padding: '10px',
    maxHeight: '400px',
    overflowY: 'auto',
    display: isMinimized ? 'none' : 'block',
    backgroundColor: '#FFFFFF',
  };

  // --- Content Rendering ---
  const renderContent = () => {
    // Check if matchData and profileData exist
    if (!matchData || !matchData.profileData) return <p>No data selected or data is invalid.</p>;

    // Use datasetAttributes if provided and valid, otherwise iterate profileData keys
    const attributesToDisplay = Array.isArray(datasetAttributes) && datasetAttributes.length > 0
      ? datasetAttributes
      : Object.keys(matchData.profileData).map(key => ({ originalName: key })); // Fallback

    return (
      <dl>
        {/* Display Match Percentage first if available */}
        {matchData.matchPercentage !== undefined && (
             <React.Fragment>
                <dt style={{ fontWeight: 'bold', color: '#000080', marginTop: '5px' }}>Match %:</dt>
                <dd style={{ marginLeft: '15px', color: '#006400', fontWeight: 'bold' }}>
                  {matchData.matchPercentage.toFixed(1)}%
                </dd>
            </React.Fragment>
        )}
        {/* Display Profile ID */}
         <React.Fragment>
            <dt style={{ fontWeight: 'bold', color: '#000080', marginTop: '5px' }}>Profile ID:</dt>
            <dd style={{ marginLeft: '15px', color: '#333333' }}>
              {String(matchData.profileData?.original_row_index ?? '-')}
            </dd>
        </React.Fragment>
        {/* Display other attributes */}
        {attributesToDisplay
            .filter(attr => attr.originalName !== 'original_row_index') // Don't repeat Profile ID
            .map(attr => (
              <React.Fragment key={attr.originalName}>
                <dt style={{ fontWeight: 'bold', color: '#000080', marginTop: '5px' }}>{attr.originalName}:</dt>
                <dd style={{ marginLeft: '15px', color: '#333333' }}>
                  {/* Use sanitizedName if available, otherwise fallback to originalName */}
                  {(() => {
                    const keyToUse = attr.sanitizedName || attr.originalName;
                    const value = matchData.profileData[keyToUse];
                    return (value !== null && value !== undefined) ? String(value) : '-';
                  })()}
                </dd>
              </React.Fragment>
        ))}
      </dl>
    );
  };


  return (
    <div ref={windowRef} style={windowStyle}>
      {/* Title Bar - Attach mouse down handler here */}
      <div style={titleBarStyle} onMouseDown={handleMouseDown}>
        <span>Profile Details - ID: {matchData?.profileData?.original_row_index ?? 'N/A'}</span>
        <div style={titleBarButtonsStyle}>
          <button style={windowButtonStyle} onClick={toggleMinimize} title={isMinimized ? 'Restore' : 'Minimize'}>
            {isMinimized ? '1' : '0'}
          </button>
          <button style={{...windowButtonStyle, fontWeight: 'bold'}} onClick={onClose} title="Close">
            r
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={contentStyle}>
        {renderContent()}
      </div>
    </div>
  );
}

DetailsWindow.propTypes = {
  matchData: PropTypes.object,
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
      originalName: PropTypes.string.isRequired,
      sanitizedName: PropTypes.string, // Add sanitizedName, make it optional for fallback
      // type might also be useful if available: type: PropTypes.string,
  })).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default DetailsWindow;