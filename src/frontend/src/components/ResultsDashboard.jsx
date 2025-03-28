import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Removed: import './ResultsDashboard.css';
import ResultsSummary from './ResultsDashboard/ResultsSummary';
import ResultsTable from './ResultsDashboard/ResultsTable.tsx';
import MatchBreakdown from './ResultsDashboard/MatchBreakdown';
import ProgressBar from './ProgressBar'; // <-- Import ProgressBar

// Removed darkMode prop
// Added importedData prop
// Added isSearching prop
function ResultsDashboard({ searchResults, searchCriteria, importedData, isSearching }) {
  const navigate = useNavigate();
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [averageMatchPercentage, setAverageMatchPercentage] = useState(0);
  const [highestMatch, setHighestMatch] = useState(0);

  useEffect(() => {
    // Only calculate stats if not searching and searchResults exist
    if (!isSearching && searchResults) {
        let matches = [];
        // Check if searchResults has matches property or is the array itself
        matches = Array.isArray(searchResults.matches) ? searchResults.matches : (Array.isArray(searchResults) ? searchResults : []);

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
        // Reset stats if not searching and no results (e.g., after file import)
        setTotalMatches(0);
        setAverageMatchPercentage(0);
        setHighestMatch(0);
    }
    // Add isSearching to dependency array
  }, [searchResults, isSearching]);

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseBreakdown = () => {
    setSelectedMatch(null);
  };

  // Ensure searchResults.matches is used if available, otherwise use searchResults directly if it's an array
  // Handle potential error object in searchResults
  const resultsData = (searchResults && !searchResults.error)
    ? (searchResults.matches ?? (Array.isArray(searchResults) ? searchResults : []))
    : [];
  const searchError = searchResults?.error;


  return (
    // Container with padding - Matched SearchBar container style
    <div className="p-5 bg-white/70 dark:bg-gray-800/60 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/50 rounded-xl shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl min-h-[200px]"> {/* Added min-height */}
      <h2 className="text-2xl font-semibold mb-5 text-gray-800 dark:text-gray-100">Results Dashboard</h2>

      {/* Display Search Criteria */}
      {searchCriteria && searchCriteria.length > 0 && (
        <div className="mb-6 p-4 bg-gray-100/80 dark:bg-gray-700/60 backdrop-blur-sm rounded-lg border border-gray-200/60 dark:border-gray-600/40 transition-all duration-300 ease-in-out shadow-sm"> {/* Refined glass effect */}
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

      {/* Conditional Rendering: Progress Bar or Results/Message */}
      {isSearching ? (
        <ProgressBar /> // <-- Show progress bar when searching
      ) : searchError ? ( // <-- Show error if search failed
        <div className="text-center py-10 text-red-600 dark:text-red-400">
          Error during search: {searchError}
        </div>
      ) : resultsData && resultsData.length > 0 ? ( // <-- Show results if available
        <div className="space-y-6"> {/* Add spacing between dashboard elements */}
          <ResultsSummary
            totalMatches={totalMatches}
            averageMatchPercentage={averageMatchPercentage}
            highestMatch={highestMatch}
          />
          <ResultsTable
            results={resultsData}
            onMatchClick={handleMatchClick}
            // darkMode prop removed
          />

          {/* Data Analysis Button */}
          <div className="flex justify-end mt-4">
            <button
              onClick={() => navigate('/data-analysis', { state: { matchResults: resultsData } })}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 dark:bg-primary-700 dark:hover:bg-primary-800 text-white font-semibold rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800" // Matched standard button style
            >
              Go to Data Analysis
            </button>
          </div>

          {/* Match Breakdown Modal */}
          {selectedMatch && (
            // Modal Overlay
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-[1000] transition-opacity duration-300 ease-out"
              onClick={handleCloseBreakdown}
            >
              {/* Modal Content */}
              <div
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg p-6 rounded-xl shadow-2xl w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-300 ease-out transform scale-95 group-hover:scale-100"
                onClick={(e) => e.stopPropagation()} // Prevent closing on content click
              >
                <MatchBreakdown match={selectedMatch} fullData={importedData} /> {/* Pass fullData */}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleCloseBreakdown}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold border border-gray-300 dark:border-gray-500 rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800" // Matched standard secondary button style
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : ( // <-- Show message if no results and not searching
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          {searchCriteria ? 'No results match your criteria.' : 'Perform a search to see results.'}
        </div>
      )}
    </div>
  )
}

export default ResultsDashboard;
