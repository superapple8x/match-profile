import React, { useState, useEffect, useRef, useCallback } from 'react'; // Added useRef, useCallback
import { BrowserRouter as Router } from 'react-router-dom';
import FileImport from './components/FileImport';
import SearchBuilder from './components/SearchBuilder';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSessions from './components/SavedSessions';
import DataOverview from './components/DataOverview';
import DataAnalysisPage from './components/ResultsDashboard/DataAnalysisPage';
import LoginForm from './components/Auth/LoginForm'; // Import Login Form
import RegisterForm from './components/Auth/RegisterForm'; // Import Register Form
import {
  ArrowLeftIcon, ChatBubbleLeftRightIcon, SunIcon, MoonIcon, ArrowRightOnRectangleIcon,
  ChevronDoubleLeftIcon, ChevronDoubleRightIcon, Bars3Icon // Added Bars3Icon for handle
} from '@heroicons/react/24/outline';

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

// Auth View Component (Renders Login or Register)
function AuthView({ onLoginSuccess }) {
    const [view, setView] = useState('login'); // 'login' or 'register'

    const switchToRegister = () => setView('register');
    const switchToLogin = () => setView('login');

    // Apply gradient to the AuthView container as well
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
  const [importedData, setImportedData] = useState(null); // Note: This might need reloading based on datasetId when loading session
  const [searchResults, setSearchResults] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [datasetId, setDatasetId] = useState(null);
  const [isAnalysisViewOpen, setIsAnalysisViewOpen] = useState(false);
  const [analysisMessages, setAnalysisMessages] = useState([]);
  const [analysisQuery, setAnalysisQuery] = useState(''); // Add state for the analysis query itself
  const [currentView, setCurrentView] = useState('welcome');

  // --- Authentication State ---
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('authToken'));
  // ---

  // --- Sidebar State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Add state for collapse/expand
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default width (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null); // Ref for sidebar element
  // ---

  // --- Effects ---

  // Dark mode effect - Only manage dark class and base text color on body
  useEffect(() => {
    const body = document.body;
    const bodyClassList = body.classList;

    // Apply dark class
    if (darkMode) {
      bodyClassList.add('dark');
    } else {
      bodyClassList.remove('dark');
    }
    // Apply base text color to body
    body.style.color = darkMode ? 'rgb(243 244 246)' : 'rgb(17 24 39)'; // gray-100 : gray-900
    // Remove direct background/height/overflow styling from body
    body.style.backgroundColor = ''; // Let Tailwind handle body background via index.css or defaults
    body.style.height = '';
    body.style.overflow = '';
    document.documentElement.style.height = '';
    body.style.transition = 'color 0.3s ease-in-out'; // Only transition color

    // Cleanup function
    return () => {
        bodyClassList.remove('dark');
        body.style.color = '';
    }
  }, [darkMode]);

  // View switching effect (only relevant when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return; // Don't switch views if not logged in

    if (isAnalysisViewOpen) {
      setCurrentView('analysis');
    } else if (datasetId) { // Changed condition: show dashboard if datasetId is set
      setCurrentView('dashboard');
    } else {
      setCurrentView('welcome');
    }
  }, [isAnalysisViewOpen, datasetId, isAuthenticated]); // Changed importedData to datasetId dependency

  // --- Handlers ---

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // --- Sidebar Handlers ---
  const toggleSidebarCollapse = () => {
    const collapsed = !isSidebarCollapsed;
    setIsSidebarCollapsed(collapsed);
    // Optionally set a fixed collapsed width or restore previous width
    if (collapsed) {
        setSidebarWidth(80); // w-20
    } else {
        // Restore a default or last known width (could store last width in state/localStorage)
        setSidebarWidth(256); // Restore default w-64
    }
  };

  // Function to ensure sidebar is expanded
  const ensureSidebarExpanded = () => {
      if (isSidebarCollapsed) {
          setIsSidebarCollapsed(false);
          setSidebarWidth(256); // Or restore previous width if saved
      }
  };

  const startResizing = useCallback((mouseDownEvent) => {
    // Prevent collapsing when starting resize
    if (isSidebarCollapsed) return;
    setIsResizing(true);
  }, [isSidebarCollapsed]);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth = mouseMoveEvent.clientX - sidebarRef.current.getBoundingClientRect().left;
        // Apply constraints (e.g., min 80px (w-20), max 512px (w-128))
        const constrainedWidth = Math.max(80, Math.min(newWidth, 512));
        setSidebarWidth(constrainedWidth);
        // If width goes below a threshold, collapse it
        if (constrainedWidth <= 100 && !isSidebarCollapsed) { // Example threshold
            setIsSidebarCollapsed(true);
        } else if (constrainedWidth > 100 && isSidebarCollapsed) {
            setIsSidebarCollapsed(false);
        }
      }
    },
    [isResizing, isSidebarCollapsed] // Include isSidebarCollapsed
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);
  // ---

  const handleFileImport = (data, fileName) => {
    console.log(`App: File imported - ${fileName}`, data);
    setImportedData(data); // Keep imported data for current session use
    setDatasetId(fileName);
    // Reset other states when a new file is imported
    setSearchResults(null);
    setSearchCriteria(null);
    setIsAnalysisViewOpen(false);
    setAnalysisMessages([]);
    setAnalysisQuery('');
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

    const headers = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    // TODO: Decide if /api/match needs authentication or if it operates only on provided data
    fetch('/api/match', {
      method: 'POST',
      headers: headers,
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
      if (error.message.includes('401') || error.message.includes('403')) {
          handleLogout();
      }
    })
    .finally(() => {
        setIsSearching(false);
    });
  };

  const openAnalysisView = (query = '') => { // Accept optional query when opening
    if (datasetId) {
        setAnalysisQuery(query); // Set the query if provided (e.g., from loaded session)
        setIsAnalysisViewOpen(true);
    }
  };

  const closeAnalysisView = () => {
    setIsAnalysisViewOpen(false);
    // Don't clear analysisMessages here, allow saving session first
  };

  // --- Authentication Handlers ---
  const handleLoginSuccess = (token) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    setIsAuthenticated(true);
    // Reset application state on login
    setCurrentView('welcome');
    setImportedData(null);
    setDatasetId(null);
    setSearchResults(null);
    setSearchCriteria(null);
    setIsAnalysisViewOpen(false);
    setAnalysisMessages([]);
    setAnalysisQuery('');
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setIsAuthenticated(false);
    // Reset application state on logout
    setCurrentView('welcome');
    setImportedData(null);
    setDatasetId(null);
    setSearchResults(null);
    setSearchCriteria(null);
    setIsAnalysisViewOpen(false);
    setAnalysisMessages([]);
    setAnalysisQuery('');
    console.log('User logged out.');
  };
  // ---

  // --- Session Load Handler ---
  const handleLoadSession = (sessionData) => {
      console.log("App: Loading session data", sessionData);

      // TODO: Handle loading the actual dataset file content based on dataset_id
      // This might require fetching the file content or assuming it's already available
      // For now, just set the ID and clear current data if it doesn't match
      if (datasetId !== sessionData.dataset_id) {
          setImportedData(null); // Clear potentially mismatched data
          // Ideally, trigger a fetch/load of the correct dataset here
          console.warn(`Dataset ID mismatch. Loaded session requires '${sessionData.dataset_id}', current is '${datasetId}'. Data may be incorrect until file is re-uploaded/fetched.`);
      }
      setDatasetId(sessionData.dataset_id);

      setSearchCriteria(sessionData.search_criteria || null);
      setAnalysisMessages(sessionData.analysis_messages || []);
      setAnalysisQuery(sessionData.analysis_query || ''); // Load analysis query

      // Reset search results as they aren't saved in the session
      setSearchResults(null);
      setIsSearching(false);

      // Decide which view to show based on loaded data
      if (sessionData.analysis_messages && sessionData.analysis_messages.length > 0) {
          setIsAnalysisViewOpen(true); // Open analysis view if there's history
      } else if (sessionData.dataset_id) {
          setIsAnalysisViewOpen(false); // Ensure analysis is closed if no history
          setCurrentView('dashboard'); // Go to dashboard if only dataset/search criteria loaded
      } else {
          setIsAnalysisViewOpen(false);
          setCurrentView('welcome'); // Fallback to welcome
      }

      alert(`Session "${sessionData.session_name}" loaded.`); // Simple feedback
  };
  // ---

  // --- State object for saving session ---
  const currentAppState = {
      datasetId,
      searchCriteria,
      analysisQuery, // Include the query used for analysis
      analysisMessages,
      // Note: importedData and searchResults are generally not saved directly
  };
  // ---

  // Common button classes
  const baseButtonClasses = "w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";
  const primaryButtonActiveClasses = "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-900";
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
      {/* Apply gradient to this container, ensure it fills viewport height */}
      <div className="flex h-screen relative bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-800 dark:to-gray-950">
        {/* Sidebar */}
        {/* Remove fixed width, apply dynamic width via style, add ref */}
        {/* Explicitly set sidebar background, overriding the parent gradient */}
        <aside
          ref={sidebarRef}
          style={{ width: `${sidebarWidth}px` }} // Apply dynamic width
          // Ensure sidebar doesn't shrink and takes full height
          className={`flex-shrink-0 p-4 flex flex-col bg-indigo-50/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-lg h-full sticky top-0 z-20 transition-all duration-100 ease-linear`} // Changed h-screen to h-full
        >
           {/* Conditionally hide title or show smaller version */}
           <h1 className={`font-bold text-gray-800 dark:text-white pt-4 pb-2 px-2 mb-4 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'text-lg text-center' : 'text-xl'}`}>
             {isSidebarCollapsed ? 'PM' : 'Profile Matching'}
           </h1>
           {/* Make this middle section scrollable and allow it to grow/shrink */}
           {/* Add padding adjustment when collapsed */}
           <div className={`flex-grow space-y-4 overflow-y-auto mb-4 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'overflow-x-hidden px-0' : 'pr-1'}`}>
             {/* Pass isCollapsed prop down */}
             <FileImport onFileImport={handleFileImport} isCollapsed={isSidebarCollapsed} />

             {/* LLM Analysis Button - Moved Up */}
             <button
               onClick={() => openAnalysisView()} // Open without specific query initially
               disabled={!datasetId}
               className={`${baseButtonClasses} ${!datasetId ? primaryButtonDisabledClasses : primaryButtonActiveClasses}`}
               title={isSidebarCollapsed ? "LLM Analysis" : ""} // Add title for collapsed view
             >
               {/* Use consistent h-6 w-6 icon size */}
               <ChatBubbleLeftRightIcon className={`h-6 w-6 ${!isSidebarCollapsed ? 'mr-2' : 'mx-auto'}`} /> {/* Center icon when collapsed */}
               {!isSidebarCollapsed && <span>LLM Analysis</span>} {/* Hide text when collapsed */}
             </button>

             {/* Pass props to SavedSessions */}
             <SavedSessions
                authToken={authToken}
                currentAppState={currentAppState}
                onLoadSession={handleLoadSession}
                isCollapsed={isSidebarCollapsed} // Pass collapsed state down
                // Pass function to expand sidebar
                onRequestExpand={ensureSidebarExpanded}
             />
           </div>

           {/* Bottom Controls: Collapse Toggle, Dark Mode & Logout */}
           <div className="mt-auto pb-4 space-y-2 flex-shrink-0"> {/* Added flex-shrink-0 */}
                {/* Sidebar Collapse Toggle Button */}
                <button
                    onClick={toggleSidebarCollapse}
                    className={`w-full flex items-center justify-center px-4 py-2 rounded-md shadow-sm transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${secondaryButtonClasses}`}
                    aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isSidebarCollapsed ? <ChevronDoubleRightIcon className="h-6 w-6" /> : <ChevronDoubleLeftIcon className="h-6 w-6" />} {/* Changed to h-6 w-6 */}
                    {!isSidebarCollapsed && <span className="ml-2">Collapse</span>} {/* Hide text when collapsed */}
                </button>
                 <button
                     onClick={toggleDarkMode}
                     className={`w-full flex items-center justify-center px-4 py-2 rounded-md shadow-sm transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${secondaryButtonClasses}`}
                     aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                 >
                     {darkMode ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />} {/* Changed to h-6 w-6 */}
                     {!isSidebarCollapsed && <span className="ml-2">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>} {/* Hide text when collapsed */}
                 </button>
                 <button
                     onClick={handleLogout}
                     className={`w-full flex items-center justify-center px-4 py-2 rounded-md shadow-sm transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 bg-red-100 hover:bg-red-200 dark:bg-red-800/80 dark:hover:bg-red-700/80 text-red-700 dark:text-red-100 font-semibold`}
                     aria-label="Logout"
                 >
                    <ArrowRightOnRectangleIcon className={`h-6 w-6 ${!isSidebarCollapsed ? 'mr-2' : 'mx-auto'}`} /> {/* Changed to h-6 w-6 */}
                    {!isSidebarCollapsed && <span>Logout</span>} {/* Hide text when collapsed */}
                 </button>
           </div>
        </aside>

        {/* Draggable Resize Handle */}
        <div
            className="flex-shrink-0 w-2 cursor-col-resize bg-gray-300/50 dark:bg-gray-600/50 hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-colors duration-150 h-full sticky top-0 z-20" // Changed h-screen to h-full
            onMouseDown={startResizing}
            title="Resize Sidebar"
        />

        {/* Main Content Area */}
        {/* Let this area scroll internally, remove background */}
        <main className="flex-1 p-6 overflow-y-auto relative bg-transparent"> {/* Removed gradient/bg, h-screen */}

          {/* Welcome View */}
          <div className={`absolute inset-6 transition-opacity duration-300 ease-in-out ${currentView === 'welcome' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             <WelcomeMessage />
          </div>

          {/* Dashboard View */}
          <div className={`transition-opacity duration-300 ease-in-out ${currentView === 'dashboard' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {currentView === 'dashboard' && datasetId && ( // Ensure datasetId exists
              <>
                {/* Pass searchCriteria to DataOverview if needed */}
                <DataOverview importedData={importedData} searchCriteria={searchCriteria} />
                <SearchBuilder
                  importedData={importedData}
                  onSearch={handleSearch}
                  initialCriteria={searchCriteria} // Pass loaded criteria to SearchBuilder
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
            {currentView === 'analysis' && datasetId && (
              <DataAnalysisPage
                datasetId={datasetId}
                initialQuery={analysisQuery} // Pass loaded query
                messages={analysisMessages}
                setMessages={setAnalysisMessages} // Allow DataAnalysisPage to update messages
                setQuery={setAnalysisQuery} // Allow DataAnalysisPage to update the query state
                onCloseAnalysis={closeAnalysisView}
                authToken={authToken}
              />
            )}
          </div>

        </main>
      </div>
    </Router>
  );
}

export default App;
