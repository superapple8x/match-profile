  import React, { useState, useCallback } from 'react';
import CriteriaBuilder from './CriteriaBuilder';
import SearchBar from './SearchBar';

function SearchBuilder({ importedData, onSearch }) {
  return (
    <div className="search-config-container">
      <SearchBar importedData={importedData} onSearch={onSearch} />
    </div>
  );
}

export default SearchBuilder;
