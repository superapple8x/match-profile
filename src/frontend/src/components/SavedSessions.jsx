import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Updated SavedSessions component for new retro theme
function SavedSessions({ authToken, currentAppState, onLoadSession, handleLogout }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // Track loading state (save, load-id, delete-id)

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  });

  // Fetch sessions
  useEffect(() => {
    if (!authToken) {
        setSessions([]);
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
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || `Failed to fetch sessions. Status: ${response.status}`);
        }
        const data = await response.json();
        setSessions(data);
      } catch (err) {
        console.error('Error fetching sessions:', err);
        const isTokenError = err.message.includes('401') || err.message.includes('403') || err.message.toLowerCase().includes('token is not valid');
        if (isTokenError) {
            setError('');
            console.warn('Session fetch failed due to invalid/expired token.');
            if (handleLogout) handleLogout();
        } else {
            setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [authToken, handleLogout]);

  // --- Action Handlers ---

  const handleSaveClick = async () => {
    if (!currentAppState || !currentAppState.datasetId) {
        alert("Please upload a dataset before saving a session.");
        return;
    }

    const defaultName = `Session ${new Date().toLocaleString()}`;
    const newSessionName = window.prompt("Enter a name for this session:", defaultName);

    if (!newSessionName) return;

    setActionLoading('save');
    setError('');
    try {
        const payload = {
            sessionName: newSessionName,
            datasetId: currentAppState.datasetId,
            searchCriteria: currentAppState.searchCriteria,
            analysisQuery: currentAppState.analysisQuery,
            analysisMessages: currentAppState.analysisMessages,
            weights: currentAppState.weights, // Include weights
        };
        console.log("Saving session payload:", payload);

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
        setSessions([newSession, ...sessions]);
    } catch (err) {
        console.error('Error saving session:', err);
        const isTokenError = err.message.includes('401') || err.message.includes('403') || err.message.toLowerCase().includes('token is not valid');
        if (isTokenError) {
            setError('');
            console.warn('Session save failed due to invalid/expired token.');
            if (handleLogout) handleLogout();
        } else {
            setError(`Save failed: ${err.message}`);
        }
    } finally {
        setActionLoading(null);
    }
  };

  const handleLoadClick = async (sessionId) => {
     if (!onLoadSession) return;

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
        console.log("Loading session data:", sessionData);
        onLoadSession(sessionData);
      } catch (err) {
          console.error('Error loading session:', err);
          const isTokenError = err.message.includes('401') || err.message.includes('403') || err.message.toLowerCase().includes('token is not valid');
          if (isTokenError) {
              setError('');
              console.warn('Session load failed due to invalid/expired token.');
              if (handleLogout) handleLogout();
          } else {
              setError(`Load failed: ${err.message}`);
          }
      } finally {
          setActionLoading(null);
     }
  };

  const handleDeleteClick = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session FOREVER?!')) return; // More dramatic confirm

    setActionLoading(`delete-${sessionId}`);
    setError('');
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
         if (!response.ok && response.status !== 204) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `Failed to delete session. Status: ${response.status}`);
        }
        setSessions(sessions.filter(s => s.id !== sessionId));
     } catch (err) {
          console.error('Error deleting session:', err);
          const isTokenError = err.message.includes('401') || err.message.includes('403') || err.message.toLowerCase().includes('token is not valid');
          if (isTokenError) {
              setError('');
              console.warn('Session delete failed due to invalid/expired token.');
              if (handleLogout) handleLogout();
          } else {
              setError(`Delete failed: ${err.message}`);
          }
     } finally {
         setActionLoading(null);
    }
  };

  // --- Render Logic ---

  return (
    // Container styles inherited from .sidebar-cell
    <div>
      {/* Apply sidebar-section-title */}
      <div className="sidebar-section-title">Saved Sessions</div>

      {/* Save Button - Apply button classes */}
      <button
        onClick={handleSaveClick}
        disabled={!authToken || !currentAppState?.datasetId || actionLoading === 'save'}
        className="button button-yellow button-full" // Yellow, full width
      >
        {actionLoading === 'save' ? 'Saving...' : 'Save Current Session'}
      </button>

      {/* Error Message - Use sidebar text color */}
      {error && <p style={{ color: '#FF8C00', fontSize: '11px', marginTop: '5px', fontWeight: 'bold' }}>Error: {error}</p>}

      {/* Session List */}
      {isLoading ? (
        <p style={{ fontStyle: 'italic', fontSize: '11px', marginTop: '5px' }}>Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <p style={{ fontSize: '11px', marginTop: '5px' }}>No saved sessions found.</p>
      ) : (
        // List container styling from example
        <div style={{ border: '1px solid #FFFF00', padding: '5px', marginTop: '5px', maxHeight: '150px', overflowY: 'auto', backgroundColor: '#000080' }}>
          {sessions.map((session) => (
            // List item styling from example
            <div key={session.id} style={{ marginBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Details */}
              <div style={{ flexGrow: 1, marginRight: '10px', overflow: 'hidden' }}>
                <span style={{ fontSize: '11px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={session.session_name}>
                  {session.session_name}
                </span>
                <span style={{ fontSize: '10px', color: '#AAAAAA' }}>
                  DS: {session.dataset_id?.length > 8 ? session.dataset_id.substring(0, 8) + '...' : session.dataset_id || 'N/A'} | {new Date(session.updated_at).toLocaleDateString()}
                </span>
              </div>
              {/* Actions - Apply button classes */}
              <div style={{ flexShrink: 0 }}>
                <button
                  onClick={() => handleLoadClick(session.id)}
                  disabled={!!actionLoading}
                  title="Load Session"
                  className="button button-green button-small" // Green, small
                >
                  {actionLoading === `load-${session.id}` ? '...' : 'Load'}
                </button>
                <button
                  onClick={() => handleDeleteClick(session.id)}
                   disabled={!!actionLoading}
                  title="Delete Session"
                  className="button button-red button-small" // Red, small
                >
                   {actionLoading === `delete-${session.id}` ? '...' : 'Del'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Updated PropTypes to include weights
SavedSessions.propTypes = {
  authToken: PropTypes.string,
  currentAppState: PropTypes.shape({
    datasetId: PropTypes.string,
    searchCriteria: PropTypes.any,
    analysisQuery: PropTypes.string,
    analysisMessages: PropTypes.array,
    weights: PropTypes.object, // Added weights
  }),
  onLoadSession: PropTypes.func.isRequired,
  handleLogout: PropTypes.func.isRequired,
};

SavedSessions.defaultProps = {
  authToken: null,
  currentAppState: null,
};

export default SavedSessions;
