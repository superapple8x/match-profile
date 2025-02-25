import React, { useState } from 'react';
import './SearchConfig.css';
import AttributeSelector from './AttributeSelector';
import CriteriaBuilder from './CriteriaBuilder';

function SearchBuilder({ importedData, onSearch }) {
  const [weights, setWeights] = useState({});
  const [matchingRules, setMatchingRules] = useState({});

  const handleWeightChange = (attribute, value) => {
    setWeights(prevWeights => ({
      ...prevWeights,
      [attribute]: parseFloat(value)
    }));
  };

  const handleRuleChange = (attribute, rule) => {
    setMatchingRules(prevRules => ({
      ...prevRules,
      [attribute]: rule
    }));
  };

  const handleSearch = () => {
    const searchConfig = {
      weights,
      matchingRules
    };
    onSearch(searchConfig);
  };

  return (
    <div className="search-config-container">
      <h3>Search Configuration</h3>
      <AttributeSelector importedData={importedData} />
      {importedData && Object.keys(importedData[0]).map(attribute => (
        <CriteriaBuilder
          key={attribute}
          attribute={attribute}
          onWeightChange={handleWeightChange}
          onRuleChange={handleRuleChange}
        />
      ))}
      <button onClick={handleSearch} className="search-button">
        Run Search
      </button>
    </div>
  );
}

export default SearchBuilder;