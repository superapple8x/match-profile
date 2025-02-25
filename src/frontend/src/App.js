import { useState } from 'react';
import FileImport from './components/FileImport';
import SearchBuilder from './components/SearchBuilder';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSearches from './components/SavedSearches';

function App() {
  const [importedData, setImportedData] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState(null);

  const handleFileImport = (data) => {
    setImportedData(data);
  };

  const handleSearch = (criteria) => {
    console.log('Search criteria:', criteria);
    setSearchCriteria(criteria);

    // Implement search logic here
    fetch('http://localhost:3001/api/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        baseProfile: { id: 'baseProfileId', ...importedData[0] }, // Assuming first row is base profile
        compareProfiles: importedData.slice(1).map((profile, index) => ({ id: `profile-${index}`, ...profile })), // Assuming rest are compare profiles
        weights: criteria.weights,
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
          <SearchBuilder
            importedData={importedData}
            onSearch={handleSearch}
            />
        )}
        <ResultsDashboard searchResults={searchResults} searchCriteria={searchCriteria} />
        <SavedSearches />
      </header>
    </div>
  );
}

export default App;
