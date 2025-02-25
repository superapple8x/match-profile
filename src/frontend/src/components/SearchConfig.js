import React, { useState, useEffect } from 'react';
import './SearchConfig.css';

function SearchConfig({ importedData, onSearch }) {
  const [attributes, setAttributes] = useState([]);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [weights, setWeights] = useState({});
  const [matchingRules, setMatchingRules] = useState({});

  // Initialize attributes when data is imported
  useEffect(() => {
    if (importedData && importedData.length > 0) {
      const keys = Object.keys(importedData[0]);
      setAttributes(keys);
      setSelectedAttributes(keys); // Initially select all attributes

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

  const handleAttributeSelection = (attribute) => {
    setSelectedAttributes(prevSelected => {
      if (prevSelected.includes(attribute)) {
        return prevSelected.filter(attr => attr !== attribute);
      } else {
        return [...prevSelected, attribute];
      }
    });
  };

  return (
    <div className="search-config-container">
      <h3>Search Configuration</h3>
      
      <div className="attributes-selection">
        <h4>Select Attributes</h4>
        {attributes.map(attribute => (
          <div key={attribute} className="attribute-checkbox">
            <input
              type="checkbox"
              id={`checkbox-${attribute}`}
              checked={selectedAttributes.includes(attribute)}
              onChange={() => handleAttributeSelection(attribute)}
            />
            <label htmlFor={`checkbox-${attribute}`}>{attribute}</label>
          </div>
        ))}
      </div>

      <div className="criteria-config">
        <h4>Criteria Configuration</h4>
        {selectedAttributes.map(attribute => (
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
      </div>

      <button onClick={handleSearch} className="search-button">
        Run Search
      </button>
    </div>
  );
}

export default SearchConfig;