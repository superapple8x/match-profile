const express = require('express');
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware'); // Import the auth middleware
const { body, param, validationResult } = require('express-validator'); // Import validation functions
const logger = require('../config/logger'); // Import logger

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(authMiddleware);

// --- Validation Middleware ---
// Middleware to handle validation errors from express-validator
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors
    logger.warn('Validation failed for request', { url: req.originalUrl, userId: req.user?.id, errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

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
    logger.error(`Error fetching saved sessions`, { userId, error: err });
    res.status(500).json({ message: 'Error fetching saved sessions.' });
  }
});

// --- POST /api/sessions - Save a new session ---
// Define validation rules
const saveSessionValidationRules = [
  body('sessionName', 'Session name is required').notEmpty().trim().escape(),
  body('datasetId', 'Dataset ID is required').notEmpty(), // Add .isInt() if it should be numeric
  body('searchCriteria').optional({ nullable: true }).isObject().withMessage('searchCriteria must be an object or null'),
  body('analysisQuery').optional({ nullable: true }).isString().trim().escape(),
  body('analysisMessages').optional({ nullable: true }).isArray().withMessage('analysisMessages must be an array or null')
];

router.post('/', saveSessionValidationRules, validateRequest, async (req, res) => {
  const userId = req.user.id;
  // Use validated data
  const {
    sessionName,
    searchCriteria,
    analysisQuery,
    analysisMessages,
    datasetId
  } = req.body;

  // Old validation removed

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
   logger.info(`Session saved`, { userId, sessionId: result.rows[0].id, sessionName });
   res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error(`Error saving session '${sessionName}'`, { userId, error: err });
    res.status(500).json({ message: 'Error saving session.' });
  }
});

// --- GET /api/sessions/:id - Load a specific session ---
// Define validation rules
const sessionIdValidationRule = [
  param('id', 'Session ID must be a positive integer').isInt({ min: 1 })
];

router.get('/:id', sessionIdValidationRule, validateRequest, async (req, res) => {
  const userId = req.user.id;
  // Use validated param
  const sessionId = req.params.id;

  // Old validation removed

  try {
    const result = await db.query(
      'SELECT * FROM saved_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      logger.warn(`Attempted to access non-existent or unauthorized session`, { userId, sessionId });
      return res.status(404).json({ message: 'Session not found or access denied.' });
    }

    logger.info(`Session loaded`, { userId, sessionId });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error(`Error loading session`, { userId, sessionId, error: err });
    res.status(500).json({ message: 'Error loading session.' });
  }
});

// --- DELETE /api/sessions/:id - Delete a specific session ---
// Use the same validation rule as GET /:id
router.delete('/:id', sessionIdValidationRule, validateRequest, async (req, res) => {
  const userId = req.user.id;
  // Use validated param
  const sessionId = req.params.id;

  // Old validation removed

  try {
    const result = await db.query(
      'DELETE FROM saved_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, userId]
    );

    if (result.rowCount === 0) {
      // If no rows were deleted, it means the session didn't exist or didn't belong to the user
      logger.warn(`Attempted to delete non-existent or unauthorized session`, { userId, sessionId });
      return res.status(404).json({ message: 'Session not found or access denied.' });
    }

    logger.info(`Session deleted`, { userId, sessionId });
    res.status(204).send(); // No Content success status
  } catch (err) {
    logger.error(`Error deleting session`, { userId, sessionId, error: err });
    res.status(500).json({ message: 'Error deleting session.' });
  }
});

// --- PUT /api/sessions/:id - Update an existing session (Optional - can be added later if needed) ---
// router.put('/:id', async (req, res) => { ... });

module.exports = router;