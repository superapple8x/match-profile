// Load environment variables from .env file at the root of the backend directory
// Ensure you have a .env file in src/backend with SUPABASE_URL and SUPABASE_ANON_KEY
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger'); // Assuming logger is configured

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables (SUPABASE_URL or SUPABASE_ANON_KEY). Please check your .env file in src/backend.';
  logger.error(errorMsg);
  // In production, you might want to throw an error to prevent startup
  if (process.env.NODE_ENV === 'production') {
    throw new Error(errorMsg);
  } else {
    logger.warn('Supabase client not initialized due to missing environment variables.');
    // Export null or a dummy object in dev to avoid hard crashes elsewhere,
    // but log that it's not functional.
    module.exports = null;
  }
} else {
  // Initialize the Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    // Optional: Configure client options here if needed
    // auth: {
    //   autoRefreshToken: true,
    //   persistSession: true, // Typically true for browser, false for server-side if managing tokens manually
    //   detectSessionInUrl: false, // Typically false for server-side
    // }
  });

  logger.info('Supabase client initialized successfully.');
  module.exports = supabase;
}