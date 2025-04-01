const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator'); // Import validation functions
const db = require('../config/db'); // Import the database query function
const logger = require('../config/logger'); // Import logger

const router = express.Router();

// IMPORTANT: Use a strong, secret key from environment variables in production!
const JWT_SECRET = process.env.JWT_SECRET;
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

// --- Registration Route ---
// Define validation rules for registration
const registerValidationRules = [
  body('username', 'Username is required').notEmpty().trim().escape(),
  body('password', 'Password is required').notEmpty(),
  body('password', 'Password must be at least 8 characters long').isLength({ min: 8 })
];

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
// --- Login Route ---
// Define validation rules for login
const loginValidationRules = [
  body('username', 'Username is required').notEmpty().trim().escape(),
  body('password', 'Password is required').notEmpty()
];

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