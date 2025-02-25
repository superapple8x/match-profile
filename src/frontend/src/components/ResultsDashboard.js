import React, { useState, useEffect } from 'react';
import './ResultsDashboard.css';
import ResultsSummary from './ResultsDashboard/ResultsSummary';
import ResultsTable from './ResultsDashboard/ResultsTable';
import MatchBreakdown from './ResultsDashboard/MatchBreakdown';

function ResultsDashboard({ searchResults }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [averageMatchPercentage, setAverageMatchPercentage] = useState(0);
  const [highestMatch, setHighestMatch] = useState(0);

  useEffect(() => {
    if (searchResults) {
      setTotalMatches(searchResults.matches.length);
      const sum = searchResults.matches.reduce((acc, match) => acc + match.matchPercentage, 0);
      setAverageMatchPercentage(totalMatches > 0 ? sum / totalMatches : 0);
      setHighestMatch(searchResults.matches.reduce((max, match) => Math.max(max, match.matchPercentage), 0));
    } else {
      setTotalMatches(0);
      setAverageMatchPercentage(0);
      setHighestMatch(0);
    }
  }, [searchResults]);

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseBreakdown = () => {
    setSelectedMatch(null);
  };

  return (
    <div className="results-dashboard-container">
      <h2>Results Dashboard</h2>
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
