import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import DataOverviewWindow from './DataOverviewWindow'; // Import the new window component

// Updated DataOverview component for new retro theme
function DataOverview({ datasetId, datasetName, datasetAttributes, authToken, handleLogout }) {
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOverviewWindowOpen, setIsOverviewWindowOpen] = useState(false); // State for window visibility

  // Fetch statistics when datasetId changes
  useEffect(() => {
    const fetchStats = async () => {
      if (!datasetId) {
        setStatsData(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setStatsData(null);
      console.log(`[DataOverview] Fetching stats for dataset ID: ${datasetId}. Auth token present: ${!!authToken}`);

      const fetchOptions = {
          method: 'GET',
          headers: {},
      };
      if (authToken) {
          fetchOptions.headers['Authorization'] = `Bearer ${authToken}`;
      }

      try {
        const response = await fetch(`/api/datasets/${datasetId}/stats`, fetchOptions);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (!authToken && (response.status === 401 || response.status === 403)) {
              setError('Statistics are not available for anonymous users.');
              console.warn('[DataOverview] Stats fetch failed (expectedly?) without auth token:', response.status);
          } else {
              throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
          }
          setStatsData(null);
        } else {
            const data = await response.json();
            setStatsData(data);
            console.log('[DataOverview] Stats received:', data);
        }

      } catch (e) {
        console.error("Failed to fetch dataset statistics:", e);
        setError(`Failed to load statistics: ${e.message}`);
        if (authToken && (e.message.includes('401') || e.message.includes('403'))) {
            console.warn('[DataOverview] Auth error with token detected, logging out.');
            if (handleLogout) handleLogout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Reset window state if dataset changes
    setIsOverviewWindowOpen(false);
    fetchStats();
  }, [datasetId, authToken, handleLogout]);

  // Handlers for window
  const openOverviewWindow = () => {
      if (statsData || error) { // Only open if data is loaded or there's an error to show
          setIsOverviewWindowOpen(true);
      } else if (!isLoading) {
          // Optionally trigger fetch again if button clicked and no data/error yet
          // fetchStats(); // Consider if this is desired behavior
      }
  };
  const closeOverviewWindow = () => setIsOverviewWindowOpen(false);


  // Render based on datasetId presence
  if (!datasetId) {
    return null; // Don't render anything if no dataset is loaded
  }

  // Determine button state/text
  let buttonText = "Show Dataset Overview";
  let buttonDisabled = false;
  if (isLoading) {
      buttonText = "Loading Stats...";
      buttonDisabled = true;
  } else if (error && !statsData) {
      // Allow opening window even if there's an error, to show the error message
      buttonText = "Show Overview (Error)";
  } else if (!statsData) {
      // Could happen if fetch completed but returned no data (e.g., empty dataset)
      buttonText = "Overview Unavailable";
      buttonDisabled = true;
  }


  return (
    // Use a wrapper div styled like the example's top section
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', backgroundColor: '#D0D0D0', padding: '10px', border: '2px solid #0000FF', position: 'relative' }}>
      {/* Dataset Name - styled inline for simplicity */}
      <span style={{ fontWeight: 'bold', color: '#000080' }}>
        DATASET: <span style={{ color: '#FF0000' }}>{datasetName || 'Unnamed Dataset'}</span>
      </span>

      {/* Button to open the overview window */}
      <button
        onClick={openOverviewWindow}
        disabled={buttonDisabled}
        className="button button-blue" // Apply blue button style
      >
        {buttonText}
      </button>

      {/* Conditionally render the DataOverviewWindow */}
      {isOverviewWindowOpen && (statsData || error) && ( // Ensure data or error exists before rendering window
        <DataOverviewWindow
          datasetName={datasetName}
          statsData={statsData} // Pass the fetched stats data
          datasetAttributes={datasetAttributes}
          onClose={closeOverviewWindow}
        />
      )}
    </div>
  );
}

// Updated PropTypes to reflect changes
DataOverview.propTypes = {
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  datasetName: PropTypes.string,
  authToken: PropTypes.string,
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
      originalName: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
  })),
  handleLogout: PropTypes.func,
};

DataOverview.defaultProps = {
  datasetId: null,
  datasetName: '',
  datasetAttributes: [],
  authToken: null,
  handleLogout: () => {},
};

export default DataOverview;
