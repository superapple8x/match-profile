import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import FileImport from './components/FileImport';
import SearchBar from './components/SearchBar';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSessions from './components/SavedSessions';
import DataOverview from './components/DataOverview';
import DataAnalysisPage from './components/ResultsDashboard/DataAnalysisPage';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';

// Constants
const DEFAULT_PAGE_SIZE = 10;

// Welcome Message Component (Remains the same simplified version)
function WelcomeMessage() {
  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h2>Upload a File to Begin</h2>
      <p>Select a dataset using the panel on the left to start searching or analyzing.</p>
    </div>
  );
}

// Auth View Component (Rebuilt to match the provided HTML structure)
function AuthView({ onLoginSuccess, switchToAppView }) { // Keep switchToAppView for potential future use, though not in current design
    const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'

    const showTab = (tabName) => {
        setActiveTab(tabName);
    };

    // Get current date/time for the footer
    const getCurrentDateTime = () => {
        const now = new Date();
        // Example format, adjust as needed
        return now.toLocaleString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short'
        });
    };

    return (
        // Mimic the HTML structure using JSX and CSS classes from index.css
        <table className="main-container-table" cellPadding="0" cellSpacing="0">
            <tbody>
                <tr>
                    <td className="header-cell">
                        <h1 className="main-title">Web Portal Access</h1>
                        <span style={{ color: '#FF0000', fontWeight: 'bold' }}>Your Gateway to the Information Superhighway!</span>
                    </td>
                </tr>
                <tr>
                    <td>
                        <table className="tabs-table" cellPadding="0" cellSpacing="0">
                            <tbody>
                                <tr>
                                    <td
                                        id="login-tab-button"
                                        className={`tab-button-cell ${activeTab === 'login' ? 'active' : ''}`}
                                        onClick={() => showTab('login')}
                                    >
                                        &gt;&gt; Member Login &lt;&lt;
                                    </td>
                                    <td
                                        id="register-tab-button"
                                        className={`tab-button-cell ${activeTab === 'register' ? 'active' : ''}`}
                                        onClick={() => showTab('register')}
                                    >
                                       Join the <span className="blink">FUN!</span> Register!
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td className="content-cell">
                        {/* Login Tab Content */}
                        <div id="login-tab" className={`tab-content ${activeTab === 'login' ? 'active' : ''}`}>
                            {/* LoginForm component expects onLoginSuccess and onSwitchToRegister */}
                            <LoginForm
                                onLoginSuccess={onLoginSuccess}
                                onSwitchToRegister={() => showTab('register')} // Use showTab to switch
                            />
                             <hr />
                             <div className="fake-graphic">
                                 ** Site Optimized for Netscape Navigator 4.0+ ** <br />
                                 Best Viewed at 800x600 Resolution
                             </div>
                        </div>

                        {/* Register Tab Content */}
                        <div id="register-tab" className={`tab-content ${activeTab === 'register' ? 'active' : ''}`}>
                             {/* RegisterForm component expects onRegisterSuccess and onSwitchToLogin */}
                             <RegisterForm
                                onRegisterSuccess={() => showTab('login')} // Switch to login on success
                                onSwitchToLogin={() => showTab('login')} // Use showTab to switch
                             />
                            <hr />
                             <div className="fake-graphic">
                                 Your IP: 192.168.1.100 | Hits Today: 00001234 <br />
                                 (c) 1999-2001 MegaWeb Corp.
                             </div>
                        </div>
                    </td>
                </tr>
                 <tr>
                     <td style={{ textAlign: 'center', padding: '5px', fontSize: '10px', color: '#AAAAAA', borderTop: '1px solid #FFFF00' }}>
                         This page was last updated: {getCurrentDateTime()}. Wow!
                     </td>
                 </tr>
            </tbody>
        </table>
    );
}


function App() {
  // Removed dark mode state
  const [searchResults, setSearchResults] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState(null);
  const [searchWeights, setSearchWeights] = useState({});
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
  const [viewMode, setViewMode] = useState('app'); // 'app' or 'auth'

  // --- View Switching Functions ---
  const switchToAuthView = () => setViewMode('auth');
  const switchToAppView = () => setViewMode('app');

  // Removed Sidebar State

  // --- Sorting & Pagination State ---
  const [sortBy, setSortBy] = useState('');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const isInitialSearchTrigger = useRef(false);

  // --- Effects ---

  // Removed Dark mode effect

  // View switching effect (simplified)
  useEffect(() => {
    if (isAnalysisViewOpen) {
      setCurrentView('analysis');
    } else if (datasetId) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('welcome');
    }
  }, [isAnalysisViewOpen, datasetId]);

  // Logout Handler (Simplified)
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
    // Optionally switch to auth view on logout
    // switchToAuthView();
  }, []);


  // --- Search Trigger Function --- (Logic remains similar, headers simplified)
  const triggerSearch = useCallback(async (criteria, weights, page, size, sortCol, sortDir) => {
    if (!datasetId || !criteria || criteria.length === 0) {
        console.log("Search trigger skipped: No dataset ID or criteria provided.");
        setIsSearching(false);
        if (datasetId && (!criteria || criteria.length === 0)) {
            setSearchResults(null);
            setSearchCriteria(null);
        }
        return;
    }

    console.log(`Triggering search: Page=${page}, Size=${size}, Sort=${sortCol}@${sortDir}`, criteria);
    setIsSearching(true);
    setSearchCriteria(criteria);
    setSearchResults(null); // Clear previous results

    const matchingRules = {};
    criteria.forEach(criterion => {
      const attributeName = datasetAttributes.find(a => a.originalName === criterion.attribute)?.originalName || criterion.attribute;
      if (attributeName === 'Age') {
        matchingRules[attributeName] = { type: 'range', tolerance: 5 };
      } else if (['Gender', 'Platform', 'Video Category', 'Debt', 'Owns Property'].includes(attributeName)) {
        matchingRules[attributeName] = { type: 'exact' };
      } else {
        matchingRules[attributeName] = { type: 'partial' };
      }
    });

    const headers = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: size.toString(),
    });
    if (sortCol) {
        // Use original name for sorting as sanitizedName might not exist in simplified attributes
        const sortAttribute = datasetAttributes.find(a => a.originalName === sortCol)?.originalName || sortCol;
        queryParams.append('sortBy', sortAttribute);
        queryParams.append('sortDirection', sortDir);
    }

    try {
        const response = await fetch(`/api/match?${queryParams.toString()}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                datasetId: datasetId,
                criteria: criteria,
                matchingRules,
                weights: weights,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Search results received:', data);
        setSearchResults(data);

    } catch (error) {
        console.error('Search error:', error);
        setSearchResults({ matches: [], pagination: null, error: error.message });
        if (error.message.includes('401') || error.message.includes('403')) {
            handleLogout();
        }
    } finally {
        setIsSearching(false);
        isInitialSearchTrigger.current = false;
    }
  }, [datasetId, authToken, handleLogout, datasetAttributes]);


  // --- Effect for Sorting/Pagination Changes --- (Logic remains same)
  useEffect(() => {
    if (!searchCriteria || isInitialSearchTrigger.current || isSearching) {
        return;
    }
    triggerSearch(searchCriteria, searchWeights, currentPage, pageSize, sortBy, sortDirection);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, sortBy, sortDirection]);


  // --- Handlers ---

  // Removed Dark Mode Toggle
  // Removed Sidebar Handlers

  // File Import Handler (Logic remains same)
  const handleFileImport = (metadata) => {
    console.log(`App: File processed. Metadata:`, metadata);
    setDatasetId(metadata.datasetId);
    // Ensure columnsMetadata is an array, even if empty
    setDatasetAttributes(Array.isArray(metadata.columnsMetadata) ? metadata.columnsMetadata : []);
    setCurrentDatasetName(metadata.originalFileName || '');
    setSearchResults(null);
    setSearchCriteria(null);
    setCurrentPage(1);
    setSortBy('');
    setSortDirection('desc');
    setIsAnalysisViewOpen(false);
    setAnalysisMessages([]);
    setAnalysisQuery('');
  };

  // Initial Search Handler (Logic remains same)
  const handleSearch = (searchData) => {
    const { criteria, weights } = searchData;
    console.log('Initial search triggered with:', { criteria, weights });
    isInitialSearchTrigger.current = true;
    setCurrentPage(1);
    setSearchCriteria(criteria);
    setSearchWeights(weights || {}); // Ensure weights is an object
    triggerSearch(criteria, weights || {}, 1, pageSize, sortBy, sortDirection);
  };

  // Sort Change Handler (Logic remains same)
  const handleSortChange = (newSortBy, newSortDirection) => {
    console.log(`Sort changed: ${newSortBy} ${newSortDirection}`);
    setCurrentPage(1);
    setSortBy(newSortBy);
    setSortDirection(newSortDirection);
  };

  // Page Change Handler (Logic remains same)
  const handlePageChange = (newPage) => {
    console.log(`Page changed: ${newPage}`);
    setCurrentPage(newPage);
  };

  // Analysis View Handlers (Logic remains same)
  const openAnalysisView = (query = '') => {
    if (datasetId) {
        setAnalysisQuery(query);
        setIsAnalysisViewOpen(true);
    }
  };
  const closeAnalysisView = () => setIsAnalysisViewOpen(false);

  // Authentication Handlers (Logic remains same)
  const handleLoginSuccess = (token) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    setIsAuthenticated(true);
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
    switchToAppView();
  };


  // Session Load Handler (Logic remains similar)
  const handleLoadSession = useCallback(async (sessionData) => {
      console.log("App: Loading session data", sessionData);
      const newDatasetId = sessionData.dataset_id;

      setSearchResults(null);
      setIsSearching(false);
      setCurrentPage(1);
      setSortBy('');
      setSortDirection('desc');
      setDatasetId(newDatasetId);

      if (newDatasetId) {
          try {
              console.log(`[handleLoadSession] Fetching metadata for dataset ID: ${newDatasetId}`);
              const metaResponse = await fetch(`/api/datasets/${newDatasetId}/metadata`, {
                  headers: { 'Authorization': `Bearer ${authToken}` }
              });
              if (!metaResponse.ok) throw new Error(`Failed to fetch metadata. Status: ${metaResponse.status}`);
              const metaData = await metaResponse.json();
              // Ensure columnsMetadata is an array
              setDatasetAttributes(Array.isArray(metaData.columnsMetadata) ? metaData.columnsMetadata : []);
              setCurrentDatasetName(metaData.originalFileName || '');
          } catch (error) {
              console.error('Failed to load dataset metadata for session:', error);
              setDatasetAttributes([]);
              setCurrentDatasetName('');
              alert(`Error loading metadata for dataset ID ${newDatasetId}: ${error.message}`);
          }
      } else {
           setDatasetAttributes([]);
           setCurrentDatasetName('');
      }

      setSearchCriteria(sessionData.search_criteria || null);
      setAnalysisMessages(sessionData.analysis_messages || []);
      setAnalysisQuery(sessionData.analysis_query || '');

      if (sessionData.analysis_messages && sessionData.analysis_messages.length > 0) {
          setIsAnalysisViewOpen(true);
      } else if (newDatasetId) {
          setIsAnalysisViewOpen(false);
          setCurrentView('dashboard');
          if (sessionData.search_criteria && sessionData.search_criteria.length > 0) {
              console.log("Triggering search after session load with criteria.");
              isInitialSearchTrigger.current = true;
              // Pass empty weights object as saved sessions don't store weights yet
              triggerSearch(sessionData.search_criteria, {}, 1, pageSize, '', 'desc');
          }
      } else {
          setIsAnalysisViewOpen(false);
          setCurrentView('welcome');
      }

      alert(`Session "${sessionData.session_name}" loaded.`);

  }, [authToken, pageSize, triggerSearch]);

  // State object for saving session (remains the same)
  const currentAppState = {
      datasetId,
      searchCriteria,
      analysisQuery,
      analysisMessages,
  };

  // Removed button class variables

  // --- Render Logic ---

  if (viewMode === 'auth') {
    // Render the new AuthView when in 'auth' mode
    return (
      <Router>
        <AuthView
          onLoginSuccess={handleLoginSuccess}
          switchToAppView={switchToAppView}
        />
      </Router>
    );
  }

  // Main App Layout (using basic table for layout - apply new styles)
  // Apply the main container table style here, mimicking the AuthView structure
  return (
    <Router>
      <table
        className="main-container-table" // Apply the main container style
        style={{ width: '95%', maxWidth: '1200px' }} // Adjust width for app view
        cellPadding="0"
        cellSpacing="0"
      >
        <tbody>
          <tr>
            <td className="header-cell"> {/* Re-use header style */}
               <h1 className="main-title">Profile Matching Tool</h1> {/* App title */}
               <span style={{ color: '#FF0000', fontWeight: 'bold' }}>The Future of Data Analysis! (Maybe)</span>
            </td>
          </tr>
          <tr>
            {/* Main content row */}
            <td>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            {/* Sidebar Area (fixed width, apply retro styles) */}
                            <td style={{ width: '220px', verticalAlign: 'top', borderRight: '3px ridge #FFFF00', padding: '10px', backgroundColor: '#000080' }}> {/* Match container style */}
                              {/* Removed H1 from here */}
                              <FileImport
                                onFileImport={handleFileImport}
                                authToken={authToken}
                                handleLogout={handleLogout} // Pass handleLogout
                              />
                              <hr />
                              <button
                                onClick={() => openAnalysisView()}
                                disabled={!datasetId}
                                title="LLM Analysis"
                                style={{ width: '100%', marginBottom: '10px' }} // Basic button styling
                              >
                                LLM Analysis
                              </button>
                              <hr />

                              {isAuthenticated && (
                                <SavedSessions
                                   authToken={authToken}
                                   currentAppState={currentAppState}
                                   onLoadSession={handleLoadSession}
                                   handleLogout={handleLogout} // Pass handleLogout
                                />
                              )}

                              {/* Bottom Controls */}
                              <div style={{ marginTop: '20px', borderTop: '1px solid #FFFF00', paddingTop: '10px' }}>
                                 {!isAuthenticated && (
                                     <button onClick={switchToAuthView} style={{ width: '100%', marginBottom: '5px' }}>
                                       Login / Register
                                     </button>
                                 )}
                                 {isAuthenticated && (
                                     <button onClick={handleLogout} style={{ width: '100%', color: 'yellow', backgroundColor: 'red', borderColor: 'darkred' }}>
                                       Logout
                                     </button>
                                 )}
                              </div>
                            </td>

                            {/* Main Content Area (apply retro styles) */}
                            <td className="content-cell" style={{ verticalAlign: 'top' }}> {/* Use content-cell style */}
                              {currentView === 'welcome' && <WelcomeMessage />}

                              {currentView === 'dashboard' && datasetId && (
                                <div>
                                  <DataOverview
                                      datasetAttributes={datasetAttributes}
                                      datasetName={currentDatasetName}
                                      searchCriteria={searchCriteria} // Pass criteria for display if needed
                                      datasetId={datasetId}
                                      authToken={authToken}
                                      handleLogout={handleLogout} // Pass handleLogout
                                  />
                                <hr />
                                <SearchBar
                                  datasetAttributes={datasetAttributes} // Pass the full array of objects
                                  onSearch={handleSearch}
                                  initialCriteria={searchCriteria}
                                  // Removed datasetId, authToken, handleLogout as they might not be needed in simplified SearchBar
                                  />
                                   <hr />
                                  <ResultsDashboard
                                    searchResults={searchResults}
                                    searchCriteria={searchCriteria}
                                    searchWeights={searchWeights}
                                    datasetAttributes={datasetAttributes}
                                    isSearching={isSearching}
                                    sortBy={sortBy}
                                    sortDirection={sortDirection}
                                    onSortChange={handleSortChange}
                                    currentPage={currentPage}
                                    pageSize={pageSize}
                                    paginationData={searchResults?.pagination}
                                    onPageChange={handlePageChange}
                                  />
                                </div>
                              )}

                              {currentView === 'analysis' && datasetId && (
                                <DataAnalysisPage
                                  datasetId={datasetId}
                                  // Removed initialQuery, setQuery as they might be handled internally now
                                  messages={analysisMessages}
                                  setMessages={setAnalysisMessages}
                                  onCloseAnalysis={closeAnalysisView}
                                  authToken={authToken}
                                  handleLogout={handleLogout}
                                  isAuthenticated={isAuthenticated}
                                  switchToAuthView={switchToAuthView}
                                />
                              )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </td>
          </tr>
           <tr>
               <td style={{ textAlign: 'center', padding: '5px', fontSize: '10px', color: '#AAAAAA', borderTop: '1px solid #FFFF00' }}>
                   Powered by React & Retro Vibes | Last Render: {new Date().toLocaleTimeString()}
               </td>
           </tr>
        </tbody>
      </table>
    </Router>
  );
}

export default App;
