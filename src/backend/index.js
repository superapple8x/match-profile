const express = require('express');
const cors = require('cors'); // Import the cors middleware
const fs = require('fs');
const db = require('../config/db');
const fileOperationsRoutes = require('./routes/fileOperations');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log request headers
app.use((req, res, next) => {
  console.log('Request received:', req.method, req.url);
  console.log('Request Headers:', req.headers);
  next();
});

// Mount the file operations routes
app.use('/api', fileOperationsRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Profile Matching API is running');
});

// Start server
app.listen(port, () => {
  const logMessage = `Server running on port ${port}\n`;
  fs.appendFile('/home/pepper/match-profile/server.log', logMessage, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
    console.log(logMessage.trim());
  });
});

//const originalConsoleLog = console.log;
const originalConsoleLog = console.log;
console.log = function (...args) {
  originalConsoleLog.apply(console, args);
  const logString = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  fs.appendFile('/home/pepper/match-profile/server.log', logString + '\n', (err) => {
    if (err) {
      originalConsoleLog.error('Error writing to log file:', err);
    }
  });
};

const originalConsoleError = console.error;

console.error = function (...args) {
  originalConsoleError.apply(console, args);
  const logString = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  fs.appendFile('/home/pepper/match-profile/server.log', logString + '\n', (err) => {
    if (err) {
      originalConsoleLog.error('Error writing to log file:', err);
    }
  });
};