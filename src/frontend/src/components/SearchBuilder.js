import React, { useState, useCallback } from 'react';
import './SearchConfig.css';
import AttributeSelector from './AttributeSelector';
import CriteriaBuilder from './CriteriaBuilder';
import GuidedSearch from './SearchBuilder/GuidedSearch';
import SearchBar from './SearchBar';

function SearchBuilder({ importedData, onSearch }) {
  const [isGuidedSearchOpen, setIsGuidedSearchOpen] = useState(false);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [matchingRules, setMatchingRules] = useState({});
  const [searchValues, setSearchValues] = useState({});

  const handleOpenGuidedSearch = () => {
    setIsGuidedSearchOpen(true);
  };

  const handleCloseGuidedSearch = () => {
    setIsGuidedSearchOpen(false);
  };

  const handleAttributeSelect = useCallback((attribute) => {
    setSelectedAttributes(prev => [...prev, attribute]);
  }, [setSelectedAttributes]);

  const handleAttributeDeselect = useCallback((attribute) => {
    setSelectedAttributes(prev => prev.filter((attr) => attr !== attribute));
  }, [setSelectedAttributes]);

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
      <h3>Search Configuration</h3>
      <AttributeSelector
        importedData={importedData}
        onAttributeSelect={handleAttributeSelect}
        onAttributeDeselect={handleAttributeDeselect}
      />
      {selectedAttributes.map(attribute => (
        <CriteriaBuilder
          key={attribute}
          attribute={attribute}
          onRuleChange={handleRuleChange}
          onSearchValueChange={handleSearchValueChange}
        />
      ))}
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
