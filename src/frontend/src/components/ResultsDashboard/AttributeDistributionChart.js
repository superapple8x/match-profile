import React, { useState, useEffect } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Button, Tabs, Tab, Alert } from 'react-bootstrap';
import './AttributeDistributionChart.css';

Chart.register(...registerables);

const AttributeDistributionChart = ({ matchResults, darkMode = false }) => {
  const [data, setData] = useState({});
  const [trends, setTrends] = useState([]);
  const [patternData, setPatternData] = useState({
    exactMatches: 0,
    partialMatches: 0,
    noMatches: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (matchResults) {
      // Process dataset attributes into chart data
      const distribution = {};
      const trendData = [];
      const patterns = {
        exactMatches: 0,
        partialMatches: 0,
        noMatches: 0
      };

      // Get unique attributes from the first result
      if (matchResults.length > 0) {
        const firstResult = matchResults[0];
        Object.keys(firstResult.profile || firstResult).forEach(attr => {
          if (attr !== 'matchPercentage') {
            distribution[attr] = 0;
          }
        });
      }

      // Count occurrences in all results
      matchResults.forEach(result => {
        Object.entries(result.profile || result).forEach(([attr, value]) => {
          if (attr !== 'matchPercentage' && value) {
            distribution[attr]++;
          }
        });

        // Trend data
        trendData.push({
          date: new Date(result.timestamp).toLocaleDateString(),
          value: result.matchPercentage
        });

        // Pattern data
        if (result.matchPercentage === 100) {
          patterns.exactMatches++;
        } else if (result.matchPercentage > 0) {
          patterns.partialMatches++;
        } else {
          patterns.noMatches++;
        }
      });

      setData(distribution);
      setTrends(trendData);
      setPatternData(patterns);
      setLoading(false);
    }
  }, [matchResults]);
  const [activeTab, setActiveTab] = useState('distribution');
  const [optimizationSuggestions, setOptimizationSuggestions] = useState([]);

  // Distribution Chart Data
  const distributionData = {
    labels: Object.keys(data),
    datasets: [
      {
        label: 'Attribute Distribution',
        data: Object.values(data),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Trend Analysis Data
  const trendData = {
    labels: trends.map(t => t.date),
    datasets: [
      {
        label: 'Match Percentage Trend',
        data: trends.map(t => t.value),
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        fill: true,
      },
    ],
  };

  // Pattern Analysis Data
  const pieChartData = {
    labels: ['Exact Matches', 'Partial Matches', 'No Matches'],
    datasets: [
      {
        data: [patternData.exactMatches, patternData.partialMatches, patternData.noMatches],
        backgroundColor: [
          'rgba(75, 192, 192, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(255, 99, 132, 0.5)',
        ],
      },
    ],
  };

  const handleAnalyze = () => {
    // Generate optimization suggestions based on data
    const suggestions = [];
    if (data.exactMatches < data.partialMatches) {
      suggestions.push('Consider relaxing exact match criteria for better results');
    }
    if (trends.length > 0 && trends[trends.length - 1].value < 50) {
      suggestions.push('Recent match percentages are low - review matching criteria');
    }
    setOptimizationSuggestions(suggestions);
  };

  useEffect(() => {
    return () => {
      // Clean up charts when component unmounts
      const charts = Chart.instances;
      Object.values(charts).forEach(chart => chart.destroy());
    };
  }, []);

  return (
    <div className="chart-container" key={activeTab}>
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className={`mb-3 ${darkMode ? 'dark-tabs' : 'light-tabs'}`}
      >
        <Tab eventKey="distribution" title="Distribution">
          <h2>Attribute Distribution</h2>
          <Bar data={distributionData} options={{
            scales: { y: { beginAtZero: true } },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.dataset.label || '';
                    const value = context.raw || 0;
                    return `${label}: ${value} (${((value / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(2)}%)`;
                  }
                }
              }
            }
          }} />
        </Tab>
        <Tab eventKey="trends" title="Trend Analysis">
          <h2>Match Percentage Trends</h2>
          <Line data={trendData} options={{
            scales: {
              y: { beginAtZero: true },
              x: { type: 'time', time: { unit: 'day' } }
            },
            interaction: {
              intersect: false,
              mode: 'index',
            },
          }} />
        </Tab>
        <Tab eventKey="patterns" title="Pattern Analysis">
          <h2>Match Patterns</h2>
          <Pie data={pieChartData} options={{
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || '';
                    const value = context.raw || 0;
                    return `${label}: ${value} (${((value / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(2)}%)`;
                  }
                }
              }
            }
          }} />
        </Tab>
      </Tabs>

      <div className="optimization-section">
        <Button variant="primary" onClick={handleAnalyze}>
          Analyze and Optimize
        </Button>
        
        {optimizationSuggestions.length > 0 && (
          <div className="mt-3">
            <h4>Optimization Suggestions</h4>
            {optimizationSuggestions.map((suggestion, index) => (
              <Alert key={index} variant="info">
                {suggestion}
              </Alert>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttributeDistributionChart;