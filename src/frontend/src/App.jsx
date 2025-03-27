import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'; // Added Link
import FileImport from './components/FileImport';
import SearchBuilder from './components/SearchBuilder';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSearches from './components/SavedSearches';
import DataOverview from './components/DataOverview';
import DataAnalysisPage from './components/ResultsDashboard/DataAnalysisPage'; // Import DataAnalysisPage
import { ArrowLeftIcon, ChatBubbleLeftRightIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline'; // Import icons, Added Sun/Moon

function App() {
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [darkMode, setDarkMode] = useState(prefersDarkMode);
  const [importedData, setImportedData] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [datasetId, setDatasetId] = useState(null); // Keep track of the uploaded dataset filename/ID

  // State for controlling the view (dashboard vs analysis)
  const [isAnalysisViewOpen, setIsAnalysisViewOpen] = useState(false);
  // State to manage the *rendered* view during transition - used for applying transition classes
  const [renderedView, setRenderedView] = useState('dashboard');

  // Hoisted state for analysis chat messages
  const [analysisMessages, setAnalysisMessages] = useState([]);

  useEffect(() => {
    const bodyClassList = document.body.classList;
    if (darkMode) {
      bodyClassList.add('dark');
    } else {
      bodyClassList.remove('dark');
    }
    // Apply base body styles for better dark mode background
    document.body.style.backgroundColor = darkMode ? 'rgb(17 24 39)' : 'rgb(249 250 251)'; // gray-900 : gray-50
    document.body.style.color = darkMode ? 'rgb(243 244 246)' : 'rgb(17 24 39)'; // gray-100 : gray-900
    document.body.style.transition = 'background-color 0.3s ease-in-out, color 0.3s ease-in-out';

    return () => {
        bodyClassList.remove('dark');
        // Reset body styles on cleanup if needed
        document.body.style.backgroundColor = '';
        document.body.style.color = '';
    }
  }, [darkMode]);

  // Update renderedView based on isAnalysisViewOpen - This controls the CSS classes
  useEffect(() => {
    setRenderedView(isAnalysisViewOpen ? 'analysis' : 'dashboard');
  }, [isAnalysisViewOpen]);


  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleFileImport = (data, fileName) => {
    console.log(`App: File imported - ${fileName}`, data);
    setImportedData(data);
    setDatasetId(fileName);
    setSearchResults(null);
    setSearchCriteria(null);
    setIsAnalysisViewOpen(false); // Switch back to dashboard on new upload
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
    }
  };

  const closeAnalysisView = () => {
    setIsAnalysisViewOpen(false);
  };


  // Common button classes using solid indigo
  const commonButtonClasses = "w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900";
  const disabledButtonClasses = "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-70"; // Use distinct gray for disabled
  const activeButtonClasses = "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800";


  return (
    <Router>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`w-64 p-4 space-y-6 flex flex-col bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-lg h-screen sticky top-0 z-10 transition-colors duration-300 ease-in-out`}>
           <h1 className="text-xl font-bold text-gray-800 dark:text-white pt-4 pb-2 px-2">Profile Matching</h1>
           <div className="flex-grow space-y-4">
             <FileImport onFileImport={handleFileImport} />
             <SavedSearches />

             {/* LLM Analysis Button */}
             <button
               onClick={openAnalysisView}
               disabled={!datasetId}
               className={`${commonButtonClasses} ${!datasetId ? disabledButtonClasses : activeButtonClasses}`}
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

        {/* Main Content Area with Transition Wrapper */}
        {/* Add 'relative' and 'overflow-hidden' to allow absolute positioning of children for transitions */}
        <main className="flex-1 p-6 overflow-hidden max-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-800 dark:to-gray-950 relative">
            {/* Wrapper for Dashboard View - Apply transition classes */}
            <div
                className={`absolute inset-6 transition-opacity duration-300 ease-in-out overflow-y-auto ${ // Use inset-6 to match main padding
                    renderedView === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
            >
                {importedData && <DataOverview importedData={importedData} />}
                {importedData && (
                    <SearchBuilder
                        importedData={importedData}
                        onSearch={handleSearch}
                    />
                )}
                {importedData && <div className="mt-6" />}
                <Routes>
                    <Route path="/" element={
                        <ResultsDashboard
                            searchResults={searchResults}
                            searchCriteria={searchCriteria}
                            importedData={importedData}
                            isSearching={isSearching}
                        />
                    } />
                </Routes>
            </div>

            {/* Wrapper for Analysis View - Apply transition classes */}
            <div
                className={`absolute inset-6 transition-opacity duration-300 ease-in-out ${ // Use inset-6 to match main padding
                    renderedView === 'analysis' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                 }`}
            >
                 {/* Conditionally render only when datasetId exists, or optionally keep mounted but hidden */}
                 {datasetId && (
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
