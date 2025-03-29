import React from 'react';
// Removed CriteriaBuilder import as it's unused
import SearchBar from './SearchBar';

// Accept datasetAttributes, datasetId, authToken
function SearchBuilder({ datasetAttributes, onSearch, initialCriteria, datasetId, authToken }) {
  // Removed the wrapper div
  return (
    <SearchBar
        datasetAttributes={datasetAttributes}
        onSearch={onSearch}
        initialCriteria={initialCriteria}
        datasetId={datasetId} // Pass datasetId down
        authToken={authToken} // Pass authToken down
    />
  );
}

export default SearchBuilder;
