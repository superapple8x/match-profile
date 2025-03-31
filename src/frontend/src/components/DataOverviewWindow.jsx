import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
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
import {
    DocumentTextIcon, HashtagIcon, CalendarDaysIcon, QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';

// Register Chart.js components (if not already registered globally)
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const TABS = {
  ATTRIBUTES: 'Attributes',
  CATEGORICAL: 'Categorical',
  NUMERICAL: 'Numerical',
  MISSING: 'Missing Values',
};

// DataOverviewWindow component - Adapted from DetailsWindow
function DataOverviewWindow({
    datasetName,
    statsData,
    datasetAttributes,
    darkMode, // Pass darkMode for chart styling if needed
    onClose
}) {
  const [position, setPosition] = useState({ x: 70, y: 70 }); // Slightly different initial position
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef(null);
  const [activeTab, setActiveTab] = useState(TABS.ATTRIBUTES); // Internal state for tabs

  // Set initial tab based on data availability when component mounts or data changes
  useEffect(() => {
      const hasAttributes = datasetAttributes && datasetAttributes.length > 0;
      const hasCategorical = statsData?.categoricalStats && Object.keys(statsData.categoricalStats).length > 0;
      const hasNumerical = statsData?.numericStats && Object.keys(statsData.numericStats).length > 0;
      if (hasAttributes) {
          setActiveTab(TABS.ATTRIBUTES);
      } else if (hasCategorical) {
          setActiveTab(TABS.CATEGORICAL);
      } else if (hasNumerical) {
          setActiveTab(TABS.NUMERICAL);
      } else {
          setActiveTab(TABS.MISSING); // Fallback
      }
  }, [statsData, datasetAttributes]);


  // --- Dragging Logic (Copied from DetailsWindow) ---
  const handleMouseMove = useCallback((e) => {
    const newX = e.clientX - dragStartOffset.current.x;
    const newY = e.clientY - dragStartOffset.current.y;
    setPosition({ x: newX, y: newY });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (windowRef.current) windowRef.current.style.cursor = 'default';
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return; // Prevent drag on buttons/tab buttons
    e.preventDefault();
    setIsDragging(true);
    const rect = windowRef.current.getBoundingClientRect();
    dragStartOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    if (windowRef.current) windowRef.current.style.cursor = 'grabbing';
    document.body.style.cursor = 'grabbing';
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (isDragging) document.body.style.cursor = 'default';
    };
  }, [handleMouseMove, handleMouseUp, isDragging]);

  // --- Minimize/Restore Logic ---
  const toggleMinimize = () => setIsMinimized(!isMinimized);

  // --- Styling (Adapted from DetailsWindow, adjusted width/height) ---
  const windowStyle = {
    position: 'absolute',
    top: `${position.y}px`,
    left: `${position.x}px`,
    width: isMinimized ? '300px' : '600px', // Wider for charts
    minHeight: '30px',
    border: '3px outset #C0C0C0',
    backgroundColor: '#C0C0C0',
    zIndex: 100,
    boxShadow: '5px 5px 5px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    color: '#000000',
    fontSize: '12px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    userSelect: 'none',
  };

  const titleBarStyle = {
    backgroundColor: '#000080',
    color: '#FFFFFF',
    padding: '3px 5px',
    fontWeight: 'bold',
    cursor: 'grab',
    borderBottom: '1px solid #000000',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '24px',
  };

  const titleBarButtonsStyle = { display: 'flex', gap: '3px' };

  const windowButtonStyle = {
    fontFamily: '"Webdings", "Wingdings", sans-serif',
    fontSize: '14px',
    width: '18px',
    height: '18px',
    border: '1px outset #FFFFFF',
    backgroundColor: '#C0C0C0',
    color: '#000000',
    padding: '0',
    lineHeight: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const contentAreaStyle = {
    display: isMinimized ? 'none' : 'flex', // Use flex for layout
    flexDirection: 'column', // Stack tabs and content vertically
    backgroundColor: '#FFFFFF',
    height: '500px', // Fixed height for content area
  };

  const tabContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '5px',
    borderBottom: '1px solid #888888',
    backgroundColor: '#E0E0E0', // Slightly different background for tabs
  };

  const tabButtonStyle = (isActive) => ({
    padding: '3px 8px',
    border: isActive ? '1px inset #888888' : '1px outset #FFFFFF',
    backgroundColor: isActive ? '#AAAAAA' : '#C0C0C0', // Indicate active tab
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: isActive ? 'bold' : 'normal',
    color: '#000000',
  });

  const tabContentStyle = {
    padding: '10px',
    flexGrow: 1, // Allow content to take remaining space
    overflowY: 'auto', // Make content scrollable
    backgroundColor: '#FFFFFF', // White background for content
  };

  // --- Chart Data Preparation (Copied from DataOverview) ---
   const getCategoricalChartData = (attributeName) => {
    const catData = statsData?.categoricalStats?.[attributeName];
    if (!catData || catData.length === 0) return null;
    return {
      labels: catData.map(item => String(item.value).substring(0, 20)),
      datasets: [{
        label: 'Count', data: catData.map(item => item.count),
        backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1,
      }],
    };
  };

  const getMissingValuesChartData = () => {
    if (!statsData || !statsData.columnDetails || statsData.totalRows === 0) return null;
    const labels = Object.keys(statsData.columnDetails);
    const missingPercentages = labels.map(key => {
        const nullCount = statsData.columnDetails[key]?.nullCount ?? 0;
        return ((nullCount / statsData.totalRows) * 100);
    });
    return {
      labels: labels,
      datasets: [{
        label: '% Missing', data: missingPercentages,
        backgroundColor: 'rgba(255, 99, 132, 0.6)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1,
      }],
    };
  };

  const getNumericalChartData = (attributeName) => {
    const numStats = statsData?.numericStats?.[attributeName];
    const histogramData = numStats?.histogram;
    if (!histogramData || histogramData.length === 0) return null;
    const labels = histogramData.map(bucket => bucket.lower_bound === bucket.upper_bound ? `${bucket.lower_bound.toFixed(1)}` : `${bucket.lower_bound.toFixed(1)} - ${bucket.upper_bound.toFixed(1)}`);
    return {
      labels: labels,
      datasets: [{
        label: 'Count', data: histogramData.map(bucket => bucket.count),
        backgroundColor: 'rgba(54, 162, 235, 0.6)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1, barPercentage: 1.0, categoryPercentage: 1.0,
      }],
    };
  };

  // Chart options (consider passing darkMode or adapting styles)
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { color: '#333', font: { size: 10 } } }, title: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#666', font: { size: 10 } }, grid: { color: 'rgba(0, 0, 0, 0.1)' } },
      x: { ticks: { color: '#666', font: { size: 10 } }, grid: { display: false } }
    },
  };
   const missingChartOptions = { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } };

   // --- Helper to get type icon (Copied from DataOverview) ---
   const getTypeIcon = (type) => {
       const lowerType = type?.toLowerCase() || '';
       if (lowerType.includes('string') || lowerType.includes('text') || lowerType.includes('varchar')) {
           return <DocumentTextIcon style={{ height: '1em', width: '1em', marginRight: '4px', color: '#555', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true" />;
       } else if (lowerType.includes('int') || lowerType.includes('num') || lowerType.includes('float') || lowerType.includes('double') || lowerType.includes('decimal')) {
           return <HashtagIcon style={{ height: '1em', width: '1em', marginRight: '4px', color: '#369', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true" />;
       } else if (lowerType.includes('date') || lowerType.includes('time')) {
           return <CalendarDaysIcon style={{ height: '1em', width: '1em', marginRight: '4px', color: '#838', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true" />;
       } else {
           return <QuestionMarkCircleIcon style={{ height: '1em', width: '1em', marginRight: '4px', color: '#777', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true" />;
       }
   };

  // --- Content Rendering Logic (Adapted from DataOverview) ---
  const renderTabContent = () => {
    if (!statsData) return <p style={{ padding: '10px', fontStyle: 'italic', color: '#555' }}>Statistics data not available.</p>;

    switch (activeTab) {
      case TABS.ATTRIBUTES:
        if (!datasetAttributes || datasetAttributes.length === 0) return <p style={{ padding: '10px', fontStyle: 'italic', color: '#555' }}>No attribute information available.</p>;
        return (
            <div style={{ border: '1px solid #AAA', margin: '5px', padding: '8px', backgroundColor: '#F8F8F8' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#000080', marginBottom: '5px' }}>Attributes ({datasetAttributes.length}):</h4>
                <ul style={{ listStyle: 'none', paddingLeft: '0', margin: '0', maxHeight: '350px', overflowY: 'auto' }}>
                {datasetAttributes.map((attr, index) => {
                    const details = statsData?.columnDetails?.[attr.originalName];
                    const totalRows = statsData?.totalRows;
                    let missingPercentText = '';
                    if (details && totalRows > 0) {
                        const missingPercent = ((details.nullCount ?? 0) / totalRows * 100);
                        missingPercentText = `(${(missingPercent).toFixed(1)}% missing)`;
                    } else if (statsData && !details) {
                        missingPercentText = '(stats N/A)';
                    }
                    return (
                        <li key={index} title={`${attr.originalName} (${attr.type})`} style={{ marginBottom: '3px', borderBottom: '1px dotted #CCC', paddingBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', marginRight: '10px' }}>
                                {getTypeIcon(attr.type)}
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attr.originalName}</span>
                            </span>
                            {missingPercentText && <span style={{ fontSize: '10px', color: '#777', whiteSpace: 'nowrap' }}>{missingPercentText}</span>}
                        </li>
                    );
                })}
                </ul>
            </div>
        );
      case TABS.CATEGORICAL:
        const categoricalAttributes = Object.keys(statsData.categoricalStats || {});
        if (categoricalAttributes.length === 0) return <p style={{ padding: '10px', fontStyle: 'italic', color: '#555' }}>No categorical attributes found.</p>;
        return (
          <div style={{ spaceY: '15px' }}>
            {categoricalAttributes.map(attr => {
              const chartData = getCategoricalChartData(attr);
              if (!chartData) return null;
              return (
                <div key={attr} style={{ border: '1px solid #AAA', margin: '5px', padding: '8px', backgroundColor: '#F8F8F8' }}>
                  <h5 style={{ fontSize: '12px', fontWeight: 'bold', color: '#000080', marginBottom: '5px', textAlign: 'center' }}>{attr} (Top 5 Values)</h5>
                  <div style={{ height: '180px' }}> {/* Adjust height as needed */}
                     <Bar options={chartOptions} data={chartData} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      case TABS.NUMERICAL:
        const numericAttributes = Object.keys(statsData.numericStats || {});
        if (numericAttributes.length === 0) return <p style={{ padding: '10px', fontStyle: 'italic', color: '#555' }}>No numeric attributes found.</p>;
        return (
          <div style={{ spaceY: '15px' }}>
            {numericAttributes.map(attr => {
              const chartData = getNumericalChartData(attr);
              const numStats = statsData.numericStats[attr];
              const details = statsData.columnDetails[attr];
              const missingPercent = ((details?.nullCount ?? 0) / statsData.totalRows * 100).toFixed(1);
              return (
                <div key={attr} style={{ border: '1px solid #AAA', margin: '5px', padding: '8px', backgroundColor: '#F8F8F8' }}>
                  <h5 style={{ fontSize: '12px', fontWeight: 'bold', color: '#000080', marginBottom: '5px', textAlign: 'center' }}>{attr}</h5>
                  {/* Stats Summary */}
                  <dl style={{ fontSize: '10px', color: '#444', marginBottom: '5px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 10px' }}>
                      <div style={{ display:'contents' }}><dt style={{fontWeight:'bold'}}>Avg:</dt> <dd style={{textAlign:'right'}}>{numStats?.average?.toFixed(2) ?? 'N/A'}</dd></div>
                      <div style={{ display:'contents' }}><dt style={{fontWeight:'bold'}}>Median:</dt> <dd style={{textAlign:'right'}}>{numStats?.median?.toFixed(2) ?? 'N/A'}</dd></div>
                      <div style={{ display:'contents' }}><dt style={{fontWeight:'bold'}}>StdDev:</dt> <dd style={{textAlign:'right'}}>{numStats?.standardDeviation?.toFixed(2) ?? 'N/A'}</dd></div>
                      <div style={{ display:'contents' }}><dt style={{fontWeight:'bold'}}>Range:</dt> <dd style={{textAlign:'right'}}>{numStats?.min?.toFixed(2) ?? 'N/A'} - {numStats?.max?.toFixed(2) ?? 'N/A'}</dd></div>
                      <div style={{ display:'contents' }}><dt style={{fontWeight:'bold'}}>Missing:</dt> <dd style={{textAlign:'right'}}>{details?.nullCount ?? 'N/A'} ({missingPercent}%)</dd></div>
                  </dl>
                  {/* Histogram */}
                  {chartData ? (
                    <div style={{ height: '180px' }}> {/* Adjust height */}
                       <Bar options={chartOptions} data={chartData} />
                    </div>
                  ) : (
                    <p style={{ fontSize: '10px', fontStyle: 'italic', color: '#777', textAlign: 'center' }}>Histogram data unavailable.</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      case TABS.MISSING:
        const missingChartData = getMissingValuesChartData();
        if (!missingChartData) return <p style={{ padding: '10px', fontStyle: 'italic', color: '#555' }}>Could not generate missing values data.</p>;
        return (
          <div style={{ border: '1px solid #AAA', margin: '5px', padding: '8px', backgroundColor: '#F8F8F8' }}>
            <h5 style={{ fontSize: '12px', fontWeight: 'bold', color: '#000080', marginBottom: '5px', textAlign: 'center' }}>% Missing Values per Attribute</h5>
            <div style={{ height: '200px' }}> {/* Adjust height */}
               <Bar options={missingChartOptions} data={missingChartData} />
            </div>
          </div>
        );
      default: return null;
    }
  };

  // --- Render ---
  return (
    <div ref={windowRef} style={windowStyle}>
      {/* Title Bar */}
      <div style={titleBarStyle} onMouseDown={handleMouseDown}>
        <span>Dataset Overview: {datasetName || 'N/A'}</span>
        <div style={titleBarButtonsStyle}>
          <button style={windowButtonStyle} onClick={toggleMinimize} title={isMinimized ? 'Restore' : 'Minimize'}>
            {isMinimized ? '1' : '0'}
          </button>
          <button style={{...windowButtonStyle, fontWeight: 'bold'}} onClick={onClose} title="Close">
            r
          </button>
        </div>
      </div>

      {/* Content Area with Tabs */}
      <div style={contentAreaStyle}>
        {/* Tab Buttons */}
        <div style={tabContainerStyle}>
          {Object.values(TABS).map(tabName => (
            <button
              key={tabName}
              style={tabButtonStyle(activeTab === tabName)}
              onClick={() => setActiveTab(tabName)}
            >
              {tabName}
            </button>
          ))}
        </div>
        {/* Tab Content */}
        <div style={tabContentStyle}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

DataOverviewWindow.propTypes = {
  datasetName: PropTypes.string,
  statsData: PropTypes.object, // Contains .categoricalStats, .numericStats, .columnDetails, .totalRows
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
      originalName: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired, // Added type
  })).isRequired,
  darkMode: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};

DataOverviewWindow.defaultProps = {
    datasetName: 'Unnamed Dataset',
    statsData: null,
    datasetAttributes: [],
    darkMode: false,
};

export default DataOverviewWindow;