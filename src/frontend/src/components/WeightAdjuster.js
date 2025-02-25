import React, { useState } from 'react';

function WeightAdjuster({ attribute, onWeightChange }) {
  const [weight, setWeight] = useState(1.0);

  const handleWeightChange = (e) => {
    const newWeight = parseFloat(e.target.value);
    setWeight(newWeight);
    onWeightChange(attribute, newWeight);
  };

  return (
    <div>
      <span>Weight:</span>
      <input
        type="number"
        min="0"
        max="1"
        step="0.1"
        value={weight}
        onChange={handleWeightChange}
      />
    </div>
  );
}

export default WeightAdjuster;