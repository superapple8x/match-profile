import React from 'react';

const ResultsSummary = ({ totalMatches, averageMatchPercentage, highestMatch }) => {
  return (
    <div>
      <h3>Summary:</h3>
      <div>
        <div>
          <div>{totalMatches}</div>
          <div>Matches</div>
        </div>
        <div>
          <div>{averageMatchPercentage}</div>
          <div>Avg</div>
        </div>
        <div>
          <div>{highestMatch}</div>
          <div>Best</div>
        </div>
      </div>
    </div>
  );
};

export default ResultsSummary;