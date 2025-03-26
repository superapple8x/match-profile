import React from 'react';
// Removed: import './ResultsSummary.css';

const ResultsSummary = ({ totalMatches, averageMatchPercentage, highestMatch }) => {
  return (
    // Container for the summary section
    <div className="mb-5 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-150">
      <h3 className="text-lg font-semibold mb-3 text-center text-gray-700 dark:text-gray-200">Summary</h3>
      {/* Flex container for summary items */}
      <div className="flex justify-around items-start">
        {/* Individual Summary Item */}
        <div className="text-center mx-2">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
            {totalMatches}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Matches
          </div>
        </div>
        {/* Individual Summary Item */}
        <div className="text-center mx-2">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
            {/* Ensure value exists before calling toFixed */}
            {averageMatchPercentage !== null && averageMatchPercentage !== undefined ? averageMatchPercentage.toFixed(1) : '0.0'}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Avg Match
          </div>
        </div>
        {/* Individual Summary Item */}
        <div className="text-center mx-2">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
            {/* Ensure value exists before calling toFixed */}
            {highestMatch !== null && highestMatch !== undefined ? highestMatch.toFixed(1) : '0.0'}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Best Match
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsSummary;
