const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const MatchingEngine = require('../matchingEngine');
const cors = require('cors');
const fs = require('fs').promises; // Use fs.promises
const path = require('path'); // Need path module
const authMiddleware = require('../middleware/authMiddleware'); // Import auth middleware
const { query, pool: dbPool } = require('../config/db'); // Import query function and the instantiated pool

// --- Helper Functions ---

// Sanitize identifiers for database (table names, column names)
function sanitizeDbIdentifier(name) {
  if (!name) return '_unnamed';
  // Convert to lowercase, replace non-alphanumeric with underscore, trim underscores, handle leading numbers
  let sanitized = name
    .toString() // Ensure it's a string
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_') // Replace invalid chars with underscore
    .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores

  // Add prefix if starts with a number or is empty after sanitization
  if (/^\d/.test(sanitized) || sanitized.length === 0) {
    sanitized = '_' + sanitized;
  }
  // Truncate if too long (PostgreSQL limit is typically 63 chars)
  return sanitized.substring(0, 63);
}

// Infer basic SQL type from sample value
function inferColumnType(value) {
  if (value === null || value === undefined || value === '') return 'TEXT'; // Default to TEXT
  // Check specifically for boolean strings
  if (typeof value === 'string') {
      const lowerVal = value.trim().toLowerCase();
      if (lowerVal === 'true' || lowerVal === 'false') return 'BOOLEAN';
  }
  // Check for numbers (handles integers and decimals)
  if (!isNaN(parseFloat(value)) && isFinite(value)) return 'NUMERIC';
  // Check for potential date/timestamp formats (basic check, might need refinement)
  if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'TIMESTAMP WITH TIME ZONE';

  return 'TEXT'; // Default to TEXT
}

// --- End Helper Functions ---


// Define the base upload directory path (No longer used for saving uploads)
// const BASE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Multer setup for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB limit
  }
});

// File import endpoint - Apply authMiddleware first
router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  console.log('--- /api/import request received ---');
  try {
    // User ID should be available from authMiddleware
    const userId = req.user?.id;
    if (!userId) {
        // This shouldn't happen if authMiddleware is working, but good to check
        console.error('User ID missing after authMiddleware in /import');
        return res.status(401).json({ error: 'Authentication required but user ID not found.' });
    }
    console.log(`Authenticated user ID: ${userId}`);

    console.log('req.file received:', req.file ? `Name: ${req.file.originalname}, Size: ${req.file.size}` : 'No file object');
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    // Sanitize filename
    const originalFileName = req.file.originalname;
    // Keep safeFileName for potential use in table naming, but don't create paths
    const safeFileName = path.basename(originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    console.log(`[Import] Processing file: ${originalFileName} (Sanitized: ${safeFileName})`);

    // --- Filesystem saving removed ---

    let parsedData = [];

    // Handle different file types (using the buffer as before)
    const textDecoder = new TextDecoder('utf-8');
    // Use safeFileName to check extension
    if (safeFileName.endsWith('.csv')) {
      console.log(`Parsing CSV file: ${safeFileName}`);
      try { // Add try/catch specifically around the promise/stream
        await new Promise((resolve, reject) => {
          require('stream').Readable.from(fileBuffer)
            .pipe(csv())
            .on('data', (row) => {
              // Add safety check for row data if needed
              parsedData.push(row);
            })
            .on('end', () => {
              console.log('CSV parsing complete');
              resolve();
            })
            .on('error', (error) => {
              console.error('CSV stream error:', error); // Log stream-specific error
              reject(error); // Reject the promise on stream error
            });
        });
      } catch (csvError) {
         console.error("Caught error during CSV stream processing:", csvError);
         // Re-throw to be caught by the main handler's catch block
         throw new Error(`CSV Processing failed: ${csvError.message}`);
      }
    // Use safeFileName to check extension
    } else if (safeFileName.endsWith('.xlsx') || safeFileName.endsWith('.xls')) {
      console.log(`Parsing Excel file: ${safeFileName}`);
      try { // Add try/catch for excel parsing
        const workbook = xlsx.read(fileBuffer); // Read directly from buffer for xlsx
        const sheetName = workbook.SheetNames[0];
        parsedData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log('Excel parsing complete');
      } catch (excelError) {
          console.error("Caught error during Excel processing:", excelError);
          throw new Error(`Excel Processing failed: ${excelError.message}`);
      }
    } else {
      throw new Error('Unsupported file type');
    }

    // --- Database Interaction Logic ---
    if (!parsedData || parsedData.length === 0) {
      console.log('[Import] Parsed data is empty, skipping database operations.');
      return res.status(400).json({ error: 'No data found in the uploaded file.' });
    }

    console.log(`[Import] Parsed ${parsedData.length} rows. Starting database processing.`);

    // 1. Determine Columns and Types & Sanitize
    const originalColumns = Object.keys(parsedData[0]);
    const columnsMetadata = originalColumns.map(originalName => {
      const sanitizedName = sanitizeDbIdentifier(originalName);
      // Infer type based on the first few rows (e.g., first 10 or 100) for better accuracy
      let sampleValue = null;
      for(let i = 0; i < Math.min(parsedData.length, 10); i++) {
          if (parsedData[i][originalName] !== null && parsedData[i][originalName] !== undefined && parsedData[i][originalName] !== '') {
              sampleValue = parsedData[i][originalName];
              break;
          }
      }
      const type = inferColumnType(sampleValue);
      console.log(`[Import] Column: "${originalName}" -> Sanitized: "${sanitizedName}", Type: ${type}`);
      return { originalName, sanitizedName, type };
    });

    // Check for duplicate sanitized names (though sanitizeDbIdentifier tries to avoid this)
    const sanitizedNames = columnsMetadata.map(c => c.sanitizedName);
    if (new Set(sanitizedNames).size !== sanitizedNames.length) {
        console.error('[Import] Duplicate sanitized column names detected after sanitization:', sanitizedNames);
        throw new Error('Failed to generate unique column names for the database table.');
    }

    // 2. Generate Unique Table Name
    const timestamp = Date.now();
    const dbTableName = sanitizeDbIdentifier(`dataset_user_${userId}_${timestamp}_${safeFileName}`);
    console.log(`[Import] Generated DB Table Name: ${dbTableName}`);

    // --- Overwrite Logic: Check for and clean up existing dataset with the same identifier ---
    const checkExistingSql = `
      SELECT id, db_table_name FROM dataset_metadata
      WHERE user_id = $1 AND dataset_identifier = $2;
    `;
    try {
        const existingResult = await query(checkExistingSql, [userId, originalFileName]);
        if (existingResult.rows.length > 0) {
            const oldMetadataId = existingResult.rows[0].id;
            const oldDbTableName = existingResult.rows[0].db_table_name;
            console.log(`[Import] Found existing dataset metadata (ID: ${oldMetadataId}) for "${originalFileName}" and user ${userId}. Table: "${oldDbTableName}". Proceeding with overwrite.`);

            // Delete old metadata
            const deleteMetadataSql = `DELETE FROM dataset_metadata WHERE id = $1;`;
            await query(deleteMetadataSql, [oldMetadataId]);
            console.log(`[Import] Deleted old metadata record (ID: ${oldMetadataId}).`);

            // Drop old table
            const dropTableSql = `DROP TABLE IF EXISTS "${oldDbTableName}";`; // Ensure table name is quoted
            await query(dropTableSql);
            console.log(`[Import] Dropped old database table "${oldDbTableName}".`);
        }
    } catch (cleanupError) {
        console.error('[Import] Error during cleanup of existing dataset:', cleanupError);
        // Decide if this error should prevent the import. For now, we'll let it proceed,
        // but it might leave orphaned tables if dropping fails.
        // Consider throwing an error here if cleanup is critical:
        // throw new Error(`Failed to clean up existing dataset: ${cleanupError.message}`);
    }
    // --- End Overwrite Logic ---


    // Use a database client from the imported pool for transaction control
    const dbClient = await dbPool.connect(); // Get client from the actual pool

    try {
      await dbClient.query('BEGIN'); // Start transaction

      // 3. Create Table Dynamically (Add original_row_index)
      const createTableColumns = columnsMetadata
        .map(col => `"${col.sanitizedName}" ${col.type}`)
        .join(', ');
      // Add the new column definition
      const createTableSql = `CREATE TABLE "${dbTableName}" (id SERIAL PRIMARY KEY, original_row_index INTEGER, ${createTableColumns});`;
      console.log(`[Import] Executing CREATE TABLE: ${createTableSql}`);
      await dbClient.query(createTableSql);
      console.log(`[Import] Table "${dbTableName}" created successfully.`);

      // 4. Insert Data (Include original_row_index)
      console.log(`[Import] Preparing to insert ${parsedData.length} rows into "${dbTableName}"...`);
      // Add original_row_index to columns and placeholders
      const insertColumns = `"original_row_index", ${columnsMetadata.map(col => `"${col.sanitizedName}"`).join(', ')}`;
      const valuePlaceholders = columnsMetadata.map((_, index) => `$${index + 2}`).join(', '); // Start from $2
      const insertSql = `INSERT INTO "${dbTableName}" (${insertColumns}) VALUES ($1, ${valuePlaceholders})`; // $1 is for index

      // Execute inserts row by row, including the index
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        const originalIndex = i + 1; // Use 1-based index for user display

        const values = columnsMetadata.map(col => {
            let val = row[col.originalName];
            // Basic type coercion (keep existing logic)
            if (col.type === 'NUMERIC') {
                val = (val === null || val === undefined || val === '') ? null : parseFloat(val);
                if (isNaN(val)) val = null; // Handle parsing errors
            } else if (col.type === 'BOOLEAN') {
                if (typeof val === 'string') {
                    const lowerVal = val.trim().toLowerCase();
                    val = lowerVal === 'true' ? true : (lowerVal === 'false' ? false : null);
                } else if (typeof val !== 'boolean') {
                    val = null; // Or handle other types appropriately
                }
            } else if (col.type === 'TIMESTAMP WITH TIME ZONE') {
                 val = (val === null || val === undefined || val === '') ? null : new Date(val);
                 if (isNaN(val.getTime())) val = null; // Handle invalid dates
            }
            // Ensure TEXT values are strings
            else if (col.type === 'TEXT' && val !== null && val !== undefined) {
                 val = String(val);
            }
            return val;
        });

        // Prepend the original index to the values array
        const finalValues = [originalIndex, ...values];
        // console.log(`[Import] Inserting values:`, finalValues); // DEBUG log
        await dbClient.query(insertSql, finalValues);
      }
      console.log(`[Import] Successfully inserted ${parsedData.length} rows.`);

      // 5. Store Metadata (Add original_row_index to metadata if needed for reference, though maybe not necessary)
      // For now, we don't strictly need to add it to columns_metadata JSON,
      // as the column exists in the table itself.
      const metadataSql = `
        INSERT INTO dataset_metadata (user_id, dataset_identifier, db_table_name, columns_metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
      const metadataValues = [userId, originalFileName, dbTableName, JSON.stringify(columnsMetadata)];
      console.log('[Import] Storing metadata:', { userId, originalFileName, dbTableName });
      const metadataResult = await dbClient.query(metadataSql, metadataValues);
      const datasetId = metadataResult.rows[0].id;
      console.log(`[Import] Metadata stored successfully. Dataset ID: ${datasetId}`);

      await dbClient.query('COMMIT'); // Commit transaction
      console.log('[Import] Transaction committed.');

      // 6. Update API Response
      console.log(`[Import] Sending success response for dataset ID: ${datasetId}`);
      res.status(200).json({
        message: 'File processed and data stored successfully.',
        datasetId: datasetId,
        columnsMetadata: columnsMetadata // Send the mapping info to the frontend
      });

    } catch (dbError) {
      await dbClient.query('ROLLBACK'); // Rollback transaction on error
      console.error('[Import] Database error during import, transaction rolled back:', dbError);
      // Attempt to drop the table if creation succeeded but insertion/metadata failed
      try {
          console.log(`[Import] Attempting to drop potentially created table "${dbTableName}" due to error.`);
          await query(`DROP TABLE IF EXISTS "${dbTableName}";`); // Use original query function for cleanup
          console.log(`[Import] Cleanup successful for table "${dbTableName}".`);
      } catch (cleanupError) {
          console.error(`[Import] Error during table cleanup for "${dbTableName}":`, cleanupError);
      }
      throw new Error(`Database operation failed: ${dbError.message}`); // Re-throw to be caught by outer handler
    } finally {
      dbClient.release(); // Release the client back to the pool
      console.log('[Import] Database client released.');
    }

  } catch (error) {
    console.error("--- Error during file import ---:", error); // Add marker for easier log searching
    // Ensure a JSON error response is always sent, even if dbClient wasn't defined
    res.status(500).json({ error: 'Failed to process file', details: error.message });
  }
});

// File export endpoint (example: CSV)
router.get('/export/csv', (req, res) => {
  try {
    // Sample data (replace with your actual data source)
    const data = [
      { name: 'John Doe', email: 'jane@example.com' },
    ];

    const csv = Papa.unparse(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
    res.status(200).send(csv);

  } catch (error) {
    console.error("Error during CSV export:", error);
    res.status(500).json({ error: 'Failed to export data', details: error.message });
  }
});

// Match profiles endpoint - Modified for DB querying
router.post('/match', authMiddleware, async (req, res) => { // Added authMiddleware, made async
  console.log('--- /api/match request received ---');
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // 1. Get data from request body
    const { datasetId, searchCriteria, weights, matchingRules } = req.body;
    console.log('[Match] Received:', { datasetId, searchCriteria, weights, matchingRules });

    if (!datasetId || !searchCriteria || !Array.isArray(searchCriteria) || searchCriteria.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid datasetId or searchCriteria.' });
    }

    // 2. Fetch dataset metadata
    const metadataSql = `
      SELECT db_table_name, columns_metadata FROM dataset_metadata
      WHERE id = $1 AND user_id = $2;
    `;
    const metadataResult = await query(metadataSql, [datasetId, userId]);

    if (metadataResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset metadata not found or access denied.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadataResult.rows[0];
    console.log(`[Match] Found metadata. DB Table: ${dbTableName}`);

    // 3. Create originalToSanitizedMap and validate criteria attributes
    const originalToSanitizedMap = {};
    const validDbColumns = {}; // Store { sanitizedName: type }
    columnsMetadata.forEach(col => {
        originalToSanitizedMap[col.originalName] = col.sanitizedName;
        validDbColumns[col.sanitizedName] = col.type;
    });

    // Validate that attributes in searchCriteria exist in the dataset
    for (const criterion of searchCriteria) {
        if (!originalToSanitizedMap.hasOwnProperty(criterion.attribute)) {
            return res.status(400).json({ error: `Invalid search attribute "${criterion.attribute}" for this dataset.` });
        }
    }

    // 4. Build Parameterized SQL Query
    let whereClause = 'WHERE 1 = 1'; // Start with a clause that's always true
    const queryParams = [];
    let paramIndex = 1;

    searchCriteria.forEach(criterion => {
      const sanitizedColName = originalToSanitizedMap[criterion.attribute];
      const colType = validDbColumns[sanitizedColName]; // Get the DB type
      let value = criterion.value;

      // Basic type coercion/validation for query parameters based on DB type
      if (colType === 'NUMERIC') {
          value = parseFloat(value);
          if (isNaN(value)) {
              console.warn(`[Match] Invalid numeric value for ${criterion.attribute}: ${criterion.value}. Skipping criterion.`);
              return; // Skip this criterion if value is not a valid number
          }
      } else if (colType === 'BOOLEAN') {
          if (typeof value === 'string') {
              const lowerVal = value.trim().toLowerCase();
              value = lowerVal === 'true' ? true : (lowerVal === 'false' ? false : null);
          } else if (typeof value !== 'boolean') {
              value = null;
          }
          if (value === null) {
               console.warn(`[Match] Invalid boolean value for ${criterion.attribute}: ${criterion.value}. Skipping criterion.`);
               return; // Skip if not a valid boolean representation
          }
      } else if (colType === 'TIMESTAMP WITH TIME ZONE') {
          value = new Date(value);
          if (isNaN(value.getTime())) {
              console.warn(`[Match] Invalid date/timestamp value for ${criterion.attribute}: ${criterion.value}. Skipping criterion.`);
              return; // Skip invalid dates
          }
      } else { // TEXT or other types
          value = String(value); // Ensure it's a string for LIKE etc.
      }


      // Determine operator based on rule and column type
      const rule = matchingRules?.[criterion.attribute] || {};
      let operator;
      let finalValue = value; // Use the already coerced value by default

      // Determine the default operator based on column type
      const isNonTextType = ['NUMERIC', 'BOOLEAN', 'TIMESTAMP WITH TIME ZONE'].includes(colType);
      const defaultOperator = isNonTextType ? '=' : 'ILIKE';

      // Set operator based on rule, falling back to type-based default
      if (rule.type === 'exact' || rule.type === 'range') {
          operator = '='; // Use exact match for 'exact' and 'range' (engine handles range logic)
      } else {
          // For 'partial' or undefined rule type, use the default based on column type
          operator = defaultOperator;
      }

      // Add wildcards ONLY if using ILIKE
      if (operator === 'ILIKE') {
          finalValue = `%${value}%`; // value is already String()ified for TEXT types
      }

      whereClause += ` AND "${sanitizedColName}" ${operator} $${paramIndex++}`;
      queryParams.push(finalValue); // Push the potentially modified value
    });

    const selectSql = `SELECT * FROM "${dbTableName}" ${whereClause};`;
    console.log(`[Match] Executing SQL: ${selectSql}`);
    console.log('[Match] Query Params:', queryParams);

    const dbResult = await query(selectSql, queryParams);
    const filteredProfiles = dbResult.rows;
    console.log(`[Match] Found ${filteredProfiles.length} profiles matching filter criteria.`);

    if (filteredProfiles.length === 0) {
        return res.status(200).json({ matches: [] }); // Return empty if DB query yields nothing
    }

    // 5. Instantiate Matching Engine and Set Weights
    const engine = new MatchingEngine();
    if (weights) {
        engine.setWeights(weights);
        console.log('[Match] Applied custom weights:', weights);
    }

    // 6. Calculate Scores using the Map
    // Convert searchCriteria array back to an object for the engine
    const searchCriteriaObject = searchCriteria.reduce((obj, item) => {
        obj[item.attribute] = item.value;
        return obj;
    }, {});

    const results = filteredProfiles.map(profile => {
      // The 'profile' object here has keys matching the sanitized DB column names
      const matchPercentage = engine.calculateMatchScore(
        searchCriteriaObject,
        profile, // Pass the profile object with sanitized keys
        originalToSanitizedMap, // Pass the map
        matchingRules // Pass the rules
      );
      return {
        // profileId: profile.id, // Use the auto-generated DB ID
        matchPercentage: matchPercentage,
        profileData: profile // Include the full row data (with sanitized keys)
      };
    });

    // 7. Format and Send Response
    const responseData = {
      matches: results.sort((a, b) => b.matchPercentage - a.matchPercentage)
    };
    console.log(`[Match] Sending ${responseData.matches.length} results.`);
    res.status(200).json(responseData);

  } catch (error) {
    console.error("--- Matching error ---:", error);
    res.status(500).json({ error: 'Failed to process matching request', details: error.message });
  }
});

// --- Get Dataset Content Route ---
router.get('/datasets/:filename', authMiddleware, async (req, res) => {
  console.log('--- /api/datasets/:filename request received ---');
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const requestedFilename = req.params.filename;
    // Basic validation/sanitization on filename from URL param
    const safeRequestedFilename = path.basename(requestedFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeRequestedFilename) {
        return res.status(400).json({ error: 'Invalid filename provided.' });
    }

    console.log(`User ${userId} requesting dataset: ${safeRequestedFilename}`);

    const userUploadDir = path.join(BASE_UPLOAD_DIR, `user_${userId}`);
    const filePath = path.join(userUploadDir, safeRequestedFilename);

    // Check if file exists
    try {
      await fs.access(filePath); // Check accessibility
      console.log(`File found at: ${filePath}`);
    } catch (accessError) {
      console.warn(`File not found or inaccessible for user ${userId}: ${filePath}`);
      return res.status(404).json({ error: 'Dataset file not found.' });
    }

    // Read the file content
    const fileBuffer = await fs.readFile(filePath);
    console.log(`File read successfully: ${safeRequestedFilename}`);

    // Parse the file content (similar logic to /import)
    let parsedData = [];
    if (safeRequestedFilename.endsWith('.csv')) {
      console.log(`Parsing retrieved CSV: ${safeRequestedFilename}`);
      await new Promise((resolve, reject) => {
        require('stream').Readable.from(fileBuffer)
          .pipe(csv())
          .on('data', (row) => parsedData.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
    } else if (safeRequestedFilename.endsWith('.xlsx') || safeRequestedFilename.endsWith('.xls')) {
      console.log(`Parsing retrieved Excel: ${safeRequestedFilename}`);
      const workbook = xlsx.read(fileBuffer);
      const sheetName = workbook.SheetNames[0];
      parsedData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      // Should not happen if saved correctly, but good practice
      throw new Error('Unsupported file type encountered during retrieval.');
    }

    console.log(`Successfully parsed retrieved file ${safeRequestedFilename}. Records: ${parsedData.length}`);
    res.status(200).json({ data: parsedData, fileName: safeRequestedFilename });

  } catch (error) {
    console.error("--- Error retrieving dataset content ---:", error);
    res.status(500).json({ error: 'Failed to retrieve dataset content', details: error.message });
  }
});


// --- Value Suggestions Endpoint ---
router.get('/suggest/values', authMiddleware, async (req, res) => {
  console.log('--- /api/suggest/values request received ---');
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { datasetId, attributeName, searchTerm } = req.query;
    console.log('[Suggest] Params:', { datasetId, attributeName, searchTerm });

    if (!datasetId || !attributeName || searchTerm === undefined) {
      return res.status(400).json({ error: 'Missing required query parameters: datasetId, attributeName, searchTerm.' });
    }

    // 1. Fetch dataset metadata to get table name and sanitized column name
    const metadataSql = `
      SELECT db_table_name, columns_metadata FROM dataset_metadata
      WHERE id = $1 AND user_id = $2;
    `;
    const metadataResult = await query(metadataSql, [datasetId, userId]);

    if (metadataResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset metadata not found or access denied.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadataResult.rows[0];

    // Find the sanitized name for the requested attribute
    const attributeMeta = columnsMetadata.find(col => col.originalName === attributeName);
    if (!attributeMeta) {
      return res.status(400).json({ error: `Attribute "${attributeName}" not found in this dataset.` });
    }
    const sanitizedColName = attributeMeta.sanitizedName;
    const colType = attributeMeta.type; // Get type for potential casting

    // 2. Query for distinct values matching the searchTerm
    // Ensure column name is quoted to handle special characters/keywords
    // Cast to TEXT for consistent ILIKE comparison, especially for numeric/date types
    const suggestSql = `
      SELECT DISTINCT "${sanitizedColName}"
      FROM "${dbTableName}"
      WHERE "${sanitizedColName}"::TEXT ILIKE $1
      LIMIT 10;
    `;
    const queryParams = [`%${searchTerm}%`]; // Add wildcards for ILIKE

    console.log(`[Suggest] SQL: ${suggestSql}`);
    console.log('[Suggest] Params:', queryParams);

    const suggestionsResult = await query(suggestSql, queryParams);

    // Extract the values
    const suggestedValues = suggestionsResult.rows.map(row => row[sanitizedColName]);
    console.log('[Suggest] Found values:', suggestedValues);

    res.status(200).json({ suggestions: suggestedValues });

  } catch (error) {
    console.error("--- Value suggestion error ---:", error);
    res.status(500).json({ error: 'Failed to fetch value suggestions', details: error.message });
  }
});

// --- Dataset Statistics Endpoint ---
router.get('/datasets/:datasetId/stats', authMiddleware, async (req, res) => {
  console.log('--- /api/datasets/:datasetId/stats request received ---');
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { datasetId } = req.params;
    console.log('[Stats] Params:', { datasetId });

    if (!datasetId) {
      return res.status(400).json({ error: 'Missing required parameter: datasetId.' });
    }

    // 1. Fetch dataset metadata
    const metadataSql = `
      SELECT db_table_name, columns_metadata FROM dataset_metadata
      WHERE id = $1 AND user_id = $2;
    `;
    const metadataResult = await query(metadataSql, [datasetId, userId]);

    if (metadataResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset metadata not found or access denied.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadataResult.rows[0];
    console.log(`[Stats] Found metadata for table: ${dbTableName}`);

    // 2. Calculate Statistics
    const stats = {
      totalRows: 0,
      numericStats: {}, // For min, max, avg, stddev of numeric cols
      categoricalStats: {}, // For top values of text cols
      columnDetails: {}, // Added: To store type and null count for ALL columns
    };

    // Get total row count
    const countSql = `SELECT COUNT(*) AS total FROM "${dbTableName}";`;
    const countResult = await query(countSql);
    stats.totalRows = parseInt(countResult.rows[0].total, 10);
    console.log(`[Stats] Total rows: ${stats.totalRows}`);

    // Calculate stats for each relevant column
    for (const colMeta of columnsMetadata) {
      const sanitizedColName = colMeta.sanitizedName;
      const originalColName = colMeta.originalName;
      const colType = colMeta.type;
      let nullCount = 0; // Initialize null count for the column

      try {
        // --- Calculate Null Count (for ALL types) ---
        const nullCountSql = `
            SELECT COUNT(*) AS null_count
            FROM "${dbTableName}"
            WHERE "${sanitizedColName}" IS NULL;
        `;
        const nullCountResult = await query(nullCountSql);
        nullCount = parseInt(nullCountResult.rows[0].null_count, 10) || 0;
        // Store type and null count immediately
        stats.columnDetails[originalColName] = { type: colType, nullCount: nullCount };

        // --- Calculate Type-Specific Stats ---
        if (colType === 'NUMERIC') {
          const numericSql = `
            SELECT
              MIN("${sanitizedColName}") AS min,
              MAX("${sanitizedColName}") AS max,
              AVG("${sanitizedColName}") AS avg,
              STDDEV("${sanitizedColName}") AS stddev
            FROM "${dbTableName}";
          `;
          console.log(`[Stats] Querying numeric stats for: ${sanitizedColName}`);
          const numericResult = await query(numericSql);
          if (numericResult.rows.length > 0) {
               const row = numericResult.rows[0];
               // Ensure avg and stddev are numbers, handle potential null if table is empty/all nulls
               const avg = row.avg !== null ? parseFloat(row.avg) : null;
               const stddev = row.stddev !== null ? parseFloat(row.stddev) : null;
               stats.numericStats[originalColName] = {
                   min: row.min !== null ? parseFloat(row.min) : null,
                   max: row.max !== null ? parseFloat(row.max) : null,
                   average: avg !== null && !isNaN(avg) ? avg : null,
                   standardDeviation: stddev !== null && !isNaN(stddev) ? stddev : null,
                   // nullCount is stored in columnDetails
                };

                // --- Calculate Percentiles (Median, P25, P75) ---
                const percentileSql = `
                    SELECT
                        percentile_cont(0.25) WITHIN GROUP (ORDER BY "${sanitizedColName}") AS p25,
                        percentile_cont(0.5) WITHIN GROUP (ORDER BY "${sanitizedColName}") AS median,
                        percentile_cont(0.75) WITHIN GROUP (ORDER BY "${sanitizedColName}") AS p75
                    FROM "${dbTableName}"
                    WHERE "${sanitizedColName}" IS NOT NULL;
                `;
                console.log(`[Stats] Querying percentiles for: ${sanitizedColName}`);
                const percentileResult = await query(percentileSql);
                if (percentileResult.rows.length > 0) {
                    const pRow = percentileResult.rows[0];
                    stats.numericStats[originalColName].p25 = pRow.p25 !== null ? parseFloat(pRow.p25) : null;
                    stats.numericStats[originalColName].median = pRow.median !== null ? parseFloat(pRow.median) : null;
                    stats.numericStats[originalColName].p75 = pRow.p75 !== null ? parseFloat(pRow.p75) : null;
                }
                // --- End Percentile Calculation ---


                // --- Calculate Histogram Data ---
                const minVal = stats.numericStats[originalColName].min;
               const maxVal = stats.numericStats[originalColName].max;
               let histogramData = [];

               if (minVal !== null && maxVal !== null && typeof minVal === 'number' && typeof maxVal === 'number') {
                   const numBuckets = 10; // Define the number of buckets for the histogram

                   if (maxVal > minVal) {
                       const bucketWidth = (maxVal - minVal) / numBuckets;
                       const histogramSql = `
                           SELECT
                               width_bucket("${sanitizedColName}", $1, $2, $3) AS bucket,
                               COUNT(*) AS count
                           FROM "${dbTableName}"
                           WHERE "${sanitizedColName}" IS NOT NULL
                           GROUP BY bucket
                           ORDER BY bucket;
                       `;
                       // Note: width_bucket bounds are (min, max]. Values = max go into num_buckets. Values < min go into 0.
                       // We add a small epsilon to maxVal for the upper bound to include maxVal in the last bucket.
                       const epsilon = (maxVal - minVal) * 0.00001; // Small value to ensure max is included
                       const histogramResult = await query(histogramSql, [minVal, maxVal + epsilon, numBuckets]);

                       histogramData = histogramResult.rows.map(row => {
                           const bucketNum = parseInt(row.bucket, 10);
                           const count = parseInt(row.count, 10);
                           // Calculate bounds based on bucket number
                           const lowerBound = minVal + (bucketNum - 1) * bucketWidth;
                           const upperBound = minVal + bucketNum * bucketWidth;
                           return {
                               bucket: bucketNum,
                               count: count,
                               lower_bound: lowerBound,
                               // Ensure the last bucket's upper bound is exactly maxVal
                               upper_bound: bucketNum === numBuckets ? maxVal : upperBound
                           };
                       }).filter(b => b.bucket >= 1 && b.bucket <= numBuckets); // Filter out potential 0 or numBuckets+1 buckets if any

                   } else if (minVal === maxVal) {
                       // If min and max are the same, create a single bucket
                       const singleValueCountSql = `SELECT COUNT(*) AS count FROM "${dbTableName}" WHERE "${sanitizedColName}" = $1;`;
                       const singleValueResult = await query(singleValueCountSql, [minVal]);
                       histogramData = [{
                           bucket: 1,
                           count: parseInt(singleValueResult.rows[0].count, 10),
                           lower_bound: minVal,
                           upper_bound: maxVal
                       }];
                   }
               }
               stats.numericStats[originalColName].histogram = histogramData;
               console.log(`[Stats] Calculated histogram for ${sanitizedColName}: ${histogramData.length} buckets`);
               // --- End Histogram Calculation ---
          }
        } else if (colType === 'TEXT') {
          // Get top 5 most frequent values for text columns
          const categoricalSql = `
            SELECT "${sanitizedColName}", COUNT(*) AS count
            FROM "${dbTableName}"
            WHERE "${sanitizedColName}" IS NOT NULL AND "${sanitizedColName}"::text <> '' -- Exclude nulls and empty strings
            GROUP BY "${sanitizedColName}"
            ORDER BY count DESC
            LIMIT 5;
          `;
          console.log(`[Stats] Querying categorical stats for: ${sanitizedColName}`);
          const categoricalResult = await query(categoricalSql);
          stats.categoricalStats[originalColName] = categoricalResult.rows.map(row => ({
            value: row[sanitizedColName],
            count: parseInt(row.count, 10),
          }));
        }
        // Add more stats for BOOLEAN, TIMESTAMP etc. if needed (e.g., true/false counts for boolean)

      } catch (columnStatError) {
        // Log error for specific column but continue with others
        console.error(`[Stats] Error calculating stats for column "${sanitizedColName}":`, columnStatError.message);
        // Ensure columnDetails entry still exists even if stats calculation failed
        if (!stats.columnDetails[originalColName]) {
            stats.columnDetails[originalColName] = { type: colType, nullCount: nullCount }; // Use potentially calculated nullCount
        }
      }
    }

    console.log('[Stats] Statistics calculation complete.');
    res.status(200).json(stats);

  } catch (error) {
    console.error("--- Dataset statistics error ---:", error);
    res.status(500).json({ error: 'Failed to fetch dataset statistics', details: error.message });
  }
});

// --- Get Dataset Metadata Endpoint ---
router.get('/datasets/:datasetId/metadata', authMiddleware, async (req, res) => {
  console.log('--- /api/datasets/:datasetId/metadata request received ---');
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { datasetId } = req.params;
    // Validate datasetId is a number
    const numericDatasetId = parseInt(datasetId, 10);
    if (isNaN(numericDatasetId)) {
        console.error(`[Metadata] Invalid dataset ID format received: ${datasetId}`);
        return res.status(400).json({ error: 'Invalid dataset ID format.' });
    }
    console.log(`[Metadata] User ${userId} requesting metadata for dataset ID: ${numericDatasetId}`);

    // Fetch dataset metadata from the database
    const metadataSql = `
      SELECT dataset_identifier, columns_metadata
      FROM dataset_metadata
      WHERE id = $1 AND user_id = $2;
    `;
    const metadataResult = await query(metadataSql, [numericDatasetId, userId]);

    if (metadataResult.rows.length === 0) {
      console.warn(`[Metadata] Metadata not found for ID ${numericDatasetId} and user ${userId}`);
      return res.status(404).json({ error: 'Dataset metadata not found or access denied.' });
    }

    const { dataset_identifier: originalFileName, columns_metadata: columnsMetadata } = metadataResult.rows[0];
    console.log(`[Metadata] Found metadata for ID ${numericDatasetId}: FileName: ${originalFileName}`);

    // Ensure columnsMetadata is parsed if stored as JSON string (it should be JSONB now, but good practice)
    const parsedColumnsMetadata = typeof columnsMetadata === 'string' ? JSON.parse(columnsMetadata) : columnsMetadata;

    res.status(200).json({
        originalFileName,
        columnsMetadata: parsedColumnsMetadata // Send parsed metadata
    });

  } catch (error) {
    console.error("--- Dataset metadata retrieval error ---:", error);
    res.status(500).json({ error: 'Failed to fetch dataset metadata', details: error.message });
  }
});


module.exports = router;
