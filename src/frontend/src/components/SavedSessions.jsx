import React, { useState, useEffect } from 'react';
import { FolderPlusIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, BookmarkSquareIcon } from '@heroicons/react/24/outline'; // Added BookmarkSquareIcon

// Simple Modal Component (can be extracted later)
const SaveSessionModal = ({ isOpen, onClose, onSave, sessionName, setSessionName, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Save Current Session</h3>
        <input
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="Enter session name"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white mb-4"
          disabled={isLoading}
        />
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!sessionName || isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800/50"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};


// Accept isCollapsed prop
function SavedSessions({ authToken, currentAppState, onLoadSession, isCollapsed }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // Track loading state for specific actions (save, load, delete)

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  });

  // Fetch sessions on component mount or when authToken changes
  useEffect(() => {
    if (!authToken) {
        setSessions([]); // Clear sessions if logged out
        return;
    };

    const fetchSessions = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/sessions', {
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({})); // Try to get error message
          throw new Error(data.message || `Failed to fetch sessions. Status: ${response.status}`);
        }
        const data = await response.json();
        setSessions(data);
      } catch (err) {
        console.error('Error fetching sessions:', err);
        setError(err.message);
        if (err.message.includes('401')) {
            // Handle token expiry/invalidation - maybe trigger logout in App.jsx?
            setError('Authentication error. Please log in again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [authToken]); // Re-fetch if auth token changes

  // --- Action Handlers ---

  const handleSaveClick = () => {
    if (!currentAppState || !currentAppState.datasetId) {
        alert("Please upload a dataset before saving a session.");
        return;
    }
    setNewSessionName(`Session ${new Date().toLocaleString()}`); // Default name
    setShowSaveModal(true);
  };

  const handleSaveConfirm = async () => {
    if (!newSessionName || !currentAppState || !currentAppState.datasetId) return;

    setActionLoading('save');
    setError('');
    try {
        const payload = {
            sessionName: newSessionName,
            datasetId: currentAppState.datasetId,
            searchCriteria: currentAppState.searchCriteria,
            analysisQuery: currentAppState.analysisQuery, // Assuming this exists in App state
            analysisMessages: currentAppState.analysisMessages, // Assuming this exists in App state
        };
        console.log("Saving session payload:", payload); // Debug log

        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `Failed to save session. Status: ${response.status}`);
        }
        const newSession = await response.json();
        setSessions([newSession, ...sessions]); // Add new session to the top
        setShowSaveModal(false);
        setNewSessionName(''); // Clear name input
    } catch (err) {
        console.error('Error saving session:', err);
        setError(`Save failed: ${err.message}`);
    } finally {
        setActionLoading(null);
    }
  };

  const handleLoadClick = async (sessionId) => {
     if (!onLoadSession) return; // Ensure callback exists

     setActionLoading(`load-${sessionId}`);
     setError('');
     try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            headers: getAuthHeaders(),
        });
         if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `Failed to load session. Status: ${response.status}`);
        }
        const sessionData = await response.json();
        console.log("Loading session data:", sessionData); // Debug log
        onLoadSession(sessionData); // Pass loaded data up to App.jsx

     } catch (err) {
         console.error('Error loading session:', err);
         setError(`Load failed: ${err.message}`);
     } finally {
         setActionLoading(null);
     }
  };

  const handleDeleteClick = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;

    setActionLoading(`delete-${sessionId}`);
    setError('');
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
         if (!response.ok && response.status !== 204) { // 204 No Content is success for DELETE
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `Failed to delete session. Status: ${response.status}`);
        }
        // Remove session from local state
        setSessions(sessions.filter(s => s.id !== sessionId));

    } catch (err) {
         console.error('Error deleting session:', err);
         setError(`Delete failed: ${err.message}`);
    } finally {
        setActionLoading(null);
    }
  };

  // --- Render Logic ---

  // Common button style (secondary/grey)
  const secondaryButtonClasses = "w-full flex items-center justify-center px-4 py-2 mb-4 border border-transparent text-sm font-medium rounded-md shadow-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 dark:disabled:opacity-70 dark:focus:ring-offset-gray-800";

  return (
    <>
      {/* Adjust padding and margin based on collapsed state */}
      <div className={`border rounded-lg shadow-md bg-indigo-100/60 dark:bg-gray-700/60 border-gray-200 dark:border-gray-600/80 transition-all duration-300 ease-in-out ${isCollapsed ? 'p-2 mb-4' : 'p-4 mb-6'}`}>
        {/* Title or Icon */}
        <h2 className={`font-semibold mb-3 text-gray-800 dark:text-gray-100 ${isCollapsed ? 'text-center' : 'text-lg'}`} title={isCollapsed ? "Saved Sessions" : ""}>
          {isCollapsed ? <BookmarkSquareIcon className="h-6 w-6 mx-auto" /> : 'Saved Sessions'}
        </h2>

        {/* Save Button */}
        <button
          onClick={handleSaveClick}
          disabled={!authToken || !currentAppState?.datasetId || actionLoading === 'save'}
          className={`${secondaryButtonClasses} ${isCollapsed ? 'px-2' : ''}`} // Use secondary style, adjust padding when collapsed
          title={isCollapsed ? "Save Current Session" : ""}
        >
          <ArrowUpTrayIcon className={`h-5 w-5 ${!isCollapsed ? 'mr-2' : 'mx-auto'}`} /> {/* Center icon when collapsed */}
          {!isCollapsed && (actionLoading === 'save' ? 'Saving...' : 'Save Current Session')} {/* Hide text when collapsed */}
        </button>

        {/* Error Message - Conditionally render based on collapsed state */}
        {!isCollapsed && error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {/* Session List - Hide when collapsed */}
        {!isCollapsed && (
          <>
            {isLoading ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">Loading sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">No saved sessions found.</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-1"> {/* Scrollable list */}
                {sessions.map((session) => (
                  <li key={session.id} className="flex justify-between items-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-md shadow-sm">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={session.session_name}>
                        {session.session_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Dataset: {session.dataset_id || 'N/A'} | Saved: {new Date(session.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleLoadClick(session.id)}
                        disabled={!!actionLoading}
                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Load Session"
                      >
                        {actionLoading === `load-${session.id}` ? <span className="loading loading-spinner loading-xs"></span> : <ArrowDownTrayIcon className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteClick(session.id)}
                         disabled={!!actionLoading}
                        className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete Session"
                      >
                         {actionLoading === `delete-${session.id}` ? <span className="loading loading-spinner loading-xs"></span> : <TrashIcon className="h-5 w-5" />}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Save Modal - Render outside the main div if needed, or keep here */}
      <SaveSessionModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveConfirm}
        sessionName={newSessionName}
        setSessionName={setNewSessionName}
        isLoading={actionLoading === 'save'}
      />
    </>
  );
}

export default SavedSessions;