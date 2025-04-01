const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator'); // Import validation functions
const db = require('../config/db'); // Import the database query function
const logger = require('../config/logger'); // Import logger

const router = express.Router();

// IMPORTANT: Use a strong, secret key from environment variables in production!
let JWT_SECRET = process.env.JWT_SECRET; // Use let to allow reassignment in dev
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Token expiration time

// --- Critical Security Check ---
if (!JWT_SECRET) {
  const errorMsg = 'FATAL ERROR: JWT_SECRET environment variable is not set.';
  logger.error(errorMsg);
  // In production, prevent the application from starting without a secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error(errorMsg);
  } else {
    logger.warn('JWT_SECRET is not set. Using a default insecure secret for development ONLY.');
    // Assign the weak default ONLY if not in production and it was missing
    JWT_SECRET = 'your-default-very-secret-key-dev-only';
  }
}
// --- End Security Check ---

// --- Validation Middleware ---
// Middleware to handle validation errors from express-validator
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors
    logger.warn('Validation failed for request', { url: req.originalUrl, errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// --- JSDoc Definitions for Swagger ---

/**
 * @swagger
 * components:
 *   schemas:
 *     UserCredentials:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: The user's desired username.
 *           example: johndoe
 *         password:
 *           type: string
 *           description: The user's password (min 8 characters).
 *           format: password
 *           example: S3cureP@ssw0rd
 *     UserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The unique ID of the registered user.
 *           example: 1
 *         username:
 *           type: string
 *           description: The username of the registered user.
 *           example: johndoe
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the user was created.
 *     AuthToken:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: JWT token for authenticated requests.
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJ1c2VybmFtZSI6ImpvaG5kb2UifSwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE2MTYyNDI2MjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: A message describing the error.
 *           example: Invalid credentials.
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: field
 *               value:
 *                 type: string
 *                 example: my short pw
 *               msg:
 *                 type: string
 *                 example: Password must be at least 8 characters long
 *               path:
 *                 type: string
 *                 example: password
 *               location:
 *                 type: string
 *                 example: body
 *           description: An array of validation errors (present on status 400).
 */

// --- Registration Route ---
// Define validation rules for registration
const registerValidationRules = [
  body('username', 'Username is required').notEmpty().trim().escape(),
  body('password', 'Password is required').notEmpty(),
  body('password', 'Password must be at least 8 characters long').isLength({ min: 8 })
];

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     description: Creates a new user account with a username and password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCredentials'
 *     responses:
 *       '201':
 *         description: User registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully.
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       '400':
 *         description: Validation error (e.g., missing fields, password too short).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: Username already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 message:
 *                   example: Username already exists.
 *       '500':
 *         description: Internal server error during registration.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 message:
 *                   example: Internal server error during registration.
 */
router.post('/register', registerValidationRules, validateRequest, async (req, res) => {
  // Validation handled by middleware, access validated data via req.body
  const { username, password } = req.body;

  try {
    // Check if username already exists
    const existingUser = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' }); // 409 Conflict
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10); // Generate salt
    const passwordHash = await bcrypt.hash(password, salt); // Hash password

    // Insert new user into the database
    const newUser = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );

    logger.info(`User registered: ${newUser.rows[0].username}`);
    // Don't send password hash back
    res.status(201).json({
        message: 'User registered successfully.',
        user: {
            id: newUser.rows[0].id,
            username: newUser.rows[0].username,
            createdAt: newUser.rows[0].created_at,
        }
    });

  } catch (err) {
    logger.error('Registration error:', { error: err });
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});

// --- Login Route ---
// Define validation rules for login
const loginValidationRules = [
  body('username', 'Username is required').notEmpty().trim().escape(),
  body('password', 'Password is required').notEmpty()
];

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     description: Authenticates a user with username and password, returning a JWT token upon success.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCredentials'
 *     responses:
 *       '200':
 *         description: Login successful, JWT token returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthToken'
 *       '400':
 *         description: Validation error (e.g., missing fields).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Invalid credentials (username or password incorrect).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 message:
 *                   example: Invalid credentials.
 *       '500':
 *         description: Internal server error during login.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 message:
 *                   example: Internal server error during login.
 */
router.post('/login', loginValidationRules, validateRequest, async (req, res) => {
  // Validation handled by middleware
  const { username, password } = req.body;

  try {
    // Find user by username
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' }); // Unauthorized
    }

    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' }); // Unauthorized
    }

    // Passwords match, generate JWT
    const payload = {
      user: {
        id: user.id,
        username: user.username
        // Add other relevant user info if needed, but keep payload small
      }
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
      (err, token) => {
        if (err) {
            logger.error('JWT signing error during login', { error: err, username: user.username });
            // Throwing here will be caught by the outer catch block
            throw err;
        }
        logger.info(`User logged in: ${user.username}`);
        res.json({ token }); // Send token to client
      }
    );

  } catch (err) {
    // Avoid logging sensitive info like username in case of error if possible
    logger.error('Login error:', { error: err });
    // Send a generic error message unless it's a specific known issue
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

module.exports = router;