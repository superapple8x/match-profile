import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  ChevronDownIcon, ChevronUpIcon, TableCellsIcon, ChartBarIcon, InformationCircleIcon, ExclamationTriangleIcon,
  DocumentTextIcon, // For string/text
  HashtagIcon,      // For numerical
  CalendarDaysIcon, // For date (if applicable)
  QuestionMarkCircleIcon, // Default/unknown
  ArrowPathIcon // For loading spinner
} from '@heroicons/react/24/outline';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const TABS = {
  ATTRIBUTES: 'Attributes', // Added Attributes tab
  CATEGORICAL: 'Categorical',
  NUMERICAL: 'Numerical',
  MISSING: 'Missing Values',
};

// Accept new props: datasetId, datasetName, datasetAttributes, authToken, darkMode, handleLogout
function DataOverview({ datasetId, datasetName, datasetAttributes, authToken, darkMode, handleLogout }) { // Added darkMode and handleLogout
  const [isExpanded, setIsExpanded] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // For content area loading message
  const [isHeaderLoading, setIsHeaderLoading] = useState(false); // For header loading indicator
  const [error, setError] = useState(null);
  // Default to Attributes tab if available, otherwise Categorical
  const [activeTab, setActiveTab] = useState(
    (datasetAttributes && datasetAttributes.length > 0) ? TABS.ATTRIBUTES : TABS.CATEGORICAL
  );

  // Render based on datasetId presence
  if (!datasetId) {
    return null;
  }

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  // Fetch statistics when datasetId changes (authToken presence determines header)
  useEffect(() => {
    const fetchStats = async () => {
      // Only proceed if datasetId is present
      if (!datasetId) {
        setStatsData(null);
        setError(null);
        setIsLoading(false);
        setIsHeaderLoading(false); // Ensure header loading stops if no datasetId
        return;
      }

      setIsLoading(true); // Keep this for the content area message
      setIsHeaderLoading(true); // Start header loading indicator
      setError(null);
      setStatsData(null);
      console.log(`[DataOverview] Fetching stats for dataset ID: ${datasetId}. Auth token present: ${!!authToken}`);

      // Prepare fetch options, conditionally adding Authorization header
      const fetchOptions = {
          method: 'GET', // Explicitly GET
          headers: {},
      };
      if (authToken) {
          fetchOptions.headers['Authorization'] = `Bearer ${authToken}`;
      }

      try {
        const response = await fetch(`/api/datasets/${datasetId}/stats`, fetchOptions);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // If no auth token was sent, a 401/403 might be expected, treat differently
          if (!authToken && (response.status === 401 || response.status === 403)) {
              setError('Statistics are not available for anonymous users.'); // Specific message for anonymous
              console.warn('[DataOverview] Stats fetch failed (expectedly?) without auth token:', response.status);
          } else {
              // Throw error for other failures or if auth token *was* sent and failed
              throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
          }
          // Don't proceed to set data if response was not ok
          setStatsData(null);
        } else {
            // Only process data if response is ok
            const data = await response.json();
            setStatsData(data);
            console.log('[DataOverview] Stats received:', data);
            // Set initial tab based on fetched data availability
            const hasAttributes = datasetAttributes && datasetAttributes.length > 0;
            const hasCategorical = data?.categoricalStats && Object.keys(data.categoricalStats).length > 0;
            const hasNumerical = data?.numericStats && Object.keys(data.numericStats).length > 0;
            if (hasAttributes) {
                setActiveTab(TABS.ATTRIBUTES);
            } else if (hasCategorical) {
                setActiveTab(TABS.CATEGORICAL);
            } else if (hasNumerical) {
                setActiveTab(TABS.NUMERICAL);
            } else {
                setActiveTab(TABS.MISSING); // Fallback
            }
        }

      } catch (e) {
        console.error("Failed to fetch dataset statistics:", e);
        setError(`Failed to load statistics: ${e.message}`);
        // Check for auth error ONLY if a token was provided, then trigger logout
        if (authToken && (e.message.includes('401') || e.message.includes('403'))) {
            console.warn('[DataOverview] Auth error with token detected, logging out.');
            if (handleLogout) handleLogout();
        }
      } finally {
        setIsLoading(false); // Stop content area loading message
        setIsHeaderLoading(false); // Stop header loading indicator
      }
    };

    fetchStats();
  }, [datasetId, authToken, datasetAttributes, handleLogout]); // Dependencies remain the same

  // --- Chart Data Preparation ---

  const getCategoricalChartData = (attributeName) => {
    const catData = statsData?.categoricalStats?.[attributeName];
    if (!catData || catData.length === 0) return null;

    return {
      labels: catData.map(item => String(item.value).substring(0, 20)), // Truncate long labels
      datasets: [
        {
          label: 'Count',
          data: catData.map(item => item.count),
          backgroundColor: 'rgba(75, 192, 192, 0.6)', // Teal color
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  const getMissingValuesChartData = () => {
    if (!statsData || !statsData.columnDetails || statsData.totalRows === 0) return null;

    const labels = Object.keys(statsData.columnDetails);
    const missingCounts = labels.map(key => statsData.columnDetails[key]?.nullCount ?? 0);
    const missingPercentages = labels.map(key => {
        const nullCount = statsData.columnDetails[key]?.nullCount ?? 0;
        return ((nullCount / statsData.totalRows) * 100);
    });


    return {
      labels: labels,
      datasets: [
        {
          label: '% Missing',
          data: missingPercentages,
          backgroundColor: 'rgba(255, 99, 132, 0.6)', // Red color
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  // --- New function for Numerical Histogram Data ---
  const getNumericalChartData = (attributeName) => {
    const numStats = statsData?.numericStats?.[attributeName];
    const histogramData = numStats?.histogram;

    if (!histogramData || histogramData.length === 0) return null;

    // Format labels based on bounds
    const labels = histogramData.map(bucket => {
       if (bucket.lower_bound === bucket.upper_bound) {
           return `${bucket.lower_bound.toFixed(1)}`; // Single value bucket
       }
       return `${bucket.lower_bound.toFixed(1)} - ${bucket.upper_bound.toFixed(1)}`;
    });

    return {
      labels: labels,
      datasets: [
        {
          label: 'Count',
          data: histogramData.map(bucket => bucket.count),
          backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue color
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          barPercentage: 1.0, // Make bars touch for histogram feel
          categoryPercentage: 1.0, // Make bars touch
        },
      ],
    };
  };
  // --- End Numerical Histogram Data ---


  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow chart height to be controlled by container
    plugins: {
      legend: {
        position: 'top',
        labels: {
            color: darkMode ? '#e5e7eb' : '#374151', // Adjust legend color for dark mode
            font: { size: 12 } // Slightly larger legend font
        }
      },
      title: {
        display: false, // We'll use custom titles above charts
      },
      tooltip: {
        callbacks: {
            label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    // Format percentage for missing chart, otherwise just the value
                    if (context.dataset.label === '% Missing') {
                         label += context.parsed.y.toFixed(1) + '%';
                    } else {
                         label += context.parsed.y;
                    }
                }
                return label;
            }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
            color: darkMode ? '#9ca3af' : '#6b7280', // Adjust tick color
            font: { size: 11 } // Slightly larger tick font
        },
        grid: {
            color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', // Adjust grid line color
        }
      },
      x: {
         ticks: {
            color: darkMode ? '#9ca3af' : '#6b7280', // Adjust tick color
            font: { size: 11 } // Slightly larger tick font
         },
         grid: {
            display: false, // Hide vertical grid lines for cleaner look
         }
      }
    },
  };

  const missingChartOptions = { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }; // Set max Y to 100 for percentage


   // --- Helper to get type icon ---
   const getTypeIcon = (type) => {
       const lowerType = type?.toLowerCase() || '';
       if (lowerType.includes('string') || lowerType.includes('text') || lowerType.includes('varchar')) {
           return <DocumentTextIcon className="h-4 w-4 mr-1.5 text-gray-400 dark:text-gray-500 inline-block align-middle" aria-hidden="true" />;
       } else if (lowerType.includes('int') || lowerType.includes('num') || lowerType.includes('float') || lowerType.includes('double') || lowerType.includes('decimal')) {
           return <HashtagIcon className="h-4 w-4 mr-1.5 text-blue-400 dark:text-blue-500 inline-block align-middle" aria-hidden="true" />;
       } else if (lowerType.includes('date') || lowerType.includes('time')) {
           return <CalendarDaysIcon className="h-4 w-4 mr-1.5 text-purple-400 dark:text-purple-500 inline-block align-middle" aria-hidden="true" />;
       } else {
           return <QuestionMarkCircleIcon className="h-4 w-4 mr-1.5 text-gray-400 dark:text-gray-500 inline-block align-middle" aria-hidden="true" />;
       }
   };

   // --- Tab Rendering ---

   const renderTabContent = () => {
    // Use slightly larger text for loading/error/no data messages
    if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse p-6">Loading statistics...</p>;
    if (error) return <p className="text-sm text-red-600 dark:text-red-400 p-6">{error}</p>;
    if (!statsData) return <p className="text-sm text-gray-500 dark:text-gray-400 p-6">No statistics available.</p>;

    switch (activeTab) {
      case TABS.ATTRIBUTES:
        if (!datasetAttributes || datasetAttributes.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400 p-6">No attribute information available.</p>;
        return (
            <div className="p-6"> {/* Outer padding */}
                {/* Increased padding from p-4 to p-5 */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-5 bg-white dark:bg-gray-700/50 shadow-sm">
                    <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Attributes ({datasetAttributes.length}):</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {datasetAttributes.map((attr, index) => {
                        // Calculate missing percentage if statsData is available
                        const details = statsData?.columnDetails?.[attr.originalName];
                        const totalRows = statsData?.totalRows;
                        let missingPercentText = '';
                        if (details && totalRows > 0) {
                            const missingPercent = ((details.nullCount ?? 0) / totalRows * 100);
                            missingPercentText = `(${missingPercent.toFixed(1)}% missing)`;
                        } else if (statsData && !details) {
                            // Handle case where column might not be in stats (e.g., added later)
                            missingPercentText = '(stats N/A)';
                        }

                        return (
                            <li key={index} className="truncate flex items-center justify-between" title={`${attr.originalName} (${attr.type})`}> {/* Added justify-between */}
                                <div className="flex items-center overflow-hidden"> {/* Wrap icon and name */}
                                    {getTypeIcon(attr.type)} {/* Call helper function */}
                                    <span className="flex-1 truncate mr-2">{attr.originalName}</span> {/* Allow name to truncate */}
                                </div>
                                {/* Display missing percentage */}
                                {missingPercentText && <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{missingPercentText}</span>}
                            </li>
                        );
                    })}
                    </ul>
                </div>
            </div>
        );
      case TABS.CATEGORICAL:
        const categoricalAttributes = Object.keys(statsData.categoricalStats || {});
        if (categoricalAttributes.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400 p-6">No categorical attributes found or no frequent values to display.</p>;
        return (
          <div className="space-y-6 p-6"> {/* Outer padding and spacing */}
            {categoricalAttributes.map(attr => {
              const chartData = getCategoricalChartData(attr);
              if (!chartData) return null;
              return (
                // Increased padding from p-4 to p-5
                <div key={attr} className="border border-gray-200 dark:border-gray-600 rounded-lg p-5 bg-white dark:bg-gray-700/50 shadow-sm">
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{attr} (Top 5 Values)</h5> {/* Added mb-2 */}
                  {/* Increased height from h-48 to h-56 */}
                  <div className="h-56">
                     <Bar options={chartOptions} data={chartData} />
                  </div>
                </div>
              );
            })}
          </div>
        );

      case TABS.NUMERICAL:
        const numericAttributes = Object.keys(statsData.numericStats || {});
        if (numericAttributes.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400 p-6">No numeric attributes found.</p>;
        return (
          <div className="space-y-6 p-6"> {/* Outer padding and spacing */}
            {numericAttributes.map(attr => {
              const chartData = getNumericalChartData(attr);
              const numStats = statsData.numericStats[attr];
              const details = statsData.columnDetails[attr];
              const missingPercent = ((details?.nullCount ?? 0) / statsData.totalRows * 100).toFixed(1);

              return (
                // Increased padding from p-4 to p-5
                <div key={attr} className="border border-gray-200 dark:border-gray-600 rounded-lg p-5 bg-white dark:bg-gray-700/50 shadow-sm">
                  { !chartData ? (
                      // Fallback text rendering using definition list
                      <div>
                          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{attr} (Summary)</h5>
                          <dl className="text-xs text-gray-500 dark:text-gray-400 mb-2 space-y-0.5">
                              <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">Avg:</dt> <dd className="text-right">{numStats?.average?.toFixed(2) ?? 'N/A'}</dd> </div>
                              <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">Median:</dt> <dd className="text-right">{numStats?.median?.toFixed(2) ?? 'N/A'}</dd> </div>
                              <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">StdDev:</dt> <dd className="text-right">{numStats?.standardDeviation?.toFixed(2) ?? 'N/A'}</dd> </div>
                              <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">IQR:</dt> <dd className="text-right">{(numStats?.p75 - numStats?.p25)?.toFixed(2) ?? 'N/A'}</dd> </div>
                              <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">Range:</dt> <dd className="text-right">{numStats?.min?.toFixed(2) ?? 'N/A'} - {numStats?.max?.toFixed(2) ?? 'N/A'}</dd> </div>
                              <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">Missing:</dt> <dd className="text-right">{details?.nullCount ?? 'N/A'} ({missingPercent}%)</dd> </div>
                          </dl>
                          <p className="text-xs italic text-gray-500 dark:text-gray-500">Histogram data unavailable.</p>
                      </div>
                    ) : (
                      // Chart rendering
                      <>
                        <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{attr} (Distribution)</h5>
                        {/* Display additional stats using a definition list style */}
                        <dl className="text-xs text-gray-500 dark:text-gray-400 mb-2 space-y-0.5">
                            <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">Avg:</dt> <dd className="text-right">{numStats?.average?.toFixed(2) ?? 'N/A'}</dd> </div>
                            <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">Median:</dt> <dd className="text-right">{numStats?.median?.toFixed(2) ?? 'N/A'}</dd> </div>
                            <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">StdDev:</dt> <dd className="text-right">{numStats?.standardDeviation?.toFixed(2) ?? 'N/A'}</dd> </div>
                            <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">IQR:</dt> <dd className="text-right">{(numStats?.p75 - numStats?.p25)?.toFixed(2) ?? 'N/A'}</dd> </div>
                            <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">Range:</dt> <dd className="text-right">{numStats?.min?.toFixed(2) ?? 'N/A'} - {numStats?.max?.toFixed(2) ?? 'N/A'}</dd> </div>
                            <div className="flex justify-between"> <dt className="font-medium text-gray-600 dark:text-gray-300">Missing:</dt> <dd className="text-right">{details?.nullCount ?? 'N/A'} ({missingPercent}%)</dd> </div>
                        </dl>
                        {/* Removed stray closing p tag */}
                        {/* Increased height from h-48 to h-56 */}
                        <div className="h-56">
                           <Bar options={chartOptions} data={chartData} />
                        </div>
                      </>
                    )
                  }
                </div>
              );
            })}
          </div>
        );

      case TABS.MISSING:
        const missingChartData = getMissingValuesChartData();
        if (!missingChartData) return <p className="text-sm text-gray-500 dark:text-gray-400 p-6">Could not generate missing values data.</p>;
        return (
          <div className="p-6"> {/* Outer padding */}
            {/* Increased padding from p-4 to p-5 */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-5 bg-white dark:bg-gray-700/50 shadow-sm">
                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Percentage of Missing Values per Attribute</h5>
                <div className="h-64">
                   <Bar options={missingChartOptions} data={missingChartData} />
                </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTabButton = (tabName) => {
    const isActive = activeTab === tabName;
    return (
      <button
        key={tabName}
        onClick={() => setActiveTab(tabName)}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary-500 ${
          isActive
            ? 'bg-primary-600 text-white shadow-sm font-semibold' // Added font-semibold
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium' // Lighter inactive text, keep font-medium
        }`}
      >
        {tabName}
      </button>
    );
  };


  return (
    <div className="mb-6 bg-indigo-100/60 dark:bg-gray-800/70 backdrop-blur-sm shadow-md rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header Button */}
      <button
        onClick={toggleExpansion}
        className="w-full flex justify-between items-center text-left p-4 focus:outline-none group hover:bg-indigo-100/50 dark:hover:bg-gray-700/50 transition-colors duration-150 ease-in-out"
        aria-expanded={isExpanded}
        aria-controls="dataset-insights-content"
      >
        <div className="flex items-center space-x-3">
           <TableCellsIcon className="h-6 w-6 text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-150 ease-in-out" />
           <span className="text-xl font-semibold text-gray-800 dark:text-white truncate" title={datasetName}> {/* Increased text-xl */}
             Dataset: {datasetName || 'Unnamed Dataset'}
           </span>
           {/* Loading spinner icon */}
           {isHeaderLoading && <ArrowPathIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 animate-spin ml-2" aria-hidden="true" />}
           {/* Row count capsule (only show if NOT loading and statsData exists) */}
           {!isHeaderLoading && statsData && (
               <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                   {statsData.totalRows?.toLocaleString()} Profiles
               </span>
           )}
        </div>
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
          isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0' // Increased max-h significantly
        }`}
      >
         <div className="border-t border-gray-200 dark:border-gray-600">
             {/* Statistics Tabs and Content */}
                 {/* Tab Buttons */}
                 <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"> {/* Use flex-wrap and gap */}
                    {/* Explicitly render tabs in desired order */}
                    {renderTabButton(TABS.ATTRIBUTES)}
                    {renderTabButton(TABS.CATEGORICAL)}
                    {renderTabButton(TABS.NUMERICAL)}
                    {renderTabButton(TABS.MISSING)}
                 </div>

                 {/* Tab Content Area (Scrollable) */}
                 <div className="max-h-[600px] overflow-y-auto bg-gray-50/50 dark:bg-gray-800/30" style={{ scrollbarWidth: 'thin' }}> {/* Increased max-h, added background */}
                    {renderTabContent()}
                 </div>
            </div>
         </div>
      {/* Removed extra closing div */}
    </div>
  );
}

// Update PropTypes
DataOverview.propTypes = {
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  datasetName: PropTypes.string,
  authToken: PropTypes.string,
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
      originalName: PropTypes.string.isRequired,
      sanitizedName: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
  })),
  darkMode: PropTypes.bool, // Added darkMode prop type
  handleLogout: PropTypes.func, // Added handleLogout prop type
};

DataOverview.defaultProps = {
  datasetId: null,
  datasetName: '',
  datasetAttributes: [],
  authToken: null,
  darkMode: false, // Added darkMode default prop
  handleLogout: () => {}, // Added handleLogout default prop
};

export default DataOverview;
