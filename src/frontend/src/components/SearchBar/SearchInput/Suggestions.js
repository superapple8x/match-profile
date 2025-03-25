import React, { useState, useEffect } from 'react';
import Fuse from 'fuse.js';
import './Suggestions.css';

const Suggestions = ({ 
  query, 
  suggestions, 
  onSelect,
  darkMode = false 
}) => {
  const [filtered, setFiltered] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!query) {
      setFiltered(suggestions.slice(0, 5));
      return;
    }

    const fuse = new Fuse(suggestions, {
      includeScore: true,
      threshold: 0.3,
    });
    
    const results = fuse.search(query);
    setFiltered(results.slice(0, 5).map(result => result.item));
    setSelectedIndex(0);
  }, [query, suggestions]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      onSelect(filtered[selectedIndex]);
    }
  };

  if (!filtered.length) return null;

  const highlightMatch = (text, query) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.split(regex).map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <span key={i} className="highlight">{part}</span> : 
        part
    );
  };

  return (
    <div 
      className={`suggestions-container ${darkMode ? 'dark' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {filtered.map((suggestion, index) => (
        <div
          key={suggestion}
          className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(suggestion)}
        >
          {highlightMatch(suggestion, query)}
        </div>
      ))}
    </div>
  );
};

export default Suggestions;
