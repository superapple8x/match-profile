// Load environment variables from .env file if present
require('dotenv').config();

module.exports = {
  // Database connection details sourced from environment variables
  // Matches the configuration used in src/backend/config/db.js
  databaseUrl: process.env.DATABASE_URL || {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'profile_matching',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    // Add SSL configuration here if needed in the future, e.g.:
    // ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },

  // Directory where migration files will be stored
  dir: 'migrations', // This will create src/backend/migrations

  // The table name to store migration history
  migrationsTable: 'pgmigrations',

  // Enable verbose logging during migrations
  verbose: true,

  // Ensure transactions are used for migrations
  decamelize: true, // Converts camelCase parameters to snake_case for SQL
  direction: 'up', // Default direction
};