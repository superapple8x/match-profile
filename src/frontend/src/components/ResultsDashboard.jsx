import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ResultsTable from './ResultsDashboard/ResultsTable.tsx';
import DetailsWindow from './ResultsDashboard/DetailsWindow';

// Updated ResultsDashboard component for new retro theme
function ResultsDashboard({
  searchResults,
  searchCriteria,
  datasetAttributes,
  isSearching,
  sortBy,
  sortDirection,
  onSortChange,
  currentPage,
  pageSize,
  paginationData,
  onPageChange,
  searchWeights,
}) {
  const [localSortBy, setLocalSortBy] = useState(sortBy || '');
  const [localSortDirection, setLocalSortDirection] = useState(sortDirection || 'desc');
  const [selectedMatch, setSelectedMatch] = useState(null); // State for details window

  useEffect(() => { setLocalSortBy(sortBy || ''); }, [sortBy]);
  useEffect(() => { setLocalSortDirection(sortDirection || 'desc'); }, [sortDirection]);
  useEffect(() => { setSelectedMatch(null); }, [searchResults]); // Reset selected match on new results

  const handleLocalSortChange = (e) => {
      const { name, value } = e.target;
      if (name === 'sortBy') {
          setLocalSortBy(value);
          if (localSortDirection) { onSortChange(value, localSortDirection); }
      } else if (name === 'sortDirection') {
          // This button now just toggles the direction state, the effect triggers the actual change
          const newDirection = localSortDirection === 'asc' ? 'desc' : 'asc';
          setLocalSortDirection(newDirection);
           if (localSortBy) { onSortChange(localSortBy, newDirection); } // Trigger sort immediately
      }
  };

  const handlePrevPage = () => { if (currentPage > 1) { onPageChange(currentPage - 1); } };
  const handleNextPage = () => { if (currentPage < (paginationData?.totalPages || 1)) { onPageChange(currentPage + 1); } };
  const handleMatchClick = (matchData) => { setSelectedMatch(matchData); };
  const handleCloseDetails = () => { setSelectedMatch(null); };

  const searchError = searchResults?.error;
  const resultsData = (searchResults && !searchError && Array.isArray(searchResults.matches)) ? searchResults.matches : [];
  const totalItems = paginationData?.totalItems || resultsData.length || 0;

  // Determine content based on state
  let resultsContent;
  if (isSearching) {
    resultsContent = <p style={{ color: '#FFFF00', textAlign: 'center', margin: '20px', fontWeight: 'bold' }}><span className="spin" style={{color: '#FF00FF'}}>@</span><span className="blink">*** Searching Database... Please Stand By... ***</span><span className="spin" style={{color: '#FF00FF'}}>@</span></p>;
  } else if (searchError) {
    resultsContent = (
      <div style={{ color: 'red', border: '2px dashed red', padding: '10px', margin: '10px 0', backgroundColor: '#330000' }}>
        <p style={{ fontWeight: 'bold', color: 'yellow' }}>!! SEARCH ERROR !!</p>
        <p>{searchError}</p>
      </div>
    );
  } else if (totalItems > 0) {
    resultsContent = (
      <>
        {/* --- Sorting and Pagination Controls --- */}
        <div className="dashboard-controls"> {/* Use dashboard-controls class */}
          {/* Active Criteria Display */}
          {searchCriteria && searchCriteria.length > 0 && (
            <div className="mb-1"> {/* Utility margin class */}
              <span>Active Criteria:</span>
              {searchCriteria.map((criteria, index) => (
                <span key={index} className="active-criteria-item"> {/* Use active-criteria-item class */}
                  {criteria.attribute} {criteria.operator} {String(criteria.value)} (W: {searchWeights?.[criteria.attribute] ?? 5})
                </span>
              ))}
            </div>
          )}

          {/* Sorting */}
          <label htmlFor="sortBySelect">Sort by:</label>
          <select
            id="sortBySelect"
            name="sortBy"
            value={localSortBy}
            onChange={handleLocalSortChange}
            // Styles inherited from CSS
          >
            <option value="">Select...</option>
            <option value="_matchPercentage">Match %</option>
            {datasetAttributes && datasetAttributes.map((attr) => (
              <option key={attr.originalName} value={attr.originalName}>
                {attr.originalName}
              </option>
            ))}
          </select>

          {/* Sort Direction Toggle Button */}
          <button
            name="sortDirection" // Keep name for handler logic if needed, though onClick handles it now
            onClick={handleLocalSortChange}
            disabled={!localSortBy}
            className={`button button-small ${localSortDirection === 'asc' ? 'button-blue' : ''}`} // Use button-small and conditional blue
            title={`Switch to ${localSortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {localSortDirection === 'asc' ? 'Ascending' : 'Descending'}
          </button>

          {/* Pagination */}
          {paginationData && paginationData.totalPages > 1 && (
            <>
              <span className="pagination-info">
                Page {currentPage} of {paginationData.totalPages} ({paginationData.totalItems.toLocaleString()} total)
              </span>
              {/* Use button-small */}
              <button onClick={handlePrevPage} disabled={currentPage <= 1} className="button button-small">
                {'<< Prev'}
              </button>
              <button onClick={handleNextPage} disabled={currentPage >= paginationData.totalPages} className="button button-small">
                {'Next >>'}
              </button>
            </>
          )}
        </div>
        {/* --- End Controls --- */}

        <ResultsTable
          results={resultsData}
          datasetAttributes={datasetAttributes}
          onMatchClick={handleMatchClick}
        />

        {/* Bottom Pagination (Optional) */}
         {paginationData && paginationData.totalPages > 1 && (
            <div className="dashboard-controls text-center mt-2"> {/* Use dashboard-controls and utilities */}
              <span className="pagination-info">
                Page {currentPage} of {paginationData.totalPages}
              </span>
              <button onClick={handlePrevPage} disabled={currentPage <= 1} className="button button-small">
                {'<< Prev'}
              </button>
              <button onClick={handleNextPage} disabled={currentPage >= paginationData.totalPages} className="button button-small">
                {'Next >>'}
              </button>
            </div>
          )}
      </>
    );
  } else {
    resultsContent = (
      <div style={{ textAlign: 'center', margin: '20px 0', color: '#666666', fontStyle: 'italic' }}> {/* Dimmer color */}
        {searchCriteria && searchCriteria.length > 0 ? 'No matches found. Try different criteria!' : 'Perform a search to see results here.'}
      </div>
    );
  }


  return (
    // Use Fragment as outer container is main-content-cell in App.jsx
    <>
      {/* Apply section-title class and add bling */}
      <h2 className="section-title">
          <span style={{fontFamily: 'Webdings', animation: 'spin 3s linear infinite', display:'inline-block', color: '#FF00FF'}}>ê</span>
           Results Dashboard
          <span style={{fontFamily: 'Webdings', animation: 'spin 3s linear infinite', display:'inline-block', color: '#FF00FF'}}>ê</span>
      </h2>

      {/* Render the results content */}
      {resultsContent}

      {/* Conditionally render the Details Window */}
       {selectedMatch && (
         <DetailsWindow
           matchData={selectedMatch}
           datasetAttributes={datasetAttributes}
           onClose={handleCloseDetails}
         />
       )}
    </>
  )
}

// --- PropTypes --- (Remain the same)
ResultsDashboard.propTypes = {
  searchResults: PropTypes.shape({
    matches: PropTypes.array, error: PropTypes.string, pagination: PropTypes.shape({ currentPage: PropTypes.number, pageSize: PropTypes.number, totalItems: PropTypes.number, totalPages: PropTypes.number }),
  }),
  searchCriteria: PropTypes.array,
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({ originalName: PropTypes.string.isRequired })).isRequired,
  isSearching: PropTypes.bool,
  sortBy: PropTypes.string,
  sortDirection: PropTypes.oneOf(['asc', 'desc']),
  onSortChange: PropTypes.func.isRequired,
  currentPage: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  paginationData: PropTypes.shape({ currentPage: PropTypes.number, pageSize: PropTypes.number, totalItems: PropTypes.number, totalPages: PropTypes.number }),
  onPageChange: PropTypes.func.isRequired,
  searchWeights: PropTypes.object,
};

ResultsDashboard.defaultProps = {
  searchResults: { matches: [], error: null, pagination: null }, searchCriteria: [], isSearching: false, sortBy: '', sortDirection: 'desc', paginationData: null, searchWeights: {},
};

export default ResultsDashboard;
