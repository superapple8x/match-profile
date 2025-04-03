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

// --- JSDoc Definitions for Swagger ---

/**
 * @swagger
 * tags:
 *   name: Sessions
 *   description: API endpoints for managing saved user sessions (search criteria, analysis history). Requires authentication.
 *
 * components:
 *   schemas:
 *     SessionSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique ID of the saved session.
 *           example: 5
 *         session_name:
 *           type: string
 *           description: User-defined name for the session.
 *           example: "Analysis of Q3 Sales Data"
 *         dataset_id:
 *           type: string # Or integer depending on how datasetId is stored/used
 *           description: Identifier of the dataset used in this session.
 *           example: "42"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the session was first saved.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the session was last updated.
 *
 *     SessionDetail:
 *       allOf: # Inherits properties from SessionSummary
 *         - $ref: '#/components/schemas/SessionSummary'
 *         - type: object
 *           properties:
 *             user_id:
 *               type: integer
 *               description: ID of the user who owns the session.
 *               example: 1
 *             search_criteria:
 *               type: object # Stored as JSONB in DB
 *               nullable: true
 *               description: The search criteria object used for matching. Structure depends on frontend implementation (e.g., array of MatchCriterion).
 *               example: [{ attribute: "City", operator: "=", value: "London" }]
 *             analysis_query:
 *               type: string
 *               nullable: true
 *               description: The last natural language query used for LLM analysis.
 *               example: "Show me the average age per department"
 *             analysis_messages:
 *               type: array # Stored as JSONB in DB
 *               nullable: true
 *               description: History of messages exchanged during LLM analysis (user queries, bot responses). Structure depends on frontend implementation.
 *               items:
 *                 type: object # Example structure, adjust as needed
 *                 properties:
 *                   role:
 *                     type: string
 *                     enum: [user, bot]
 *                   content:
 *                     type: string
 *                   type: # Optional: Differentiate content types (log, code, stats, summary)
 *                     type: string
 *                     enum: [log, code, stats, summary, text]
 *               example: [{ role: "user", content: "Plot sales by region" }, { role: "bot", type: "code", content: "import matplotlib..." }]
 *
 *     SaveSessionRequest:
 *       type: object
 *       required:
 *         - sessionName
 *         - datasetId
 *       properties:
 *         sessionName:
 *           type: string
 *           description: Name for the new session.
 *           example: "Initial exploration - Customer Data"
 *         datasetId:
 *           type: string # Or integer
 *           description: ID of the dataset associated with this session.
 *           example: "42"
 *         searchCriteria:
 *           type: object
 *           nullable: true
 *           description: Search criteria object to save.
 *           example: [{ attribute: "Status", operator: "=", value: "Active" }]
 *         analysisQuery:
 *           type: string
 *           nullable: true
 *           description: LLM analysis query text to save.
 *           example: "What is the distribution of sign-up dates?"
 *         analysisMessages:
 *           type: array
 *           nullable: true
 *           description: LLM analysis message history to save.
 *           items:
 *             type: object
 *           example: [{ role: "user", content: "Analyze churn rate" }]
 *
 *   securitySchemes:
 *      bearerAuth: # Defined here for reference, also in swaggerOptions.js
 *        type: http
 *        scheme: bearer
 *        bearerFormat: JWT
 */

// --- GET /api/sessions - List saved sessions for the logged-in user ---
/**
 * @swagger
 * /sessions:
 *   get:
 *     summary: List saved sessions
 *     tags: [Sessions]
 *     description: Retrieves a list of all sessions saved by the currently authenticated user, ordered by last updated time (descending).
 *     security:
 *       - bearerAuth: [] # Requires JWT Bearer token
 *     responses:
 *       '200':
 *         description: A list of saved sessions.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SessionSummary'
 *       '401':
 *         description: Unauthorized (Missing, invalid, or expired JWT token).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error while fetching sessions.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res) => {
  const userId = req.user.id; // Get user ID from middleware

  logger.info(`[Sessions GET /] Attempting to fetch sessions for user ${userId}`);
  try {
    const sql = 'SELECT id, session_name, dataset_id, created_at, updated_at FROM saved_sessions WHERE user_id = $1 ORDER BY updated_at DESC';
    logger.debug(`[Sessions GET /] Executing SQL: ${sql} with params: [${userId}]`);
    const result = await db.query(sql, [userId]);
    logger.info(`[Sessions GET /] Successfully fetched ${result.rows.length} sessions for user ${userId}`);
    res.json(result.rows);
  } catch (err) {
    // Log the specific database error
    logger.error(`[Sessions GET /] Database error fetching saved sessions for user ${userId}`, {
        errorMessage: err.message,
        errorCode: err.code, // PostgreSQL error code (e.g., 42P01 for undefined_table)
        errorStack: err.stack,
        userId: userId
     });
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

/**
 * @swagger
 * /sessions:
 *   post:
 *     summary: Save a new session
 *     tags: [Sessions]
 *     description: Saves a new session associated with the authenticated user, including search criteria and analysis history.
 *     security:
 *       - bearerAuth: [] # Requires JWT Bearer token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaveSessionRequest'
 *     responses:
 *       '201':
 *         description: Session saved successfully. Returns the details of the newly created session.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionDetail' # Return full detail on create
 *       '400':
 *         description: Validation error (e.g., missing required fields, invalid data types).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized (Missing, invalid, or expired JWT token).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error while saving the session.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
      RETURNING *`, // Return all columns for SessionDetail response
     // Pass the stringified versions to the query
     [userId, sessionName, searchCriteriaString, analysisQuery, analysisMessagesString, datasetId]
   );
   logger.info(`Session saved`, { userId, sessionId: result.rows[0].id, sessionName });
   res.status(201).json(result.rows[0]); // Return the full session detail
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

/**
 * @swagger
 * /sessions/{id}:
 *   get:
 *     summary: Load a specific session
 *     tags: [Sessions]
 *     description: Retrieves the full details of a specific session saved by the authenticated user.
 *     security:
 *       - bearerAuth: [] # Requires JWT Bearer token
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the session to retrieve.
 *         example: 5
 *     responses:
 *       '200':
 *         description: Session details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionDetail'
 *       '400':
 *         description: Validation error (Invalid session ID format).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized (Missing, invalid, or expired JWT token).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Session not found or the user does not have permission to access it.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 message:
 *                   example: Session not found or access denied.
 *       '500':
 *         description: Internal server error while loading the session.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
/**
 * @swagger
 * /sessions/{id}:
 *   delete:
 *     summary: Delete a specific session
 *     tags: [Sessions]
 *     description: Deletes a specific session saved by the authenticated user.
 *     security:
 *       - bearerAuth: [] # Requires JWT Bearer token
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the session to delete.
 *         example: 5
 *     responses:
 *       '204':
 *         description: Session deleted successfully. No content returned.
 *       '400':
 *         description: Validation error (Invalid session ID format).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized (Missing, invalid, or expired JWT token).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Session not found or the user does not have permission to delete it.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 message:
 *                   example: Session not found or access denied.
 *       '500':
 *         description: Internal server error while deleting the session.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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