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

// Updated ResultsTable to show only essential columns + Details button
function ResultsTable({ results = [], datasetAttributes = [], onMatchClick }: ResultsTableProps) {

  if (!results || results.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px', color: '#CCCCCC' }}>No results to display in table.</div>;
  }

  // Headers now only include essential info + Actions
  const headers = ['Match %', 'Profile ID', 'Actions'];

  const handleDetailsClick = (e: React.MouseEvent, result: ResultData) => {
    e.stopPropagation(); // Prevent row click handler if button is clicked
    if (onMatchClick) {
      onMatchClick(result);
    }
  };

  return (
    <table border={1} cellPadding={5} cellSpacing={0} style={{ width: 'auto', margin: '0 auto' /* Center table */ }} className="results-table-retro">
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
          const profileId = result.profileData?.original_row_index ?? '-';

          // No longer need row click handler here, button handles it
          return (
            <tr
              key={key}
              // Removed onClick, onMouseEnter, onMouseLeave from row
            >
              {/* Match Percentage */}
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{matchPercent}</td>
              {/* Profile ID */}
              <td style={{ textAlign: 'center' }}>{profileId}</td>
              {/* Actions Column */}
              <td style={{ textAlign: 'center' }}>
                {onMatchClick && (
                  <button
                    onClick={(e) => handleDetailsClick(e, result)}
                    className="button" // Use standard button style
                    style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#FFFF00', borderColor: '#AAAA00' }} // Yellow button
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
