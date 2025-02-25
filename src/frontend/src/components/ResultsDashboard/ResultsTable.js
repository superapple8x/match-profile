import React from 'react';

const ResultsTable = ({ results }) => {
  return (
    <div>
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
              <td>{result.matchPercentage}</td>
              <td>{result.age}</td>
              <td>{result.gender}</td>
              <td>{result.location}</td>
              <td><button>Details</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;