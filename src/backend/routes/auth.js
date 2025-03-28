const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // Import the database query function

const router = express.Router();

// IMPORTANT: Use a strong, secret key from environment variables in production!
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-very-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Token expiration time

// --- Registration Route ---
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

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

    console.log(`User registered: ${newUser.rows[0].username}`);
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
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});

// --- Login Route ---
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

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
        if (err) throw err;
        console.log(`User logged in: ${user.username}`);
        res.json({ token }); // Send token to client
      }
    );

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

module.exports = router;