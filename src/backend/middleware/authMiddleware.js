const jwt = require('jsonwebtoken');

// Use the same secret as in auth.js, preferably from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-very-secret-key';

module.exports = function(req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if not token
  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied.' });
  }

  // Check if token is in the correct format 'Bearer <token>'
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Token is not valid (Format Error).' });
  }

  const token = parts[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Add user from payload to request object
    req.user = decoded.user; // Contains { id: user.id, username: user.username }
    if (!req.user || !req.user.id) {
        console.error('Token decoded but user ID missing:', decoded);
        return res.status(401).json({ message: 'Token is not valid (Payload Error).' });
    }
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(401).json({ message: 'Token is not valid.' });
  }
};