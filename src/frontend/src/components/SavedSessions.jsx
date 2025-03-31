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
    // Container matching FileImport style
    <div style={{ border: '3px ridge #FFFF00', padding: '10px', marginBottom: '15px', backgroundColor: '#000080', color: '#FFFFFF' }}>
      <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#FFFF00', fontFamily: 'Impact', textShadow: '1px 1px #FF00FF' }}>Saved Sessions</h4>

      {/* Save Button - Use .button class */}
      <button
        onClick={handleSaveClick}
        disabled={!authToken || !currentAppState?.datasetId || actionLoading === 'save'}
        className="button" // Use the green button style
        style={{ width: '100%', marginBottom: '10px' }}
      >
        {actionLoading === 'save' ? 'Saving...' : 'Save Current Session'}
      </button>

      {/* Error Message */}
      {error && <p style={{ color: '#FF8C00', fontSize: '11px', marginBottom: '10px', fontWeight: 'bold' }}>Error: {error}</p>}

      {/* Session List */}
      {isLoading ? (
        <p style={{ fontStyle: 'italic', color: '#CCCCCC', fontSize: '11px' }}>Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <p style={{ fontSize: '11px', color: '#CCCCCC' }}>No saved sessions found.</p>
      ) : (
        // Use a basic div for the list container
        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #FFFF00', backgroundColor: '#000033', padding: '5px' }}>
          {sessions.map((session) => (
            <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px dotted #FFFF00' }}>
              {/* Details */}
              <div style={{ flexGrow: 1, marginRight: '10px', overflow: 'hidden' }}>
                <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#FFFFFF', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={session.session_name}>
                  {session.session_name}
                </span>
                <span style={{ fontSize: '10px', color: '#AAAAAA' }}>
                  DS: {session.dataset_id?.length > 8 ? session.dataset_id.substring(0, 8) + '...' : session.dataset_id || 'N/A'} | {new Date(session.updated_at).toLocaleDateString()}
                </span>
              </div>
              {/* Actions - Use basic buttons inheriting styles */}
              <div style={{ flexShrink: 0 }}>
                <button
                  onClick={() => handleLoadClick(session.id)}
                  disabled={!!actionLoading}
                  title="Load Session"
                  style={{ fontSize: '10px', padding: '1px 3px', marginRight: '3px', color: '#000000', backgroundColor: '#00FFFF', borderColor: '#00AAAA' }} // Cyan button
                >
                  {actionLoading === `load-${session.id}` ? '...' : 'Load'}
                </button>
                <button
                  onClick={() => handleDeleteClick(session.id)}
                   disabled={!!actionLoading}
                  title="Delete Session"
                  style={{ fontSize: '10px', padding: '1px 3px', color: '#FFFFFF', backgroundColor: '#FF0000', borderColor: '#AA0000' }} // Red button
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

// Simplified PropTypes
SavedSessions.propTypes = {
  authToken: PropTypes.string,
  currentAppState: PropTypes.shape({
    datasetId: PropTypes.string,
    searchCriteria: PropTypes.any,
    analysisQuery: PropTypes.string,
    analysisMessages: PropTypes.array,
  }),
  onLoadSession: PropTypes.func.isRequired,
  handleLogout: PropTypes.func.isRequired,
};

SavedSessions.defaultProps = {
  authToken: null,
  currentAppState: null,
};

export default SavedSessions;