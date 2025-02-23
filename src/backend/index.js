const express = require('express');
const db = require('../config/db');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Profile Matching API is running');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});