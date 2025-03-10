import React, { useState, useEffect } from 'react';
import SyntaxHighlighter from './SyntaxHighlighter';
import { parseInput } from '../../services/InputParser';

const SearchInput = ({ value, onChange, onCommit }) => {
  const [inputState, setInputState] = useState({
    stage: 'ATTRIBUTE_SELECTION',
    attribute: null,
    partialValue: ''
  });

  useEffect(() => {
    const parsed = parseInput(value);
    setInputState(parsed);
  }, [value]);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      onCommit({
        attribute: inputState.attribute,
        value: inputState.partialValue
      });
    }
  };

  return (
    <div className="search-input">
      <SyntaxHighlighter
        text={value}
        stage={inputState.stage}
      />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label="Search criteria input"
      />
    </div>
  );
};

export default SearchInput;
