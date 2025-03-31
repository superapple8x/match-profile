import React from 'react';

// Define basic types for props
type DatasetAttribute = {
  originalName: string;
};

type ResultData = {
  matchPercentage?: number;
  profileData: Record<string, any>;
};

interface ResultsTableProps {
  results?: ResultData[];
  datasetAttributes: DatasetAttribute[]; // Still needed for the details window
  onMatchClick?: (data: ResultData) => void;
}

// Updated ResultsTable to match HTML example styling
function ResultsTable({ results = [], datasetAttributes = [], onMatchClick }: ResultsTableProps) {

  if (!results || results.length === 0) {
    // Use a more subtle message, styling inherited from main-content-cell
    return <div style={{ textAlign: 'center', padding: '20px', color: '#666666', fontStyle: 'italic' }}>No results to display.</div>;
  }

  // Headers remain the same
  const headers = ['Match %', 'Profile ID', 'Actions'];

  const handleDetailsClick = (e: React.MouseEvent, result: ResultData) => {
    e.stopPropagation(); // Prevent row click handler if button is clicked
    if (onMatchClick) {
      onMatchClick(result);
    }
  };

  return (
    // Apply results-table class, remove inline styles
    <table className="results-table">
      <thead>
        <tr>
          {headers.map(header => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.map((result, index) => {
          const key = result.profileData?.original_row_index ?? `row-${index}`;
          const matchPercent = typeof result.matchPercentage === 'number'
            ? `${result.matchPercentage.toFixed(1)}%`
            : '-';
          // Attempt to find a common ID field, fallback to index
          const profileId = result.profileData?.id ?? result.profileData?.profile_id ?? result.profileData?.original_row_index ?? '-';

          return (
            <tr key={key}>
              {/* Match Percentage */}
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{matchPercent}</td>
              {/* Profile ID */}
              <td style={{ textAlign: 'center' }}>{profileId}</td>
              {/* Actions Column */}
              <td style={{ textAlign: 'center' }}>
                {onMatchClick && (
                  <button
                    onClick={(e) => handleDetailsClick(e, result)}
                    // Apply button classes from CSS
                    className="button button-cyan details-button"
                  >
                    Details
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default ResultsTable;
