import React from 'react';
import './ResultsTable.css';

const ResultsTable = ({ results, onMatchClick }) => {
  return (
    <div className="results-table">
      <h3>Results Table</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>%</th>
            <th>Age</th>
            <th>Gender</th>
            <th>Location</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id}>
              <td>{result.id}</td>
              <td>
                <div className="match-percentage">
                  <div
                    className="match-bar"
                    style={{ width: `${result.matchPercentage.toFixed(2)}%` }}
                  >
                    {result.matchPercentage.toFixed(2)}%
                  </div>
                </div>
              </td>
              <td>{result.age}</td>
              <td>{result.gender}</td>
              <td>{result.location}</td>
              <td><button onClick={() => onMatchClick(result)}>Details</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;
