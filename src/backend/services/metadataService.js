const fs = require('fs'); // Keep for potential future use? Or remove if truly unused.
const path = require('path');
const csv = require('csv-parser'); // Keep for potential future use? Or remove if truly unused.
const { query } = require('../config/db'); // Import the database query function

// Assuming uploaded files are stored in a directory like 'uploads' relative to the backend root
// The actual path might depend on the implementation of fileOperations.js
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads'); // Adjust if needed

/**
 * Fetches dataset metadata (table name, column info) from the database.
 *
 * @param {number} datasetId - The numerical ID of the dataset in the database.
 * @returns {Promise<{dbTableName: string, columnsMetadata: Array<{originalName: string, sanitizedName: string, type: string}>, datasetIdentifier: string}|null>}
 *          A promise that resolves with the dataset metadata or null if not found.
 */
async function getMetadata(datasetId) {
  console.log(`Metadata Service: Fetching metadata for dataset ID ${datasetId}`);

  // Validate datasetId
  const numericDatasetId = parseInt(datasetId, 10);
  if (isNaN(numericDatasetId)) {
    console.error(`Metadata Service: Invalid dataset ID format received: ${datasetId}`);
    throw new Error('Invalid dataset ID format.'); // Throw error for invalid ID
  }

  try {
    // Fetch dataset metadata from the database
    const metadataSql = `
      SELECT db_table_name, columns_metadata, dataset_identifier -- Use dataset_identifier
      FROM dataset_metadata
      WHERE id = $1;
    `;
    // Removed user_id check for simplicity within this service, assuming authorization happened before calling this.
    // If needed, user_id could be passed as an argument.
    const metadataResult = await query(metadataSql, [numericDatasetId]);

    if (metadataResult.rows.length === 0) {
      console.warn(`Metadata Service: Metadata not found for ID ${numericDatasetId}`);
      return null; // Return null if not found
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata, dataset_identifier: datasetIdentifier } = metadataResult.rows[0]; // Destructure dataset_identifier
    console.log(`Metadata Service: Found metadata for ID ${numericDatasetId}. Table: ${dbTableName}`);

    // Ensure columnsMetadata is parsed if stored as JSON string (it should be JSONB, but good practice)
    const parsedColumnsMetadata = typeof columnsMetadata === 'string'
      ? JSON.parse(columnsMetadata)
      : columnsMetadata;

    // Add check for datasetIdentifier
    if (!dbTableName || !Array.isArray(parsedColumnsMetadata) || !datasetIdentifier) {
        console.error(`Metadata Service: Invalid or incomplete metadata structure retrieved for ID ${numericDatasetId}`, metadataResult.rows[0]);
        throw new Error('Invalid or incomplete metadata structure in database.');
    }

    // Return the essential metadata needed by the analysis process
    return {
      dbTableName,
      columnsMetadata: parsedColumnsMetadata,
      datasetIdentifier // Return the dataset identifier (original filename)
    };

  } catch (error) {
    console.error(`Metadata Service: Database error fetching metadata for ID ${numericDatasetId}:`, error);
    // Re-throw the error to be handled by the caller (e.g., performAnalysis)
    throw new Error(`Database error fetching metadata: ${error.message}`);
  }
}

module.exports = {
  getMetadata,
};