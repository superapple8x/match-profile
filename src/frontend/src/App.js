import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import FileImport from './components/FileImport';
import SearchBuilder from './components/SearchBuilder';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSearches from './components/SavedSearches';
// import AttributeDistributionPage from './components/ResultsDashboard/AttributeDistributionPage'; // No longer needed
import DataAnalysisPage from './components/ResultsDashboard/DataAnalysisPage';


function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [importedData, setImportedData] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState(null);

  // Toggle dark mode class on body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

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
    <Router>
      <div className={`App ${darkMode ? 'dark' : ''}`}>
        <header className="App-header">
          <div className="dark-mode-toggle">
            <button onClick={toggleDarkMode}>
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
          <h1>Profile Matching Application</h1>
        </header>

        <div className="sidebar">
          <FileImport onFileImport={handleFileImport} />
          <SavedSearches />
        </div>

        <Routes>
          <Route path="/" element={
            <div className="main-content">
              {importedData && (
                <SearchBuilder
                  importedData={importedData}
                  onSearch={handleSearch}
                  darkMode={darkMode}
                />
              )}
              <ResultsDashboard 
                searchResults={searchResults} 
                searchCriteria={searchCriteria}
                darkMode={darkMode}
              />
            </div>
          } />
          <Route
            path="/attribute-distribution"
            element={<Navigate to="/data-analysis" replace state={{ matchResults: searchResults?.matches }} />}
          />
          <Route path="/data-analysis" element={<DataAnalysisPage />} />

        </Routes>
      </div>
    </Router>
  );
}

export default App;
