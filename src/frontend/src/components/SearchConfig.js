import React, { useState } from 'react';
import './SearchConfig.css';

function SearchConfig() {
  // Placeholder attributes - will be fetched from backend later
  const availableAttributes = [
    'firstName',
    'lastName',
    'age',
    'city',
    'country',
    'skill',
    'experience',
  ];

  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [weights, setWeights] = useState({});

  const handleAttributeChange = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedAttributes(selectedOptions);

    // Initialize weights for newly selected attributes
    const newWeights = { ...weights };
    selectedOptions.forEach((attr) => {
      if (!(attr in newWeights)) {
        newWeights[attr] = 1; // Default weight
      }
    });
    setWeights(newWeights);
  };

  const handleWeightChange = (attribute, value) => {
    setWeights({ ...weights, [attribute]: parseFloat(value) });
  };

  return (
    <div className="search-config-container">
      <h2>Search Configuration</h2>

      <div>
        <label htmlFor="attributes">Attributes:</label>
        <select
          id="attributes"
          multiple
          value={selectedAttributes}
          onChange={handleAttributeChange}
        >
          {availableAttributes.map((attribute) => (
            <option key={attribute} value={attribute}>
              {attribute}
            </option>
          ))}
        </select>
      </div>

      
        <div>
          {selectedAttributes.map((attribute) => (
            <div key={attribute}>
              <label htmlFor={`weight-${attribute}`}>{attribute}:</label>
              <input
                type="range"
                id={`weight-${attribute}`}
                min="0"
                max="2"
                step="0.1"
                value={weights[attribute] || 1}
                onChange={(e) => handleWeightChange(attribute, e.target.value)}
              />
              <span>{weights[attribute] || 1}</span>
            </div>
          ))}
        </div>
      {/* Placeholder for other search parameters */}
      <div>
        <h3>Other Search Parameters</h3>
        {/* To be implemented later */}
      </div>
    </div>
  );
}

export default SearchConfig;