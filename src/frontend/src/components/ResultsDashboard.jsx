import React, { useState, useEffect } from 'react';
// Removed: import { useNavigate } from 'react-router-dom';
// Removed: import './ResultsDashboard.css';
import ResultsSummary from './ResultsDashboard/ResultsSummary';
import ResultsTable from './ResultsDashboard/ResultsTable.tsx';
import MatchBreakdown from './ResultsDashboard/MatchBreakdown';
import ProgressBar from './ProgressBar';
import DataAnalysisPage from './ResultsDashboard/DataAnalysisPage';

// Accept datasetId prop
function ResultsDashboard({ searchResults, searchCriteria, importedData, isSearching, datasetId }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showAnalysisPage, setShowAnalysisPage] = useState(false);
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
    // Reset analysis page visibility when search results change or searching starts
    // Add null check for searchResults
    if (searchResults || isSearching) {
        setShowAnalysisPage(false);
    }
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
    datasetIdExists: !!datasetId,
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
    console.log('ResultsDashboard: Rendering Results Content (Summary, Table, etc.)'); // <-- ADDED LOG
    resultsContent = (
      <div className="space-y-6">
        <ResultsSummary
          totalMatches={totalMatches}
          averageMatchPercentage={averageMatchPercentage}
          highestMatch={highestMatch}
        />
        <ResultsTable
          results={resultsData}
          onMatchClick={handleMatchClick}
        />
        {/* Conditionally render Data Analysis Button */}
        {datasetId && ( // Simplified check: just need datasetId
          <div className="flex justify-end mt-4">
            <button
              onClick={() => setShowAnalysisPage(!showAnalysisPage)}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 dark:bg-primary-700 dark:hover:bg-primary-800 text-white font-semibold rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              {showAnalysisPage ? 'Hide LLM Analysis' : 'Analyze Results with LLM'}
            </button>
          </div>
        )}
        {/* Conditionally render DataAnalysisPage */}
        {showAnalysisPage && datasetId && (
          <div className="mt-6 border-t pt-6">
            <DataAnalysisPage datasetId={datasetId} />
          </div>
        )}
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
    <div className="p-5 bg-white/70 dark:bg-gray-800/60 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/50 rounded-xl shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl min-h-[200px]">
      <h2 className="text-2xl font-semibold mb-5 text-gray-800 dark:text-gray-100">Results Dashboard</h2>

      {/* Display Search Criteria */}
      {searchCriteria && searchCriteria.length > 0 && (
        <div className="mb-6 p-4 bg-gray-100/80 dark:bg-gray-700/60 backdrop-blur-sm rounded-lg border border-gray-200/60 dark:border-gray-600/40 transition-all duration-300 ease-in-out shadow-sm">
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
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-[1000] transition-opacity duration-300 ease-out"
          onClick={handleCloseBreakdown}
        >
          <div
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg p-6 rounded-xl shadow-2xl w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-300 ease-out transform scale-95 group-hover:scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MatchBreakdown match={selectedMatch} fullData={importedData} />
            <div className="flex justify-end mt-4">
              <button
                onClick={handleCloseBreakdown}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold border border-gray-300 dark:border-gray-500 rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
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
