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

    // Transform criteria array into baseProfile object
    const baseProfile = { id: 'searchCriteria' };
    const weights = {};
    const matchingRules = {};

    criteria.forEach(criterion => {
      baseProfile[criterion.attribute] = criterion.value;
      weights[criterion.attribute] = criterion.weight || 5;
      
      // Set appropriate matching rule based on attribute type
      if (criterion.attribute === 'Age') {
        matchingRules[criterion.attribute] = { type: 'range', tolerance: 5 };
      } else if (['Gender', 'Platform'].includes(criterion.attribute)) {
        matchingRules[criterion.attribute] = { type: 'exact' };
      } else {
        matchingRules[criterion.attribute] = { type: 'partial' };
      }
    });

    fetch('http://localhost:3001/api/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        baseProfile,
        compareProfiles: importedData.map((profile, index) => ({ id: `profile-${index}`, ...profile })),
        matchingRules,
        weights,
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
