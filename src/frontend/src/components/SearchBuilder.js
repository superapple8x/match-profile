import React, { useState, useCallback } from 'react';
import './SearchConfig.css';
import AttributeSelector from './AttributeSelector';
import CriteriaBuilder from './CriteriaBuilder';
import GuidedSearch from './SearchBuilder/GuidedSearch';
import SearchBar from './SearchBar';

function SearchBuilder({ importedData, onSearch }) {
  const [isGuidedSearchOpen, setIsGuidedSearchOpen] = useState(false);

  const handleOpenGuidedSearch = () => {
    setIsGuidedSearchOpen(true);
  };

  const handleCloseGuidedSearch = () => {
    setIsGuidedSearchOpen(false);
  };

  const handleSearch = (criteria) => {
    // Implement search logic here based on the criteria
    onSearch(criteria);
  };

  return (
    <div className="search-config-container">
      <h3>Search Configuration</h3>
      <SearchBar importedData={importedData} onSearch={handleSearch} />
      <button onClick={handleOpenGuidedSearch}>Guided Search</button>
      {isGuidedSearchOpen && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content">
            <span className="close" onClick={handleCloseGuidedSearch}>
              &times;
            </span>
            <GuidedSearch importedData={importedData} onSearch={onSearch} />
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBuilder;
