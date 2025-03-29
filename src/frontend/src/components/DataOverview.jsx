import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDownIcon, ChevronUpIcon, TableCellsIcon } from '@heroicons/react/24/outline'; // Changed icon

// Removed DatasetInsightsChart import as it's no longer used here
// import DatasetInsightsChart from './DatasetInsightsChart';

// Removed TABS constants

// Accept new props: datasetId, datasetName, datasetAttributes
function DataOverview({ datasetId, datasetName, datasetAttributes }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Removed activeTab state

  // Render based on datasetId presence
  if (!datasetId) {
    return null;
  }
  // Removed recordCount calculation

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  // Removed renderTabButton function

  return (
    <div className="mb-6 bg-indigo-100/60 dark:bg-gray-800/70 backdrop-blur-sm shadow-md rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"> {/* Light: indigo-100 tint */}
      {/* Header Button - Enhanced */}
      <button
        onClick={toggleExpansion}
        className="w-full flex justify-between items-center text-left p-4 focus:outline-none group hover:bg-indigo-100/50 dark:hover:bg-gray-700/50 transition-colors duration-150 ease-in-out" // Light hover: indigo-100
        aria-expanded={isExpanded}
        aria-controls="dataset-insights-content"
      >
        {/* Left side: Icon, Title (using datasetName) */}
        <div className="flex items-center space-x-3">
           <TableCellsIcon className="h-6 w-6 text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-150 ease-in-out" /> {/* Changed Icon */}
           <span className="text-lg font-semibold text-gray-800 dark:text-white truncate" title={datasetName}>
             Dataset: {datasetName || 'Unnamed Dataset'} {/* Display datasetName */}
           </span>
           {/* Removed Record Count */}
        </div>

        {/* Right side: Chevron (Expand/Collapse Attributes List) */}
        {isExpanded ? (
          <ChevronUpIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        )}
      </button>

      {/* Expandable Content Area - Now shows attribute list */}
      <div
        id="dataset-attributes-content" // Changed ID
        className={`transition-all duration-500 ease-in-out ${
          isExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0' // Adjusted max-h
        }`}
      >
        {/* Removed Tab Buttons */}

        {/* Scrollable Content Area for Attributes */}
        <div
          className={`transition-opacity duration-300 ease-in-out p-4 border-t border-gray-200 dark:border-gray-600 ${ // Added padding and border
            isExpanded ? 'opacity-100 overflow-y-auto max-h-[280px]' : 'opacity-0 overflow-hidden max-h-0' // Adjusted max-h
          }`}
           style={{ scrollbarWidth: 'thin' }}
        >
          {isExpanded && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Attributes ({datasetAttributes.length}):</h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {datasetAttributes.map((attr, index) => (
                  <li key={index} className="truncate" title={attr.originalName}>
                    {attr.originalName} <span className="text-gray-400 dark:text-gray-500">({attr.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Removed DatasetInsightsChart */}
        </div>
      </div>
    </div>
  );
}

// Update PropTypes
DataOverview.propTypes = {
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Can be string or number from DB ID
  datasetName: PropTypes.string,
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
      originalName: PropTypes.string.isRequired,
      sanitizedName: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
  })),
};

DataOverview.defaultProps = {
  datasetId: null,
  datasetName: '',
  datasetAttributes: [],
};

export default DataOverview;
