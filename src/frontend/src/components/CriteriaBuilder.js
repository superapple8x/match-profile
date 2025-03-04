import React, { useState, useCallback } from 'react';
import WeightAdjuster from './WeightAdjuster';
import MatchingRuleSelector from './MatchingRuleSelector';

function CriteriaBuilder({ attribute, onRuleChange, onSearchValueChange }) {
  const [searchValue, setSearchValue] = useState('');

    // Validate props
  if (typeof onSearchValueChange !== 'function') {
    console.error('CriteriaBuilder: onSearchValueChange prop is not a function');
    // Provide fallback
    onSearchValueChange = () => {};
  }

  if (typeof onRuleChange !== 'function') {
    console.error('CriteriaBuilder: onRuleChange prop is not a function');
    // Provide fallback
    onRuleChange = () => {};
  }

  const handleSearchValueChange = useCallback((e) => {
    setSearchValue(e.target.value);
    onSearchValueChange(attribute, e.target.value);
  }, [attribute, onSearchValueChange]);

  return (
    <div className="criteria-builder-container">
      <span>{attribute}</span>
      <input
        type="text"
        value={searchValue}
        onChange={handleSearchValueChange}
      />
      <WeightAdjuster attribute={attribute} />
      <MatchingRuleSelector
        attribute={attribute}
        onRuleChange={onRuleChange}
      />
    </div>
  );
}


export default CriteriaBuilder;
