import React from 'react';
import './WeightAdjustmentModal.css';

function WeightAdjustmentModal({ selectedCriteria, onWeightChange, onClose }) {
  return (
    <div className="weight-modal">
      <div className="weight-modal-content">
        <h3>Adjust Attribute Weights</h3>
        <p>Drag sliders to adjust the importance of each attribute in the search.</p>
        
        {selectedCriteria.map((criteria, index) => (
          <div key={index} className="weight-slider-container">
            <label>{criteria.attribute}</label>
            <input
              type="range"
              min="1"
              max="10"
              value={criteria.weight}
              onChange={(e) => onWeightChange(criteria.attribute, parseInt(e.target.value))}
              className="weight-slider"
            />
            <span className="weight-value">{criteria.weight}</span>
          </div>
        ))}
        
        <div className="modal-actions">
          <button onClick={onClose} className="apply-button">
            Apply Weights
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeightAdjustmentModal;
