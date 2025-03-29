import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import FileImport from './components/FileImport';
// import SearchBuilder from './components/SearchBuilder'; // Replaced
import SearchBar from './components/SearchBar'; // Use updated SearchBar
import ResultsDashboard from './components/ResultsDashboard';
import SavedSessions from './components/SavedSessions';
import DataOverview from './components/DataOverview';
import DataAnalysisPage from './components/ResultsDashboard/DataAnalysisPage';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import {
  ArrowLeftIcon, ChatBubbleLeftRightIcon, SunIcon, MoonIcon, ArrowRightOnRectangleIcon,
  ChevronDoubleLeftIcon, ChevronDoubleRightIcon, Bars3Icon
} from '@heroicons/react/24/outline';

// Constants
const DEFAULT_PAGE_SIZE = 10; // Default number of results per page

// Welcome Message Component (remains the same)
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

// Auth View Component (remains the same)
function AuthView({ onLoginSuccess }) {
    const [view, setView] = useState('login');
    const switchToRegister = () => setView('register');
    const switchToLogin = () => setView('login');
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-800 dark:to-gray-950">
            {view === 'login' ? (
                <LoginForm onLoginSuccess={onLoginSuccess} onSwitchToRegister={switchToRegister} />
            ) : (
                <RegisterForm onRegisterSuccess={switchToLogin} onSwitchToLogin={switchToLogin} />
            )}
        </div>
    );
}


function App() {
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [darkMode, setDarkMode] = useState(prefersDarkMode);
  const [searchResults, setSearchResults] = useState(null); // Will contain { matches: [], pagination: {}, error: null }
  const [searchCriteria, setSearchCriteria] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [datasetId, setDatasetId] = useState(null);
  const [datasetAttributes, setDatasetAttributes] = useState([]);
  const [currentDatasetName, setCurrentDatasetName] = useState('');
  const [isAnalysisViewOpen, setIsAnalysisViewOpen] = useState(false);
  const [analysisMessages, setAnalysisMessages] = useState([]);
  const [analysisQuery, setAnalysisQuery] = useState('');
  const [currentView, setCurrentView] = useState('welcome');

  // --- Authentication State ---
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('authToken'));

  // --- Sidebar State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);

  // --- Sorting & Pagination State ---
  const [sortBy, setSortBy] = useState(''); // Default: No sort (or maybe '_matchPercentage'?)
  const [sortDirection, setSortDirection] = useState('desc'); // Default direction
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const isInitialSearchTrigger = useRef(false); // Ref to prevent effect trigger on initial search

  // --- Effects ---

  // Dark mode effect (remains the same)
  useEffect(() => {
    const body = document.body;
    const bodyClassList = body.classList;
    if (darkMode) {
      bodyClassList.add('dark');
    } else {
      bodyClassList.remove('dark');
    }
    body.style.color = darkMode ? 'rgb(243 244 246)' : 'rgb(17 24 39)';
    body.style.backgroundColor = '';
    body.style.height = '';
    body.style.overflow = '';
    document.documentElement.style.height = '';
    body.style.transition = 'color 0.3s ease-in-out';
    return () => {
        bodyClassList.remove('dark');
        body.style.color = '';
    }
  }, [darkMode]);

  // View switching effect (remains the same)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isAnalysisViewOpen) {
      setCurrentView('analysis');
    } else if (datasetId) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('welcome');
    }
  }, [isAnalysisViewOpen, datasetId, isAuthenticated]);

  // Use useCallback for handleLogout as it's passed down
  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setIsAuthenticated(false);
    // Reset application state
    setCurrentView('welcome');
    setDatasetId(null);
    setDatasetAttributes([]);
    setCurrentDatasetName('');
    setSearchResults(null);
    setSearchCriteria(null);
    setCurrentPage(1);
    setSortBy('');
    setSortDirection('desc');
    setIsAnalysisViewOpen(false);
    setAnalysisMessages([]);
    setAnalysisQuery('');
    console.log('User logged out.');
  }, []); // No dependencies needed if it only uses setters


  // --- Search Trigger Function ---
  const triggerSearch = useCallback(async (criteria, page, size, sortCol, sortDir) => {
    if (!datasetId || !criteria || criteria.length === 0) {
        console.log("Search trigger skipped: No dataset ID or criteria.");
        setIsSearching(false); // Ensure searching state is off
        // Clear results if criteria are cleared but dataset exists
        if (datasetId && (!criteria || criteria.length === 0)) {
            setSearchResults(null);
            setSearchCriteria(null); // Ensure criteria state is also null
        }
        return;
    }

    console.log(`Triggering search: Page=${page}, Size=${size}, Sort=${sortCol}@${sortDir}`, criteria);
    setIsSearching(true);
    // Keep existing criteria, but clear results for new fetch
    setSearchCriteria(criteria); // Ensure criteria state is set
    // setSearchResults(prev => ({ ...prev, matches: [], error: null })); // Clear matches/error, keep pagination? Maybe clear all. Let's clear all for now.
    setSearchResults(null); // Clear previous results entirely

    const weights = {};
    const matchingRules = {};
    criteria.forEach(criterion => {
      // Use originalName for matching rules and weights if available, otherwise fallback to attribute
      const attributeName = datasetAttributes.find(a => a.originalName === criterion.attribute)?.originalName || criterion.attribute;
      weights[attributeName] = criterion.weight || 5;
      // Define matchingRules (same logic as before, using attributeName)
      if (attributeName === 'Age') {
        matchingRules[attributeName] = { type: 'range', tolerance: 5 };
      } else if (['Gender', 'Platform', 'Video Category'].includes(attributeName)) {
        matchingRules[attributeName] = { type: 'exact' };
      } else {
        // Defaulting others to partial might not be ideal for all cases (e.g., numeric IDs)
        // Consider adding more specific rules or making it configurable
        matchingRules[attributeName] = { type: 'partial' }; // Use attributeName here too
      }
    });


    const headers = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Construct query parameters for pagination and sorting
    const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: size.toString(),
    });
    if (sortCol) {
        // Use sanitized name if available for sorting, otherwise original name
        const sortAttribute = datasetAttributes.find(a => a.originalName === sortCol)?.sanitizedName || sortCol;
        queryParams.append('sortBy', sortAttribute); // Send potentially sanitized name to backend
        queryParams.append('sortDirection', sortDir);
    }

    try {
        const response = await fetch(`/api/match?${queryParams.toString()}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                datasetId: datasetId,
                searchCriteria: criteria, // Send criteria with original names
                matchingRules, // Rules based on original names
                weights, // Weights based on original names
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Try to get error details
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Search results received:', data);
        // Expect data to be { matches: [...], pagination: { currentPage, pageSize, totalItems, totalPages } }
        setSearchResults(data);

    } catch (error) {
        console.error('Search error:', error);
        setSearchResults({ matches: [], pagination: null, error: error.message }); // Set error state
        if (error.message.includes('401') || error.message.includes('403')) {
            handleLogout(); // Use useCallback version
        }
    } finally {
        setIsSearching(false);
        isInitialSearchTrigger.current = false; // Reset flag after search completes/fails
    }
  }, [datasetId, authToken, handleLogout, datasetAttributes]); // Added handleLogout, datasetAttributes


  // --- Effect for Sorting/Pagination Changes ---
  useEffect(() => {
    // Prevent triggering on initial mount or if initial search hasn't happened yet
    // Also prevent if currently searching
    if (!searchCriteria || isInitialSearchTrigger.current || isSearching) {
        return;
    }
    // Trigger search only if criteria exist and it's not the initial search call
    triggerSearch(searchCriteria, currentPage, pageSize, sortBy, sortDirection);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, sortBy, sortDirection]); // Exclude searchCriteria, triggerSearch to avoid loops on criteria/function identity change


  // --- Handlers ---

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Sidebar Handlers (remain the same)
  const toggleSidebarCollapse = () => {
    const collapsed = !isSidebarCollapsed;
    setIsSidebarCollapsed(collapsed);
    setSidebarWidth(collapsed ? 80 : 256);
  };
  const ensureSidebarExpanded = () => {
      if (isSidebarCollapsed) {
          setIsSidebarCollapsed(false);
          setSidebarWidth(256);
      }
  };
  const startResizing = useCallback((mouseDownEvent) => {
    if (isSidebarCollapsed) return;
    setIsResizing(true);
  }, [isSidebarCollapsed]);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((mouseMoveEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth = mouseMoveEvent.clientX - sidebarRef.current.getBoundingClientRect().left;
        const constrainedWidth = Math.max(80, Math.min(newWidth, 512));
        setSidebarWidth(constrainedWidth);
        if (constrainedWidth <= 100 && !isSidebarCollapsed) {
            setIsSidebarCollapsed(true);
        } else if (constrainedWidth > 100 && isSidebarCollapsed) {
            setIsSidebarCollapsed(false);
        }
      }
    }, [isResizing, isSidebarCollapsed]);
  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // File Import Handler - Reset pagination/sort
  const handleFileImport = (metadata) => {
    console.log(`App: File processed. Metadata:`, metadata);
    setDatasetId(metadata.datasetId);
    setDatasetAttributes(metadata.columnsMetadata || []);
    setCurrentDatasetName(metadata.originalFileName || '');
    // Reset search, pagination, and sort state
    setSearchResults(null);
    setSearchCriteria(null);
    setCurrentPage(1);
    setSortBy('');
    setSortDirection('desc');
    setIsAnalysisViewOpen(false);
    setAnalysisMessages([]);
    setAnalysisQuery('');
  };

  // Initial Search Handler (from SearchBar)
  const handleSearch = (criteria) => {
    console.log('Initial search triggered with criteria:', criteria);
    isInitialSearchTrigger.current = true; // Set flag to prevent effect trigger
    setCurrentPage(1); // Reset to page 1 for new search
    // Optionally reset sort on new search, or keep existing sort? Let's reset.
    // setSortBy('');
    // setSortDirection('desc');
    // Trigger the search (pass current sort state, which might be empty or previous)
    triggerSearch(criteria, 1, pageSize, sortBy, sortDirection);
  };

  // Sort Change Handler
  const handleSortChange = (newSortBy, newSortDirection) => {
    console.log(`Sort changed: ${newSortBy} ${newSortDirection}`);
    // Reset to page 1 when sorting changes
    setCurrentPage(1);
    setSortBy(newSortBy);
    setSortDirection(newSortDirection);
    // The useEffect hook will trigger the search (if criteria exist)
  };

  // Page Change Handler
  const handlePageChange = (newPage) => {
    console.log(`Page changed: ${newPage}`);
    setCurrentPage(newPage);
    // The useEffect hook will trigger the search (if criteria exist)
  };

  // Analysis View Handlers (remain the same)
  const openAnalysisView = (query = '') => {
    if (datasetId) {
        setAnalysisQuery(query);
        setIsAnalysisViewOpen(true);
    }
  };
  const closeAnalysisView = () => setIsAnalysisViewOpen(false);

  // Authentication Handlers - Reset pagination/sort
  const handleLoginSuccess = (token) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    setIsAuthenticated(true);
    // Reset application state
    setCurrentView('welcome');
    setDatasetId(null);
    setDatasetAttributes([]);
    setCurrentDatasetName('');
    setSearchResults(null);
    setSearchCriteria(null);
    setCurrentPage(1);
    setSortBy('');
    setSortDirection('desc');
    setIsAnalysisViewOpen(false);
    setAnalysisMessages([]);
    setAnalysisQuery('');
  };


  // Session Load Handler - Reset pagination/sort
  const handleLoadSession = useCallback(async (sessionData) => {
      console.log("App: Loading session data", sessionData);
      const newDatasetId = sessionData.dataset_id;

      // Reset states before loading
      setSearchResults(null);
      setIsSearching(false);
      setCurrentPage(1); // Reset page
      setSortBy('');      // Reset sort
      setSortDirection('desc');

      setDatasetId(newDatasetId); // Set dataset ID first

      // Fetch metadata if dataset ID exists
      if (newDatasetId) {
          try {
              console.log(`[handleLoadSession] Fetching metadata for dataset ID: ${newDatasetId}`);
              const metaResponse = await fetch(`/api/datasets/${newDatasetId}/metadata`, {
                  headers: { 'Authorization': `Bearer ${authToken}` }
              });
              if (!metaResponse.ok) throw new Error(`Failed to fetch metadata. Status: ${metaResponse.status}`);
              const metaData = await metaResponse.json();
              setDatasetAttributes(metaData.columnsMetadata || []);
              setCurrentDatasetName(metaData.originalFileName || '');
          } catch (error) {
              console.error('Failed to load dataset metadata for session:', error);
              setDatasetAttributes([]);
              setCurrentDatasetName('');
              alert(`Error loading metadata for dataset ID ${newDatasetId}: ${error.message}`);
              // Continue loading session criteria/messages even if metadata fails
          }
      } else {
           setDatasetAttributes([]);
           setCurrentDatasetName('');
      }

      // Update other states from session
      // IMPORTANT: Set criteria *after* resetting page/sort, but *before* deciding view
      setSearchCriteria(sessionData.search_criteria || null);
      setAnalysisMessages(sessionData.analysis_messages || []);
      setAnalysisQuery(sessionData.analysis_query || '');

      // Decide which view to show based on loaded data
      if (sessionData.analysis_messages && sessionData.analysis_messages.length > 0) {
          setIsAnalysisViewOpen(true); // This will trigger view change effect
      } else if (newDatasetId) {
          setIsAnalysisViewOpen(false);
          setCurrentView('dashboard'); // Directly set view if no analysis
          // If criteria were loaded, trigger a search for page 1 with default sort
          if (sessionData.search_criteria && sessionData.search_criteria.length > 0) {
              console.log("Triggering search after session load with criteria.");
              isInitialSearchTrigger.current = true; // Prevent effect loop
              triggerSearch(sessionData.search_criteria, 1, pageSize, '', 'desc');
          }
      } else {
          setIsAnalysisViewOpen(false);
          setCurrentView('welcome');
      }

      alert(`Session "${sessionData.session_name}" loaded.`);

  }, [authToken, pageSize, triggerSearch]); // Added pageSize, triggerSearch

  // State object for saving session (remains the same)
  const currentAppState = {
      datasetId,
      searchCriteria,
      analysisQuery,
      analysisMessages,
      // We don't save pagination/sort state currently
  };

  // Common button classes (remain the same)
  const baseButtonClasses = "w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";
  const primaryButtonActiveClasses = "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-indigo-400 dark:focus:ring-offset-gray-900"; // Adjusted dark focus ring
  const primaryButtonDisabledClasses = "bg-gray-400 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed opacity-70";
  const secondaryButtonClasses = "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold";

  // --- Render Logic ---

  if (!isAuthenticated) {
    return (
        <Router>
            <AuthView onLoginSuccess={handleLoginSuccess} />
        </Router>
    );
  }

  return (
    <Router>
      <div className="flex h-screen relative bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-800 dark:to-gray-950">
        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          style={{ width: `${sidebarWidth}px` }}
          className={`flex-shrink-0 p-4 flex flex-col bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-lg h-full sticky top-0 z-20 transition-all duration-100 ease-linear border-r border-gray-200 dark:border-gray-700/50`} // Adjusted background/border
        >
           <h1 className={`font-bold text-gray-800 dark:text-white pt-4 pb-2 px-2 mb-4 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'text-lg text-center' : 'text-xl'}`}>
             {isSidebarCollapsed ? 'PM' : 'Profile Matching'}
           </h1>
           <div className={`flex-grow space-y-4 overflow-y-auto mb-4 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'overflow-x-hidden px-0' : 'pr-1'}`}>
             <FileImport onFileImport={handleFileImport} isCollapsed={isSidebarCollapsed} authToken={authToken} />
             <button
               onClick={() => openAnalysisView()}
               disabled={!datasetId}
               className={`${baseButtonClasses} ${!datasetId ? primaryButtonDisabledClasses : primaryButtonActiveClasses}`}
               title={isSidebarCollapsed ? "LLM Analysis" : ""}
             >
               <ChatBubbleLeftRightIcon className={`h-5 w-5 ${!isSidebarCollapsed ? 'mr-2' : 'mx-auto'}`} /> {/* Adjusted size */}
               {!isSidebarCollapsed && <span>LLM Analysis</span>}
             </button>
             <SavedSessions
                authToken={authToken}
                currentAppState={currentAppState}
                onLoadSession={handleLoadSession}
                isCollapsed={isSidebarCollapsed}
                onRequestExpand={ensureSidebarExpanded}
                handleLogout={handleLogout}
             />
           </div>
           {/* Bottom Controls */}
           <div className="mt-auto pb-4 space-y-2 flex-shrink-0">
                <button
                    onClick={toggleSidebarCollapse}
                    className={`w-full flex items-center justify-center px-4 py-2 rounded-md shadow-sm transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${secondaryButtonClasses}`} // Indigo focus
                    aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isSidebarCollapsed ? <ChevronDoubleRightIcon className="h-5 w-5" /> : <ChevronDoubleLeftIcon className="h-5 w-5" />} {/* Adjusted size */}
                    {!isSidebarCollapsed && <span className="ml-2 text-sm">Collapse</span>} {/* Adjusted size */}
                </button>
                 <button
                     onClick={toggleDarkMode}
                     className={`w-full flex items-center justify-center px-4 py-2 rounded-md shadow-sm transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${secondaryButtonClasses}`} // Indigo focus
                     aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                 >
                     {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />} {/* Adjusted size */}
                     {!isSidebarCollapsed && <span className="ml-2 text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>} {/* Adjusted size */}
                 </button>
                 <button
                     onClick={handleLogout}
                     className={`w-full flex items-center justify-center px-4 py-2 rounded-md shadow-sm transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 bg-red-100 hover:bg-red-200 dark:bg-red-800/80 dark:hover:bg-red-700/80 text-red-700 dark:text-red-100 font-semibold`}
                     aria-label="Logout"
                 >
                    <ArrowRightOnRectangleIcon className={`h-5 w-5 ${!isSidebarCollapsed ? 'mr-2' : 'mx-auto'}`} /> {/* Adjusted size */}
                    {!isSidebarCollapsed && <span className="text-sm">Logout</span>} {/* Adjusted size */}
                 </button>
           </div>
        </aside>

        {/* Draggable Resize Handle */}
        <div
            className="flex-shrink-0 w-1.5 cursor-col-resize bg-gray-300/50 dark:bg-gray-600/50 hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-colors duration-150 h-full sticky top-0 z-20" // Adjusted width
            onMouseDown={startResizing}
            title="Resize Sidebar"
        />

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto relative bg-transparent">
          {/* Suggestions Portal Target */}
          <div id="suggestions-portal" className="relative z-30"></div>

          {/* Welcome View */}
          <div className={`absolute inset-6 transition-opacity duration-300 ease-in-out ${currentView === 'welcome' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             <WelcomeMessage />
          </div>

          {/* Dashboard View */}
          <div className={`transition-opacity duration-300 ease-in-out ${currentView === 'dashboard' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {currentView === 'dashboard' && datasetId && (
              <div className="space-y-6"> {/* Added wrapper for spacing */}
                <DataOverview
                    datasetAttributes={datasetAttributes}
                    datasetName={currentDatasetName}
                    searchCriteria={searchCriteria}
                    datasetId={datasetId}
                    authToken={authToken}
                    darkMode={darkMode}
                    handleLogout={handleLogout}
                />
                {/* Use SearchBar instead of SearchBuilder */}
                <SearchBar
                  datasetAttributes={datasetAttributes.map(attr => attr.originalName)} // Pass only names
                  onSearch={handleSearch} // Initial search trigger
                  initialCriteria={searchCriteria} // Pass current criteria for display/removal
                  datasetId={datasetId}
                  authToken={authToken}
                  handleLogout={handleLogout}
                />
                {/* Pass sorting/pagination state and handlers to ResultsDashboard */}
                <ResultsDashboard
                  searchResults={searchResults} // Contains matches AND pagination data
                  searchCriteria={searchCriteria}
                  datasetAttributes={datasetAttributes} // Pass full attribute objects
                  isSearching={isSearching}
                  // Sorting Props
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                  // Pagination Props
                  currentPage={currentPage}
                  pageSize={pageSize}
                  paginationData={searchResults?.pagination} // Pass pagination data from results
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>

          {/* Analysis View */}
           <div className={`absolute inset-6 transition-opacity duration-300 ease-in-out ${currentView === 'analysis' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            {currentView === 'analysis' && datasetId && (
              <DataAnalysisPage
                datasetId={datasetId}
                initialQuery={analysisQuery}
                messages={analysisMessages}
                setMessages={setAnalysisMessages}
                setQuery={setAnalysisQuery}
                onCloseAnalysis={closeAnalysisView}
                authToken={authToken}
                handleLogout={handleLogout}
              />
            )}
          </div>

        </main>
      </div>
    </Router>
  );
}

export default App;
