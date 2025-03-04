import React, { useState, useEffect } from 'react';
import './ResultsDashboard.css';
import ResultsSummary from './ResultsDashboard/ResultsSummary';
import ResultsTable from './ResultsDashboard/ResultsTable';
import MatchBreakdown from './ResultsDashboard/MatchBreakdown';

function ResultsDashboard({ searchResults, searchCriteria }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [averageMatchPercentage, setAverageMatchPercentage] = useState(0);
  const [highestMatch, setHighestMatch] = useState(0);

  useEffect(() => {
    if (searchResults) {
      // Check if searchResults has matches property
      if (searchResults.matches && Array.isArray(searchResults.matches)) {
        setTotalMatches(searchResults.matches.length);
        const sum = searchResults.matches.reduce((acc, match) => acc + match.matchPercentage, 0);
        setAverageMatchPercentage(totalMatches > 0 ? sum / totalMatches : 0);
        setHighestMatch(searchResults.matches.reduce((max, match) => Math.max(max, match.matchPercentage), 0));
      } else if (Array.isArray(searchResults)) {
        // Handle direct array of results
        setTotalMatches(searchResults.length);
        // Calculate match percentages if available
        if (searchResults.length > 0 && 'matchPercentage' in searchResults[0]) {
          const sum = searchResults.reduce((acc, match) => acc + match.matchPercentage, 0);
          setAverageMatchPercentage(totalMatches > 0 ? sum / totalMatches : 0);
          setHighestMatch(searchResults.reduce((max, match) => Math.max(max, match.matchPercentage), 0));
        }
      }
    } else {
      setTotalMatches(0);
      setAverageMatchPercentage(0);
      setHighestMatch(0);
    }
  }, [searchResults, searchCriteria]);

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseBreakdown = () => {
    setSelectedMatch(null);
  };

  return (
    <div className="results-dashboard-container">
      <h2>Results Dashboard</h2>
      {searchCriteria && (
        <div className="search-criteria">
          <h3>Search Criteria:</h3>
          <ul>
            {searchCriteria.map((criteria, index) => (
              <li key={index}>
                {criteria.attribute}: {criteria.value} (Weight: {criteria.weight})
              </li>
            ))}
          </ul>
        </div>
      )}
      {searchResults ? (
        <>
          <ResultsSummary
            totalMatches={totalMatches}
            averageMatchPercentage={averageMatchPercentage}
            highestMatch={highestMatch}
          />
          <ResultsTable results={searchResults.matches} onMatchClick={handleMatchClick} />
          {selectedMatch && (
            <div className="match-breakdown-modal">
              <MatchBreakdown match={selectedMatch} />
              <button onClick={handleCloseBreakdown}>Close</button>
            </div>
          )}
        </>
      ) : (
        <div>No results to display.</div>
      )}
    </div>
  );
}

export default ResultsDashboard;
