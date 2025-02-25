import { useState } from 'react';
import FileImport from './components/FileImport';
import SearchConfig from './components/SearchConfig';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSearches from './components/SavedSearches';
import './App.css';

function App() {
  const [importedData, setImportedData] = useState(null);
  const [searchResults, setSearchResults] = useState(null);

  const handleFileImport = (data) => {
    setImportedData(data);
  };

  const handleSearch = (searchConfig) => {
    console.log('Search config:', searchConfig);

    fetch('/api/files/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        baseProfile: { id: 'baseProfileId', ...importedData[0] }, // Assuming first row is base profile
        compareProfiles: importedData.slice(1).map((profile, index) => ({ id: `profile-${index}`, ...profile })), // Assuming rest are compare profiles
        matchingRules: searchConfig.matchingRules,
        weights: searchConfig.weights,
      }),
    })
    .then(response => response.json())
    .then(data => {
      console.log('Search results:', data);
      setSearchResults(data);
    })
    .catch(error => {
      console.error('Search error:', error);
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Profile Matching Application</h1>
        <FileImport onFileImport={handleFileImport} />
        {importedData && (
          <SearchConfig
            importedData={importedData}
            onSearch={handleSearch}
          />
        )}
        <ResultsDashboard searchResults={searchResults} />
        <SavedSearches />
      </header>
    </div>
  );
}

export default App;
