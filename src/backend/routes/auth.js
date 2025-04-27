const express = require('express');
// Removed: const bcrypt = require('bcryptjs');
// Removed: const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator'); // Import validation functions
// Removed: const db = require('../config/db'); // Import the database query function
const supabase = require('../config/supabaseClient'); // Import the Supabase client
const logger = require('../config/logger'); // Import logger

const router = express.Router();

// Removed JWT_SECRET and related logic

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

// --- JSDoc Definitions for Swagger (Updated for Supabase) ---

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
 *           description: The user's username (will be used as email for Supabase Auth).
 *           example: johndoe@example.com
 *         password:
 *           type: string
 *           description: The user's password (min 8 characters).
 *           format: password
 *           example: S3cureP@ssw0rd
 *     SupabaseUserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The unique ID assigned by Supabase Auth.
 *           example: 123e4567-e89b-12d3-a456-426614174000
 *         email:
 *           type: string
 *           format: email
 *           description: The email (username) of the registered user.
 *           example: johndoe@example.com
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the user was created in Supabase.
 *     SupabaseAuthToken:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: Supabase JWT access token for authenticated requests.
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *         user:
 *           $ref: '#/components/schemas/SupabaseUserResponse'
 *         expires_in:
 *           type: integer
 *           description: Token expiry time in seconds.
 *           example: 3600
 *         expires_at:
 *           type: integer
 *           description: Token expiry timestamp (Unix epoch).
 *           example: 1616242622
 *         refresh_token:
 *           type: string
 *           description: Supabase refresh token (handle securely if needed).
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

// --- Registration Route (Using Supabase Auth) ---
// Define validation rules for registration
const registerValidationRules = [
  // Using username as email for Supabase Auth
  body('username', 'Username (as email) is required').notEmpty().isEmail().trim().escape(),
  body('password', 'Password is required').notEmpty(),
  body('password', 'Password must be at least 8 characters long').isLength({ min: 8 }) // Supabase default is 6, but keeping 8 for consistency
];

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user via Supabase Auth
 *     tags: [Auth]
 *     description: Creates a new user account using Supabase Auth. Username is used as the email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCredentials'
 *     responses:
 *       '201':
 *         description: User registered successfully (confirmation might be required depending on Supabase settings).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully. Check email for confirmation if enabled.
 *                 user:
 *                   $ref: '#/components/schemas/SupabaseUserResponse'
 *       '400':
 *         description: Validation error or Supabase Auth error (e.g., weak password, user already exists).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error during registration.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', registerValidationRules, validateRequest, async (req, res) => {
  // Validation handled by middleware
  const { username, password } = req.body; // username is used as email

  if (!supabase) {
      logger.error('Supabase client not initialized during registration attempt.');
      return res.status(500).json({ message: 'Authentication service is unavailable.' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: username, // Using username as email
      password: password,
      // options: { // Optional: Add user metadata if needed
      //   data: {
      //     username: username // Store original username if needed separately
      //   }
      // }
    });

    if (error) {
      logger.warn('Supabase registration error:', { error: error.message, username });
      // Map Supabase errors to appropriate HTTP status codes
      let statusCode = 400; // Default to Bad Request
      if (error.message.includes('User already registered')) {
        statusCode = 409; // Conflict
      }
      // Add more specific error handling if needed based on Supabase error codes/messages
      return res.status(statusCode).json({ message: error.message });
    }

    // Handle case where user is returned but session is null (e.g., email confirmation required)
    if (data.user && !data.session) {
        logger.info(`User registered, requires confirmation: ${data.user.email}`);
        return res.status(201).json({
            message: 'User registered successfully. Check email for confirmation if enabled.',
            user: {
                id: data.user.id,
                email: data.user.email,
                created_at: data.user.created_at,
            }
        });
    }

    // Handle case where user and session are returned (e.g., auto-confirmation enabled)
    if (data.user && data.session) {
        logger.info(`User registered and logged in: ${data.user.email}`);
        // Return user info and potentially the session token if needed immediately
        return res.status(201).json({
            message: 'User registered and logged in successfully.',
            user: {
                id: data.user.id,
                email: data.user.email,
                created_at: data.user.created_at,
            },
            token: data.session.access_token, // Send token immediately if auto-confirmed
            expires_in: data.session.expires_in,
            expires_at: data.session.expires_at,
            refresh_token: data.session.refresh_token // Handle securely
        });
    }

    // Fallback for unexpected response structure
    logger.warn('Supabase registration returned unexpected data structure.', { data });
    return res.status(500).json({ message: 'Registration completed but response format was unexpected.' });

  } catch (err) {
    // Catch unexpected errors during the process
    logger.error('Unexpected registration error:', { error: err });
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});

// --- Login Route (Using Supabase Auth) ---
// Define validation rules for login
const loginValidationRules = [
  // Using username as email for Supabase Auth
  body('username', 'Username (as email) is required').notEmpty().isEmail().trim().escape(),
  body('password', 'Password is required').notEmpty()
];

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in a user via Supabase Auth
 *     tags: [Auth]
 *     description: Authenticates a user with username (as email) and password using Supabase Auth, returning session details including JWT upon success.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCredentials'
 *     responses:
 *       '200':
 *         description: Login successful, Supabase session details returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SupabaseAuthToken' # Updated schema
 *       '400':
 *         description: Validation error or Supabase Auth error (e.g., invalid credentials).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error during login.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', loginValidationRules, validateRequest, async (req, res) => {
  // Validation handled by middleware
  const { username, password } = req.body; // username is used as email

  if (!supabase) {
      logger.error('Supabase client not initialized during login attempt.');
      return res.status(500).json({ message: 'Authentication service is unavailable.' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username, // Using username as email
      password: password,
    });

    if (error) {
      logger.warn('Supabase login error:', { error: error.message, username });
      // Supabase typically returns 400 for invalid credentials
      return res.status(400).json({ message: error.message || 'Invalid credentials.' });
    }

    if (!data || !data.session || !data.user) {
        logger.error('Supabase login returned unexpected data structure.', { data });
        return res.status(500).json({ message: 'Login failed due to unexpected response.' });
    }

    logger.info(`User logged in: ${data.user.email}`);
    // Return the relevant session information
    // Renaming access_token to token for potential backward compatibility with frontend if needed
    res.json({
        token: data.session.access_token,
        user: {
            id: data.user.id,
            email: data.user.email,
            created_at: data.user.created_at,
            // Add other user properties from data.user if needed
        },
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        refresh_token: data.session.refresh_token // Handle securely
     });

  } catch (err) {
    // Catch unexpected errors
    logger.error('Unexpected login error:', { error: err });
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

module.exports = router;