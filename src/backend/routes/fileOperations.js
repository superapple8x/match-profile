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
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware'); // Import optional auth middleware
const { query, pool: dbPool } = require('../config/db'); // Import query function and the instantiated pool
const { body, query: queryValidator, param, validationResult } = require('express-validator'); // Import validation functions
const logger = require('../config/logger'); // Import logger
const { fileTypeFromBuffer } = require('file-type'); // Import file-type
const cache = require('../services/cacheService'); // Import cache service

// --- Validation Middleware ---
// Middleware to handle validation errors from express-validator
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors
    logger.warn('Validation failed for request', { url: req.originalUrl, errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

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

// --- Metadata Caching Helper ---
async function getMetadataWithCache(datasetId) {
  const cacheKey = `metadata_${datasetId}`;
  let metadata = cache.get(cacheKey);

  if (metadata) {
    logger.debug(`[Cache] HIT for metadata: ${cacheKey}`);
    return metadata; // Return cached data
  }

  logger.debug(`[Cache] MISS for metadata: ${cacheKey}. Fetching from DB.`);
  // Fetch from DB if not in cache
  const metadataSql = `
    SELECT db_table_name, columns_metadata, user_id AS owner_id
    FROM dataset_metadata
    WHERE id = $1;
  `;
  const metadataResult = await query(metadataSql, [datasetId]);

  if (metadataResult.rows.length === 0) {
    return null; // Indicate not found
  }

  // Prepare metadata object (ensure columns_metadata is parsed)
  const dbRow = metadataResult.rows[0];
  metadata = {
    db_table_name: dbRow.db_table_name,
    columns_metadata: typeof dbRow.columns_metadata === 'string'
      ? JSON.parse(dbRow.columns_metadata)
      : dbRow.columns_metadata,
    owner_id: dbRow.owner_id
  };

  // Store in cache (using default TTL from cacheService)
  cache.set(cacheKey, metadata);
  logger.debug(`[Cache] SET metadata: ${cacheKey}`);

  return metadata;
}
// --- End Metadata Caching Helper ---

// --- End Helper Functions ---


// Define the base upload directory path (No longer used for saving uploads)
// const BASE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Multer file filter based on reported MIME type (less secure than magic number check, but an extra layer)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/csv' // Another common CSV type
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    logger.warn(`[Import] Multer rejected file upload due to invalid reported MIME type`, { originalFileName: file.originalname, reportedMime: file.mimetype });
    // Pass an error to multer - this will be caught by multer's error handling
    // The message will be available in the error object in the route handler if needed,
    // but typically we just send a generic 400 or rely on the magic number check later.
    cb(new Error(`Unsupported file type reported by client: ${file.mimetype}.`), false); // Reject file
  }
};

// Multer setup for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB limit - Adjust as needed
  },
  fileFilter: fileFilter // Add the filter
});

// File import endpoint - Use optionalAuthMiddleware
router.post('/import', optionalAuthMiddleware, upload.single('file'), async (req, res) => { // Use optional auth
  logger.info('--- /api/import request received ---');
  try {
    // User ID might be null if request is anonymous
    const userId = req.user?.id || null;
    logger.info(`[Import] User ID: ${userId === null ? 'Anonymous' : userId}`);

    logger.info('[Import] req.file received:', { name: req.file?.originalname, size: req.file?.size });
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    // Sanitize filename
    const originalFileName = req.file.originalname;
    // Keep safeFileName for potential use in table naming, but don't create paths
    const safeFileName = path.basename(originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    logger.info(`[Import] Processing file: ${originalFileName} (Sanitized: ${safeFileName})`);

    // --- Filesystem saving removed ---

    let parsedData = [];

    // --- File Type Validation (Revised) ---
    // Get the MIME type reported by multer (based on Content-Type header)
    const reportedMimeType = req.file.mimetype;
    const isReportedCsv = ['text/csv', 'application/csv'].includes(reportedMimeType);
    const isReportedExcel = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ].includes(reportedMimeType);

    let fileTypeCheckPassed = false;
    let actualMimeType = reportedMimeType; // Assume reported is correct initially

    if (isReportedCsv) {
        // For CSV, trust the reported type for now and let the parser handle errors.
        fileTypeCheckPassed = true;
        logger.info(`[Import] File reported as CSV (${reportedMimeType}). Proceeding to parse.`);
    } else if (isReportedExcel) {
        // For Excel, verify using magic numbers as it's more reliable.
        const detectedType = await fileTypeFromBuffer(fileBuffer);
        if (detectedType && (detectedType.mime === 'application/vnd.ms-excel' || detectedType.mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
            fileTypeCheckPassed = true;
            actualMimeType = detectedType.mime; // Use the detected type
            logger.info(`[Import] Detected Excel file MIME type: ${actualMimeType}`);
        } else {
            const detectedMime = detectedType ? detectedType.mime : 'unknown';
            logger.warn(`[Import] Rejected Excel file upload. Reported MIME: ${reportedMimeType}, Detected MIME: ${detectedMime}`, { originalFileName });
            return res.status(400).json({ error: `Invalid Excel file format detected. Reported: ${reportedMimeType}, Detected: ${detectedMime}.` });
        }
    }

    if (!fileTypeCheckPassed) {
        // This path is reached if the reported type wasn't CSV or Excel, or if Excel magic number check failed.
        logger.warn(`[Import] Rejected file upload due to unsupported reported MIME type`, { originalFileName, reportedMimeType });
        return res.status(400).json({ error: `Unsupported file type reported by client: ${reportedMimeType}. Allowed: CSV, XLS, XLSX.` });
    }
    // --- End File Type Validation ---

    // Handle different file types based on the validated/actual MIME type
    const textDecoder = new TextDecoder('utf-8');
    // Use detected MIME type instead of filename extension
    if (actualMimeType === 'text/csv' || actualMimeType === 'application/csv') {
      logger.info(`[Import] Parsing CSV file: ${safeFileName}`);
      try { // Add try/catch specifically around the promise/stream
        await new Promise((resolve, reject) => {
          require('stream').Readable.from(fileBuffer)
            .pipe(csv())
            .on('data', (row) => {
              // Add safety check for row data if needed
              parsedData.push(row);
            })
            .on('end', () => {
              logger.info('[Import] CSV parsing complete');
              resolve();
            })
            .on('error', (error) => {
              logger.error('[Import] CSV stream error', { error }); // Log stream-specific error
              reject(error); // Reject the promise on stream error
            });
        });
      } catch (csvError) {
         logger.error("[Import] Caught error during CSV stream processing", { error: csvError });
         // Re-throw to be caught by the main handler's catch block
         throw new Error(`CSV Processing failed: ${csvError.message}`);
      }
    // Use detected MIME type instead of filename extension
    } else if (actualMimeType === 'application/vnd.ms-excel' || actualMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      logger.info(`[Import] Parsing Excel file: ${safeFileName}`);
      try { // Add try/catch for excel parsing
        const workbook = xlsx.read(fileBuffer); // Read directly from buffer for xlsx
        const sheetName = workbook.SheetNames[0];
        parsedData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        logger.info('[Import] Excel parsing complete');
      } catch (excelError) {
          logger.error("[Import] Caught error during Excel processing", { error: excelError });
          throw new Error(`Excel Processing failed: ${excelError.message}`);
      }
    }
    // No 'else' needed here as fileTypeCheckPassed ensures we only handle allowed types

    // --- Database Interaction Logic ---
    if (!parsedData || parsedData.length === 0) {
      logger.warn('[Import] Parsed data is empty, skipping database operations.');
      return res.status(400).json({ error: 'No data found in the uploaded file.' });
    }

    logger.info(`[Import] Parsed ${parsedData.length} rows. Starting database processing.`);

    // 1. Determine Columns and Types & Sanitize
    // Trim original column names before processing
    const originalColumns = Object.keys(parsedData[0]).map(key => key.trim());
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
      logger.debug(`[Import] Column: "${originalName}" -> Sanitized: "${sanitizedName}", Type: ${type}`);
      return { originalName, sanitizedName, type };
    });

    // Check for duplicate sanitized names (though sanitizeDbIdentifier tries to avoid this)
    const sanitizedNames = columnsMetadata.map(c => c.sanitizedName);
    if (new Set(sanitizedNames).size !== sanitizedNames.length) {
        logger.error('[Import] Duplicate sanitized column names detected after sanitization', { sanitizedNames });
        throw new Error('Failed to generate unique column names for the database table.');
    }

    // 2. Generate Unique Table Name
    const timestamp = Date.now();
    // Use 'anonymous' in table name if userId is null
    const userPart = userId ? `user_${userId}` : 'anonymous';
    const dbTableName = sanitizeDbIdentifier(`dataset_${userPart}_${timestamp}_${safeFileName}`);
    logger.info(`[Import] Generated DB Table Name: ${dbTableName}`);

    // --- Overwrite Logic: Check for and clean up existing dataset with the same identifier ---
    // Adjust query based on whether userId is null
    let checkExistingSql;
    let checkParams;
    if (userId) {
        checkExistingSql = `
          SELECT id, db_table_name FROM dataset_metadata
          WHERE user_id = $1 AND dataset_identifier = $2;
        `;
        checkParams = [userId, originalFileName];
    } else {
        // For anonymous, only check based on identifier where user_id IS NULL
        // Note: This means an anonymous user overwrites the *last* anonymous upload with the same name.
        // Consider if a different strategy is needed for anonymous overwrites (e.g., disallow, or keep multiple).
        // For now, we'll allow overwriting the last anonymous upload with the same name.
        checkExistingSql = `
          SELECT id, db_table_name FROM dataset_metadata
          WHERE user_id IS NULL AND dataset_identifier = $1
          ORDER BY created_at DESC LIMIT 1; -- Find the most recent anonymous one
        `;
        checkParams = [originalFileName];
    }

    try {
        const existingResult = await query(checkExistingSql, checkParams);
        if (existingResult.rows.length > 0) {
            const oldMetadataId = existingResult.rows[0].id;
            const oldDbTableName = existingResult.rows[0].db_table_name;
            const userIdentifierLog = userId ? `user ${userId}` : 'anonymous user';
            logger.info(`[Import] Found existing dataset metadata (ID: ${oldMetadataId}) for "${originalFileName}" and ${userIdentifierLog}. Table: "${oldDbTableName}". Proceeding with overwrite.`);

            // Delete old metadata AND invalidate cache
            const deleteMetadataSql = `DELETE FROM dataset_metadata WHERE id = $1;`;
            await query(deleteMetadataSql, [oldMetadataId]);
            cache.del(`metadata_${oldMetadataId}`); // Invalidate cache
            logger.info(`[Import] Deleted old metadata record (ID: ${oldMetadataId}) and invalidated cache.`);

            // Drop old table
            const dropTableSql = `DROP TABLE IF EXISTS "${oldDbTableName}";`; // Ensure table name is quoted
            await query(dropTableSql);
            logger.info(`[Import] Dropped old database table "${oldDbTableName}".`);
        }
    } catch (cleanupError) {
        logger.error('[Import] Error during cleanup of existing dataset', { error: cleanupError });
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
      logger.info(`[Import] Executing CREATE TABLE for ${dbTableName}`); // Don't log full SQL by default
      logger.debug(`[Import] CREATE TABLE SQL: ${createTableSql}`);
      await dbClient.query(createTableSql);
      logger.info(`[Import] Table "${dbTableName}" created successfully.`);

      // 4. Insert Data (Include original_row_index)
      logger.info(`[Import] Preparing to insert ${parsedData.length} rows into "${dbTableName}"...`);
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
            // Ensure TEXT values are strings and trim whitespace
            else if (col.type === 'TEXT' && val !== null && val !== undefined) {
                 val = String(val).trim(); // Trim whitespace here
            }
            return val;
        });

        // Prepend the original index to the values array
        const finalValues = [originalIndex, ...values];
        // console.log(`[Import] Inserting values:`, finalValues); // DEBUG log
        await dbClient.query(insertSql, finalValues);
      }
      logger.info(`[Import] Successfully inserted ${parsedData.length} rows.`);

      // 5. Store Metadata (Add original_row_index to metadata if needed for reference, though maybe not necessary)
      // For now, we don't strictly need to add it to columns_metadata JSON,
      // as the column exists in the table itself.
      const metadataSql = `
        INSERT INTO dataset_metadata (user_id, dataset_identifier, db_table_name, columns_metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
      const metadataValues = [userId, originalFileName, dbTableName, JSON.stringify(columnsMetadata)];
      logger.info('[Import] Storing metadata', { userId, originalFileName, dbTableName });
      const metadataResult = await dbClient.query(metadataSql, metadataValues);
      const datasetId = metadataResult.rows[0].id;
      logger.info(`[Import] Metadata stored successfully. Dataset ID: ${datasetId}`);

      await dbClient.query('COMMIT'); // Commit transaction
      logger.info('[Import] Transaction committed.');

      // 6. Update API Response
      logger.info(`[Import] Sending success response for dataset ID: ${datasetId}`);
      res.status(200).json({
        message: 'File processed and data stored successfully.',
        datasetId: datasetId,
        columnsMetadata: columnsMetadata // Send the mapping info to the frontend
      });

    } catch (dbError) {
      await dbClient.query('ROLLBACK'); // Rollback transaction on error
      logger.error('[Import] Database error during import, transaction rolled back', { error: dbError });
      // Attempt to drop the table if creation succeeded but insertion/metadata failed
      try {
          logger.warn(`[Import] Attempting to drop potentially created table "${dbTableName}" due to error.`);
          await query(`DROP TABLE IF EXISTS "${dbTableName}";`); // Use original query function for cleanup
          logger.info(`[Import] Cleanup successful for table "${dbTableName}".`);
      } catch (cleanupError) {
          logger.error(`[Import] Error during table cleanup for "${dbTableName}"`, { error: cleanupError });
      }
      throw new Error(`Database operation failed: ${dbError.message}`); // Re-throw to be caught by outer handler
    } finally {
      dbClient.release(); // Release the client back to the pool
      logger.debug('[Import] Database client released.');
    }

  } catch (error) {
    logger.error("--- Error during file import ---", { error }); // Add marker for easier log searching
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
    logger.error("Error during CSV export", { error });
    res.status(500).json({ error: 'Failed to export data', details: error.message });
  }
});

// Match profiles endpoint - Modified for DB querying and optional auth
// Define validation rules for /match endpoint
const matchValidationRules = [
  body('datasetId', 'Dataset ID is required').notEmpty(), // Add .isInt() if applicable
  body('criteria', 'Criteria must be an array').isArray(),
  // Optional fields with validation
  body('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  body('pageSize').optional().isInt({ min: 1 }).withMessage('PageSize must be a positive integer'),
  body('sortBy').optional().isString().trim().escape(),
  body('sortDirection').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('SortDirection must be ASC or DESC').toUpperCase(),
  // Basic checks for weights and matchingRules (can be enhanced)
  body('weights').optional().isObject(),
  body('matchingRules').optional().isObject()
];

router.post('/match', optionalAuthMiddleware, matchValidationRules, validateRequest, async (req, res) => { // Use optionalAuthMiddleware, made async
  logger.info('--- /api/match request received ---');
  try {
    // User ID might be null if request is anonymous
    const userId = req.user?.id || null;
    logger.info(`[Match] Requesting User ID: ${userId === null ? 'Anonymous' : userId}`);

    // 1. Get data from request body (Updated: Expect 'criteria' instead of 'searchCriteria')
    const {
        datasetId,
        criteria, // Renamed from searchCriteria to match frontend payload
        weights,
        matchingRules,
        page = 1, // Default to page 1
        pageSize = 20, // Default page size
        sortBy, // Optional column to sort by (original name)
        sortDirection = 'ASC' // Default sort direction
    } = req.body;

    // Use validated and potentially defaulted values
    const pageNum = parseInt(req.body.page || 1, 10);
    const pageSizeNum = parseInt(req.body.pageSize || 20, 10);
    const upperSortDirection = req.body.sortDirection || 'ASC'; // Default handled by validation/logic below

    logger.info('[Match] Received (validated):', { datasetId, criteria, weights, matchingRules, page: pageNum, pageSize: pageSizeNum, sortBy, sortDirection: upperSortDirection });

    // Old validation removed - handled by express-validator

    // 2. Fetch dataset metadata using cache helper
    const metadata = await getMetadataWithCache(datasetId);

    if (!metadata) {
      return res.status(404).json({ error: 'Dataset metadata not found.' });
    }

    // 2.1 Check Authorization: Authenticated users can only access their own datasets. Anonymous users can only access anonymous datasets.
    const ownerId = metadata.owner_id;
    if (ownerId !== userId) { // This covers both cases: (ownerId=null, userId=123) and (ownerId=123, userId=null) and (ownerId=123, userId=456)
        logger.warn(`[Match] Authorization failed: User ${userId} attempted to access dataset ${datasetId} owned by user ${ownerId}.`);
        return res.status(403).json({ error: 'Access denied to this dataset.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadata;
    logger.info(`[Match] Found metadata. DB Table: ${dbTableName}`);

    // 3. Create originalToSanitizedMap and validate criteria attributes
    const originalToSanitizedMap = {};
    const validDbColumns = {}; // Store { sanitizedName: type }
    columnsMetadata.forEach(col => {
        originalToSanitizedMap[col.originalName] = col.sanitizedName;
        validDbColumns[col.sanitizedName] = col.type;
    });

    // Validate that attributes in criteria exist in the dataset (using 'criteria')
    for (const criterion of criteria) {
        if (!originalToSanitizedMap.hasOwnProperty(criterion.attribute)) {
            return res.status(400).json({ error: `Invalid search attribute "${criterion.attribute}" for this dataset.` });
        }
    }

    // 4. Build Parameterized SQL Query
    let whereClause = 'WHERE 1 = 1'; // Start with a clause that's always true
    const queryParams = [];
    let paramIndex = 1;

    // Define allowed operators
    const allowedOperators = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'ILIKE', 'NOT LIKE', 'NOT ILIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'];

    criteria.forEach(criterion => { // Updated to iterate over 'criteria'
      const { attribute, operator: rawOperator, value: rawValue } = criterion; // Expect operator and value
      const sanitizedColName = originalToSanitizedMap[attribute];
      const colType = validDbColumns[sanitizedColName]; // Get the DB type
      const rule = matchingRules?.[attribute] || {}; // Get the rule for this attribute, default to empty object

      // Validate operator, BUT override for partial matching rule
      let operator = rawOperator && allowedOperators.includes(rawOperator.toUpperCase())
                       ? rawOperator.toUpperCase()
                       : (colType === 'TEXT' ? 'ILIKE' : '='); // Default based on type if invalid/missing

      let value = rawValue;
      let queryFragment = '';

      // --- Removed specific override for partial text match ---
      // Let the standard logic below handle operator and value based on input criteria


      // Handle operators that don't need a value
      if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
        queryFragment = `"${sanitizedColName}" ${operator}`;
      } else if (rawValue === undefined || rawValue === null) {
         // Skip criteria if value is missing for operators that require it
         logger.warn(`[Match] Missing value for attribute "${attribute}" with operator "${operator}". Skipping criterion.`);
         return;
      }
      // Standard handling for operators requiring a value
      else {
        // Handle type coercion/validation based on column type AND operator
        try {
          if (operator === 'IN' || operator === 'NOT IN') {
            // Use rawValue for array check
             if (!Array.isArray(rawValue)) {
               throw new Error(`Value for IN/NOT IN must be an array.`);
             }
             if (rawValue.length === 0) {
                  logger.warn(`[Match] Empty array provided for IN/NOT IN for attribute "${attribute}". Skipping criterion.`);
                  return; // Skip if array is empty
             }
             // Coerce array elements based on column type from rawValue
             value = rawValue.map(item => {
               if (colType === 'NUMERIC') return parseFloat(item);
               if (colType === 'BOOLEAN') {
                   if (typeof item === 'string') {
                       const lower = item.trim().toLowerCase();
                       return lower === 'true' ? true : (lower === 'false' ? false : null);
                   }
                   return typeof item === 'boolean' ? item : null;
               }
               return String(item);
             }).filter(item => item !== null && (typeof item === 'boolean' || !isNaN(item) || colType === 'TEXT')); // Simplified filter

             if (value.length === 0) {
                  logger.warn(`[Match] Array became empty after type coercion for IN/NOT IN for attribute "${attribute}". Skipping criterion.`);
                  return; // Skip if array is empty after coercion
             }
             const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
             queryFragment = `"${sanitizedColName}" ${operator} (${placeholders})`;
             queryParams.push(...value); // Add coerced values

          } else {
            // Handle single value operators (use rawValue for coercion)
            value = rawValue; // Reset value to rawValue for coercion
            if (colType === 'NUMERIC') {
              value = parseFloat(value);
              if (isNaN(value)) throw new Error('Invalid numeric value');
            } else if (colType === 'BOOLEAN') {
              if (typeof value === 'string') {
                const lowerVal = value.trim().toLowerCase();
                value = lowerVal === 'true' ? true : (lowerVal === 'false' ? false : null);
              }
              if (typeof value !== 'boolean') throw new Error('Invalid boolean value');
            } else if (colType === 'TIMESTAMP WITH TIME ZONE') {
              value = new Date(value);
              if (isNaN(value.getTime())) throw new Error('Invalid date/timestamp value');
            } else { // TEXT
              value = String(value);
              // For standard LIKE/ILIKE, wildcards must be explicit in input
              // For '=', it will be an exact match
            }

            // Standard operator handling
            queryFragment = `"${sanitizedColName}" ${operator} $${paramIndex++}`;
            queryParams.push(value); // Push the coerced value
          }
        } catch (error) {
           logger.warn(`[Match] Error processing criterion for attribute "${attribute}" (Value: "${rawValue}", Operator: "${operator}", Type: ${colType}): ${error.message}. Skipping criterion.`);
           return; // Skip this criterion on error
        }
      }

      // Add the fragment to the WHERE clause
      if (queryFragment) {
        whereClause += ` AND (${queryFragment})`; // Wrap in parentheses for safety
      }
    });

    // 4.1 Build ORDER BY clause
    let orderByClause = 'ORDER BY "id" ASC'; // Default sort for consistent pagination
    if (sortBy && originalToSanitizedMap.hasOwnProperty(sortBy)) {
        const sanitizedSortBy = originalToSanitizedMap[sortBy];
        // Ensure the sanitized column name is valid before using it
        if (validDbColumns.hasOwnProperty(sanitizedSortBy)) {
             // Use the validated upperSortDirection
            orderByClause = `ORDER BY "${sanitizedSortBy}" ${upperSortDirection}`;
            logger.info(`[Match] Applying sorting: ${orderByClause}`);
        } else {
            logger.warn(`[Match] Invalid sortBy column specified: ${sortBy}. Defaulting to ID sort.`);
        }
    } else if (sortBy) {
         logger.warn(`[Match] sortBy column "${sortBy}" not found in dataset metadata. Defaulting to ID sort.`);
    }

    // 4.2 Build LIMIT and OFFSET clauses
    const limitClause = `LIMIT $${paramIndex++}`;
    queryParams.push(pageSizeNum);
    const offsetClause = `OFFSET $${paramIndex++}`;
    const offset = (pageNum - 1) * pageSizeNum;
    queryParams.push(offset);

    // 4.3 Construct the main SELECT query with filtering, sorting, and pagination
    const selectSql = `SELECT * FROM "${dbTableName}" ${whereClause} ${orderByClause} ${limitClause} ${offsetClause};`;
    logger.info(`[Match] Executing SQL for ${dbTableName}`); // Don't log full SQL by default
    logger.debug(`[Match] SQL: ${selectSql}`);
    logger.debug('[Match] Query Params:', queryParams);

    // 4.4 Construct and execute the COUNT query (using the same WHERE clause but different params)
    const countParams = queryParams.slice(0, paramIndex - 3); // Exclude LIMIT and OFFSET params
    const countSql = `SELECT COUNT(*) AS total_count FROM "${dbTableName}" ${whereClause};`;
    logger.info(`[Match] Executing Count SQL for ${dbTableName}`); // Don't log full SQL by default
    logger.debug(`[Match] Count SQL: ${countSql}`);
    logger.debug('[Match] Count Query Params:', countParams);

    // Execute both queries
    const [dbResult, countResult] = await Promise.all([
        query(selectSql, queryParams),
        query(countSql, countParams)
    ]);

    const filteredProfiles = dbResult.rows;
    const totalItems = parseInt(countResult.rows[0].total_count, 10);
    const totalPages = Math.ceil(totalItems / pageSizeNum);

    logger.info(`[Match] Found ${filteredProfiles.length} profiles on page ${pageNum} (Total matching: ${totalItems}).`);

    // Return empty if DB query yields nothing for the current page
    // The total count might still be > 0
    // if (filteredProfiles.length === 0) {
    //     // Send pagination info even if current page is empty
    //     return res.status(200).json({
    //         matches: [],
    //         pagination: {
    //             totalItems: totalItems,
    //             totalPages: totalPages,
    //             currentPage: pageNum,
    //             pageSize: pageSizeNum
    //         }
    //      });
    // }
    // Let the scoring proceed even if the current page is empty,
    // the final response structure handles the empty matches array.

    // 5. Instantiate Matching Engine and Set Weights
    const engine = new MatchingEngine();
    if (weights) {
        engine.setWeights(weights);
        logger.info('[Match] Applied custom weights:', weights);
    }

    // 6. Calculate Scores using the Map
    // No longer need to reduce searchCriteria, pass the full array to the engine
    // const searchCriteriaObject = searchCriteria.reduce((obj, item) => {
    //     obj[item.attribute] = item.value;
    //     return obj;
    // }, {});

    const results = filteredProfiles.map(profile => {
      // The 'profile' object here has keys matching the sanitized DB column names
      const matchPercentage = engine.calculateMatchScore(
        criteria, // Pass the full criteria array (with operators, without weights)
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

    // 7. Format and Send Response (including pagination)
    const responseData = {
      matches: results.sort((a, b) => b.matchPercentage - a.matchPercentage), // Keep sorting by score for display
      pagination: {
        totalItems: totalItems,
        totalPages: totalPages,
        currentPage: pageNum,
        pageSize: pageSizeNum
      }
    };
    logger.info(`[Match] Sending ${responseData.matches.length} results for page ${pageNum}/${totalPages} (Total items: ${totalItems}).`);
    res.status(200).json(responseData);

  } catch (error) {
    logger.error("--- Matching error ---", { error });
    res.status(500).json({ error: 'Failed to process matching request', details: error.message });
  }
});

// --- Get Dataset Content Route --- (DEPRECATED - Uses filesystem, not DB)
// Define validation rules
const getDatasetValidationRules = [
  param('filename', 'Filename is required').notEmpty().trim().escape() // Basic validation, more specific checks might be needed
];
router.get('/datasets/:filename', authMiddleware, getDatasetValidationRules, validateRequest, async (req, res) => {
  logger.warn('--- Deprecated /api/datasets/:filename endpoint called ---'); // Log warning
  // NOTE: This route appears deprecated as it reads from the filesystem (BASE_UPLOAD_DIR)
  // which was removed in the /import logic. It should likely be removed or updated
  // to fetch data from the database based on a dataset ID instead of filename.
  // For now, keeping the logic but logging a warning.
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

    logger.info(`[Get Dataset] User ${userId} requesting dataset: ${safeRequestedFilename}`);

    const userUploadDir = path.join(BASE_UPLOAD_DIR, `user_${userId}`);
    const filePath = path.join(userUploadDir, safeRequestedFilename);

    // Check if file exists
    try {
      await fs.access(filePath); // Check accessibility
      logger.info(`[Get Dataset] File found at: ${filePath}`);
    } catch (accessError) {
      logger.warn(`[Get Dataset] File not found or inaccessible for user ${userId}: ${filePath}`);
      return res.status(404).json({ error: 'Dataset file not found.' });
    }

    // Read the file content
    const fileBuffer = await fs.readFile(filePath);
    logger.info(`[Get Dataset] File read successfully: ${safeRequestedFilename}`);

    // Parse the file content (similar logic to /import)
    let parsedData = [];
    if (safeRequestedFilename.endsWith('.csv')) {
      logger.info(`[Get Dataset] Parsing retrieved CSV: ${safeRequestedFilename}`);
      await new Promise((resolve, reject) => {
        require('stream').Readable.from(fileBuffer)
          .pipe(csv())
          .on('data', (row) => parsedData.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
    } else if (safeRequestedFilename.endsWith('.xlsx') || safeRequestedFilename.endsWith('.xls')) {
      logger.info(`[Get Dataset] Parsing retrieved Excel: ${safeRequestedFilename}`);
      const workbook = xlsx.read(fileBuffer);
      const sheetName = workbook.SheetNames[0];
      parsedData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      // Should not happen if saved correctly, but good practice
      throw new Error('Unsupported file type encountered during retrieval.');
    }

    logger.info(`[Get Dataset] Successfully parsed retrieved file ${safeRequestedFilename}. Records: ${parsedData.length}`);
    res.status(200).json({ data: parsedData, fileName: safeRequestedFilename });

  } catch (error) {
    logger.error("--- Error retrieving dataset content ---", { error });
    res.status(500).json({ error: 'Failed to retrieve dataset content', details: error.message });
  }
});

// --- Value Suggestions Endpoint ---
// Define validation rules
const suggestValuesValidationRules = [
  queryValidator('datasetId', 'datasetId is required').notEmpty(), // Add .isInt() if applicable
  queryValidator('attributeName', 'attributeName is required').notEmpty().trim().escape(),
  queryValidator('searchTerm', 'searchTerm is required').notEmpty().trim().escape() // Escape to prevent XSS if reflected
];

router.get('/suggest/values', optionalAuthMiddleware, suggestValuesValidationRules, validateRequest, async (req, res) => { // Use optional auth
  logger.info('--- /api/suggest/values request received ---');
  try {
    // User ID might be null if request is anonymous
    const userId = req.user?.id || null;
    logger.info(`[Suggest] Requesting User ID: ${userId === null ? 'Anonymous' : userId}`);

    // Use validated query parameters
    const { datasetId, attributeName, searchTerm } = req.query;
    logger.info('[Suggest] Params (validated):', { datasetId, attributeName, searchTerm });

    // Old validation removed

    // 1. Fetch dataset metadata using cache helper
    const metadata = await getMetadataWithCache(datasetId);

    if (!metadata) {
      return res.status(404).json({ error: 'Dataset metadata not found.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadata;

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

    logger.info(`[Suggest] Executing SQL for ${dbTableName}`); // Don't log full SQL by default
    logger.debug(`[Suggest] SQL: ${suggestSql}`);
    logger.debug('[Suggest] Params:', queryParams);

    const suggestionsResult = await query(suggestSql, queryParams);

    // Extract the values
    const suggestedValues = suggestionsResult.rows.map(row => row[sanitizedColName]);
    logger.info('[Suggest] Found values:', { count: suggestedValues.length });
    logger.debug('[Suggest] Values:', suggestedValues); // Log actual values only at debug level

    res.status(200).json({ suggestions: suggestedValues });

  } catch (error) {
    logger.error("--- Value suggestion error ---", { error });
    res.status(500).json({ error: 'Failed to fetch value suggestions', details: error.message });
  }
});

// --- Dataset Statistics Endpoint ---
// Define validation rules
const datasetIdValidationRule = [
  param('datasetId', 'Dataset ID must be a positive integer').isInt({ min: 1 })
];

router.get('/datasets/:datasetId/stats', optionalAuthMiddleware, datasetIdValidationRule, validateRequest, async (req, res) => { // Use optional auth
  logger.info('--- /api/datasets/:datasetId/stats request received ---');
  try {
    // User ID might be null if request is anonymous
    const userId = req.user?.id || null;
    logger.info(`[Stats] Requesting User ID: ${userId === null ? 'Anonymous' : userId}`);

    // Use validated param
    const { datasetId } = req.params;
    logger.info('[Stats] Params (validated):', { datasetId });

    // Old validation removed

    // 1. Fetch dataset metadata using cache helper
    const metadata = await getMetadataWithCache(datasetId);

    if (!metadata) {
      return res.status(404).json({ error: 'Dataset metadata not found.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadata;
    logger.info(`[Stats] Found metadata for table: ${dbTableName}`);

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
    logger.info(`[Stats] Total rows: ${stats.totalRows}`);

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
          logger.debug(`[Stats] Querying numeric stats for: ${sanitizedColName}`);
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
                logger.debug(`[Stats] Querying percentiles for: ${sanitizedColName}`);
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
               logger.debug(`[Stats] Calculated histogram for ${sanitizedColName}: ${histogramData.length} buckets`);
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
          logger.debug(`[Stats] Querying categorical stats for: ${sanitizedColName}`);
          const categoricalResult = await query(categoricalSql);
          stats.categoricalStats[originalColName] = categoricalResult.rows.map(row => ({
            value: row[sanitizedColName],
            count: parseInt(row.count, 10),
          }));
        }
        // Add more stats for BOOLEAN, TIMESTAMP etc. if needed (e.g., true/false counts for boolean)

      } catch (columnStatError) {
        // Log error for specific column but continue with others
        logger.error(`[Stats] Error calculating stats for column "${sanitizedColName}"`, { error: columnStatError });
        // Ensure columnDetails entry still exists even if stats calculation failed
        if (!stats.columnDetails[originalColName]) {
            stats.columnDetails[originalColName] = { type: colType, nullCount: nullCount }; // Use potentially calculated nullCount
        }
      }
    }

    logger.info('[Stats] Statistics calculation complete.');
    res.status(200).json(stats);

  } catch (error) {
    logger.error("--- Dataset statistics error ---", { error });
    res.status(500).json({ error: 'Failed to fetch dataset statistics', details: error.message });
  }
});

// --- Get Dataset Metadata Endpoint ---
// Use the same validation rule as /stats
router.get('/datasets/:datasetId/metadata', authMiddleware, datasetIdValidationRule, validateRequest, async (req, res) => {
  logger.info('--- /api/datasets/:datasetId/metadata request received ---');
  try {
    const userId = req.user?.id; // Auth middleware ensures this exists
    // No need for !userId check due to authMiddleware

    const { datasetId } = req.params;
    // Validate datasetId is a number
    const numericDatasetId = parseInt(datasetId, 10);
    if (isNaN(numericDatasetId)) {
        logger.error(`[Metadata] Invalid dataset ID format received: ${datasetId}`); // Should be caught by validation now
        return res.status(400).json({ error: 'Invalid dataset ID format.' });
    }
    logger.info(`[Metadata] User ${userId} requesting metadata for dataset ID: ${numericDatasetId}`);

    // Fetch dataset metadata using cache helper (adjusting for user check)
    const metadata = await getMetadataWithCache(numericDatasetId);

    // Check if found and if owner matches the requesting user
    if (!metadata || metadata.owner_id !== userId) {
      logger.warn(`[Metadata] Metadata not found or access denied for ID ${numericDatasetId} and user ${userId}`);
      return res.status(404).json({ error: 'Dataset metadata not found or access denied.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadata; // Use cached metadata
    // We need the original filename, which isn't in the cached object currently.
    // Let's re-query just for that if needed, or ideally add it to the cached object.
    // For now, let's re-query just for the identifier.
    const identifierResult = await query('SELECT dataset_identifier FROM dataset_metadata WHERE id = $1', [numericDatasetId]);
    const originalFileName = identifierResult.rows.length > 0 ? identifierResult.rows[0].dataset_identifier : 'unknown';
    logger.info(`[Metadata] Found metadata for ID ${numericDatasetId}: FileName: ${originalFileName}`);

    // Ensure columnsMetadata is parsed if stored as JSON string (it should be JSONB now, but good practice)
    const parsedColumnsMetadata = typeof columnsMetadata === 'string' ? JSON.parse(columnsMetadata) : columnsMetadata;

    res.status(200).json({
        originalFileName,
        columnsMetadata: parsedColumnsMetadata // Send parsed metadata
    });

  } catch (error) {
    logger.error("--- Dataset metadata retrieval error ---", { error });
    res.status(500).json({ error: 'Failed to fetch dataset metadata', details: error.message });
  }
});


module.exports = router;
