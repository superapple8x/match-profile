/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- User table schema
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Saved Sessions table schema
    CREATE TABLE IF NOT EXISTS saved_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to the user
        session_name VARCHAR(255) NOT NULL,
        search_criteria JSONB, -- Store search parameters (from SearchBuilder)
        analysis_query TEXT, -- Store the text query used for LLM analysis
        analysis_messages JSONB, -- Store analysis chat history (user messages and bot responses including logs, code, stats, summary)
        dataset_id VARCHAR(255), -- Reference to the dataset used (e.g., filename or ID)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Function to automatically update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Trigger to update updated_at on row update for saved_sessions
    DO $$ -- Use DO block to avoid error if trigger already exists
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_saved_sessions_updated_at') THEN
            CREATE TRIGGER update_saved_sessions_updated_at
            BEFORE UPDATE ON saved_sessions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END $$;

    -- Dataset Metadata table to track dynamically created dataset tables
    CREATE TABLE IF NOT EXISTS dataset_metadata (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Made nullable for anonymous uploads
        dataset_identifier VARCHAR(255) NOT NULL, -- User-facing identifier (e.g., original filename)
        db_table_name VARCHAR(255) NOT NULL UNIQUE, -- Actual name of the table in the database
        columns_metadata JSONB, -- Store column names and inferred types (e.g., {"col1": "text", "col2": "numeric"})
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        -- Removed UNIQUE (user_id, dataset_identifier) constraint to allow multiple anonymous uploads with same identifier
    );

    -- Apply changes to existing table if necessary (These might be redundant if table is created fresh, but safe to include)
    -- Make user_id nullable for anonymous uploads
    ALTER TABLE dataset_metadata ALTER COLUMN user_id DROP NOT NULL;

    -- Remove the unique constraint that includes user_id
    -- Note: Constraint name might vary. If this fails, find the name using \d dataset_metadata in psql.
    ALTER TABLE dataset_metadata DROP CONSTRAINT IF EXISTS dataset_metadata_user_id_dataset_identifier_key;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Drop dependent objects first
  pgm.sql('DROP TRIGGER IF EXISTS update_saved_sessions_updated_at ON saved_sessions;');
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column();');

  // Drop tables, considering foreign key constraints (drop saved_sessions before users)
  pgm.dropTable('saved_sessions', { ifExists: true });
  pgm.dropTable('dataset_metadata', { ifExists: true });
  pgm.dropTable('users', { ifExists: true, cascade: true }); // Cascade might be needed if other FKs exist, though 'saved_sessions' FK is handled by dropping it first. Using ifExists for safety.
};
