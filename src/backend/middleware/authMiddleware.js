// Removed: const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient'); // Import the Supabase client
const logger = require('../config/logger'); // Import logger

// Removed JWT_SECRET and related logic

module.exports = async function(req, res, next) { // Make the function async
  let token = null;

  // 1. Try getting token from Authorization header
  const authHeader = req.header('Authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    } else {
      // Invalid header format
      logger.warn('AuthMiddleware: Invalid Authorization header format.');
      return res.status(401).json({ message: 'Token is not valid (Format Error).' });
    }
  }

  // 2. If no header token AND it's a stream route, try query parameter
  // Check if the path starts with '/api/notebook/stream/' (Adjust path if needed)
  const isStreamRoute = req.originalUrl.startsWith('/api/notebook/stream/'); // Example path

  if (!token && isStreamRoute && req.query.token) {
    token = req.query.token;
    logger.info(`AuthMiddleware: Using token from query parameter for stream route ${req.originalUrl}`);
  }

  // 3. Check if token was found either way
  if (!token) {
    logger.warn('AuthMiddleware: No token provided.');
    return res.status(401).json({ message: 'No token provided, authorization denied.' });
  }

  // 4. Check if Supabase client is initialized
  if (!supabase) {
      logger.error('AuthMiddleware: Supabase client not initialized.');
      return res.status(503).json({ message: 'Authentication service is unavailable.' }); // 503 Service Unavailable
  }

  // Token variable now holds the token from either header or query param

  try {
    // Verify token using Supabase client
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      // Handle specific Supabase errors if needed
      logger.warn('Supabase token verification failed', { error: error.message, status: error.status });
      // Map Supabase error status codes if possible, default to 401
      const statusCode = error.status && typeof error.status === 'number' ? error.status : 401;
      return res.status(statusCode).json({ message: error.message || 'Token is not valid or has expired.' });
    }

    if (!user) {
        // This case might occur if the token is valid but doesn't correspond to a user
        logger.warn('Supabase token verification succeeded but no user found.');
        return res.status(401).json({ message: 'Token is valid but no user session found.' });
    }

    // Add user from Supabase payload to request object
    // Ensure the structure matches what downstream routes expect
    req.user = {
        id: user.id, // Supabase user ID (UUID)
        email: user.email, // Supabase user email
        // Add other relevant fields from 'user' object if needed by your application
        // e.g., user.app_metadata, user.user_metadata
    };

    logger.debug(`AuthMiddleware: User authenticated: ${req.user.id}`);
    next(); // Proceed to the next middleware or route handler

  } catch (err) {
    // Catch unexpected errors during the process
    logger.error('Unexpected error during Supabase token verification', { error: err });
    res.status(500).json({ message: 'Internal server error during authentication.' });
  }
};