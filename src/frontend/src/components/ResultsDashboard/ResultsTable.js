import React from 'react';
import './ResultsTable.css';
import BootstrapTable from 'react-bootstrap-table-next';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';

function ResultsTable({ results, filteredData, onMatchClick }) {
  // Handle both structured results and direct filtered data
  let data;
  let showMatchPercentage = false;

  if (results && Array.isArray(results)) {
    // Handle results from ResultsDashboard
    data = results;
    showMatchPercentage = true;
  } else if (filteredData && Array.isArray(filteredData)) {
    // Handle filtered data from GuidedSearch
    data = filteredData;
  } else {
    return <div>No data to display.</div>;
  }

  // Generate columns based on data structure
  const columns = [];

  // Add match percentage column if available
  if (showMatchPercentage) {
    columns.push({
      dataField: 'matchPercentage',
      text: 'Match %',
      sort: true,
      formatter: (cell) => `${cell.toFixed(2)}%`
    });
  }

  // Add data columns
  if (data.length > 0) {
    // Get the first item to determine columns
    const firstItem = data[0];

    // If it's a match result with profile property
    if (firstItem.profile) {
      Object.keys(firstItem.profile).forEach(key => {
        columns.push({
          dataField: `profile.${key}`,
          text: key,
          sort: true
        });
      });
    } else {
      // Direct data object
      Object.keys(firstItem).forEach(key => {
        // Skip matchPercentage if already added
        if (key !== 'matchPercentage' || !showMatchPercentage) {
          columns.push({
            dataField: key,
            text: key,
            sort: true
          });
        }
      });
    }
  }

  const defaultSorted = [{
    dataField: columns[0].dataField,
    order: 'asc'
  }];

  const keyField = data[0].id ? 'id' : columns[0].dataField;

  return (
    <div className="results-table-container">
      <BootstrapTable
        bootstrap4
        keyField={keyField}
        data={data}
        columns={columns}
        defaultSorted={defaultSorted}
      />
    </div>
  );
}

export default ResultsTable;
