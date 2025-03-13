import React, { useState, useEffect } from 'react';
import { Button, Form, Container, Row, Col } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import { useLocation } from 'react-router-dom';

function DataAnalysisPage() {
  const location = useLocation();
  const [request, setRequest] = useState('');
  const [chartData, setChartData] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchResults, setMatchResults] = useState([]);
  const [promptSuggestions, setPromptSuggestions] = useState([]);

    useEffect(() => {
        if (location.state && location.state.matchResults) {
            setMatchResults(location.state.matchResults);
            // Generate prompt suggestions whenever matchResults changes
            setPromptSuggestions(generatePromptSuggestions(location.state.matchResults));
        }
    }, [location.state]);

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

    return (
    <Container>
      <Row>
        <Col>
          <h1>Data Analysis</h1>
        </Col>
      </Row>
      <Row>
        <Col>
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
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
            <Button
              variant="secondary"
              className="ms-2"
              onClick={() => setPromptSuggestions(generatePromptSuggestions(matchResults))}
            >
              Suggest Prompts
            </Button>
          </Form>
          {promptSuggestions.length > 0 && (
            <div className="mt-3">
              <Form.Label>Suggested Prompts:</Form.Label>
              <ul className="list-unstyled">
                {promptSuggestions.map((prompt, index) => (
                  <li key={index}>
                    <Button
                      variant="outline-info"
                      size="sm"
                      className="mb-1"
                      onClick={() => handleSuggestPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Col>
      </Row>
      <Row>
        <Col>
          {loading && <div>Loading...</div>}
          {chartData && (
            <Plot
              data={chartData.data}
              layout={chartData.layout}
            />
          )}
        </Col>
      </Row>
      <Row>
        <Col>
          <h2>Analysis:</h2>
          <p>{analysis}</p>
        </Col>
      </Row>
    </Container>
  );
}

export default DataAnalysisPage;
