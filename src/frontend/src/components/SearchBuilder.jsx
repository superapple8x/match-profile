import React from 'react';
// Removed CriteriaBuilder import as it's unused
import SearchBar from './SearchBar';

function SearchBuilder({ importedData, onSearch }) {
  // Removed the wrapper div
  return (
    <SearchBar importedData={importedData} onSearch={onSearch} />
  );
}

export default SearchBuilder;
