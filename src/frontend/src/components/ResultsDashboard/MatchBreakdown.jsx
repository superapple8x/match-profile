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
          <div className="text-center text-red-500 p-4">
              Error: Could not find full profile details in original data for ID: {matchIdString ?? 'undefined'}.
              <pre className="mt-2 text-xs text-left bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto">
                {JSON.stringify(match, null, 2)}
              </pre>
          </div>
      );
  }

  return (
    <div className="text-gray-800 dark:text-gray-100 p-1">
      {/* Card Header */}
      <div className="mb-5 text-center border-b border-gray-300 dark:border-gray-600 pb-3">
         <h3 className="text-xl font-bold text-gray-900 dark:text-white">
           Profile Details
         </h3>
         {/* Display original UserID if available */}
         <p className="text-sm text-gray-500 dark:text-gray-400">Original UserID: {displayId}</p>
         <div className="mt-2 text-lg font-bold text-blue-600 dark:text-blue-400">
           ({matchPercentage.toFixed(1)}% Match)
         </div>
      </div>

      {/* Profile Attributes Section - "ID Card" Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        {attributeKeys.map((key) => {
            // Use the value from the found fullProfile
            const profileValue = String(profileDataToDisplay[key] ?? 'N/A');

            return (
              // Attribute Item (Label + Value)
              <div key={key} className="py-1 border-b border-gray-200 dark:border-gray-700">
                {/* Label */}
                <dt className="text-gray-500 dark:text-gray-400 font-medium truncate" title={key}>{key}:</dt>
                {/* Value */}
                <dd className="text-gray-700 dark:text-gray-200 font-semibold break-words">{profileValue}</dd>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default MatchBreakdown;
