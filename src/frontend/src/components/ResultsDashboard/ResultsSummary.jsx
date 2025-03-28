import React from 'react';
// Removed: import './ResultsSummary.css';

const ResultsSummary = ({ totalMatches, averageMatchPercentage, highestMatch }) => {
  return (
    // Container for the summary section - Apply glass effect
    <div className="mb-6 p-5 bg-white/70 dark:bg-gray-700/60 backdrop-blur-md border border-gray-200/80 dark:border-gray-600/50 rounded-xl shadow-lg transition-all duration-300 ease-in-out"> {/* Matched parent/sibling styles */}
      <h3 className="text-lg font-semibold mb-4 text-center text-gray-800 dark:text-gray-100">Summary</h3> {/* Adjusted text color, margin */}
      {/* Grid container for summary items */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-300/50 dark:divide-gray-600/40"> {/* Use grid and dividers */}
        {/* Individual Summary Item */}
        <div className="text-center p-3 sm:p-2"> {/* Added padding */}
          <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1"> {/* Increased text size */}
            {totalMatches}
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400"> {/* Adjusted text color/weight */}
            Matches
          </div>
        </div>
        {/* Individual Summary Item */}
        <div className="text-center p-3 sm:p-2"> {/* Added padding */}
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1"> {/* Increased text size */}
            {/* Ensure value exists before calling toFixed */}
            {averageMatchPercentage !== null && averageMatchPercentage !== undefined ? averageMatchPercentage.toFixed(1) : '0.0'}%
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400"> {/* Adjusted text color/weight */}
            Avg Match
          </div>
        </div>
        {/* Individual Summary Item */}
        <div className="text-center p-3 sm:p-2"> {/* Added padding */}
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1"> {/* Increased text size */}
            {/* Ensure value exists before calling toFixed */}
            {highestMatch !== null && highestMatch !== undefined ? highestMatch.toFixed(1) : '0.0'}%
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400"> {/* Adjusted text color/weight */}
            Best Match
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsSummary;
