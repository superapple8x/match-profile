import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FileImport from './components/FileImport';
import SearchBuilder from './components/SearchBuilder';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSearches from './components/SavedSearches';
import DataOverview from './components/DataOverview';

function App() {
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [darkMode, setDarkMode] = useState(prefersDarkMode);
  const [importedData, setImportedData] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [datasetId, setDatasetId] = useState(null);

  useEffect(() => {
    const bodyClassList = document.body.classList;
    if (darkMode) {
      bodyClassList.add('dark');
    } else {
      bodyClassList.remove('dark');
    }
    return () => bodyClassList.remove('dark');
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleFileImport = (data, fileName) => {
    console.log(`App: File imported - ${fileName}`, data);
    setImportedData(data);
    setDatasetId(fileName);
    setSearchResults(null);
    setSearchCriteria(null);
  };

  const handleSearch = (criteria) => {
    console.log('Search criteria:', criteria);
    setSearchCriteria(criteria);
    setIsSearching(true);
    setSearchResults(null);

    const baseProfile = { id: 'searchCriteria' };
    const weights = {};
    const matchingRules = {};

    criteria.forEach(criterion => {
      baseProfile[criterion.attribute] = criterion.value;
      weights[criterion.attribute] = criterion.weight || 5;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseProfile,
        compareProfiles: importedData.map((profile, index) => ({ id: `profile-${index}`, ...profile })),
        matchingRules,
        weights,
      }),
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
      console.log('Search results:', data);
      setSearchResults(data);
    })
    .catch(error => {
      console.error('Search error:', error);
      setSearchResults({ error: error.message });
    })
    .finally(() => {
        setIsSearching(false);
    });
  };

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-800 dark:to-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300 ease-in-out">
        {/* Header */}
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow p-4 flex justify-between items-center sticky top-0 z-20 transition-colors duration-300 ease-in-out">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Profile Matching Application</h1>
          <button
            onClick={toggleDarkMode}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 dark:bg-primary-700 dark:hover:bg-primary-800 text-white font-semibold rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            aria-label="Toggle dark mode"
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </header>

        {/* Main Layout (Sidebar + Content) */}
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-64 p-4 space-y-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-lg h-[calc(100vh-64px)] sticky top-[64px] z-10 transition-colors duration-300 ease-in-out">
            <FileImport onFileImport={handleFileImport} />
            <SavedSearches />
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 p-6 overflow-y-auto">
             {/* Conditionally render Data Overview when data is imported */}
             {importedData && <DataOverview importedData={importedData} />}

             {/* SearchBuilder rendered directly when data is imported */}
             {importedData && (
               <SearchBuilder
                 importedData={importedData}
                 onSearch={handleSearch}
               />
             )}

             {/* Add spacing if SearchBuilder was rendered */}
             {importedData && <div className="mt-6" />}

             {/* Routes manage content below */}
             <Routes>
               <Route path="/" element={
                 // ResultsDashboard is rendered on the root path
                 <ResultsDashboard
                   searchResults={searchResults}
                   searchCriteria={searchCriteria}
                   importedData={importedData}
                   isSearching={isSearching}
                   datasetId={datasetId}
                 />
               } />
             </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
