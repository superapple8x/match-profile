const express = require('express');
const fs = require('fs');
const db = require('../config/db');
const fileOperationsRoutes = require('./routes/fileOperations');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount the file operations routes
app.use('/api/files', fileOperationsRoutes);

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