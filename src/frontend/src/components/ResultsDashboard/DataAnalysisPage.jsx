import React, { useState, useEffect } from 'react'; // Import useEffect

function DataAnalysisPage({ datasetId }) { // Accept datasetId as a prop
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultImage, setResultImage] = useState(null); // Will store base64 data URI
  const [resultSummary, setResultSummary] = useState('');
  const [resultStats, setResultStats] = useState(null);
  const [resultLogs, setResultLogs] = useState('');

  // Use the datasetId passed via props. Add effect to clear results if ID changes.
  useEffect(() => {
    // Clear results if the dataset ID changes (e.g., new file uploaded)
    setQuery('');
    setIsLoading(false);
    setError(null);
    setResultImage(null);
    setResultSummary('');
    setResultStats(null);
    setResultLogs('');
  }, [datasetId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!query.trim()) {
      setError('Please enter a query.');
      return;
    }
    if (!datasetId) {
        setError('Dataset ID is missing. Please ensure a file is uploaded.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setResultImage(null);
    setResultSummary('');
    setResultStats(null);
    setResultLogs('');

    try {
      console.log(`Sending query: "${query}" for dataset: "${datasetId}"`);
      const response = await fetch('/api/analyze-data', { // Assuming backend runs on the same origin or proxy is set up
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, datasetId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error Response:', data);
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      console.log('API Success Response:', data);
      setResultImage(data.imageUri);
      setResultSummary(data.summary);
      setResultStats(data.stats);
      setResultLogs(data.logs || ''); // Store logs if provided

    } catch (err) {
      console.error('Error during analysis request:', err);
      setError(`Analysis failed: ${err.message}`);
      // Optionally display logs from error response if available
      // if (err.response && err.response.data && err.response.data.logs) {
      //   setResultLogs(err.response.data.logs);
      // }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">LLM Data Analysis</h2>

      <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded bg-white shadow-sm">
        <div className="mb-4">
          <label htmlFor="data-query" className="block text-sm font-medium text-gray-700 mb-1">
            Enter your analysis query (e.g., "Plot Age distribution", "Show correlation between X and Y"):
          </label>
          <input
            type="text"
            id="data-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Analyze my data..."
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
            isLoading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          {isLoading ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </form>

      {isLoading && (
        <div className="text-center p-4">
          <p className="text-indigo-600">Processing your request...</p>
          {/* Add a spinner or better loading indicator here */}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 border rounded bg-red-100 text-red-700 shadow-sm">
          <h3 className="font-bold">Error</h3>
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plot Area */}
        <div className="p-4 border rounded bg-white shadow-sm">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Generated Plot</h3>
          {resultImage ? (
            <img src={resultImage} alt="Generated data analysis plot" className="max-w-full h-auto border" />
          ) : (
            <p className="text-gray-500">{!isLoading && !error ? 'Plot will appear here after analysis.' : ''}</p>
          )}
        </div>

        {/* Summary & Stats Area */}
        <div className="p-4 border rounded bg-white shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Analysis Summary</h3>
            {resultSummary ? (
              <p className="text-gray-700 whitespace-pre-wrap">{resultSummary}</p>
            ) : (
              <p className="text-gray-500">{!isLoading && !error ? 'Summary will appear here.' : ''}</p>
            )}
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Calculated Statistics</h3>
            {resultStats ? (
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                {JSON.stringify(resultStats, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500">{!isLoading && !error ? 'Statistics JSON will appear here.' : ''}</p>
            )}
          </div>
        </div>
      </div>

       {/* Optional Logs Area */}
       {resultLogs && (
         <div className="mt-6 p-4 border rounded bg-gray-100 shadow-sm">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Execution Logs</h3>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto max-h-60">
                {resultLogs}
            </pre>
         </div>
       )}
    </div>
  );
}

export default DataAnalysisPage;
