import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './SearchBar.css';
import WeightAdjustmentModal from './WeightAdjustmentModal';

function SearchBar({ importedData, onSearch, darkMode = false }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCriteria, setSelectedCriteria] = useState([]);
  const [showWeightAdjuster, setShowWeightAdjuster] = useState(false);
  const inputRef = useRef(null);

  // Extract all available attributes from the dataset
  const attributes = importedData?.length > 0 
    ? Object.keys(importedData[0]) 
    : [];

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    const [attr, val] = value.split(':').map(s => s.trim());
    
    if (!val) {
      // Attribute suggestions
      const searchTerm = attr.toLowerCase();
      const matches = attributes
        .filter(a => a.toLowerCase().includes(searchTerm))
        .slice(0, 5);
      
      setSuggestions(matches.map(a => ({
        type: 'attribute',
        value: a,
        display: a.replace(
          new RegExp(`(${searchTerm})`, 'i'), 
          '<mark>$1</mark>'
        )
      })));
    } else {
      // Value suggestions
      if (attr && importedData?.length > 0) {
        const uniqueValues = [...new Set(
          importedData.map(item => item[attr]).filter(Boolean)
        )];
        const searchTerm = val.toLowerCase();
        const matches = uniqueValues
          .filter(v => String(v).toLowerCase().includes(searchTerm))
          .slice(0, 5);
        
        setSuggestions(matches.map(v => ({
          type: 'value',
          value: v,
          display: String(v).replace(
            new RegExp(`(${searchTerm})`, 'i'),
            '<mark>$1</mark>'
          )
        })));
      } else {
        setSuggestions([]);
      }
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'attribute') {
      setInputValue(`${suggestion.value}:`);
      inputRef.current.focus();
    } else if (suggestion.type === 'value') {
      const [attr] = inputValue.split(':');
      setInputValue(`${attr}:${suggestion.value}`);
      inputRef.current.focus();
    }
  };

  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const handleKeyDown = (e) => {
    // Arrow navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : -1
      );
    } 
    // Tab/Enter to select suggestion
    else if ((e.key === 'Tab' || e.key === 'Enter') && highlightedIndex >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[highlightedIndex]);
    }
    // Enter to confirm search
    else if (e.key === 'Enter' && highlightedIndex === -1) {
      const [attr, val] = inputValue.split(':').map(s => s.trim());
      if (attr && val) {
        setSelectedCriteria([...selectedCriteria, { 
          attribute: attr, 
          value: val,
          weight: 5
        }]);
        setInputValue('');
      }
    }
  };

  const handleSearch = () => {
    if (selectedCriteria.length > 0) {
      onSearch(selectedCriteria);
    }
  };

  return (
    <div className={`enhanced-search-bar ${darkMode ? 'dark' : ''}`}>
      <div className="selected-criteria">
        {selectedCriteria.map((criteria, index) => (
          <span key={index} className="criteria-tag">
            {criteria.attribute}:{criteria.value}
            <span 
              className="remove-criteria" 
              onClick={() => setSelectedCriteria(
                selectedCriteria.filter((_, i) => i !== index)
              )}
            >
              ×
            </span>
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
          placeholder="Enter attribute:value"
          className="search-input"
        />

        {suggestions.length > 0 && (
          <div className="suggestions-dropdown">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="suggestion-item"
                onClick={() => handleSuggestionSelect(suggestion)}
                dangerouslySetInnerHTML={{ __html: suggestion.display }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="search-actions">
        <button onClick={handleSearch} className="search-button">
          Search
        </button>
        {selectedCriteria.length > 0 && (
          <button 
            onClick={() => setShowWeightAdjuster(true)} 
            className="weight-button"
          >
            Adjust Weights
          </button>
        )}
      </div>

      {showWeightAdjuster && (
        <WeightAdjustmentModal
          selectedCriteria={selectedCriteria}
          onWeightChange={(attr, weight) => setSelectedCriteria(
            selectedCriteria.map(c => c.attribute === attr ? {...c, weight} : c)
          )}
          onClose={() => setShowWeightAdjuster(false)}
        />
      )}
    </div>
  );
}

SearchBar.propTypes = {
  importedData: PropTypes.arrayOf(PropTypes.object).isRequired,
  onSearch: PropTypes.func.isRequired,
  darkMode: PropTypes.bool
};

export default SearchBar;
