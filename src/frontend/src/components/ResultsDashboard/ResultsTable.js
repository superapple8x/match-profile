import React, { useState, useEffect } from 'react';
import './ResultsTable.css';
import BootstrapTable from 'react-bootstrap-table-next';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';

function ResultsTable({ results, filteredData, onMatchClick }) {
  // State for tracking sort configuration
  const [sortState, setSortState] = useState({
    dataField: 'matchPercentage',
    order: 'desc' // Default to showing highest matches first
  });
  
  // State for the actual data to display
  const [tableData, setTableData] = useState([]);
  
   // Process the input data and determine what to display
   useEffect(() => {
    console.log('ResultsTable: data dependency array changed', { results, filteredData });
    let data;
    if (results && Array.isArray(results)) {
      data = results.map(item => ({ ...item })); // Create a new copy
    } else if (filteredData && Array.isArray(filteredData)) {
      data = filteredData.map(item => ({ ...item })); // Create a new copy
    } else {
      data = [];
    }
    setTableData(data);
  }, [results, filteredData]);

  useEffect(() => {
    console.log('Sort state changed:', sortState);
  }, [sortState]);


  // Handle all table changes including sorting
  const handleTableChange = (type, { sortField, sortOrder }) => {
    console.log('Table change event:', { type, sortField, sortOrder });
    if (type === 'sort') {
      setSortState({
        dataField: sortField,
        order: sortOrder
      });
    }
  };

  // If no data, show a message
  if (tableData.length === 0) {
    return <div>No data to display.</div>;
  }
  
  // Determine if we should show match percentage
  const showMatchPercentage = results && Array.isArray(results);
  
  // Build columns based on the data
  const columns = [];
  
  if (showMatchPercentage) {
    columns.push({
      dataField: 'matchPercentage',
      text: 'Match %',
      sort: true,
      formatter: (cell) => `${cell.toFixed(2)}%`,
      sortCaret: (order, column) => {
        return order === 'asc' ? ' ▲' : ' ▼';
      }
    });
  }
  
  const firstItem = tableData[0];
  
  if (firstItem.profile) {
    Object.keys(firstItem.profile).forEach(key => {
      columns.push({
        dataField: `profile.${key}`,
        text: key,
        sort: true,
        sortCaret: (order, column) => {
          return order === 'asc' ? ' ▲' : ' ▼';
        }
      });
    });
  } else {
    Object.keys(firstItem).forEach(key => {
      if (key !== 'matchPercentage' || !showMatchPercentage) {
        columns.push({
          dataField: key,
          text: key,
          sort: true,
          sortCaret: (order, column) => {
            return order === 'asc' ? ' ▲' : ' ▼';
          }
        });
      }
    });
  }
  
  // Determine the key field for the table
  const keyField = firstItem.id ? 'id' : columns[0].dataField;
  
  return (
    <div className="results-table-container">
      <BootstrapTable
        bootstrap4
        keyField={keyField}
        data={tableData}
        columns={columns}
        defaultSorted={[sortState]}
        onTableChange={handleTableChange}
        remote={{ sort: true }} // Set to true if sorting should be handled by the server
      />
    </div>
  );
}

export default ResultsTable;
