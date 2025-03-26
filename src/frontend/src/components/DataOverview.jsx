import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ChartBarIcon } from '@heroicons/react/24/outline'; // Use outline for subtle icon
import DatasetInsightsChart from './DatasetInsightsChart';

// Define tab constants
const TABS = {
  CATEGORICAL: 'categorical',
  NUMERICAL: 'numerical',
  MISSING: 'missing',
};

function DataOverview({ importedData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS.CATEGORICAL);

  if (!importedData || importedData.length === 0) {
    return null;
  }
  const recordCount = importedData.length; // Get record count

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
    // setActiveTab(TABS.CATEGORICAL); // Reset to default if desired
  };

  const renderTabButton = (tabKey, label) => (
    <button
      key={tabKey}
      onClick={() => setActiveTab(tabKey)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
        activeTab === tabKey
          ? 'bg-primary-500 text-white shadow-sm'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-md rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header Button - Enhanced */}
      <button
        onClick={toggleExpansion}
        className="w-full flex justify-between items-center text-left p-4 focus:outline-none group hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors duration-150 ease-in-out" // Added group, hover effect
        aria-expanded={isExpanded}
        aria-controls="dataset-insights-content"
      >
        {/* Left side: Icon, Title, Record Count */}
        <div className="flex items-center space-x-3">
           <ChartBarIcon className="h-6 w-6 text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-150 ease-in-out" /> {/* Added Icon */}
           <span className="text-lg font-semibold text-gray-800 dark:text-white">
             Dataset Overview & Insights
           </span>
           <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
             {recordCount} Records {/* Display Record Count */}
           </span>
        </div>

        {/* Right side: Chevron */}
        {isExpanded ? (
          <ChevronUpIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        )}
      </button>

      {/* Expandable Content Area */}
      <div
        id="dataset-insights-content"
        className={`transition-all duration-500 ease-in-out ${
          isExpanded ? 'max-h-[650px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {/* Tab Buttons */}
        {isExpanded && (
          <div className="px-4 pt-2 pb-3 border-t border-b border-gray-200 dark:border-gray-600 flex space-x-2"> {/* Added border-t */}
            {renderTabButton(TABS.CATEGORICAL, 'Categorical Charts')}
            {renderTabButton(TABS.NUMERICAL, 'Numerical Analysis')}
            {renderTabButton(TABS.MISSING, 'Missing Values')}
          </div>
        )}

        {/* Scrollable Content Area */}
        <div
          className={`transition-opacity duration-300 ease-in-out ${
            isExpanded ? 'opacity-100 overflow-y-auto max-h-[550px]' : 'opacity-0 overflow-hidden max-h-0'
          }`}
           style={{ scrollbarWidth: 'thin' }}
        >
          {isExpanded && (
            <DatasetInsightsChart data={importedData} activeTab={activeTab} />
          )}
        </div>
      </div>
    </div>
  );
}

export default DataOverview;