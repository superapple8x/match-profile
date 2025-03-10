import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './SearchBar.css';
import WeightAdjustmentModal from './WeightAdjustmentModal';

function SearchBar({ importedData, onSearch, darkMode = false }) {
  // Core search input state
  const [inputValue, setInputValue] = useState(''); // Current raw input text
  const [currentAttribute, setCurrentAttribute] = useState(''); // Parsed attribute part
  const [currentValue, setCurrentValue] = useState(''); // Parsed value part

  // Suggestions and selection management
  const [suggestions, setSuggestions] = useState([]); // Auto-complete suggestions
  const [selectedCriteria, setSelectedCriteria] = useState([]); // Finalized search criteria

  // Weight adjustment interface
  const [showWeightAdjuster, setShowWeightAdjuster] = useState(false); // Modal visibility

  // Data structure for suggestions
  const [attributeValues, setAttributeValues] = useState({}); // Map of attribute->values
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
  
// New regex pattern with lookaheads for complex attributes
const ATTRIBUTE_PATTERN = /^(?![0-9_])[a-zA-Z_][\w-]{2,25}(?:\.[a-z]{1,8})?$/;

const parseInput = (input) => {
  const match = input.match(/^((?:\\:|[^:])+)(?::\s*(.+))?$/);
  return {
    attribute: match?.[1]?.replace(/\\:/g, ':').trim() || '',
    value: match?.[2]?.replace(/\\:/g, ':').trim() || ''
  };
};

const attributeExists = (attribute) => {
  return importedData && importedData.length > 0 && 
    Object.keys(importedData[0]).includes(attribute);
};

const validateValueType = (attribute, value) => {
  if (!importedData || importedData.length === 0) return false;
  
  // Get the type of the first matching value
  const sampleValue = importedData[0][attribute];
  const expectedType = typeof sampleValue;
  
  // Handle numeric values that might be strings
  if (expectedType === 'number') {
    return !isNaN(Number(value));
  }
  
  // Handle boolean values
  if (expectedType === 'boolean') {
    return value.toLowerCase() === 'true' || value.toLowerCase() === 'false';
  }
  
  // For strings, just return true since we can't validate content
  return expectedType === 'string';
};

const handleErrors = (errorCodes) => {
  const errorMessages = {
    'INVALID_ATTRIBUTE_SYNTAX': 'Invalid attribute format. Use letters, numbers and underscores only',
    'UNKNOWN_ATTRIBUTE': 'Attribute not found in dataset',
    'VALUE_TYPE_MISMATCH': 'Value does not match expected type for this attribute'
  };
  
  setSuggestions(
    errorCodes.map(code => ({
      type: 'error',
      message: errorMessages[code] || 'Unknown error'
    }))
  );
};

const validateCriteria = (attribute, value) => {
  const errors = [];
  
  if (!ATTRIBUTE_PATTERN.test(attribute)) {
    errors.push('INVALID_ATTRIBUTE_SYNTAX');
  }
  
  if (!attributeExists(attribute)) {
    errors.push('UNKNOWN_ATTRIBUTE');
  }
  
  if (value && !validateValueType(attribute, value)) {
    errors.push('VALUE_TYPE_MISMATCH');
  }
  
  return errors;
};

const handleInputChange = (e) => {
  const value = e.target.value;
  setInputValue(value);
  
  const parsed = parseInput(value);
  
  // Only validate syntax during typing
  const syntaxErrors = validateCriteria(parsed.attribute, '');
  
  if (syntaxErrors.length === 0) {
    if (parsed.value) {
      handleValueInput(parsed.attribute, parsed.value);
    } else {
      handleAttributeInput(parsed.attribute);
    }
  } else {
    // Only show syntax errors during typing
    handleErrors(syntaxErrors.filter(e => e === 'INVALID_ATTRIBUTE_SYNTAX'));
  }
};

const handleAttributeInput = (attributeInput) => {
  setCurrentAttribute(attributeInput);
  
  // Clear any existing errors when typing starts
  if (suggestions.some(s => s.type === 'error')) {
    setSuggestions([]);
  }

  // Generate attribute suggestions for any partial match
  if (attributeInput) {
    const attributeSuggestions = Object.keys(attributeValues)
      .filter(attr => attr.toLowerCase().startsWith(attributeInput.toLowerCase()))
      .map(attr => ({ type: 'attribute', value: attr }));
    
    // Only show suggestions if we have matches
    if (attributeSuggestions.length > 0) {
      setSuggestions(attributeSuggestions);
    } else {
      // If no matches, check if input is valid
      const syntaxErrors = validateCriteria(attributeInput, '');
      if (syntaxErrors.length > 0) {
        handleErrors(syntaxErrors.filter(e => e === 'INVALID_ATTRIBUTE_SYNTAX'));
      } else {
        setSuggestions([]);
      }
    }
  } else {
    setSuggestions([]);
  }
};

const handleValueInput = (attributeInput, valueInput) => {
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
      setSuggestions([]); // Clear suggestions
      inputRef.current.focus();
    } else if (suggestion.type === 'value') {
      // Add the complete criteria
      const newCriteria = {
        attribute: currentAttribute,
        value: suggestion.value,
        weight: 5, // Default weight
      };

      setSelectedCriteria([...selectedCriteria, newCriteria]);
      setInputValue(''); // Clear input for next criteria
      setCurrentAttribute('');
      setCurrentValue('');
      setSuggestions([]); // Clear suggestions
      inputRef.current.focus();
    }
    
  };

  const handleKeyDown = (e) => {
  if (e.key === 'Enter' && suggestions.length > 0) {
    // Select the first suggestion if it exists
    handleSuggestionSelect(suggestions[0]);
    e.preventDefault();
  } else if (e.key === 'Enter' && currentAttribute && currentValue) {
    // Validate full criteria before adding
    const errors = validateCriteria(currentAttribute, currentValue);
    if (errors.length > 0) {
      handleErrors(errors);
      e.preventDefault();
      return;
    }
    
    const newCriteria = {
      attribute: currentAttribute,
      value: currentValue,
      weight: 5, // Default weight
    };
    setSelectedCriteria([...selectedCriteria, newCriteria]);
    setInputValue('');
    setCurrentAttribute('');
    setCurrentValue('');
    setSuggestions([]);
    e.preventDefault();
  } else if (e.key === ' ' && currentAttribute && currentValue) {
    // Validate before adding criteria
    const errors = validateCriteria(currentAttribute, currentValue);
    if (errors.length > 0) {
      handleErrors(errors);
      e.preventDefault();
      return;
    }
    
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
    <div className={`enhanced-search-bar ${darkMode ? 'dark' : ''}`}>
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
};

SearchBar.propTypes = {
    importedData: PropTypes.arrayOf(PropTypes.object).isRequired,
    onSearch: PropTypes.func.isRequired
}

export default SearchBar;
