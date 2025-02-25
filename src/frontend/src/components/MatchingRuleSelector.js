import React, { useState, useEffect } from 'react';

function MatchingRuleSelector({ attribute, onRuleChange }) {
  const [rule, setRule] = useState('exact');

  useEffect(() => {
    setRule('exact');
  }, [attribute]);

  const handleRuleChange = (e) => {
    setRule(e.target.value);
    onRuleChange(attribute, e.target.value);
  };

  return (
    <div>
      <span>Matching Rule:</span>
      <select
        value={rule}
        onChange={handleRuleChange}
      >
        <option value="exact">Exact Match</option>
        <option value="partial">Partial Match</option>
        <option value="fuzzy">Fuzzy Match</option>
      </select>
    </div>
  );
}

export default MatchingRuleSelector;