const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Assuming uploaded files are stored in a directory like 'uploads' relative to the backend root
// The actual path might depend on the implementation of fileOperations.js
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads'); // Adjust if needed

/**
 * Analyzes a dataset file (identified by datasetId) and extracts metadata.
 *
 * @param {string} datasetId - The identifier for the dataset (e.g., the filename).
 * @returns {Promise<object>} A promise that resolves with the dataset metadata.
 */
async function getMetadata(datasetId) {
  console.log(`Metadata Service: Analyzing dataset ${datasetId}`);
  // Construct the full path to the dataset file
  // SECURITY NOTE: Ensure datasetId is properly sanitized to prevent path traversal attacks
  const filePath = path.join(UPLOAD_DIR, datasetId); // Example: uploads/mydata.csv

  return new Promise((resolve, reject) => {
    const metadata = {
      columns: [], // Array of { name: string, type: string }
      summaries: {}, // { columnName: { min, max, mean, median, uniqueValues?, uniqueCount?, missingCount, missingPercent } }
      rowCount: 0,
      errors: [], // To collect any issues during processing
    };

    const columnData = {}; // Temporary store for column values during streaming

    fs.createReadStream(filePath)
      .on('error', (error) => {
        console.error(`Metadata Service: Error reading file ${filePath}`, error);
        reject(new Error(`Failed to read dataset file: ${error.message}`));
      })
      .pipe(csv()) // Use csv-parser
      .on('headers', (headers) => {
        console.log('Metadata Service: Detected headers:', headers);
        metadata.columns = headers.map(name => ({ name, type: 'unknown' })); // Initial type
        headers.forEach(header => {
          columnData[header] = []; // Initialize arrays to store values
        });
      })
      .on('data', (row) => {
        metadata.rowCount++;
        // TODO: Implement data type detection logic here
        // TODO: Collect values for summary statistics calculation
        metadata.columns.forEach(({ name }) => {
          const value = row[name];
          columnData[name].push(value);
          // Basic type detection example (needs refinement)
          // if (metadata.columns.find(c => c.name === name).type === 'unknown' && value !== null && value !== '') {
          //   if (!isNaN(value)) metadata.columns.find(c => c.name === name).type = 'number';
          //   else metadata.columns.find(c => c.name === name).type = 'string';
          //   // Add more checks for boolean, date etc.
          // }
        });
      })
      .on('end', () => {
        console.log(`Metadata Service: Finished reading ${metadata.rowCount} rows.`);
        // TODO: Calculate summary statistics (min, max, mean, median, unique, missing) from columnData
        // TODO: Refine data type detection based on all values in a column
        // Example placeholder for summaries:
        metadata.columns.forEach(({ name }) => {
          metadata.summaries[name] = {
            missingCount: columnData[name].filter(v => v === null || v === undefined || v === '').length,
            // Add other stats here after calculation
          };
          metadata.summaries[name].missingPercent = (metadata.summaries[name].missingCount / metadata.rowCount) * 100;
        });

        console.log('Metadata Service: Generated metadata:', JSON.stringify(metadata, null, 2));
        resolve(metadata);
      })
      .on('error', (error) => {
        console.error(`Metadata Service: Error processing CSV for ${filePath}`, error);
        reject(new Error(`Failed to process CSV data: ${error.message}`));
      });
  });
}

module.exports = {
  getMetadata,
};