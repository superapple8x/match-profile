import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Removed: import './ResultsDashboard.css';
import ResultsSummary from './ResultsDashboard/ResultsSummary';
import ResultsTable from './ResultsDashboard/ResultsTable.tsx';
import MatchBreakdown from './ResultsDashboard/MatchBreakdown';

// Removed darkMode prop
// Added importedData prop
function ResultsDashboard({ searchResults, searchCriteria, importedData }) {
  const navigate = useNavigate();
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [averageMatchPercentage, setAverageMatchPercentage] = useState(0);
  const [highestMatch, setHighestMatch] = useState(0);

  useEffect(() => {
    let matches = [];
    if (searchResults) {
      // Check if searchResults has matches property or is the array itself
      matches = Array.isArray(searchResults.matches) ? searchResults.matches : (Array.isArray(searchResults) ? searchResults : []);
    }

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
  }, [searchResults]); // Removed searchCriteria dependency as it wasn't used for calculations

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseBreakdown = () => {
    setSelectedMatch(null);
  };

  // Ensure searchResults.matches is used if available, otherwise use searchResults directly if it's an array
  const resultsData = searchResults?.matches ?? (Array.isArray(searchResults) ? searchResults : []);

  return (
    // Container with padding
    <div className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow transition-colors duration-150">
      <h2 className="text-2xl font-semibold mb-5 text-gray-800 dark:text-gray-100">Results Dashboard</h2>

      {/* Display Search Criteria */}
      {searchCriteria && searchCriteria.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
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

      {/* Results Area */}
      {resultsData && resultsData.length > 0 ? (
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
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-semibold rounded-md shadow transition-colors duration-150"
            >
              Go to Data Analysis
            </button>
          </div>

          {/* Match Breakdown Modal */}
          {selectedMatch && (
            // Modal Overlay
            <div
              className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[1000]" // Higher z-index
              onClick={handleCloseBreakdown}
            >
              {/* Modal Content */}
              <div
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto transition-colors duration-150"
                onClick={(e) => e.stopPropagation()} // Prevent closing on content click
              >
                <MatchBreakdown match={selectedMatch} fullData={importedData} /> {/* Pass fullData */}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleCloseBreakdown}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold rounded-md shadow transition-colors duration-150"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          {searchCriteria ? 'No results match your criteria.' : 'Perform a search to see results.'}
        </div>
      )}
    </div>
  )
}

export default ResultsDashboard;
