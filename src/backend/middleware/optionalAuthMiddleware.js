// src/backend/middleware/optionalAuthMiddleware.js
const jwt = require('jsonwebtoken');

// Use the same secret as in auth.js, preferably from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-very-secret-key';

module.exports = function(req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if no token or incorrect format 'Bearer <token>'
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No valid header found, proceed without setting req.user
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
      // Only 'Bearer' was present, proceed without setting req.user
      return next();
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Add user from payload to request object ONLY if verification succeeds
    if (decoded.user && decoded.user.id) {
        req.user = decoded.user; // Contains { id: user.id, username: user.username }
        console.log('[OptionalAuth] Valid token found, user set:', req.user.id);
    } else {
        // Token decoded but payload is invalid, proceed without setting req.user
        console.warn('[OptionalAuth] Token decoded but user ID missing:', decoded);
    }
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    // Token verification failed (expired, invalid signature, etc.)
    // Proceed without setting req.user, do not send 401
    console.warn('[OptionalAuth] Token verification failed:', err.message);
    next();
  }
};