import React from 'react';
import PropTypes from 'prop-types'; // Import PropTypes

// Accept datasetAttributes, remove fullData
const MatchBreakdown = ({ match, datasetAttributes }) => {
  // --- Debugging Logs ---
  // console.log("--- MatchBreakdown Debug ---");
  // console.log("Received match object:", JSON.stringify(match, null, 2));
  // console.log("Received datasetAttributes:", datasetAttributes);
  // --- End Debugging Logs ---

  // Profile data is now directly in match.profileData (with sanitized keys)
  const profileData = match?.profileData;

  // Ensure matchPercentage is a number, default to 0 if not
  const matchPercentage = typeof match?.matchPercentage === 'number' ? match.matchPercentage : 0;

  // Use the database ID for display
  const displayId = profileData?.id ?? 'N/A';

  // Handle case where profileData is missing
  if (!profileData) {
      console.error("MatchBreakdown: profileData is missing in the match object:", match);
      return (
          <div className="text-center text-red-600 dark:text-red-400 p-6 bg-red-50 dark:bg-red-900/30 rounded-lg">
              Error: Profile data is missing for this match.
              <pre className="mt-2 text-xs text-left bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto text-gray-700 dark:text-gray-300">
                {JSON.stringify(match, null, 2)}
              </pre>
          </div>
      );
  }

  return (
    // Adjusted container to match modal content style from ResultsDashboard
    <div className="text-gray-800 dark:text-gray-100"> {/* Removed padding/bg/shadow - handled by modal container */}
      {/* Card Header */}
      <div className="mb-6 text-center border-b border-gray-300/70 dark:border-gray-600/50 pb-4"> {/* Adjusted border, padding */}
         <h3 className="text-xl font-bold text-gray-900 dark:text-white">
           Profile Details
         </h3>
         {/* Display Database ID */}
         <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Database ID: {displayId}</p> {/* Changed label */}
         <div className="mt-2 text-lg font-bold text-primary-600 dark:text-primary-400">
           ({matchPercentage.toFixed(1)}% Match)
         </div>
      </div>

      {/* Profile Attributes Section - Iterate through datasetAttributes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5 text-sm">
        {datasetAttributes && datasetAttributes.map((attr) => {
            // Get value using sanitizedName from profileData
            const profileValue = String(profileData[attr.sanitizedName] ?? 'N/A');
            // Skip displaying the internal DB 'id' if desired, or display it differently
            if (attr.sanitizedName === 'id') {
                return null; // Or render differently if needed
            }

            return (
              // Attribute Item (Label + Value)
              <div key={attr.originalName} className="py-1.5 border-b border-gray-200/80 dark:border-gray-700/60">
                {/* Label (Use originalName) */}
                <dt className="text-gray-500 dark:text-gray-400 font-medium truncate mb-0.5" title={attr.originalName}>{attr.originalName}:</dt>
                {/* Value */}
                <dd className="text-gray-800 dark:text-gray-100 font-semibold break-words">{profileValue}</dd>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// Add PropTypes
MatchBreakdown.propTypes = {
  match: PropTypes.shape({
    matchPercentage: PropTypes.number,
    profileData: PropTypes.object.isRequired, // Expect profileData object
  }).isRequired,
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
    originalName: PropTypes.string.isRequired,
    sanitizedName: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  })).isRequired,
};

export default MatchBreakdown;
