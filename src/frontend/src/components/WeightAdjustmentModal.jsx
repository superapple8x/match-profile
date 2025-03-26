import React from 'react';
// Removed: import './WeightAdjustmentModal.css';

function WeightAdjustmentModal({ selectedCriteria, onWeightChange, onClose }) {
  // Prevent background scroll when modal is open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    // Modal Overlay
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={onClose} // Close modal on overlay click
    >
      {/* Modal Content */}
      <div
        className="bg-white dark:bg-gray-800 p-5 rounded-md w-11/12 max-w-lg max-h-[80vh] overflow-y-auto transition-colors duration-150 shadow-xl"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside content
      >
        <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Adjust Attribute Weights</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Drag sliders to adjust the importance of each attribute in the search.</p>

        {/* Sliders */}
        <div className="space-y-4">
          {selectedCriteria.map((criteria, index) => (
            <div key={index} className="flex items-center space-x-3">
              <label className="w-28 shrink-0 font-medium text-gray-700 dark:text-gray-200 truncate" title={criteria.attribute}>
                {criteria.attribute}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={criteria.weight}
                onChange={(e) => onWeightChange(criteria.attribute, parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500 dark:accent-blue-400" // Style range input
              />
              <span className="w-8 text-center font-semibold text-gray-700 dark:text-gray-200">{criteria.weight}</span>
            </div>
          ))}
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold rounded-md shadow transition-colors duration-150"
          >
            Apply Weights
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeightAdjustmentModal;
