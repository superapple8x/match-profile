import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ResultsTable from './ResultsDashboard/ResultsTable.tsx';
// Import the new DetailsWindow component
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
  const [totalMatches, setTotalMatches] = useState(0);
  const [localSortBy, setLocalSortBy] = useState(sortBy || '');
  const [localSortDirection, setLocalSortDirection] = useState(sortDirection || 'desc');
  const [selectedMatch, setSelectedMatch] = useState(null); // State for details window

  useEffect(() => {
    setLocalSortBy(sortBy || '');
  }, [sortBy]);

  useEffect(() => {
    setLocalSortDirection(sortDirection || 'desc');
  }, [sortDirection]);

  useEffect(() => {
    if (!isSearching && searchResults && !searchResults.error) {
      setTotalMatches(paginationData?.totalItems || searchResults.matches?.length || 0);
    } else if (!isSearching) {
      setTotalMatches(0);
    }
    // Reset selected match when search results change
    setSelectedMatch(null);
  }, [searchResults, isSearching, paginationData]);

  const handleLocalSortChange = (e) => {
      const { name, value } = e.target;
      if (name === 'sortBy') {
          setLocalSortBy(value);
          if (localSortDirection) {
              onSortChange(value, localSortDirection);
          }
      } else if (name === 'sortDirection') {
          setLocalSortDirection(value);
          if (localSortBy) {
              onSortChange(localSortBy, value);
          }
      }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < (paginationData?.totalPages || 1)) {
      onPageChange(currentPage + 1);
    }
  };

  // Function to handle row click and set selected match
  const handleMatchClick = (matchData) => {
    console.log("Match clicked:", matchData);
    setSelectedMatch(matchData);
  };

  // Function to close the details window
  const handleCloseDetails = () => {
    setSelectedMatch(null);
  };


  const searchError = searchResults?.error;
  const resultsData = (searchResults && !searchError && Array.isArray(searchResults.matches))
    ? searchResults.matches
    : [];

  // Determine content based on state
  let resultsContent;
  if (isSearching) {
    resultsContent = <p style={{ color: '#FFFF00', textAlign: 'center', margin: '20px', fontWeight: 'bold' }}><span className="blink">*** Searching Database... Please Stand By... ***</span></p>;
  } else if (searchError) {
    resultsContent = (
      <div style={{ color: 'red', border: '2px dashed red', padding: '10px', margin: '10px 0', backgroundColor: '#330000' }}>
        <p style={{ fontWeight: 'bold', color: 'yellow' }}>!! SEARCH ERROR !!</p>
        <p>{searchError}</p>
      </div>
    );
  } else if (resultsData.length > 0 || (paginationData && paginationData.totalItems > 0)) {
    resultsContent = (
      <div>
        {/* --- Sorting and Pagination Controls --- */}
        <div style={{ border: '2px groove #00FFFF', padding: '8px', margin: '10px 0', backgroundColor: '#444444', color: '#FFFFFF' }}>
          {/* Sorting */}
          <span style={{ marginRight: '15px' }}>
             <label htmlFor="sortBy" style={{ marginRight: '5px', fontWeight: 'bold', color: '#FFFF00' }}>Sort by:</label>
             <select
               id="sortBy"
               name="sortBy"
               value={localSortBy}
               onChange={handleLocalSortChange}
             >
               <option value="">-- Select --</option>
               <option value="_matchPercentage">Match Score</option>
               {datasetAttributes && datasetAttributes.map((attr) => (
                 <option key={attr.originalName} value={attr.originalName}>
                   {attr.originalName}
                 </option>
               ))}
             </select>
             <select
               id="sortDirection"
               name="sortDirection"
               value={localSortDirection}
               onChange={handleLocalSortChange}
               disabled={!localSortBy}
               style={{ marginLeft: '5px' }}
             >
               <option value="desc">Descending</option>
               <option value="asc">Ascending</option>
             </select>
          </span>

          {/* Pagination */}
          {paginationData && paginationData.totalPages > 1 && (
            <span style={{ marginLeft: '15px', fontSize: '11px' }}>
              Page {currentPage} of {paginationData.totalPages} ({paginationData.totalItems.toLocaleString()} total)
              {/* Corrected button syntax */}
              <button onClick={handlePrevPage} disabled={currentPage <= 1} style={{ marginLeft: '10px', padding: '2px 6px', fontSize: '11px' }}>
                &lt; Prev
              </button>
              <button onClick={handleNextPage} disabled={currentPage >= paginationData.totalPages} style={{ marginLeft: '5px', padding: '2px 6px', fontSize: '11px' }}>
                Next &gt;
              </button>
            </span>
          )}
        </div>
        {/* --- End Controls --- */}

        {/* Pass handleMatchClick to ResultsTable */}
        <ResultsTable
          results={resultsData}
          datasetAttributes={datasetAttributes}
          onMatchClick={handleMatchClick} // Pass the handler
        />

        {/* Bottom Pagination */}
         {paginationData && paginationData.totalPages > 1 && (
            <div style={{ border: '2px groove #00FFFF', padding: '8px', margin: '10px 0', backgroundColor: '#444444', color: '#FFFFFF', textAlign: 'center' }}>
              Page {currentPage} of {paginationData.totalPages}
              {/* Corrected button syntax */}
              <button onClick={handlePrevPage} disabled={currentPage <= 1} style={{ marginLeft: '10px', padding: '2px 6px', fontSize: '11px' }}>
                &lt; Prev
              </button>
              <button onClick={handleNextPage} disabled={currentPage >= paginationData.totalPages} style={{ marginLeft: '5px', padding: '2px 6px', fontSize: '11px' }}>
                Next &gt;
              </button>
            </div>
          )}

      </div>
    );
  } else {
    resultsContent = (
      <div style={{ textAlign: 'center', margin: '20px 0', color: '#CCCCCC', fontStyle: 'italic' }}>
        {searchCriteria && searchCriteria.length > 0 ? 'No matches found. Try different criteria!' : 'Perform a search to see results here.'}
      </div>
    );
  }


  return (
    <div className="content-cell" style={{ marginTop: '15px', position: 'relative' /* Needed for positioning the details window */ }}>
      <h2 className="form-title" style={{ color: '#00FF00', textShadow: '1px 1px #FF00FF' }}>Results Dashboard</h2>
      <hr />

      {/* Display Search Criteria */}
      {searchCriteria && searchCriteria.length > 0 && (
        <div style={{ margin: '10px 0', padding: '5px', border: '1px dashed #FFFF00', backgroundColor: '#000033', color: '#FFFFFF' }}>
          <b style={{ color: '#FFFF00' }}>Active Criteria:</b>
          <ul style={{ listStyleType: 'none', padding: 0, margin: '5px 0 0 0' }}>
            {searchCriteria.map((criteria, index) => (
              <li key={index} style={{ display: 'inline-block', border: '1px solid #00FFFF', borderRadius: '3px', padding: '2px 6px', margin: '2px', fontSize: '11px', backgroundColor: '#000080' }}>
                <span style={{ color: '#00FF00' }}>{criteria.attribute}</span>{' '}
                <span style={{ color: '#FF00FF' }}>{criteria.operator}</span>{' '}
                <span style={{ color: '#FFFFFF' }}>{String(criteria.value)}</span>{' '}
                <span style={{ color: '#CCCCCC' }}>(W: {searchWeights?.[criteria.attribute] ?? 'N/A'})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Render the results content */}
      {resultsContent}

      {/* Conditionally render the Details Window */}
      {/*
      {selectedMatch && (
        <DetailsWindow
          matchData={selectedMatch}
          datasetAttributes={datasetAttributes} // Pass attributes for display context
          onClose={handleCloseDetails}
        />
      )}
      */}
      {/* Render the actual DetailsWindow */}
       {selectedMatch && (
         <DetailsWindow
           matchData={selectedMatch}
           datasetAttributes={datasetAttributes} // Ensure datasetAttributes is passed
           onClose={handleCloseDetails}
         />
       )}

    </div>
  )
}

// --- PropTypes ---
ResultsDashboard.propTypes = {
  searchResults: PropTypes.shape({
    matches: PropTypes.array,
    error: PropTypes.string,
    pagination: PropTypes.shape({
        currentPage: PropTypes.number,
        pageSize: PropTypes.number,
        totalItems: PropTypes.number,
        totalPages: PropTypes.number,
    }),
  }),
  searchCriteria: PropTypes.array,
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
      originalName: PropTypes.string.isRequired,
  })).isRequired,
  isSearching: PropTypes.bool,
  sortBy: PropTypes.string,
  sortDirection: PropTypes.oneOf(['asc', 'desc']),
  onSortChange: PropTypes.func.isRequired,
  currentPage: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  paginationData: PropTypes.shape({
    currentPage: PropTypes.number,
    pageSize: PropTypes.number,
    totalItems: PropTypes.number,
    totalPages: PropTypes.number,
  }),
  onPageChange: PropTypes.func.isRequired,
  searchWeights: PropTypes.object,
};

ResultsDashboard.defaultProps = {
  searchResults: { matches: [], error: null, pagination: null },
  searchCriteria: [],
  isSearching: false,
  sortBy: '',
  sortDirection: 'desc',
  paginationData: null,
  searchWeights: {},
};


export default ResultsDashboard;
