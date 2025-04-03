const jwt = require('jsonwebtoken');
const logger = require('../config/logger'); // Import logger

// Use the same secret as in auth.js, preferably from environment variables
let JWT_SECRET = process.env.JWT_SECRET; // Use let to allow reassignment for dev default

// --- Critical Security Check ---
if (!JWT_SECRET) {
  const errorMsg = 'FATAL ERROR: JWT_SECRET environment variable is not set.';
  logger.error(errorMsg + ' (authMiddleware)');
  // In production, prevent the application from starting without a secret
  if (process.env.NODE_ENV === 'production') {
    // Throwing here might be too late if middleware is loaded after auth.js check.
    // Rely on the check in auth.js to prevent startup. Log error here.
    // Consider a centralized config check on startup instead.
  } else {
    logger.warn('JWT_SECRET is not set in authMiddleware. Using a default insecure secret for development ONLY.');
    // Assign the weak default ONLY if not in production and it was missing
    JWT_SECRET = 'your-default-very-secret-key-dev-only';
  }
}
// --- End Security Check ---

module.exports = function(req, res, next) {
  let token = null;

  // 1. Try getting token from Authorization header
  const authHeader = req.header('Authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    } else {
      // Invalid header format
      return res.status(401).json({ message: 'Token is not valid (Format Error).' });
    }
  }

  // 2. If no header token AND it's the stream route, try query parameter
  // Check if the path starts with '/api/notebook/stream/'
  const isStreamRoute = req.originalUrl.startsWith('/api/notebook/stream/');

  if (!token && isStreamRoute && req.query.token) {
    token = req.query.token;
    logger.info(`AuthMiddleware: Using token from query parameter for stream route ${req.originalUrl}`);
  }

  // 3. Check if token was found either way
  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied.' });
  }

  // Token variable now holds the token from either header or query param

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Add user from payload to request object
    req.user = decoded.user; // Contains { id: user.id, username: user.username }
    if (!req.user || !req.user.id) {
        logger.error('Token decoded but user ID missing in payload', { decodedPayload: decoded });
        return res.status(401).json({ message: 'Token is not valid (Payload Error).' });
    }
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    // Log specific JWT errors differently if needed (e.g., TokenExpiredError)
    logger.warn('Token verification failed', { error: err.message, tokenProvided: !!token });
    res.status(401).json({ message: 'Token is not valid or has expired.' }); // Slightly more informative message
  }
};