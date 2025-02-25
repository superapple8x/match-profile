import React from 'react';
import './ResultsDashboard.css';


function ResultsDashboard({ searchResults }) {
  return (
    <div className="results-dashboard-container">
      <h2>Results Dashboard</h2>
      {searchResults ? (
        <ul>
          {searchResults.matches.map(match => (
            <li key={match.profileId}>
              Profile ID: {match.profileId}, Match Percentage: {match.matchPercentage}
            </li>
          ))}
        </ul>
      ) : (
        <div>No results to display.</div>
      )}
    </div>
  );
}
export default ResultsDashboard;