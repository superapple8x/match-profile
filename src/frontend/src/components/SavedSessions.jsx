import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import { FolderPlusIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, BookmarkSquareIcon } from '@heroicons/react/24/outline'; // Added BookmarkSquareIcon

// Simple Modal Component (can be extracted later)
// Add PropTypes for the modal as well for completeness
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


// Accept isCollapsed, onRequestExpand, and handleLogout props
function SavedSessions({ authToken, currentAppState, onLoadSession, isCollapsed, onRequestExpand, handleLogout }) { // Added handleLogout
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
      // Don't show loading indicator if collapsed, fetch in background
      if (!isCollapsed) setIsLoading(true);
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
        // Check for specific token errors (401 or 403)
        const isTokenError = err.message.includes('401') || err.message.includes('403') || err.message.toLowerCase().includes('token is not valid');

        if (isTokenError) {
            // Don't show a persistent error message for invalid tokens
            setError(''); // Clear local error state
            console.warn('Session fetch failed due to invalid/expired token.');
            if (handleLogout) handleLogout(); // Trigger logout
        } else if (!isCollapsed) {
            // Show other errors only if the sidebar is expanded
            setError(err.message); // Show other errors
        }
      } finally {
        if (!isCollapsed) setIsLoading(false);
      }
    };

    fetchSessions();
  }, [authToken, isCollapsed]); // Re-fetch if auth token changes or sidebar expands

  // --- Action Handlers ---

  const handleSaveClick = () => {
    // If collapsed, request expansion first
    if (isCollapsed && onRequestExpand) {
        onRequestExpand();
        // After requesting expansion, proceed to check dataset and show modal
        // Use a small timeout to allow the sidebar animation to start,
        // preventing potential layout shifts affecting the modal immediately.
        setTimeout(() => {
            if (!currentAppState || !currentAppState.datasetId) {
                // Show alert even if sidebar was just expanded
                alert("Please upload a dataset before saving a session.");
                return;
            }
            setNewSessionName(`Session ${new Date().toLocaleString()}`); // Default name
            setShowSaveModal(true);
        }, 50); // Small delay (50ms)
        return; // Don't execute the logic below if we just expanded
    }

    // If already expanded, proceed directly
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
        // Check for 401/403 or token validity messages
        const isTokenError = err.message.includes('401') || err.message.includes('403') || err.message.toLowerCase().includes('token is not valid');
        if (isTokenError) {
            setError(''); // Clear local error
            console.warn('Session save failed due to invalid/expired token.');
            if (handleLogout) handleLogout(); // Trigger logout
        } else {
            setError(`Save failed: ${err.message}`); // Show other errors
        }
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
          // Check for 401/403 or token validity messages
          const isTokenError = err.message.includes('401') || err.message.includes('403') || err.message.toLowerCase().includes('token is not valid');
          if (isTokenError) {
              setError(''); // Clear local error
              console.warn('Session load failed due to invalid/expired token.');
              if (handleLogout) handleLogout(); // Trigger logout
          } else {
              setError(`Load failed: ${err.message}`); // Show other errors
          }
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
          // Check for 401/403 or token validity messages
          const isTokenError = err.message.includes('401') || err.message.includes('403') || err.message.toLowerCase().includes('token is not valid');
          if (isTokenError) {
              setError(''); // Clear local error
              console.warn('Session delete failed due to invalid/expired token.');
              if (handleLogout) handleLogout(); // Trigger logout
          } else {
              setError(`Delete failed: ${err.message}`); // Show other errors
          }
     } finally {
         setActionLoading(null);
    }
  };

  // --- Render Logic ---

  // Common button style (secondary/grey)
  const secondaryButtonClasses = "w-full flex items-center justify-center px-4 py-2 mb-4 border border-transparent text-sm font-medium rounded-md shadow-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 dark:disabled:opacity-70 dark:focus:ring-offset-gray-800";

  // --- Render Logic ---

  // Common button style (secondary/grey) - Defined once here (Line 211)
  // Removed duplicate declaration below

  // --- Render Collapsed View ---
  if (isCollapsed) {
    // Render only the Save button when collapsed
    return (
      <>
        <button
          onClick={handleSaveClick}
          disabled={!authToken || actionLoading === 'save'} // Simplified disabled logic for collapsed
          // Use secondary style (defined above), ensure centering, adjust padding
          className={`${secondaryButtonClasses} px-2 h-10`} // Use fixed height h-10, remove py
          title="Save Current Session"
        >
          <ArrowUpTrayIcon className="h-6 w-6 mx-auto" /> {/* Center icon */}
        </button>
        {/* Modal is rendered outside the main flow */}
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

  // --- Render Expanded View ---
  return (
    <>
      {/* Container for expanded view */}
      <div className="border rounded-lg shadow-md bg-indigo-100/60 dark:bg-gray-700/60 border-gray-200 dark:border-gray-600/80 p-4 mb-6 transition-all duration-300 ease-in-out">
        {/* Title */}
        <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-100 text-lg">
          Saved Sessions
        </h2>

        {/* Save Button */}
        <button
          onClick={handleSaveClick}
          disabled={!authToken || !currentAppState?.datasetId || actionLoading === 'save'}
          className={`${secondaryButtonClasses}`} // Use secondary style
          title="Save Current Session"
        >
          <ArrowUpTrayIcon className="h-6 w-6 mr-2" />
          {actionLoading === 'save' ? 'Saving...' : 'Save Current Session'}
        </button>

        {/* Error Message */}
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {/* Session List */}
        {isLoading ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">No saved sessions found.</p>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-1"> {/* Scrollable list */}
            {sessions.map((session) => (
              // Add gap between items for better spacing
              <li key={session.id} className="flex justify-between items-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-md shadow-sm gap-2">
                {/* Details section */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={session.session_name}>
                    {session.session_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {/* Shorten dataset display */}
                    DS: {session.dataset_id?.length > 15 ? session.dataset_id.substring(0, 15) + '...' : session.dataset_id || 'N/A'} | {new Date(session.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {/* Action buttons section - prevent shrinking */}
                <div className="flex flex-shrink-0 space-x-1">
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
      </div>

      {/* Save Modal */}
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

// PropTypes for SaveSessionModal
SaveSessionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  sessionName: PropTypes.string.isRequired,
  setSessionName: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};
SaveSessionModal.defaultProps = {
  isLoading: false,
};


// PropTypes for SavedSessions
SavedSessions.propTypes = {
  authToken: PropTypes.string,
  currentAppState: PropTypes.shape({
    datasetId: PropTypes.string,
    searchCriteria: PropTypes.any, // Adjust as needed based on actual structure
    analysisQuery: PropTypes.string,
    analysisMessages: PropTypes.array,
  }),
  onLoadSession: PropTypes.func.isRequired,
  isCollapsed: PropTypes.bool,
  onRequestExpand: PropTypes.func,
  handleLogout: PropTypes.func.isRequired, // Added handleLogout
};

// DefaultProps for SavedSessions
SavedSessions.defaultProps = {
  authToken: null,
  currentAppState: null,
  isCollapsed: false,
  onRequestExpand: () => {}, // Provide a default no-op function
};

export default SavedSessions;