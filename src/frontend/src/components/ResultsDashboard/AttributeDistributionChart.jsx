import React, { useState, useEffect, useRef } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
// Removed: import { Button, Tabs, Tab, Alert } from 'react-bootstrap';
// Removed: import './AttributeDistributionChart.css';

Chart.register(...registerables);

// Helper to generate colors for charts
const generateColors = (numColors) => {
  const colors = [];
  for (let i = 0; i < numColors; i++) {
    const hue = (i * 360 / numColors) % 360;
    colors.push(`hsla(${hue}, 70%, 60%, 0.6)`); // Adjusted alpha for better visibility
  }
  return colors;
};

const AttributeDistributionChart = ({ matchResults }) => {
  const [distributionCounts, setDistributionCounts] = useState({});
  const [trends, setTrends] = useState([]);
  const [patternData, setPatternData] = useState({ exactMatches: 0, partialMatches: 0, noMatches: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('distribution');
  const [optimizationSuggestions, setOptimizationSuggestions] = useState([]);

  // Refs for charts to destroy them on unmount
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const pieChartRef = useRef(null);

  // --- Dark Mode Aware Chart Options ---
  const [chartOptions, setChartOptions] = useState({});

  useEffect(() => {
    const isDarkMode = document.body.classList.contains('dark');
    const legendColor = isDarkMode ? '#e5e7eb' : '#374151'; // Use darker gray for light mode legend
    const tickColor = isDarkMode ? '#9ca3af' : '#6b7280';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false, // Allow height control via container
      plugins: {
        legend: {
          labels: {
            color: legendColor,
            boxWidth: 12, // Smaller legend color boxes
            padding: 15, // Padding around legend items
          }
        },
        tooltip: {
          backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)', // Semi-transparent tooltip
          titleColor: isDarkMode ? '#f3f4f6' : '#1f2937',
          bodyColor: isDarkMode ? '#d1d5db' : '#4b5563',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
        }
      }
    };

    setChartOptions({
      bar: {
        ...commonOptions,
        scales: {
          y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor }, grid: { color: gridColor } }
        },
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      },
      line: {
        ...commonOptions,
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { color: tickColor }, grid: { color: gridColor } },
          x: { type: 'time', time: { unit: 'day' }, ticks: { color: tickColor }, grid: { color: gridColor } }
        },
        interaction: { intersect: false, mode: 'index' },
      },
      pie: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });

  }, []); // Run once on mount, assumes dark mode doesn't change while component is mounted (or re-render triggers if needed)


  useEffect(() => {
    if (matchResults && matchResults.length > 0) {
      setLoading(true); // Set loading true before processing
      const counts = {};
      const trendDataPoints = [];
      const patterns = { exactMatches: 0, partialMatches: 0, noMatches: 0 };

      // Initialize counts based on attributes in the first result's profile/data
      const firstResultAttributes = matchResults[0]?.attributes || [];
      firstResultAttributes.forEach(attr => {
        counts[attr.name] = 0;
      });

      matchResults.forEach(result => {
        // Count attribute occurrences
        (result.attributes || []).forEach(attr => {
          if (counts.hasOwnProperty(attr.name) && attr.value) { // Check if key exists and value is truthy
            counts[attr.name]++;
          }
        });

        // Trend data
        if (result.timestamp && result.matchPercentage !== undefined) {
          trendDataPoints.push({
            x: new Date(result.timestamp), // Use Date object for time scale
            y: result.matchPercentage
          });
        }

        // Pattern data
        const percentage = result.matchPercentage ?? 0;
        if (percentage === 100) patterns.exactMatches++;
        else if (percentage > 0) patterns.partialMatches++;
        else patterns.noMatches++;
      });

      // Sort trend data by date
      trendDataPoints.sort((a, b) => a.x.getTime() - b.x.getTime());

      setDistributionCounts(counts);
      setTrends(trendDataPoints);
      setPatternData(patterns);
      setLoading(false);
    } else {
      setLoading(false); // Stop loading even if no results
      setDistributionCounts({});
      setTrends([]);
      setPatternData({ exactMatches: 0, partialMatches: 0, noMatches: 0 });
    }
  }, [matchResults]);

  // Chart Data Definitions
  const distributionChartData = {
    labels: Object.keys(distributionCounts),
    datasets: [{
      label: 'Attribute Occurrences',
      data: Object.values(distributionCounts),
      backgroundColor: generateColors(Object.keys(distributionCounts).length),
      borderColor: generateColors(Object.keys(distributionCounts).length).map(c => c.replace('0.6', '1')), // Solid border
      borderWidth: 1,
      borderRadius: 4, // Slightly rounded bars
    }],
  };

  const trendChartData = {
    // labels are derived from data points directly by chart.js time scale
    datasets: [{
      label: 'Match Percentage Trend',
      data: trends, // Use {x, y} data points
      borderColor: 'rgba(59, 130, 246, 0.8)', // Primary blue
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      fill: true,
      tension: 0.2, // Smoother curve
      pointBackgroundColor: 'rgba(59, 130, 246, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
    }],
  };

  const pieChartData = {
    labels: ['Exact Matches (100%)', 'Partial Matches (>0%)', 'No Matches (0%)'],
    datasets: [{
      data: [patternData.exactMatches, patternData.partialMatches, patternData.noMatches],
      backgroundColor: [
        'rgba(16, 185, 129, 0.7)', // Emerald
        'rgba(245, 158, 11, 0.7)', // Amber
        'rgba(239, 68, 68, 0.7)',  // Red
      ],
      borderColor: [
        'rgba(16, 185, 129, 1)',
        'rgba(245, 158, 11, 1)',
        'rgba(239, 68, 68, 1)',
      ],
      borderWidth: 1,
      hoverOffset: 8, // Slightly larger hover effect
    }],
  };


  const handleAnalyze = () => {
    const suggestions = [];
    if (patternData.exactMatches < patternData.partialMatches) {
      suggestions.push('Consider relaxing exact match criteria or adjusting weights for potentially more relevant partial matches.');
    }
    if (trends.length > 1) {
       const lastTrend = trends[trends.length - 1].y;
       const avgTrend = trends.reduce((sum, t) => sum + t.y, 0) / trends.length;
       if (lastTrend < avgTrend * 0.8) { // If last trend is significantly lower than average
         suggestions.push('Recent match percentages show a downward trend. Review recent data or matching criteria.');
       }
    }
    if (patternData.noMatches > matchResults.length * 0.5) { // If more than 50% are no matches
        suggestions.push('A high number of profiles resulted in no match. Check if search criteria are too strict or if data quality needs improvement.');
    }
    // Add more sophisticated analysis here based on distribution, etc.
    if (suggestions.length === 0) {
        suggestions.push('Analysis complete. No immediate optimization suggestions based on current patterns.');
    }
    setOptimizationSuggestions(suggestions);
  };

  // Cleanup chart instances on unmount
  useEffect(() => {
    return () => {
      [barChartRef.current, lineChartRef.current, pieChartRef.current].forEach(chartInstance => {
        if (chartInstance) {
          chartInstance.destroy();
        }
      });
    };
  }, []);

  const tabs = [
    { key: 'distribution', title: 'Distribution', chart: <Bar ref={barChartRef} data={distributionChartData} options={chartOptions.bar} /> },
    { key: 'trends', title: 'Trend Analysis', chart: <Line ref={lineChartRef} data={trendChartData} options={chartOptions.line} /> },
    { key: 'patterns', title: 'Pattern Analysis', chart: <Pie ref={pieChartRef} data={pieChartData} options={chartOptions.pie} /> },
  ];

  if (loading) {
    return <div className="text-center p-10 text-gray-500 dark:text-gray-400">Loading chart data...</div>;
  }

  if (!matchResults || matchResults.length === 0) {
     return <div className="text-center p-10 text-gray-500 dark:text-gray-400">No match results available to generate charts.</div>;
   }


  return (
    // Main container - Apply glass effect
    <div className="max-w-4xl mx-auto my-6 p-5 bg-white/70 dark:bg-gray-800/60 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/50 rounded-xl shadow-lg transition-all duration-300 ease-in-out"> {/* Matched other containers */}
      {/* Custom Tabs Implementation - Refined Styling */}
      <div className="mb-5 border-b border-gray-300/70 dark:border-gray-600/50"> {/* Adjusted border */}
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs"> {/* Added overflow */}
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm transition-all duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary-500/50 rounded-t-md
                ${activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:border-primary-400 dark:text-primary-300' // Use primary theme
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                }
              `}
            >
              {tab.title}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {tabs.map((tab) => (
          <div key={tab.key} className={`${activeTab === tab.key ? 'block animate-fade-in-fast' : 'hidden'}`}> {/* Added animation */}
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">{tab.title}</h2>
            {/* Container to control chart height */}
            <div className="relative h-72 md:h-96 bg-gray-50/30 dark:bg-gray-900/20 rounded-lg p-2"> {/* Added subtle bg and padding */}
              {tab.chart}
            </div>
          </div>
        ))}
      </div>

      {/* Optimization Section */}
      <div className="mt-8 pt-5 border-t border-gray-300/70 dark:border-gray-600/50"> {/* Adjusted margin/padding/border */}
        {/* Custom Button - Matched standard style */}
        <button
          onClick={handleAnalyze}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 dark:bg-primary-700 dark:hover:bg-primary-800 text-white font-semibold rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          Analyze and Suggest Optimizations
        </button>

        {optimizationSuggestions.length > 0 && (
          <div className="mt-5 space-y-3"> {/* Adjusted margin/spacing */}
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200">Optimization Suggestions:</h4>
            {/* Custom Alert - Refined Styling */}
            {optimizationSuggestions.map((suggestion, index) => (
              <div key={index} className="p-3.5 bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-400 dark:border-primary-500 text-primary-700 dark:text-primary-200 rounded-r-md shadow-sm" role="alert"> {/* Use primary theme, adjusted padding/shadow */}
                <p className="text-sm">{suggestion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttributeDistributionChart;