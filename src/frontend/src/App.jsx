import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import FileImport from './components/FileImport';
import SearchBar from './components/SearchBar';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSessions from './components/SavedSessions';
import DataOverview from './components/DataOverview';
import DataAnalysisPage from './components/ResultsDashboard/DataAnalysisPage';
import AuthPage from './components/Auth/AuthPage'; // Import the new AuthPage

// Constants
const DEFAULT_PAGE_SIZE = 10;

// Welcome Message Component
function WelcomeMessage() {
  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h2>Upload a File to Begin</h2>
      <p>Select a dataset using the panel on the left to start searching or analyzing.</p>
    </div>
  );
} // Add missing closing brace for WelcomeMessage

function App() {
  // State variables remain the same
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
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('authToken'));
  const [viewMode, setViewMode] = useState(isAuthenticated ? 'app' : 'auth'); // Start in auth if not authenticated
  const [sortBy, setSortBy] = useState('');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const isInitialSearchTrigger = useRef(false);

  // --- View Switching Functions ---
  const switchToAuthView = () => setViewMode('auth');
  const switchToAppView = () => setViewMode('app');

  // --- Effects ---
  useEffect(() => {
    if (isAnalysisViewOpen) {
      setCurrentView('analysis');
    } else if (datasetId) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('welcome');
    }
  }, [isAnalysisViewOpen, datasetId]);

  // --- Handlers (remain largely the same) ---
  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setIsAuthenticated(false);
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
    switchToAuthView(); // Switch to auth view on logout
  }, []); // Removed switchToAuthView from dependencies as it's defined outside

  const triggerSearch = useCallback(async (criteria, weights, page, size, sortCol, sortDir) => {
    if (!datasetId || !criteria || criteria.length === 0) {
        console.log("Search trigger skipped: No dataset ID or criteria provided.");
        setIsSearching(false); // Ensure searching state is reset
        if (datasetId && (!criteria || criteria.length === 0)) {
            setSearchResults(null);
            // Do not set searchCriteria to null here, keep the last valid criteria
        }
        return;
    }
    console.log(`Triggering search: Page=${page}, Size=${size}, Sort=${sortCol}@${sortDir}`, criteria);
    setIsSearching(true);
    // Do not set searchCriteria here, it's set by handleSearch or handleLoadSession
    setSearchResults(null); // Clear previous results immediately
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
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }
    const queryParams = new URLSearchParams({ page: page.toString(), pageSize: size.toString() });
    if (sortCol) {
        const sortAttribute = datasetAttributes.find(a => a.originalName === sortCol)?.originalName || sortCol;
        queryParams.append('sortBy', sortAttribute);
        queryParams.append('sortDirection', sortDir);
    }
    try {
        const response = await fetch(`/api/match?${queryParams.toString()}`, {
            method: 'POST', headers: headers, body: JSON.stringify({ datasetId, criteria, matchingRules, weights }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSearchResults(data); // Update results
    } catch (error) {
        console.error('Search error:', error);
        setSearchResults({ matches: [], pagination: null, error: error.message }); // Set error state in results
        if (error.message.includes('401') || error.message.includes('403')) { handleLogout(); }
    } finally {
        setIsSearching(false); // Reset searching state
        isInitialSearchTrigger.current = false; // Reset initial trigger flag
    }
  }, [datasetId, authToken, handleLogout, datasetAttributes]); // Dependencies for triggerSearch

  // Effect for handling pagination and sorting changes
  useEffect(() => {
    // Only run if it's NOT the initial search trigger and not currently searching
    if (!isInitialSearchTrigger.current && !isSearching && searchCriteria) {
        console.log("Effect triggered for page/sort change");
        triggerSearch(searchCriteria, searchWeights, currentPage, pageSize, sortBy, sortDirection);
    }
    // Reset the initial trigger flag after the first run if it was set
    if (isInitialSearchTrigger.current) {
        isInitialSearchTrigger.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, sortBy, sortDirection]); // Correct dependencies: only pagination/sort state

  const handleFileImport = (metadata) => {
    console.log(`App: File processed. Metadata:`, metadata);
    setDatasetId(metadata.datasetId);
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

  const handleSearch = (searchData) => {
    const { criteria, weights } = searchData;
    console.log('Initial search triggered with:', { criteria, weights });
    isInitialSearchTrigger.current = true; // Mark as initial search
    setCurrentPage(1); // Reset page on new search
    setSearchCriteria(criteria); // Set the new criteria
    setSearchWeights(weights || {}); // Set the new weights
    // Trigger search immediately
    triggerSearch(criteria, weights || {}, 1, pageSize, '', 'desc'); // Use default sort initially
  };

  const handleSortChange = (newSortBy, newSortDirection) => {
    console.log(`Sort changed: ${newSortBy} ${newSortDirection}`);
    isInitialSearchTrigger.current = false; // Ensure subsequent triggers are not marked as initial
    setCurrentPage(1); // Reset page on sort change
    setSortBy(newSortBy);
    setSortDirection(newSortDirection);
    // The useEffect hook listening to sortBy/sortDirection will trigger the search
  };

  const handlePageChange = (newPage) => {
    console.log(`Page changed: ${newPage}`);
    isInitialSearchTrigger.current = false; // Ensure subsequent triggers are not marked as initial
    setCurrentPage(newPage);
    // The useEffect hook listening to currentPage will trigger the search
  };

  const openAnalysisView = (query = '') => { if (datasetId) { setAnalysisQuery(query); setIsAnalysisViewOpen(true); } };
  const closeAnalysisView = () => setIsAnalysisViewOpen(false);

  const handleLoginSuccess = (token) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    setIsAuthenticated(true);
    setCurrentView('welcome'); // Reset view after login
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
    setViewMode('app'); // Switch to app view
  };

  const handleLoadSession = useCallback(async (sessionData) => {
      console.log("App: Loading session data", sessionData);
      const newDatasetId = sessionData.dataset_id;
      setSearchResults(null);
      setIsSearching(false);
      setCurrentPage(1); // Reset page
      setSortBy(''); // Reset sort
      setSortDirection('desc'); // Reset sort direction
      setDatasetId(newDatasetId);
      if (newDatasetId) {
          try {
              const metaResponse = await fetch(`/api/datasets/${newDatasetId}/metadata`, { headers: { 'Authorization': `Bearer ${authToken}` } });
              if (!metaResponse.ok) throw new Error(`Failed to fetch metadata. Status: ${metaResponse.status}`);
              const metaData = await metaResponse.json();
              setDatasetAttributes(Array.isArray(metaData.columnsMetadata) ? metaData.columnsMetadata : []);
              setCurrentDatasetName(metaData.originalFileName || '');
          } catch (error) {
              console.error('Failed to load dataset metadata for session:', error);
              setDatasetAttributes([]); setCurrentDatasetName('');
              alert(`Error loading metadata for dataset ID ${newDatasetId}: ${error.message}`);
          }
      } else { setDatasetAttributes([]); setCurrentDatasetName(''); }
      setSearchCriteria(sessionData.search_criteria || null);
      setAnalysisMessages(sessionData.analysis_messages || []);
      setAnalysisQuery(sessionData.analysis_query || '');
      setSearchWeights(sessionData.weights || {}); // Load weights
      if (sessionData.analysis_messages && sessionData.analysis_messages.length > 0) {
          setIsAnalysisViewOpen(true);
      } else if (newDatasetId) {
          setIsAnalysisViewOpen(false);
          setCurrentView('dashboard');
          if (sessionData.search_criteria && sessionData.search_criteria.length > 0) {
              isInitialSearchTrigger.current = true; // Mark as initial load
              // Trigger search with loaded criteria and default pagination/sort
              triggerSearch(sessionData.search_criteria, sessionData.weights || {}, 1, pageSize, '', 'desc');
          }
      } else { setIsAnalysisViewOpen(false); setCurrentView('welcome'); }
      alert(`Session "${sessionData.session_name}" loaded.`);
  }, [authToken, pageSize, triggerSearch]); // Added triggerSearch to dependencies

  const currentAppState = { datasetId, searchCriteria, analysisQuery, analysisMessages, weights: searchWeights }; // Include weights

  // --- Render Logic ---

  if (viewMode === 'auth') {
    return (
      <Router>
        {/* Use the new AuthPage component */}
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </Router>
    );
  }

  return (
    <Router>
      {/* Apply main-container-table class */}
      <table className="main-container-table" cellPadding="0" cellSpacing="0">
        <tbody>
          <tr>
            {/* Use header-cell, main-title, subtitle */}
            <td colSpan="2" className="header-cell">
               <h1 className="main-title">Profile Matching Tool 3000</h1>
               <div className="subtitle">The <span className="blink" style={{ color: '#FF00FF' }}>FUTURE</span> of Data Analysis! (Maybe)</div>
            </td>
          </tr>
          <tr>
            {/* Use sidebar-cell */}
            <td className="sidebar-cell">
              <FileImport
                onFileImport={handleFileImport}
                authToken={authToken}
                handleLogout={handleLogout}
              />
              <hr className="retro-hr cyan" />
              <button
                onClick={() => openAnalysisView()}
                disabled={!datasetId}
                title="LLM Analysis"
                className="button button-cyan button-full"
              >
                <span className="blink" style={{ color: '#FF00FF' }}>*</span> LLM Analysis <span className="blink" style={{ color: '#FF00FF' }}>*</span>
              </button>
              <hr className="retro-hr cyan" />

              {isAuthenticated && (
                <SavedSessions
                   authToken={authToken}
                   currentAppState={currentAppState}
                   onLoadSession={handleLoadSession}
                   handleLogout={handleLogout}
                />
              )}
              {/* Add HR before logout */}
              {isAuthenticated && <hr className="retro-hr cyan" />}

              {/* Bottom Controls */}
              <div style={{ marginTop: '20px' }}>
                 {!isAuthenticated && (
                     <button onClick={switchToAuthView} className="button button-yellow button-full">
                       Login / Register
                     </button>
                 )}
                 {isAuthenticated && (
                     <button onClick={handleLogout} className="button button-red button-full">
                       LOGOUT!
                     </button>
                 )}
              </div>
            </td>

            {/* Use main-content-cell */}
            <td className="main-content-cell">
              {currentView === 'welcome' && <WelcomeMessage />}

              {currentView === 'dashboard' && datasetId && (
                <> {/* Use Fragment to avoid extra div */}
                  <DataOverview
                      datasetAttributes={datasetAttributes}
                      datasetName={currentDatasetName}
                      searchCriteria={searchCriteria}
                      datasetId={datasetId}
                      authToken={authToken}
                      handleLogout={handleLogout}
                  />
                  <hr className="retro-hr magenta" />
                  <SearchBar
                    datasetAttributes={datasetAttributes}
                    onSearch={handleSearch} // Pass handleSearch for initial trigger
                    initialCriteria={searchCriteria}
                    datasetId={datasetId}
                    authToken={authToken}
                    handleLogout={handleLogout}
                  />
                   <hr className="retro-hr magenta" />
                  <ResultsDashboard
                    searchResults={searchResults}
                    searchCriteria={searchCriteria}
                    searchWeights={searchWeights}
                    datasetAttributes={datasetAttributes}
                    isSearching={isSearching}
                    sortBy={sortBy}
                    sortDirection={sortDirection}
                    onSortChange={handleSortChange} // Pass handleSortChange
                    currentPage={currentPage}
                    pageSize={pageSize}
                    paginationData={searchResults?.pagination}
                    onPageChange={handlePageChange} // Pass handlePageChange
                  />
                </>
              )}

              {currentView === 'analysis' && datasetId && (
                <DataAnalysisPage
                  datasetId={datasetId}
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
           {/* Use footer-cell */}
           <tr>
               <td colSpan="2" className="footer-cell">
                   You are visitor number: <span style={{fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#000000', color: '#00FF00', padding: '2px 8px', border: '1px solid #FFFFFF'}}>00133742</span> since 1998! |
                   <a href="#">About</a> | <a href="#">Contact</a> | <a href="#">Help</a> <br/>
                   (c) 1998-2001 Profile Matcher 3000 Corp. All rights reserved. |
                   <font size="1">Best viewed with Netscape Navigator 4.0 or Internet Explorer 5.0 at 1024x768 resolution.</font>
               </td>
           </tr>
        </tbody>
      </table>
    </Router>
  );
}

export default App;
