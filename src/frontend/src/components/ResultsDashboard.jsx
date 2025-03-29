import React, { useState, useEffect } from 'react';
// Removed: import { useNavigate } from 'react-router-dom';
// Removed: import './ResultsDashboard.css';
import ResultsSummary from './ResultsDashboard/ResultsSummary';
import ResultsTable from './ResultsDashboard/ResultsTable.tsx';
import MatchBreakdown from './ResultsDashboard/MatchBreakdown';
import ProgressBar from './ProgressBar';

// Accept datasetAttributes, remove importedData
function ResultsDashboard({ searchResults, searchCriteria, datasetAttributes, isSearching }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [averageMatchPercentage, setAverageMatchPercentage] = useState(0);
  const [highestMatch, setHighestMatch] = useState(0);

  useEffect(() => {
    // Calculate stats only when not searching and searchResults is valid
    if (!isSearching && searchResults && !searchResults.error) {
        // Ensure searchResults.matches is an array before processing
        const matches = Array.isArray(searchResults.matches) ? searchResults.matches : [];

        const validMatches = matches.filter(match => typeof match?.matchPercentage === 'number');
        const count = validMatches.length;
        setTotalMatches(count);

        if (count > 0) {
          const sum = validMatches.reduce((acc, match) => acc + match.matchPercentage, 0);
          setAverageMatchPercentage(sum / count);
          setHighestMatch(validMatches.reduce((max, match) => Math.max(max, match.matchPercentage), 0));
        } else {
          setAverageMatchPercentage(0);
          setHighestMatch(0);
        }
    } else if (!isSearching) {
        // Reset stats if not searching or if there's an error
        setTotalMatches(0);
        setAverageMatchPercentage(0);
        setHighestMatch(0);
    }
    // Removed logic related to resetting showAnalysisPage
  }, [searchResults, isSearching]);

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseBreakdown = () => {
    setSelectedMatch(null);
  };

  // Defensive calculation of resultsData and searchError
  const searchError = searchResults?.error;
  // Ensure searchResults.matches is treated as an array even if null/undefined initially
  const resultsData = (searchResults && !searchError && Array.isArray(searchResults.matches))
    ? searchResults.matches
    : [];

  // --- DEBUG LOGGING ---
  console.log('ResultsDashboard Render:', {
    isSearching,
    searchError: !!searchError,
    resultsDataLength: resultsData.length,
    searchCriteriaExists: !!searchCriteria,
    // datasetIdExists: !!datasetId, // datasetId removed from props
    searchResults // Log the raw searchResults prop
  });
  // --- END DEBUG LOGGING ---

  // Determine content based on state
  let resultsContent;
  if (isSearching) {
    console.log('ResultsDashboard: Rendering ProgressBar');
    resultsContent = <ProgressBar />;
  } else if (searchError) {
    console.log('ResultsDashboard: Rendering Search Error');
    resultsContent = (
      <div className="text-center py-10 text-red-600 dark:text-red-400">
        Error during search: {searchError}
      </div>
    );
  } else if (resultsData.length > 0) {
    // Results are available
    console.log('ResultsDashboard: Rendering Results Content (Summary, Table, etc.)');
    resultsContent = (
      <div className="space-y-6">
        <ResultsSummary
          totalMatches={totalMatches}
          averageMatchPercentage={averageMatchPercentage}
          highestMatch={highestMatch}
        />
        {/* Pass datasetAttributes down to ResultsTable */}
        <ResultsTable
          results={resultsData} // Contains profileData with sanitized keys
          datasetAttributes={datasetAttributes} // Pass the metadata
          onMatchClick={handleMatchClick}
        />
      </div>
    );
  } else {
    console.log('ResultsDashboard: Rendering Placeholder/No Results Message');
    // No results or initial state
    resultsContent = (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        {searchCriteria ? 'No results match your criteria.' : 'Perform a search to see results.'}
      </div>
    );
  }


  return (
    <div className="p-5 bg-indigo-100/60 dark:bg-gray-800/60 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/50 rounded-xl shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl min-h-[200px]"> {/* Light: indigo-100 tint */}
      <h2 className="text-2xl font-semibold mb-5 text-gray-800 dark:text-gray-100">Results Dashboard</h2>

      {/* Display Search Criteria */}
      {searchCriteria && searchCriteria.length > 0 && (
        <div className="mb-6 p-4 bg-indigo-50/80 dark:bg-gray-700/60 backdrop-blur-sm rounded-lg border border-gray-200/60 dark:border-gray-600/40 transition-all duration-300 ease-in-out shadow-sm"> {/* Light: indigo-50 tint */}
          <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">Search Criteria:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
            {searchCriteria.map((criteria, index) => (
              <li key={index}>
                <span className="font-medium">{criteria.attribute}:</span> {String(criteria.value)} (Weight: {criteria.weight})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Render the determined content */}
      {resultsContent}

      {/* Match Breakdown Modal (remains unchanged) */}
      {selectedMatch && (
        <div
          className="fixed inset-0 bg-transparent flex justify-center items-center z-[1000] transition-opacity duration-300 ease-out" // Removed overlay blur/color
          onClick={handleCloseBreakdown}
        >
          <div
            className="bg-indigo-50/80 dark:bg-gray-800/80 backdrop-blur-md p-6 rounded-xl shadow-2xl w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-300 ease-out border dark:border-gray-700/50" // Added glass effect + border
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pass datasetAttributes down to MatchBreakdown */}
            <MatchBreakdown
                match={selectedMatch} // Contains profileData with sanitized keys
                datasetAttributes={datasetAttributes} // Pass the metadata
                // Removed fullData={importedData}
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={handleCloseBreakdown}
                className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-gray-600 dark:hover:bg-gray-500 text-indigo-800 dark:text-gray-100 font-semibold border border-indigo-200 dark:border-gray-500 rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-800" // Light: indigo button
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

export default ResultsDashboard;
