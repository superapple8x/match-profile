import React, { useState, useEffect, useRef } from 'react';
import { Button, Form, Container, Row, Col, Card, Dropdown } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import { useLocation } from 'react-router-dom';
import { Bar, Pie, Scatter } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js/auto';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';

function DataAnalysisPage() {
  const location = useLocation();
  const [request, setRequest] = useState('');
  const [chartData, setChartData] = useState(null);
  const [chartType, setChartType] = useState('plotly');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchResults, setMatchResults] = useState([]);
  const [promptSuggestions, setPromptSuggestions] = useState([]);
  const [drillDownPath, setDrillDownPath] = useState([]);
  const [currentData, setCurrentData] = useState([]);
  const chartRef = useRef(null);

  useEffect(() => {
    if (location.state && location.state.matchResults) {
      const results = location.state.matchResults;
      setMatchResults(results);
      setCurrentData(results);
      setPromptSuggestions(generatePromptSuggestions(results));
    }
  }, [location.state]);

  const handleDrillDown = (filteredData, drillDownLabel) => {
    setDrillDownPath(prev => [...prev, drillDownLabel]);
    setCurrentData(filteredData);
    setChartData(null);
    setAnalysis('');
  };

  const handleDrillUp = () => {
    if (drillDownPath.length === 0) return;
    
    const newPath = [...drillDownPath];
    newPath.pop();
    setDrillDownPath(newPath);
    
    if (newPath.length === 0) {
      setCurrentData(matchResults);
    } else {
      // In a real implementation, you would want to reapply filters
      // based on the remaining path segments
      setCurrentData(matchResults);
    }
  };

  useEffect(() => {
    if (location.state && location.state.matchResults) {
      setMatchResults(location.state.matchResults);
      setPromptSuggestions(generatePromptSuggestions(location.state.matchResults));
    }
  }, [location.state]);

  const exportData = (format) => {
    try {
      if (!currentData.length) {
        throw new Error('No data available to export');
      }
      
      const data = currentData.map(result => result.profile || result);
      
      if (format === 'csv') {
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `analysis-export-${new Date().toISOString().slice(0,10)}.csv`);
      } else if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(blob, `analysis-export-${new Date().toISOString().slice(0,10)}.json`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setAnalysis(`Export failed: ${error.message}`);
    }
  };

  const renderChart = () => {
    if (!chartData) return null;
    
    const commonProps = {
      ref: chartRef,
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const clickedElement = elements[0];
          const label = chartData.labels[clickedElement.index];
          const filteredData = currentData.filter(item => {
            const profile = item.profile || item;
            return profile[chartData.datasets[0].label] === label;
          });
          handleDrillDown(filteredData, `${chartData.datasets[0].label}: ${label}`);
        }
      }
    };

    switch(chartType) {
      case 'bar':
        return <Bar data={chartData} {...commonProps} />;
      case 'pie': 
        return <Pie data={chartData} {...commonProps} />;
      case 'scatter':
        return <Scatter data={chartData} {...commonProps} />;
      default:
        return (
          <Plot 
            data={chartData.data} 
            layout={chartData.layout}
            onClick={(data) => {
              if (data.points && data.points.length > 0) {
                const point = data.points[0];
                const filteredData = currentData.filter(item => {
                  const profile = item.profile || item;
                  return profile[point.xaxis.title.text] === point.x &&
                         profile[point.yaxis.title.text] === point.y;
                });
                handleDrillDown(filteredData, `${point.xaxis.title.text}: ${point.x}`);
              }
            }}
          />
        );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setChartData(null);
    setAnalysis('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request, data: matchResults }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
      }

      const result = await response.json();
      setChartData(result.chart);
      setAnalysis(result.analysis);
    } catch (error) {
      console.error("Error:", error);
      setAnalysis(`An error occurred while analyzing the data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

    const generatePromptSuggestions = (data) => {
        if (!data || data.length === 0) {
            return [];
        }

        const firstResult = data[0].profile || data[0];
        const attributes = Object.keys(firstResult);

        const suggestions = [];

        // Example suggestions
        if (attributes.includes('Age') && attributes.includes('Gender')) {
            suggestions.push('Show the age distribution by gender.');
        }
        if (attributes.includes('Platform') && attributes.includes('Interests')) {
            suggestions.push('Compare interests across different platforms.');
        }
        if (attributes.length >= 2) {
          suggestions.push(`Show the relationship between ${attributes[0]} and ${attributes[1]}.`);
        }
        suggestions.push("Show the distribution of match percentages.");

        return suggestions;
    };

    const handleSuggestPrompt = (prompt) => {
        setRequest(prompt);
    };

  const renderBreadcrumbs = () => {
    if (drillDownPath.length === 0) return null;
    
    return (
      <Row className="mb-3">
        <Col>
          <div className="d-flex align-items-center">
            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={handleDrillUp}
              className="me-2"
            >
              &larr; Back
            </Button>
            <Button 
              variant="outline-danger" 
              size="sm" 
              onClick={() => {
                setDrillDownPath([]);
                setCurrentData(matchResults);
              }}
              className="me-2"
            >
              Clear
            </Button>
            <div className="breadcrumb">
              {drillDownPath.map((segment, index) => (
                <span key={index} className="breadcrumb-item">
                  {segment}
                  {index < drillDownPath.length - 1 && ' > '}
                </span>
              ))}
            </div>
          </div>
        </Col>
      </Row>
    );
  };

  return (
    <Container className="py-4">
      {renderBreadcrumbs()}
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="mb-3">Data Analysis</Card.Title>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Enter your request:</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., Show me a scatter plot of attribute1 vs. attribute2"
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                  />
                </Form.Group>
                <div className="d-flex flex-wrap gap-2">
                  <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? 'Analyzing...' : 'Analyze'}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={() => setPromptSuggestions(generatePromptSuggestions(matchResults))}
                  >
                    Suggest Prompts
                  </Button>
                  <Dropdown className="ms-2">
                    <Dropdown.Toggle variant="outline-primary">
                      Export Data
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => exportData('csv')}>CSV</Dropdown.Item>
                      <Dropdown.Item onClick={() => exportData('json')}>JSON</Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                  <Dropdown className="ms-2">
                    <Dropdown.Toggle variant="outline-info">
                      Chart Type: {chartType}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => setChartType('plotly')}>Plotly</Dropdown.Item>
                      <Dropdown.Item onClick={() => setChartType('bar')}>Bar Chart</Dropdown.Item>
                      <Dropdown.Item onClick={() => setChartType('pie')}>Pie Chart</Dropdown.Item>
                      <Dropdown.Item onClick={() => setChartType('scatter')}>Scatter Plot</Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {promptSuggestions.length > 0 && (
        <Row className="mb-4">
          <Col>
            <Card className="shadow-sm">
              <Card.Body>
                <Card.Title className="mb-3">Suggested Prompts</Card.Title>
                <div className="d-flex flex-wrap gap-2">
                  {promptSuggestions.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline-info"
                      size="sm"
                      onClick={() => handleSuggestPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="mb-3">Visualization</Card.Title>
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                renderChart()
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {analysis && (
        <Row>
          <Col>
            <Card className="shadow-sm">
              <Card.Body>
                <Card.Title>Analysis</Card.Title>
                <p className="mb-0">{analysis}</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default DataAnalysisPage;
