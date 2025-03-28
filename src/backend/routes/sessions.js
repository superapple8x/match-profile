const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware'); // Import the auth middleware

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(authMiddleware);

// --- GET /api/sessions - List saved sessions for the logged-in user ---
router.get('/', async (req, res) => {
  const userId = req.user.id; // Get user ID from middleware

  try {
    const result = await db.query(
      'SELECT id, session_name, dataset_id, created_at, updated_at FROM saved_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(`[User ${userId}] Error fetching saved sessions:`, err);
    res.status(500).json({ message: 'Error fetching saved sessions.' });
  }
});

// --- POST /api/sessions - Save a new session ---
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const {
    sessionName,
    searchCriteria, // Should be a JSON object or null
    analysisQuery, // Should be a string or null
    analysisMessages, // Should be a JSON array or null
    datasetId // Should be a string (filename/ID)
  } = req.body;

  // Basic validation
  if (!sessionName || !datasetId) {
    return res.status(400).json({ message: 'Session name and dataset ID are required.' });
  }
  // Validate JSON types (simple check)
  if (searchCriteria && typeof searchCriteria !== 'object') {
      return res.status(400).json({ message: 'searchCriteria must be a JSON object or null.' });
  }
   if (analysisMessages && !Array.isArray(analysisMessages)) {
      return res.status(400).json({ message: 'analysisMessages must be a JSON array or null.' });
  }

   // --- END DEBUGGING --- // Removed previous debug logs

 try {
   // Ensure JSON types are stringified before sending to DB
   const searchCriteriaString = searchCriteria ? JSON.stringify(searchCriteria) : null;
   const analysisMessagesString = analysisMessages ? JSON.stringify(analysisMessages) : null;

   const result = await db.query(
     `INSERT INTO saved_sessions
      (user_id, session_name, search_criteria, analysis_query, analysis_messages, dataset_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, session_name, dataset_id, created_at, updated_at`,
     // Pass the stringified versions to the query
     [userId, sessionName, searchCriteriaString, analysisQuery, analysisMessagesString, datasetId]
   );
   console.log(`[User ${userId}] Session saved: ID ${result.rows[0].id}, Name: ${sessionName}`);
   res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(`[User ${userId}] Error saving session '${sessionName}':`, err);
    res.status(500).json({ message: 'Error saving session.' });
  }
});

// --- GET /api/sessions/:id - Load a specific session ---
router.get('/:id', async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.id;

  if (isNaN(parseInt(sessionId))) {
      return res.status(400).json({ message: 'Invalid session ID format.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM saved_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      console.warn(`[User ${userId}] Attempted to access non-existent or unauthorized session ID: ${sessionId}`);
      return res.status(404).json({ message: 'Session not found or access denied.' });
    }

    console.log(`[User ${userId}] Session loaded: ID ${sessionId}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`[User ${userId}] Error loading session ID ${sessionId}:`, err);
    res.status(500).json({ message: 'Error loading session.' });
  }
});

// --- DELETE /api/sessions/:id - Delete a specific session ---
router.delete('/:id', async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.id;

   if (isNaN(parseInt(sessionId))) {
      return res.status(400).json({ message: 'Invalid session ID format.' });
  }

  try {
    const result = await db.query(
      'DELETE FROM saved_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, userId]
    );

    if (result.rowCount === 0) {
      // If no rows were deleted, it means the session didn't exist or didn't belong to the user
      console.warn(`[User ${userId}] Attempted to delete non-existent or unauthorized session ID: ${sessionId}`);
      return res.status(404).json({ message: 'Session not found or access denied.' });
    }

    console.log(`[User ${userId}] Session deleted: ID ${sessionId}`);
    res.status(204).send(); // No Content success status
  } catch (err) {
    console.error(`[User ${userId}] Error deleting session ID ${sessionId}:`, err);
    res.status(500).json({ message: 'Error deleting session.' });
  }
});

// --- PUT /api/sessions/:id - Update an existing session (Optional - can be added later if needed) ---
// router.put('/:id', async (req, res) => { ... });

module.exports = router;