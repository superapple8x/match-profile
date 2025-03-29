import React from 'react';
// Removed CriteriaBuilder import as it's unused
// Removed duplicate React import
import PropTypes from 'prop-types'; // Import PropTypes
import SearchBar from './SearchBar';

// Accept datasetAttributes, datasetId, authToken, handleLogout
function SearchBuilder({ datasetAttributes, onSearch, initialCriteria, datasetId, authToken, handleLogout }) { // Added handleLogout
  // Removed the wrapper div
  return (
    <SearchBar
        datasetAttributes={datasetAttributes}
        onSearch={onSearch}
        initialCriteria={initialCriteria}
        datasetId={datasetId} // Pass datasetId down
        authToken={authToken} // Pass authToken down
        handleLogout={handleLogout} // Pass handleLogout down
    />
  );
}

// Add PropTypes
SearchBuilder.propTypes = {
  datasetAttributes: PropTypes.arrayOf(PropTypes.string),
  onSearch: PropTypes.func.isRequired,
  initialCriteria: PropTypes.arrayOf(PropTypes.shape({
      attribute: PropTypes.string,
      value: PropTypes.any,
      weight: PropTypes.number,
      operator: PropTypes.string
  })),
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  authToken: PropTypes.string,
  handleLogout: PropTypes.func.isRequired, // Added handleLogout
};

// Add defaultProps
SearchBuilder.defaultProps = {
  datasetAttributes: [],
  initialCriteria: [],
  datasetId: null,
  authToken: null,
};


export default SearchBuilder;
