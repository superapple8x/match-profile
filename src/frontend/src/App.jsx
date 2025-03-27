import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom'; // Removed Routes, Route, Link
import FileImport from './components/FileImport';
import SearchBuilder from './components/SearchBuilder';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSearches from './components/SavedSearches';
import DataOverview from './components/DataOverview';
import DataAnalysisPage from './components/ResultsDashboard/DataAnalysisPage';
import { ArrowLeftIcon, ChatBubbleLeftRightIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';

// Welcome Message Component
function WelcomeMessage() {
  return (
    <div className="flex items-center justify-center h-full text-center px-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-600 dark:text-gray-400 mb-4">
          Upload a File to Begin
        </h2>
        <p className="text-gray-500 dark:text-gray-500">
          Select a dataset using the panel on the left to start searching or analyzing.
        </p>
      </div>
    </div>
  );
}

function App() {
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [darkMode, setDarkMode] = useState(prefersDarkMode);
  const [importedData, setImportedData] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [datasetId, setDatasetId] = useState(null); // Keep track of the uploaded dataset filename/ID
  const [isAnalysisViewOpen, setIsAnalysisViewOpen] = useState(false);
  const [analysisMessages, setAnalysisMessages] = useState([]);

  // State to control the current view: 'welcome', 'dashboard', 'analysis'
  const [currentView, setCurrentView] = useState('welcome');

  // --- Effects ---

  // Dark mode effect
  useEffect(() => {
    const bodyClassList = document.body.classList;
    if (darkMode) {
      bodyClassList.add('dark');
    } else {
      bodyClassList.remove('dark');
    }
    // Use indigo-50 for light mode body background
    document.body.style.backgroundColor = darkMode ? 'rgb(17 24 39)' : '#eef2ff'; // gray-900 : indigo-50
    document.body.style.color = darkMode ? 'rgb(243 244 246)' : 'rgb(17 24 39)'; // gray-100 : gray-900
    document.body.style.transition = 'background-color 0.3s ease-in-out, color 0.3s ease-in-out';

    return () => {
        bodyClassList.remove('dark');
        document.body.style.backgroundColor = '';
        document.body.style.color = '';
    }
  }, [darkMode]);

  // View switching effect
  useEffect(() => {
    if (isAnalysisViewOpen) {
      setCurrentView('analysis');
    } else if (importedData) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('welcome');
    }
  }, [isAnalysisViewOpen, importedData]);


  // --- Handlers ---

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleFileImport = (data, fileName) => {
    console.log(`App: File imported - ${fileName}`, data);
    setImportedData(data);
    setDatasetId(fileName);
    setSearchResults(null);
    setSearchCriteria(null);
    setIsAnalysisViewOpen(false); // Ensure dashboard is shown after upload
    // useEffect will update currentView to 'dashboard'
  };

  const handleSearch = (criteria) => {
    console.log('Search criteria:', criteria);
    setSearchCriteria(criteria);
    setIsSearching(true);
    setSearchResults(null);
    setIsAnalysisViewOpen(false); // Close analysis view when starting a new search

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

    fetch('/api/match', {
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

  const openAnalysisView = () => {
    if (datasetId) {
        setIsAnalysisViewOpen(true);
        // useEffect will update currentView to 'analysis'
    }
  };

  const closeAnalysisView = () => {
    setIsAnalysisViewOpen(false);
    // useEffect will update currentView based on importedData state
  };


  // Common button classes
  const baseButtonClasses = "w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";
  const primaryButtonActiveClasses = "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-900";
  const primaryButtonDisabledClasses = "bg-gray-400 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed opacity-70";


  return (
    <Router>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`w-64 p-4 space-y-6 flex flex-col bg-indigo-50/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-lg h-screen sticky top-0 z-20 transition-colors duration-300 ease-in-out`}> {/* Light: indigo-50/70 */}
           <h1 className="text-xl font-bold text-gray-800 dark:text-white pt-4 pb-2 px-2">Profile Matching</h1>
           <div className="flex-grow space-y-4">
             <FileImport onFileImport={handleFileImport} />
             <SavedSearches />

             {/* LLM Analysis Button */}
             <button
               onClick={openAnalysisView}
               disabled={!datasetId}
               className={`${baseButtonClasses} ${!datasetId ? primaryButtonDisabledClasses : primaryButtonActiveClasses}`}
             >
               <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
               LLM Analysis
             </button>
           </div>

           {/* Dark Mode Toggle at bottom */}
           <div className="mt-auto pb-4">
                <button
                    onClick={toggleDarkMode}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-md shadow-sm transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                    <span className="ml-2">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
           </div>

        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto max-h-screen bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-800 dark:to-gray-950 relative"> {/* Light: indigo gradient */}

          {/* Welcome View */}
          <div className={`absolute inset-6 transition-opacity duration-300 ease-in-out ${currentView === 'welcome' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             <WelcomeMessage />
          </div>

          {/* Dashboard View */}
          <div className={`transition-opacity duration-300 ease-in-out ${currentView === 'dashboard' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Conditionally render dashboard content only when it should be visible */}
            {currentView === 'dashboard' && (
              <>
                <DataOverview importedData={importedData} />
                <SearchBuilder
                  importedData={importedData}
                  onSearch={handleSearch}
                />
                <div className="mt-6" />
                <ResultsDashboard
                  searchResults={searchResults}
                  searchCriteria={searchCriteria}
                  importedData={importedData}
                  isSearching={isSearching}
                />
              </>
            )}
          </div>

          {/* Analysis View */}
           <div className={`absolute inset-6 transition-opacity duration-300 ease-in-out ${currentView === 'analysis' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            {/* Conditionally render analysis content only when it should be visible and datasetId exists */}
            {currentView === 'analysis' && datasetId && (
              <DataAnalysisPage
                datasetId={datasetId}
                messages={analysisMessages}
                setMessages={setAnalysisMessages}
                onCloseAnalysis={closeAnalysisView}
              />
            )}
          </div>

        </main>
      </div>
    </Router>
  );
}

export default App;
