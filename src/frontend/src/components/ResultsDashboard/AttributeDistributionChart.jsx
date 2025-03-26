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
    colors.push(`hsla(${hue}, 70%, 60%, 0.5)`); // Use hsla for background with alpha
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

  useEffect(() => {
    if (matchResults && matchResults.length > 0) {
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
      borderColor: generateColors(Object.keys(distributionCounts).length).map(c => c.replace('0.5', '1')), // Solid border
      borderWidth: 1,
    }],
  };

  const trendChartData = {
    // labels are derived from data points directly by chart.js time scale
    datasets: [{
      label: 'Match Percentage Trend',
      data: trends, // Use {x, y} data points
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      fill: true,
      tension: 0.1 // Smooth curve
    }],
  };

  const pieChartData = {
    labels: ['Exact Matches (100%)', 'Partial Matches (>0%)', 'No Matches (0%)'],
    datasets: [{
      data: [patternData.exactMatches, patternData.partialMatches, patternData.noMatches],
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(255, 99, 132, 0.6)',
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(255, 99, 132, 1)',
      ],
      borderWidth: 1,
    }],
  };

  // Chart Options
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow height control via container
    plugins: {
      legend: {
        labels: {
          color: document.body.classList.contains('dark') ? '#e5e7eb' : '#4b5563', // Adjust legend color for dark mode
        }
      }
    }
  };

  const barChartOptions = {
    ...commonChartOptions,
    scales: {
      y: { beginAtZero: true, ticks: { color: document.body.classList.contains('dark') ? '#9ca3af' : '#6b7280' } },
      x: { ticks: { color: document.body.classList.contains('dark') ? '#9ca3af' : '#6b7280' } }
    },
    plugins: {
      ...commonChartOptions.plugins,
      tooltip: {
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
  };

   const lineChartOptions = {
     ...commonChartOptions,
     scales: {
       y: { beginAtZero: true, max: 100, ticks: { color: document.body.classList.contains('dark') ? '#9ca3af' : '#6b7280' } },
       x: { type: 'time', time: { unit: 'day' }, ticks: { color: document.body.classList.contains('dark') ? '#9ca3af' : '#6b7280' } }
     },
     interaction: { intersect: false, mode: 'index' },
   };

  const pieChartOptions = {
    ...commonChartOptions,
    plugins: {
      ...commonChartOptions.plugins,
      tooltip: {
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
    { key: 'distribution', title: 'Distribution', chart: <Bar ref={barChartRef} data={distributionChartData} options={barChartOptions} /> },
    { key: 'trends', title: 'Trend Analysis', chart: <Line ref={lineChartRef} data={trendChartData} options={lineChartOptions} /> },
    { key: 'patterns', title: 'Pattern Analysis', chart: <Pie ref={pieChartRef} data={pieChartData} options={pieChartOptions} /> },
  ];

  if (loading) {
    return <div className="text-center p-10 text-gray-500 dark:text-gray-400">Loading chart data...</div>;
  }

  if (!matchResults || matchResults.length === 0) {
     return <div className="text-center p-10 text-gray-500 dark:text-gray-400">No match results available to generate charts.</div>;
   }


  return (
    // Main container with Tailwind styles
    <div className="max-w-4xl mx-auto my-5 p-5 bg-white dark:bg-gray-800 rounded-lg shadow-lg transition-colors duration-150">
      {/* Custom Tabs Implementation */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-150
                ${activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
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
          <div key={tab.key} className={`${activeTab === tab.key ? 'block' : 'hidden'}`}>
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">{tab.title}</h2>
            {/* Container to control chart height */}
            <div className="relative h-72 md:h-96">
              {tab.chart}
            </div>
          </div>
        ))}
      </div>

      {/* Optimization Section */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        {/* Custom Button */}
        <button
          onClick={handleAnalyze}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-md shadow transition-colors duration-150"
        >
          Analyze and Suggest Optimizations
        </button>

        {optimizationSuggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300">Optimization Suggestions:</h4>
            {/* Custom Alert */}
            {optimizationSuggestions.map((suggestion, index) => (
              <div key={index} className="p-3 bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-200 rounded-r-md" role="alert">
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