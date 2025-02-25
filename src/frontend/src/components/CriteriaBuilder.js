import React from 'react';
import WeightAdjuster from './WeightAdjuster';
import MatchingRuleSelector from './MatchingRuleSelector';

function CriteriaBuilder({ attribute, onWeightChange, onRuleChange }) {
  return (
    <div>
      <span>{attribute}</span>
      <WeightAdjuster
        attribute={attribute}
        onWeightChange={onWeightChange}
      />
      <MatchingRuleSelector
        attribute={attribute}
        onRuleChange={onRuleChange}
      />
    </div>
  );
}

export default CriteriaBuilder;