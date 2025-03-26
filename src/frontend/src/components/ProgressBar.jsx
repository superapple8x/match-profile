import React from 'react';

const ProgressBar = () => {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-full max-w-md bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-primary-500 dark:bg-primary-600 h-2.5 rounded-full animate-progress-indeterminate"
          style={{ width: '100%' }} // Style ensures the inner div fills for animation
        ></div>
      </div>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Searching...</p>
    </div>
  );
};

export default ProgressBar;