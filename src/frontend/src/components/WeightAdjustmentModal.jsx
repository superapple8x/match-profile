import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';

// Default weight if not specified in criteria
const DEFAULT_WEIGHT = 5;

function WeightAdjustmentModal({ selectedCriteria, initialAttributeWeights, onWeightsChange, onClose }) {
  // Prevent background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Extract unique attributes from the selected criteria
  const uniqueAttributes = useMemo(() => {
    const attributes = new Set(selectedCriteria.map(c => c.attribute));
    return Array.from(attributes);
  }, [selectedCriteria]);

  // Initialize local state for attribute weights
  const [attributeWeights, setAttributeWeights] = useState(() => {
    const weights = {};
    uniqueAttributes.forEach(attr => {
      // Use initial weight from props if available, otherwise find first matching criteria or use default
      weights[attr] = initialAttributeWeights?.[attr] ??
                      selectedCriteria.find(c => c.attribute === attr)?.weight ??
                      DEFAULT_WEIGHT;
    });
    return weights;
  });

  // Handler for slider changes
  const handleSliderChange = (attribute, newWeight) => {
    setAttributeWeights(prevWeights => ({
      ...prevWeights,
      [attribute]: parseInt(newWeight, 10)
    }));
  };

  // Handler for the Apply button
  const handleApplyWeights = () => {
    onWeightsChange(attributeWeights); // Pass the entire map of weights back
    onClose(); // Close the modal
  };

  return (
    // Modal Overlay
    <div
      className="fixed inset-0 bg-black/30 dark:bg-black/50 flex justify-center items-center z-[1000] transition-opacity duration-300 ease-out"
      onClick={onClose} // Close modal on overlay click
    >
      {/* Modal Content */}
      <div
        className="bg-white dark:bg-gray-800 backdrop-blur-md p-6 rounded-xl shadow-2xl w-11/12 max-w-lg max-h-[80vh] overflow-y-auto transition-all duration-300 ease-out border border-gray-200 dark:border-gray-700/50"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside content
      >
        <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Adjust Attribute Weights</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Adjust the importance (weight) of each attribute used in your search criteria.</p>

        {/* Sliders for Unique Attributes */}
        <div className="space-y-5">
          {uniqueAttributes.length > 0 ? uniqueAttributes.map((attribute) => (
            <div key={attribute} className="flex items-center space-x-4">
              <label className="w-32 shrink-0 font-medium text-gray-700 dark:text-gray-200 truncate" title={attribute}>
                {attribute}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={attributeWeights[attribute] || DEFAULT_WEIGHT} // Use state value or default
                onChange={(e) => handleSliderChange(attribute, e.target.value)}
                className="flex-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-150"
              />
              <span className="w-8 text-center font-semibold text-gray-700 dark:text-gray-200">
                {attributeWeights[attribute] || DEFAULT_WEIGHT}
              </span>
            </div>
          )) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No attributes selected to adjust weights for.</p>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end mt-8">
          <button
            onClick={handleApplyWeights} // Use the new handler
            disabled={uniqueAttributes.length === 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold rounded-md shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Apply Weights
          </button>
           <button
            onClick={onClose}
            className="ml-3 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-medium rounded-md shadow-sm hover:shadow transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

WeightAdjustmentModal.propTypes = {
  selectedCriteria: PropTypes.arrayOf(PropTypes.shape({
    attribute: PropTypes.string.isRequired,
    operator: PropTypes.string, // Operator/value not directly used here anymore
    value: PropTypes.any,
    weight: PropTypes.number, // Still useful for initial state derivation
  })).isRequired,
  initialAttributeWeights: PropTypes.objectOf(PropTypes.number), // Optional initial weights map
  onWeightsChange: PropTypes.func.isRequired, // Renamed and changed signature
  onClose: PropTypes.func.isRequired,
};

WeightAdjustmentModal.defaultProps = {
    initialAttributeWeights: {},
};


export default WeightAdjustmentModal;
