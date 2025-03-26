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
    // Modal Overlay - Added backdrop blur
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-[1000] transition-opacity duration-300 ease-out" // Matched ResultsDashboard modal overlay
      onClick={onClose} // Close modal on overlay click
    >
      {/* Modal Content - Applied glass effect */}
      <div
        className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg p-6 rounded-xl shadow-2xl w-11/12 max-w-lg max-h-[80vh] overflow-y-auto transition-all duration-300 ease-out" // Matched ResultsDashboard modal content
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside content
      >
        <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Adjust Attribute Weights</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Drag sliders to adjust the importance of each attribute in the search.</p>

        {/* Sliders */}
        <div className="space-y-5"> {/* Increased spacing */}
          {selectedCriteria.map((criteria, index) => (
            <div key={index} className="flex items-center space-x-4"> {/* Increased spacing */}
              <label className="w-32 shrink-0 font-medium text-gray-700 dark:text-gray-200 truncate" title={criteria.attribute}> {/* Increased width */}
                {criteria.attribute}
              </label>
              {/* Refined slider style */}
              <input
                type="range"
                min="1"
                max="10"
                value={criteria.weight}
                onChange={(e) => onWeightChange(criteria.attribute, parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-primary-500 dark:accent-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-150"
              />
              <span className="w-8 text-center font-semibold text-gray-700 dark:text-gray-200">{criteria.weight}</span>
            </div>
          ))}
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end mt-8"> {/* Increased margin */}
          <button
            onClick={onClose}
            // Applied standard primary button style
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 dark:bg-primary-700 dark:hover:bg-primary-800 text-white font-semibold rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Apply Weights
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeightAdjustmentModal;
