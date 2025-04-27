-- Saved Sessions table schema
CREATE TABLE IF NOT EXISTS public.saved_sessions (
    id SERIAL PRIMARY KEY,
    -- Changed user_id to UUID and reference auth.users
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_name VARCHAR(255) NOT NULL,
    search_criteria JSONB, -- Store search parameters (from SearchBuilder)
    analysis_query TEXT, -- Store the text query used for LLM analysis
    analysis_messages JSONB, -- Store analysis chat history
    dataset_id VARCHAR(255), -- Reference to the dataset used (e.g., filename or ID)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dataset Metadata table to track dynamically created dataset tables
CREATE TABLE IF NOT EXISTS public.dataset_metadata (
    id SERIAL PRIMARY KEY,
    -- Changed user_id to UUID and reference auth.users, kept nullable
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    dataset_identifier VARCHAR(255) NOT NULL, -- User-facing identifier (e.g., original filename)
    db_table_name VARCHAR(255) NOT NULL UNIQUE, -- Actual name of the table in the database
    columns_metadata JSONB, -- Store column names and inferred types
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on row update for saved_sessions
-- Ensure the trigger references the function in the correct schema (public)
CREATE TRIGGER update_saved_sessions_updated_at
BEFORE UPDATE ON public.saved_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Grant usage on the public schema to postgres and anon roles if needed (Supabase handles this mostly)
-- GRANT USAGE ON SCHEMA public TO postgres;
-- GRANT USAGE ON SCHEMA public TO anon;
-- Grant select/insert/update/delete permissions on tables to relevant roles (e.g., authenticated)
-- Supabase Row Level Security (RLS) is the preferred way to manage fine-grained access.
-- Enable RLS on tables and define policies. Example (Needs refinement based on actual logic):
ALTER TABLE public.saved_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_metadata ENABLE ROW LEVEL SECURITY;

-- Example Policy: Allow users to manage their own sessions
CREATE POLICY "Allow users to manage their own sessions" ON public.saved_sessions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Example Policy: Allow users to manage their own metadata (if user_id is not null)
CREATE POLICY "Allow users to manage their own metadata" ON public.dataset_metadata
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Example Policy: Allow anonymous access to metadata if user_id is null (adjust as needed)
-- CREATE POLICY "Allow anon read access to anon metadata" ON public.dataset_metadata
--     FOR SELECT
--     USING (user_id IS NULL);