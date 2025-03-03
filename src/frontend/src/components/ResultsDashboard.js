import React, { useState, useEffect } from 'react';
import './ResultsDashboard.css';
import ResultsSummary from './ResultsDashboard/ResultsSummary';
import ResultsTable from './ResultsDashboard/ResultsTable';
import MatchBreakdown from './ResultsDashboard/MatchBreakdown';
import FrequencyHeatmap from './VisualizationPrototypes/ChartJS/FrequencyHeatmap';
import TrendLines from './VisualizationPrototypes/ChartJS/TrendLines';
import NetworkGraph from './VisualizationPrototypes/D3/NetworkGraph';
import TimeSeries from './VisualizationPrototypes/D3/TimeSeries';

function ResultsDashboard({ searchResults, searchCriteria }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [averageMatchPercentage, setAverageMatchPercentage] = useState(0);
  const [highestMatch, setHighestMatch] = useState(0);

  // Dummy data for visualizations
  const heatmapData = [
    { x: 'Attribute1', y: 'Value1', value: 10 },
    { x: 'Attribute1', y: 'Value2', value: 5 },
    { x: 'Attribute2', y: 'Value1', value: 7 },
    { x: 'Attribute2', y: 'Value2', value: 12 }
  ];
  const heatmapLabels = {
    x: ['Attribute1', 'Attribute2'],
    y: ['Value1', 'Value2']
  };

  const trendData = [10, 20, 15, 25, 30, 22, 28];
  const trendLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

  const networkData = {
    nodes: [
      { id: 'A', color: 'red' },
      { id: 'B', color: 'green' },
      { id: 'C', color: 'blue' }
    ],
    links: [
      { source: 'A', target: 'B', value: 3 },
      { source: 'B', target: 'C', value: 5 },
      { source: 'C', target: 'A', value: 2 }
    ]
  };

  const timeSeriesData = [
    { date: '2025-01-01', value: 10 },
    { date: '2025-02-01', value: 20 },
    { date: '2025-03-01', value: 15 }
  ];

  useEffect(() => {
    if (searchResults) {
      // Check if searchResults has matches property
      if (searchResults.matches && Array.isArray(searchResults.matches)) {
        setTotalMatches(searchResults.matches.length);
        const sum = searchResults.matches.reduce((acc, match) => acc + match.matchPercentage, 0);
        setAverageMatchPercentage(totalMatches > 0 ? sum / totalMatches : 0);
        setHighestMatch(searchResults.matches.reduce((max, match) => Math.max(max, match.matchPercentage), 0));
      } else if (Array.isArray(searchResults)) {
        // Handle direct array of results
        setTotalMatches(searchResults.length);
        // Calculate match percentages if available
        if (searchResults.length > 0 && 'matchPercentage' in searchResults[0]) {
          const sum = searchResults.reduce((acc, match) => acc + match.matchPercentage, 0);
          setAverageMatchPercentage(totalMatches > 0 ? sum / totalMatches : 0);
          setHighestMatch(searchResults.reduce((max, match) => Math.max(max, match.matchPercentage), 0));
        }
      }
    } else {
      setTotalMatches(0);
      setAverageMatchPercentage(0);
      setHighestMatch(0);
    }
  }, [searchResults, searchCriteria]);

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseBreakdown = () => {
    setSelectedMatch(null);
  };

  return (
    <div className="results-dashboard-container">
      <h2>Results Dashboard</h2>
      {searchCriteria && (
        <div className="search-criteria">
          <h3>Search Criteria:</h3>
          <ul>
            {searchCriteria.map((criteria, index) => (
              <li key={index}>
                {criteria.attribute}: {criteria.value} (Weight: {criteria.weight})
              </li>
            ))}
          </ul>
        </div>
      )}
      {searchResults ? (
        <>
          <ResultsSummary
            totalMatches={totalMatches}
            averageMatchPercentage={averageMatchPercentage}
            highestMatch={highestMatch}
          />
          <ResultsTable results={searchResults.matches} onMatchClick={handleMatchClick} />
          {selectedMatch && (
            <div className="match-breakdown-modal">
              <MatchBreakdown match={selectedMatch} />
              <button onClick={handleCloseBreakdown}>Close</button>
            </div>
          )}

          <h3>Visualization Prototypes</h3>
          <div className="visualization-container">
            <FrequencyHeatmap data={heatmapData} labels={heatmapLabels} />
            <TrendLines data={trendData} labels={trendLabels} />
            <NetworkGraph data={networkData} />
            <TimeSeries data={timeSeriesData} />
          </div>
        </>
      ) : (
        <div>No results to display.</div>
      )}
    </div>
  );
}

export default ResultsDashboard;
