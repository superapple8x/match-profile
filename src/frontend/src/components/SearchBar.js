import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SearchBar.css';

function SearchBar({ importedData, onSearch }) {
  const [inputValue, setInputValue] = useState('');
  const [currentAttribute, setCurrentAttribute] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCriteria, setSelectedCriteria] = useState([]);
  const [showWeightAdjuster, setShowWeightAdjuster] = useState(false);
  const [attributeValues, setAttributeValues] = useState({});
  const inputRef = useRef(null);
  
  // Extract unique values for each attribute
  useEffect(() => {
    if (importedData && importedData.length > 0) {
      const values = {};
      const attributes = Object.keys(importedData[0]);
      
      attributes.forEach(attr => {
        // Extract unique values for each attribute
        values[attr] = [...new Set(importedData.map(item => item[attr]))];
      });
      
      setAttributeValues(values);
    }
  }, [importedData]);
  
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Parse input to determine if we're entering an attribute or a value
    const parts = value.split(':');
    
    if (parts.length === 1) {
      // User is typing an attribute
      const attributeInput = parts[0].trim();
      setCurrentAttribute(attributeInput);
      
      // Generate attribute suggestions
      if (attributeInput) {
        const attributeSuggestions = Object.keys(attributeValues)
          .filter(attr => attr.toLowerCase().includes(attributeInput.toLowerCase()))
          .map(attr => ({ type: 'attribute', value: attr }));
        
        setSuggestions(attributeSuggestions);
      } else {
        setSuggestions([]);
      }
    } else {
      // User is typing a value
      const attributeInput = parts[0].trim();
      const valueInput = parts[1].trim();
      
      setCurrentAttribute(attributeInput);
      setCurrentValue(valueInput);
      
      // Generate value suggestions based on the attribute
      if (attributeValues[attributeInput] && valueInput) {
        const valueSuggestions = attributeValues[attributeInput]
          .filter(val => String(val).toLowerCase().includes(valueInput.toLowerCase()))
          .map(val => ({ type: 'value', value: val }));
        
        setSuggestions(valueSuggestions);
      } else if (!attributeValues[attributeInput]) {
        // Invalid attribute
        setSuggestions([{ type: 'error', message: `Attribute "${attributeInput}" not found in dataset` }]);
      } else {
        setSuggestions([]);
      }
    }
  };
  
  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'attribute') {
      setInputValue(`${suggestion.value}:`);
      setCurrentAttribute(suggestion.value);
      setCurrentValue('');
      inputRef.current.focus();
    } else if (suggestion.type === 'value') {
      // Add the complete criteria
      const newCriteria = {
        attribute: currentAttribute,
        value: suggestion.value,
        weight: 5 // Default weight
      };
      
      setSelectedCriteria([...selectedCriteria, newCriteria]);
      setInputValue(''); // Clear input for next criteria
      setCurrentAttribute('');
      setCurrentValue('');
      inputRef.current.focus();
    }
    
    setSuggestions([]);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === ' ' && currentAttribute && currentValue) {
      // Space key adds the current criteria and prepares for next
      const newCriteria = {
        attribute: currentAttribute,
        value: currentValue,
        weight: 5 // Default weight
      };
      
      setSelectedCriteria([...selectedCriteria, newCriteria]);
      setInputValue(''); // Clear input for next criteria
      setCurrentAttribute('');
      setCurrentValue('');
      setSuggestions([]);
      
      e.preventDefault(); // Prevent space from being added to input
    }
  };
  
  const handleSearch = () => {
    // Add current criteria if not empty
    let criteria = [...selectedCriteria];
    
    if (currentAttribute && currentValue) {
      criteria.push({
        attribute: currentAttribute,
        value: currentValue,
        weight: 5
      });
    }
    
    if (criteria.length > 0) {
      onSearch(criteria);
    }
  };
  
  const handleAdjustWeights = () => {
    setShowWeightAdjuster(true);
  };
  
  const handleWeightChange = (attribute, weight) => {
    setSelectedCriteria(
      selectedCriteria.map(criteria => 
        criteria.attribute === attribute 
          ? { ...criteria, weight } 
          : criteria
      )
    );
  };
  
  const handleRemoveCriteria = (index) => {
    setSelectedCriteria(selectedCriteria.filter((_, i) => i !== index));
  };
  
  return (
    <div className="enhanced-search-bar">
      <div className="selected-criteria">
        {selectedCriteria.map((criteria, index) => (
          <span key={index} className="criteria-tag">
            {criteria.attribute}:{criteria.value}
            <span className="remove-criteria" onClick={() => handleRemoveCriteria(index)}>×</span>
            {index < selectedCriteria.length - 1 && <span className="plus-indicator">+</span>}
          </span>
        ))}
      </div>
      
      <div className="search-input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter attribute:value (e.g., Age:27)"
          className="search-input"
        />
        
        {suggestions.length > 0 && (
          <div className="suggestions-dropdown">
            {suggestions.map((suggestion, index) => (
              <div 
                key={index}
                className={`suggestion-item ${suggestion.type}`}
                onClick={() => handleSuggestionSelect(suggestion)}
              >
                {suggestion.type === 'error' 
                  ? suggestion.message 
                  : suggestion.value}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="search-actions">
        <button onClick={handleSearch} className="search-button">
          Search
        </button>
        {selectedCriteria.length > 0 && (
          <button onClick={handleAdjustWeights} className="weight-button">
            Adjust Weights
          </button>
        )}
      </div>
      
      {showWeightAdjuster && (
        <WeightAdjustmentModal
          selectedCriteria={selectedCriteria}
          onWeightChange={handleWeightChange}
          onClose={() => setShowWeightAdjuster(false)}
        />
      )}
    </div>
  );
}

export default SearchBar;
