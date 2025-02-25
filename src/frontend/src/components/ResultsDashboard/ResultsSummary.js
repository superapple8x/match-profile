import React from 'react';
import './ResultsSummary.css';

const ResultsSummary = ({ totalMatches, averageMatchPercentage, highestMatch }) => {
  return (
    <div className="results-summary">
      <h3>Summary:</h3>
      <div className="summary-container">
        <div className="summary-item">
          <div className="summary-value">{totalMatches}</div>
          <div className="summary-label">Matches</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">
            {averageMatchPercentage && averageMatchPercentage.toFixed(2)}%
          </div>
          <div className="summary-label">Avg</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">
            {highestMatch && highestMatch.toFixed(2)}%
          </div>
          <div className="summary-label">Best</div>
        </div>
      </div>
    </div>
  );
};

export default ResultsSummary;
