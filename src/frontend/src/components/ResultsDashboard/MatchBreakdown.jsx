import React from 'react';

// Accept fullData prop which contains the original imported dataset
const MatchBreakdown = ({ match, fullData }) => {
  // --- Debugging Logs ---
  // console.log("--- MatchBreakdown Debug ---");
  // console.log("Received match object:", JSON.stringify(match, null, 2));
  // console.log("Received fullData (first 2 items):", fullData?.slice(0, 2));
  // --- End Debugging Logs ---

  // Get the ID string (e.g., "profile-0") from the match object
  const matchIdString = match?.profileId; // Use profileId as identified before
  // console.log("Extracted matchIdString:", matchIdString);

  // Find the full profile data using the index derived from matchIdString
  const fullProfile = React.useMemo(() => {
    if (!fullData || !matchIdString || !matchIdString.includes('-')) {
      console.log("Cannot find profile: fullData or valid matchIdString missing.");
      return null;
    }

    const indexStr = matchIdString.split('-')[1];
    const index = parseInt(indexStr, 10);
    // console.log("Parsed index from matchIdString:", index);

    if (isNaN(index) || index < 0 || index >= fullData.length) {
      console.error(`Invalid index ${index} derived from matchIdString '${matchIdString}' or out of bounds for fullData (length ${fullData.length}).`);
      return null;
    }

    // Return the profile from the original data at the calculated index
    // console.log("Found profile at index:", index, fullData[index]);
    return fullData[index];

  }, [fullData, matchIdString]);


  // Use the found full profile for display
  const profileDataToDisplay = fullProfile;

  // Ensure matchPercentage is a number, default to 0 if not
  const matchPercentage = typeof match.matchPercentage === 'number' ? match.matchPercentage : 0;
  // Extract original ID for display if available in the found profile
  const displayId = profileDataToDisplay?.UserID ?? profileDataToDisplay?.id ?? matchIdString ?? 'N/A'; // Use UserID if present

  // Filter out keys we don't want to display (adjust if needed based on fullProfile structure)
  const attributeKeys = profileDataToDisplay
    ? Object.keys(profileDataToDisplay).filter(key => key !== 'uniqueKey') // Keep all original keys except internal ones
    : [];

  // Handle case where profile wasn't found by index
  if (!fullProfile) {
      console.error("Could not find matching profile in fullData using index derived from ID:", matchIdString);
      return (
          // Keep error styling simple
          <div className="text-center text-red-600 dark:text-red-400 p-6 bg-red-50 dark:bg-red-900/30 rounded-lg">
              Error: Could not find full profile details in original data for ID: {matchIdString ?? 'undefined'}.
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
         {/* Display original UserID if available */}
         <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Original UserID: {displayId}</p> {/* Added margin */}
         <div className="mt-2 text-lg font-bold text-primary-600 dark:text-primary-400"> {/* Use primary theme */}
           ({matchPercentage.toFixed(1)}% Match)
         </div>
      </div>

      {/* Profile Attributes Section - Refined Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5 text-sm"> {/* Increased gap-y */}
        {attributeKeys.map((key) => {
            // Use the value from the found fullProfile
            const profileValue = String(profileDataToDisplay[key] ?? 'N/A');

            return (
              // Attribute Item (Label + Value)
              <div key={key} className="py-1.5 border-b border-gray-200/80 dark:border-gray-700/60"> {/* Adjusted border, padding */}
                {/* Label */}
                <dt className="text-gray-500 dark:text-gray-400 font-medium truncate mb-0.5" title={key}>{key}:</dt> {/* Added margin */}
                {/* Value */}
                <dd className="text-gray-800 dark:text-gray-100 font-semibold break-words">{profileValue}</dd> {/* Adjusted text color */}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default MatchBreakdown;
