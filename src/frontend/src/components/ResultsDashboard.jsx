import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ResultsSummary from './ResultsDashboard/ResultsSummary';
import ResultsTable from './ResultsDashboard/ResultsTable.tsx';
import MatchBreakdown from './ResultsDashboard/MatchBreakdown';
import ProgressBar from './ProgressBar';
import { ArrowLeftIcon, ArrowRightIcon, ArrowsUpDownIcon, BarsArrowDownIcon, BarsArrowUpIcon } from '@heroicons/react/24/outline'; // Added icons

// Accept new props for sorting and pagination
function ResultsDashboard({
  searchResults,
  searchCriteria,
  datasetAttributes, // Still needed for sorting options and breakdown
  isSearching,
  // Sorting props
  sortBy,
  sortDirection,
  onSortChange,
  // Pagination props
  currentPage,
  pageSize, // Keep pageSize if needed for display, though often managed by parent
  paginationData, // Contains totalItems, totalPages etc.
  onPageChange,
}) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [averageMatchPercentage, setAverageMatchPercentage] = useState(0);
  const [highestMatch, setHighestMatch] = useState(0);

  // Local state for sort controls - reflects props but allows UI interaction
  const [localSortBy, setLocalSortBy] = useState(sortBy || '');
  const [localSortDirection, setLocalSortDirection] = useState(sortDirection || 'desc');

  // Update local state when props change (e.g., initial load or external update)
  useEffect(() => {
    setLocalSortBy(sortBy || '');
  }, [sortBy]);

  useEffect(() => {
    setLocalSortDirection(sortDirection || 'desc');
  }, [sortDirection]);


  useEffect(() => {
    if (!isSearching && searchResults && !searchResults.error) {
      const matches = Array.isArray(searchResults.matches) ? searchResults.matches : [];
      const validMatches = matches.filter(match => typeof match?.matchPercentage === 'number');
      const count = validMatches.length;
      setTotalMatches(paginationData?.totalItems || count); // Use totalItems from pagination if available

      if (count > 0) {
        const sum = validMatches.reduce((acc, match) => acc + match.matchPercentage, 0);
        setAverageMatchPercentage(sum / count);
        setHighestMatch(validMatches.reduce((max, match) => Math.max(max, match.matchPercentage), 0));
      } else {
        setAverageMatchPercentage(0);
        setHighestMatch(0);
      }
    } else if (!isSearching) {
      setTotalMatches(0);
      setAverageMatchPercentage(0);
      setHighestMatch(0);
    }
  }, [searchResults, isSearching, paginationData]); // Added paginationData dependency

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseBreakdown = () => {
    setSelectedMatch(null);
  };

  // --- Event Handlers for Sorting/Pagination ---
  const handleLocalSortChange = (e) => {
      const { name, value } = e.target;
      if (name === 'sortBy') {
          setLocalSortBy(value);
          // Trigger sort change immediately if direction is set, or wait for direction change
          if (localSortDirection) {
              onSortChange(value, localSortDirection);
          }
      } else if (name === 'sortDirection') {
          setLocalSortDirection(value);
          // Trigger sort change only if sortBy is also set
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
  // ---

  const searchError = searchResults?.error;
  const resultsData = (searchResults && !searchError && Array.isArray(searchResults.matches))
    ? searchResults.matches
    : [];

  // --- DEBUG LOGGING ---
  console.log('ResultsDashboard Render:', {
    isSearching,
    searchError: !!searchError,
    resultsDataLength: resultsData.length,
    searchCriteriaExists: !!searchCriteria,
    sortBy, sortDirection, currentPage, pageSize,
    paginationData, // Log pagination data
    searchResults
  });
  // --- END DEBUG LOGGING ---

  // Determine content based on state
  let resultsContent;
  if (isSearching) {
    resultsContent = <ProgressBar />;
  } else if (searchError) {
    resultsContent = (
      <div className="text-center py-10 text-red-600 dark:text-red-400">
        <p className="font-semibold">An error occurred while searching:</p>
        <p className="text-sm mt-1">{searchError}</p>
        <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">(If this persists, please check server logs or contact support.)</p>
      </div>
    );
  } else if (resultsData.length > 0 || (paginationData && paginationData.totalItems > 0)) { // Show controls even if current page is empty but total items > 0
    resultsContent = (
      <div className="space-y-6">
        <ResultsSummary
          totalMatches={totalMatches} // Use calculated totalMatches (based on paginationData if available)
          averageMatchPercentage={averageMatchPercentage}
          highestMatch={highestMatch}
        />

        {/* --- Sorting and Pagination Controls --- */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600/50 shadow-sm">
          {/* Sorting Controls */}
          <div className="flex items-center gap-2">
             <label htmlFor="sortBy" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Sort by:</label>
             <select
               id="sortBy"
               name="sortBy"
               value={localSortBy}
               onChange={handleLocalSortChange}
               className="block w-full sm:w-auto pl-3 pr-8 py-1.5 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
             >
               <option value="">Select Attribute</option>
               {/* Add Match Percentage as a sort option */}
               <option value="_matchPercentage">Match Score</option>
               {/* Use originalName for value and display text, ensure unique keys */}
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
               disabled={!localSortBy} // Disable if no attribute selected
               className="block w-auto pl-3 pr-8 py-1.5 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50"
             >
               <option value="desc">Descending</option>
               <option value="asc">Ascending</option>
             </select>
             {/* Optional: Icon indicating sort direction */}
             {localSortBy && (
                localSortDirection === 'asc'
                    ? <BarsArrowUpIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" title="Ascending"/>
                    : <BarsArrowDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" title="Descending"/>
             )}
          </div>
          {/* Removed redundant top pagination controls */}
        </div>
        {/* --- End Controls --- */}


        <ResultsTable
          results={resultsData}
          datasetAttributes={datasetAttributes}
          onMatchClick={handleMatchClick}
          // Pass sort info for potential header highlighting
          sortBy={localSortBy}
          sortDirection={localSortDirection}
        />

        {/* Removed redundant pagination controls previously rendered here */}

      </div>
    );
  } else {
    // No results or initial state
    resultsContent = (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        {searchCriteria && searchCriteria.length > 0 ? 'No matches found for the current criteria.' : 'Perform a search to see results.'}
      </div>
    );
  }


  return (
    <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md transition-all duration-300 ease-in-out min-h-[200px]"> {/* Standard background */}
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Results Dashboard</h2>

      {/* Display Search Criteria - Updated to show operator */}
      {searchCriteria && searchCriteria.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/60 rounded-md border border-gray-200/80 dark:border-gray-600/40 shadow-sm">
          <h3 className="text-md font-semibold mb-1.5 text-gray-700 dark:text-gray-200">Active Search Criteria:</h3>
          <ul className="flex flex-wrap gap-1.5">
            {searchCriteria.map((criteria, index) => (
              <li key={index} className="inline-flex items-center bg-indigo-100 dark:bg-gray-600 border border-indigo-200 dark:border-gray-500 rounded-full px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:text-gray-100 shadow-sm">
                {criteria.attribute} <strong className="mx-1">{criteria.operator}</strong> {String(criteria.value)} (W: {criteria.weight})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Render the determined content */}
      {resultsContent}

      {/* Match Breakdown Modal */}
      {selectedMatch && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-[1000] transition-opacity duration-300 ease-out" // Added overlay
          onClick={handleCloseBreakdown}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-11/12 max-w-3xl max-h-[90vh] overflow-y-auto transition-all duration-300 ease-out border border-gray-300 dark:border-gray-700" // Standard modal style
            onClick={(e) => e.stopPropagation()}
          >
            <MatchBreakdown
                match={selectedMatch}
                datasetAttributes={datasetAttributes}
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={handleCloseBreakdown}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:shadow-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- PropTypes ---
ResultsDashboard.propTypes = {
  searchResults: PropTypes.shape({
    matches: PropTypes.array,
    error: PropTypes.string,
    // Include pagination shape if available from backend
    pagination: PropTypes.shape({
        currentPage: PropTypes.number,
        pageSize: PropTypes.number,
        totalItems: PropTypes.number,
        totalPages: PropTypes.number,
    }),
  }),
  searchCriteria: PropTypes.arrayOf(PropTypes.shape({
    attribute: PropTypes.string.isRequired,
    operator: PropTypes.string.isRequired,
    value: PropTypes.any.isRequired,
    weight: PropTypes.number,
  })),
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
      originalName: PropTypes.string.isRequired,
      sanitizedName: PropTypes.string.isRequired,
      type: PropTypes.string, // Added type if available
  })).isRequired, // Make datasetAttributes required
  isSearching: PropTypes.bool,
  // Sorting props
  sortBy: PropTypes.string,
  sortDirection: PropTypes.oneOf(['asc', 'desc']),
  onSortChange: PropTypes.func.isRequired, // Required handler
  // Pagination props
  currentPage: PropTypes.number.isRequired, // Required
  pageSize: PropTypes.number.isRequired,    // Required
  paginationData: PropTypes.shape({
    currentPage: PropTypes.number,
    pageSize: PropTypes.number,
    totalItems: PropTypes.number,
    totalPages: PropTypes.number,
  }),
  onPageChange: PropTypes.func.isRequired, // Required handler
};

ResultsDashboard.defaultProps = {
  searchResults: { matches: [], error: null, pagination: null },
  searchCriteria: [],
  isSearching: false,
  sortBy: '', // Default sort
  sortDirection: 'desc', // Default direction
  // currentPage, pageSize, onSortChange, onPageChange are required, no defaults
  paginationData: null,
};


export default ResultsDashboard;
