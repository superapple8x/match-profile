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
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dataset_identifier VARCHAR(255) NOT NULL, -- User-facing identifier (e.g., original filename)
    db_table_name VARCHAR(255) NOT NULL UNIQUE, -- Actual name of the table in the database
    columns_metadata JSONB, -- Store column names and inferred types (e.g., {"col1": "text", "col2": "numeric"})
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Add a unique constraint for user_id and dataset_identifier to prevent duplicates per user
    UNIQUE (user_id, dataset_identifier)
);


-- Example for associating uploaded files with users (if needed):
/*
CREATE TABLE IF NOT EXISTS user_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR(1024) NOT NULL, -- Path where the file is stored
    original_filename VARCHAR(255) NOT NULL,
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
*/
