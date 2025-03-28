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

// Function to initialize the database schema
const initializeSchema = async () => {
  const schemaPath = path.join(__dirname, '../db/schema.sql'); // Correct path to schema file
  try {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const client = await pool.connect();
    try {
      await client.query(schemaSql);
      console.log('Database schema initialized successfully.');
    } finally {
      client.release(); // Release the client back to the pool
    }
  } catch (err) {
    console.error('Error initializing database schema:', err);
    // Optionally exit the process if schema initialization is critical
    // process.exit(1);
  }
};

// Call initialization function - this will run when the module is first required
initializeSchema();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // Export the pool itself if needed elsewhere
};