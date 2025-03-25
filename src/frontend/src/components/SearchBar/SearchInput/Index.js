import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trie } from '../../../utils/Trie';
import { parseInput, validateCriteria } from '../../../services/InputParser';
import Suggestions from './Suggestions';
import SyntaxHighlighter from './SyntaxHighlighter';
import './SearchInput.css';

const SearchInput = ({ 
  attributes,
  darkMode = false,
  onCommit,
  onSearch
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState([]);
  const trieRef = useRef(new Trie());
  const inputRef = useRef(null);
  
  // Initialize Trie with attributes
  useEffect(() => {
    attributes.forEach(attr => trieRef.current.insert(attr));
  }, [attributes]);

  // Debounced suggestion handler
  const updateSuggestions = useCallback(
    debounce((value) => {
      const parsed = parseInput(value);
      let newSuggestions = [];
      
      if (parsed.stage === 'ATTRIBUTE_SELECTION') {
        const trieResults = trieRef.current.search(parsed.partialValue);
        const recentMatches = recentSearches.filter(s => 
          s.startsWith(parsed.partialValue)
        );
        
        newSuggestions = [
          ...recentMatches.map(value => ({ value, recent: true })),
          ...trieResults.map(value => ({ value, recent: false }))
        ].slice(0, 10);
      }
      
      setSuggestions(newSuggestions);
    }, 300),
    [recentSearches]
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    updateSuggestions(value);
    onSearch(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) {
        handleSuggestionSelect(suggestions[selectedIndex].value);
      } else {
        commitCurrentInput();
      }
    }
  };

  const handleSuggestionSelect = (value) => {
    const parsed = parseInput(inputValue);
    let newValue = '';
    
    if (parsed.stage === 'ATTRIBUTE_SELECTION') {
      newValue = `${value}: `;
      setRecentSearches(prev => [
        value,
        ...prev.filter(v => v !== value).slice(0, 9)
      ]);
    }
    
    setInputValue(newValue);
    setSuggestions([]);
    inputRef.current.focus();
  };

  const commitCurrentInput = () => {
    const parsed = parseInput(inputValue);
    const validation = validateCriteria(
      parsed.attribute,
      parsed.partialValue,
      new Set(attributes)
    );
    
    if (validation.isValid) {
      onCommit(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="search-input-container">
      <div className={`search-input ${darkMode ? 'dark' : ''}`}>
        <SyntaxHighlighter 
          text={inputValue}
          darkMode={darkMode}
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search attributes..."
          aria-label="Attribute search input"
        />
      </div>
      
      {suggestions.length > 0 && (
        <Suggestions
          suggestions={suggestions}
          inputValue={inputValue}
          selectedIndex={selectedIndex}
          onSelect={handleSuggestionSelect}
          onHover={setSelectedIndex}
        />
      )}
    </div>
  );
};

// Debounce helper
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

export default SearchInput;
