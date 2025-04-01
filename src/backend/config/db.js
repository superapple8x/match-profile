const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres', // Use environment variables or defaults
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'profile_matching',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

// Schema initialization is now handled by migrations (node-pg-migrate)
// See migrations/ directory and package.json scripts (db:migrate:*)

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // Export the pool itself if needed elsewhere
};