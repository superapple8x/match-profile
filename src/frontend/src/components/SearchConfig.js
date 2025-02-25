import React, { useState, useEffect } from 'react';
import './SearchConfig.css';

function SearchConfig({ importedData, onSearch }) {
  const [attributes, setAttributes] = useState([]);
  const [weights, setWeights] = useState({});
  const [matchingRules, setMatchingRules] = useState({});

  // Initialize attributes when data is imported
  useEffect(() => {
    if (importedData && importedData.length > 0) {
      const keys = Object.keys(importedData[0]);
      setAttributes(keys);
      
      // Initialize default weights
      const initialWeights = {};
      keys.forEach(key => {
        initialWeights[key] = 1.0; // Default weight
      });
      setWeights(initialWeights);
    }
  }, [importedData]);

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
      attributes,
      weights,
      matchingRules
    };
    onSearch(searchConfig);
  };

  return (
    <div className="search-config-container">
      <h3>Search Configuration</h3>
      
      {attributes.map(attribute => (
        <div key={attribute} className="attribute-config">
          <label>{attribute}</label>
          
          <div className="weight-control">
            <span>Weight:</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={weights[attribute] || 0}
              onChange={e => handleWeightChange(attribute, e.target.value)}
            />
          </div>

          <div className="rule-control">
            <span>Matching Rule:</span>
            <select
              value={matchingRules[attribute] || 'exact'}
              onChange={e => handleRuleChange(attribute, e.target.value)}
            >
              <option value="exact">Exact Match</option>
              <option value="partial">Partial Match</option>
              <option value="fuzzy">Fuzzy Match</option>
            </select>
          </div>
        </div>
      ))}

      <button onClick={handleSearch} className="search-button">
        Run Search
      </button>
    </div>
  );
}

export default SearchConfig;