  import React, { useState, useCallback } from 'react';
import CriteriaBuilder from './CriteriaBuilder';
import GuidedSearch from './SearchBuilder/GuidedSearch';
import SearchBar from './SearchBar';

function SearchBuilder({ importedData, onSearch }) {
  const [isGuidedSearchOpen, setIsGuidedSearchOpen] = useState(false);
  const [matchingRules, setMatchingRules] = useState({});
  const [searchValues, setSearchValues] = useState({});

    const handleOpenGuidedSearch = () => {
        setIsGuidedSearchOpen(true);
    };

    const handleCloseGuidedSearch = () => {
        setIsGuidedSearchOpen(false);
    };

    const handleRuleChange = useCallback((attribute, rule) => {
    setMatchingRules(prevRules => ({
      ...prevRules,
      [attribute]: rule
    }));
  }, [setMatchingRules]);

  const handleSearchValueChange = useCallback((attribute, value) => {
    setSearchValues(prevValues => ({
      ...prevValues,
      [attribute]: value
    }));
  }, [setSearchValues]);

  const handleGuidedSearch = (criteria) => {
    // Implement search logic here based on the criteria
    onSearch(criteria);
  };

  return (
    <div className="search-config-container">
      
      <SearchBar importedData={importedData} onSearch={onSearch} />
      <button onClick={handleOpenGuidedSearch}>Guided Search</button>
      {isGuidedSearchOpen && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content">
            <span className="close" onClick={handleCloseGuidedSearch}>
              &times;
            </span>
            <GuidedSearch importedData={importedData} onSearch={handleGuidedSearch} />
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBuilder;
