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
// Removed: const { query, pool: dbPool } = require('../config/db'); // Import query function and the instantiated pool
const supabase = require('../config/supabaseClient'); // Import the Supabase client
const { body, query: queryValidator, param, validationResult } = require('express-validator'); // Import validation functions
const logger = require('../config/logger'); // Import logger
// const { fileTypeFromBuffer } = require('file-type'); // Import file-type - Changed to dynamic import due to package being ESM
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

// --- Metadata Caching Helper (Refactored for Supabase) ---
async function getMetadataWithCache(datasetId) {
  if (!supabase) {
      logger.error('[Cache] Supabase client not available for metadata fetch.');
      return null;
  }
  const cacheKey = `metadata_${datasetId}`;
  let metadata = cache.get(cacheKey);

  if (metadata) {
    logger.debug(`[Cache] HIT for metadata: ${cacheKey}`);
    return metadata; // Return cached data
  }

  logger.debug(`[Cache] MISS for metadata: ${cacheKey}. Fetching from DB.`);
  // Fetch from DB if not in cache using Supabase client
  const { data: dbRow, error: dbError } = await supabase
    .from('dataset_metadata')
    .select('db_table_name, columns_metadata, user_id') // user_id is UUID from auth.users
    .eq('id', datasetId)
    .maybeSingle(); // Use maybeSingle() as datasetId might not exist

  if (dbError) {
    logger.error('[Cache] Error fetching metadata from Supabase', { datasetId, error: dbError });
    return null;
  }

  if (!dbRow) {
    logger.warn(`[Cache] Metadata not found in DB for dataset ID: ${datasetId}`);
    return null; // Indicate not found
  }

  // Prepare metadata object (ensure columns_metadata is parsed)
  metadata = {
    db_table_name: dbRow.db_table_name,
    columns_metadata: typeof dbRow.columns_metadata === 'string'
      ? JSON.parse(dbRow.columns_metadata)
      : dbRow.columns_metadata,
    owner_id: dbRow.user_id // Renamed user_id to owner_id for consistency in this function's return value
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
  let dbTableName = null; // Keep track of table name for potential cleanup

  try {
    // Check if Supabase client is available
    if (!supabase) {
        throw new Error('Supabase client is not initialized. Cannot process import.');
    }

    // User ID might be null if request is anonymous (UUID format from Supabase)
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

    // --- File Type Validation (Revised - Prioritize Detected Type) ---
    const { fileTypeFromBuffer } = await import('file-type'); // Dynamically import file-type (ESM)
    const detectedType = await fileTypeFromBuffer(fileBuffer);
    const detectedMime = detectedType ? detectedType.mime : 'unknown';
    const reportedMimeType = req.file.mimetype; // Keep for logging

    logger.info(`[Import] Reported MIME: ${reportedMimeType}, Detected MIME: ${detectedMime}`);

    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
    ];

    let actualMimeType = 'unknown'; // Initialize

    if (allowedMimeTypes.includes(detectedMime)) {
        actualMimeType = detectedMime;
        logger.info(`[Import] Detected type (${actualMimeType}) is allowed. Proceeding.`);
    } else if (detectedMime === 'unknown' && ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(reportedMimeType)) {
        // Fallback for CSV if detection fails but reported type is a common CSV/Excel type
        // This is common as CSV has no reliable magic number, and some clients report Excel MIME for CSV
        actualMimeType = 'text/csv'; // Explicitly set to text/csv for parsing
        logger.warn(`[Import] Detected type is unknown, but reported type (${reportedMimeType}) suggests CSV. Attempting CSV parse.`);
    } else {
        // Reject if detected type is not allowed (and not the CSV fallback case)
        logger.warn(`[Import] Rejected file upload. Detected MIME type "${detectedMime}" is not supported.`, { originalFileName, reportedMimeType });
        return res.status(400).json({ error: `Unsupported file type detected: ${detectedMime}. Allowed: CSV, XLS, XLSX.` });
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

    // --- Database Interaction Logic (Refactored for Supabase) ---
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
    const userPart = userId ? `user_${userId.replace(/-/g, '_')}` : 'anonymous'; // Replace hyphens in UUID for table name
    dbTableName = sanitizeDbIdentifier(`dataset_${userPart}_${timestamp}_${safeFileName}`);
    logger.info(`[Import] Generated DB Table Name: ${dbTableName}`);

    // --- Overwrite Logic: Check for and clean up existing dataset with the same identifier (Refactored for Supabase) ---
    let oldMetadataId = null;
    let oldDbTableName = null;

    try {
        let query = supabase
            .from('dataset_metadata')
            .select('id, db_table_name')
            .eq('dataset_identifier', originalFileName);

        if (userId) {
            query = query.eq('user_id', userId);
        } else {
            query = query.is('user_id', null).order('created_at', { ascending: false }).limit(1);
        }

        const { data: existingData, error: checkError } = await query;

        if (checkError) {
            throw new Error(`Error checking for existing dataset: ${checkError.message}`);
        }

        if (existingData && existingData.length > 0) {
            oldMetadataId = existingData[0].id;
            oldDbTableName = existingData[0].db_table_name;
            const userIdentifierLog = userId ? `user ${userId}` : 'anonymous user';
            logger.info(`[Import] Found existing dataset metadata (ID: ${oldMetadataId}) for "${originalFileName}" and ${userIdentifierLog}. Table: "${oldDbTableName}". Proceeding with overwrite.`);

            // Delete old metadata AND invalidate cache
            const { error: deleteMetaError } = await supabase
                .from('dataset_metadata')
                .delete()
                .eq('id', oldMetadataId);

            if (deleteMetaError) {
                throw new Error(`Failed to delete old metadata record (ID: ${oldMetadataId}): ${deleteMetaError.message}`);
            }
            cache.del(`metadata_${oldMetadataId}`); // Invalidate cache
            logger.info(`[Import] Deleted old metadata record (ID: ${oldMetadataId}) and invalidated cache.`);

            // Drop old table - REQUIRES a custom DB function called via RPC
            logger.info(`[Import] Attempting to drop old database table "${oldDbTableName}" via RPC.`);
            // const { error: dropError } = await supabase.rpc('drop_dataset_table', { table_name: oldDbTableName });
            // if (dropError) {
            //     // Log error but potentially continue, or throw depending on desired strictness
            //     logger.error(`[Import] Error dropping old table "${oldDbTableName}" via RPC`, { error: dropError });
            //     // throw new Error(`Failed to drop old table: ${dropError.message}`);
            // } else {
            //     logger.info(`[Import] Successfully requested drop for old table "${oldDbTableName}".`);
            // }
            logger.warn(`[Import] Dropping table "${oldDbTableName}" requires a custom Supabase function 'drop_dataset_table'. Skipping drop.`);
            // --- Placeholder for RPC call ---
            // TODO: Implement and call `supabase.rpc('drop_dataset_table', { table_name: oldDbTableName })`
            // Ensure the 'drop_dataset_table' function exists in your Supabase SQL editor and has appropriate permissions.

        }
    } catch (cleanupError) {
        logger.error('[Import] Error during cleanup of existing dataset', { error: cleanupError });
        // Decide if this error should prevent the import. For now, we'll let it proceed,
        // but it might leave orphaned tables if dropping fails.
        // Consider throwing an error here if cleanup is critical:
        // throw new Error(`Failed to clean up existing dataset: ${cleanupError.message}`);
    }
    // --- End Overwrite Logic ---


    // --- Transaction logic removed - Handled per operation or via DB functions ---
    // Removed: const dbClient = await dbPool.connect();
    // Removed: await dbClient.query('BEGIN');

    try {
      // 3. Create Table Dynamically - REQUIRES a custom DB function called via RPC
      logger.info(`[Import] Requesting CREATE TABLE for ${dbTableName} via RPC.`);
      const createTableColumnsDef = columnsMetadata.map(col => ({
          name: col.sanitizedName,
          type: col.type
      }));
      // const { error: createError } = await supabase.rpc('create_dataset_table', {
      //     table_name: dbTableName,
      //     columns_def: createTableColumnsDef // Pass column definitions as JSON/array
      // });
      // if (createError) {
      //     throw new Error(`Failed to create table "${dbTableName}" via RPC: ${createError.message}`);
      // }
      logger.warn(`[Import] Creating table "${dbTableName}" requires a custom Supabase function 'create_dataset_table'. Skipping creation.`);
      // --- Placeholder for RPC call ---
      // TODO: Implement and call `supabase.rpc('create_dataset_table', { table_name: dbTableName, columns_def: columnsMetadata })`
      // Ensure the 'create_dataset_table' function exists, handles dynamic SQL safely, and adds the 'id' and 'original_row_index' columns.


      // 4. Insert Data (Refactored for Supabase Batch Insert)
      logger.info(`[Import] Preparing to insert ${parsedData.length} rows into "${dbTableName}"...`);

      const rowsToInsert = parsedData.map((row, i) => {
          const newRow = { original_row_index: i + 1 }; // Add 1-based index
          columnsMetadata.forEach(colMeta => {
              let val = row[colMeta.originalName];
              // Apply same coercion logic as before
              if (colMeta.type === 'NUMERIC') {
                  val = (val === null || val === undefined || val === '') ? null : parseFloat(val);
                  if (isNaN(val)) val = null;
              } else if (colMeta.type === 'BOOLEAN') {
                  if (typeof val === 'string') {
                      const lowerVal = val.trim().toLowerCase();
                      val = lowerVal === 'true' ? true : (lowerVal === 'false' ? false : null);
                  } else if (typeof val !== 'boolean') {
                      val = null;
                  }
              } else if (colMeta.type === 'TIMESTAMP WITH TIME ZONE') {
                   val = (val === null || val === undefined || val === '') ? null : new Date(val);
                   if (isNaN(val.getTime())) val = null;
              } else if (colMeta.type === 'TEXT' && val !== null && val !== undefined) {
                   val = String(val).trim();
              }
              newRow[colMeta.sanitizedName] = val;
          });
          return newRow;
      });

      // Insert data in batches (Supabase client handles batching internally to some extent, but explicit batching for very large files is safer)
      const BATCH_SIZE = 500; // Adjust batch size as needed
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
          const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
          logger.debug(`[Import] Inserting batch ${i / BATCH_SIZE + 1} (${batch.length} rows)`);
          const { error: insertError } = await supabase.from(dbTableName).insert(batch);
          if (insertError) {
              // Log details about the failing batch if possible
              logger.error(`[Import] Error inserting batch starting at index ${i}`, { error: insertError });
              throw new Error(`Database error during data insertion: ${insertError.message}`);
          }
      }
      logger.info(`[Import] Successfully inserted ${parsedData.length} rows.`);

      // 5. Store Metadata (Refactored for Supabase)
      const metadataToInsert = {
          user_id: userId,
          dataset_identifier: originalFileName,
          db_table_name: dbTableName,
          columns_metadata: columnsMetadata // Store as JSONB
      };
      logger.info('[Import] Storing metadata', { userId, originalFileName, dbTableName });

      const { data: insertedMetadata, error: metaInsertError } = await supabase
          .from('dataset_metadata')
          .insert(metadataToInsert)
          .select('id') // Select the ID of the inserted row
          .single(); // Expect only one row to be inserted

      if (metaInsertError) {
          throw new Error(`Database error storing metadata: ${metaInsertError.message}`);
      }

      const datasetId = insertedMetadata.id;
      logger.info(`[Import] Metadata stored successfully. Dataset ID: ${datasetId}`);

      // Removed: await dbClient.query('COMMIT');

      // 6. Update API Response
      logger.info(`[Import] Sending success response for dataset ID: ${datasetId}`);
      res.status(200).json({
        message: 'File processed and data stored successfully.',
        datasetId: datasetId,
        columnsMetadata: columnsMetadata // Send the mapping info to the frontend
      });

    } catch (dbError) {
      // Removed: await dbClient.query('ROLLBACK');
      logger.error('[Import] Database error during import', { error: dbError });

      // Attempt to drop the table if creation *might* have succeeded but subsequent steps failed
      // This still requires the custom DB function
      if (dbTableName) {
          try {
              logger.warn(`[Import] Attempting to drop potentially created table "${dbTableName}" via RPC due to error.`);
              // const { error: dropError } = await supabase.rpc('drop_dataset_table', { table_name: dbTableName });
              // if (dropError) {
              //     logger.error(`[Import] Error during RPC table cleanup for "${dbTableName}"`, { error: dropError });
              // } else {
              //     logger.info(`[Import] Cleanup requested via RPC for table "${dbTableName}".`);
              // }
              logger.warn(`[Import] Dropping table "${dbTableName}" requires a custom Supabase function 'drop_dataset_table'. Skipping drop on error.`);
              // --- Placeholder for RPC call ---
              // TODO: Implement and call `supabase.rpc('drop_dataset_table', { table_name: dbTableName })`
          } catch (cleanupError) {
              logger.error(`[Import] Exception during table cleanup attempt for "${dbTableName}"`, { error: cleanupError });
          }
      }
      // Re-throw the original error to be caught by the outer handler
      throw dbError;
    } finally {
      // Removed: dbClient.release();
      logger.debug('[Import] Database operations finished (no client release needed).');
    }

  } catch (error) {
    logger.error("--- Error during file import ---", { error }); // Add marker for easier log searching
    // Ensure a JSON error response is always sent
    res.status(500).json({ error: 'Failed to process file', details: error.message });
  }
});

// File export endpoint (example: CSV) - No DB interaction, no changes needed
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

// Match profiles endpoint - Modified for DB querying and optional auth (Refactored for Supabase)
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
    // Check if Supabase client is available
    if (!supabase) {
        throw new Error('Supabase client is not initialized. Cannot process match request.');
    }
    // User ID might be null if request is anonymous
    const userId = req.user?.id || null;
    logger.info(`[Match] Requesting User ID: ${userId === null ? 'Anonymous' : userId}`);

    // 1. Get data from request body (Updated: Expect 'criteria' instead of 'searchCriteria')
    const {
        datasetId,
        criteria, // Renamed from searchCriteria to match frontend payload
        weights,
        matchingRules,
        // page = 1, // Default to page 1 - Use validated value below
        // pageSize = 20, // Default page size - Use validated value below
        sortBy, // Optional column to sort by (original name)
        // sortDirection = 'ASC' // Default sort direction - Use validated value below
    } = req.body;

    // Use validated and potentially defaulted values
    const pageNum = parseInt(req.body.page || 1, 10);
    const pageSizeNum = parseInt(req.body.pageSize || 20, 10);
    const upperSortDirection = (req.body.sortDirection || 'ASC').toUpperCase(); // Default handled by validation/logic below

    logger.info('[Match] Received (validated):', { datasetId, criteria, weights, matchingRules, page: pageNum, pageSize: pageSizeNum, sortBy, sortDirection: upperSortDirection });

    // Old validation removed - handled by express-validator

    // 2. Fetch dataset metadata using cache helper
    const metadata = await getMetadataWithCache(datasetId);

    if (!metadata) {
      return res.status(404).json({ error: 'Dataset metadata not found.' });
    }

    // 2.1 Check Authorization: Authenticated users can only access their own datasets. Anonymous users can only access anonymous datasets.
    const ownerId = metadata.owner_id; // owner_id is UUID or null
    if (ownerId !== userId) { // This covers both cases: (ownerId=null, userId=UUID) and (ownerId=UUID, userId=null) and (ownerId=UUID1, userId=UUID2)
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

    // 4. Build Supabase Query
    let query = supabase.from(dbTableName).select('*', { count: 'exact' }); // Request count

    // Apply filters based on criteria
    criteria.forEach(criterion => {
      const { attribute, operator: rawOperator, value: rawValue } = criterion;
      const sanitizedColName = originalToSanitizedMap[attribute];
      const colType = validDbColumns[sanitizedColName];
      const operator = rawOperator?.toUpperCase() || (colType === 'TEXT' ? 'ILIKE' : 'EQ'); // Default operator

      // Basic operator mapping (can be expanded)
      // Note: Supabase client uses method names like eq, neq, gt, gte, lt, lte, like, ilike, is, in, contains, containedBy etc.
      try {
          let filterValue = rawValue;
          // Type coercion (similar to before, adjust if needed)
          if (colType === 'NUMERIC' && typeof filterValue !== 'number') filterValue = parseFloat(filterValue);
          if (colType === 'BOOLEAN' && typeof filterValue !== 'boolean') {
              if (typeof filterValue === 'string') {
                  const lower = filterValue.trim().toLowerCase();
                  filterValue = lower === 'true' ? true : (lower === 'false' ? false : null);
              } else filterValue = null;
          }
          if (colType === 'TIMESTAMP WITH TIME ZONE' && !(filterValue instanceof Date)) filterValue = new Date(filterValue);
          if (colType === 'TEXT' && typeof filterValue !== 'string') filterValue = String(filterValue);

          // Apply filter based on operator
          switch (operator) {
              case '=': case 'EQ': query = query.eq(sanitizedColName, filterValue); break;
              case '!=': case 'NEQ': query = query.neq(sanitizedColName, filterValue); break;
              case '>': case 'GT': query = query.gt(sanitizedColName, filterValue); break;
              case '>=': case 'GTE': query = query.gte(sanitizedColName, filterValue); break;
              case '<': case 'LT': query = query.lt(sanitizedColName, filterValue); break;
              case '<=': case 'LTE': query = query.lte(sanitizedColName, filterValue); break;
              case 'LIKE': query = query.like(sanitizedColName, filterValue); break; // Requires explicit wildcards in value
              case 'ILIKE': query = query.ilike(sanitizedColName, filterValue); break; // Requires explicit wildcards in value
              case 'IS NULL': query = query.is(sanitizedColName, null); break;
              case 'IS NOT NULL': query = query.not(sanitizedColName, 'is', null); break;
              case 'IN':
                  if (Array.isArray(filterValue) && filterValue.length > 0) {
                      query = query.in(sanitizedColName, filterValue);
                  } else {
                     logger.warn(`[Match] Invalid or empty array for IN operator on ${attribute}. Skipping filter.`);
                  }
                  break;
              // Add NOT LIKE, NOT ILIKE, NOT IN if needed
              default:
                  logger.warn(`[Match] Unsupported operator "${operator}" for attribute "${attribute}". Skipping filter.`);
          }
      } catch (error) {
          logger.warn(`[Match] Error processing criterion for attribute "${attribute}" (Value: "${rawValue}", Operator: "${operator}", Type: ${colType}): ${error.message}. Skipping filter.`);
      }
    });

    // Apply sorting
    let isValidSortBy = false;
    if (sortBy && originalToSanitizedMap.hasOwnProperty(sortBy)) {
        const sanitizedSortBy = originalToSanitizedMap[sortBy];
        if (validDbColumns.hasOwnProperty(sanitizedSortBy)) {
            query = query.order(sanitizedSortBy, { ascending: upperSortDirection === 'ASC' });
            isValidSortBy = true;
            logger.info(`[Match] Applying sorting: ORDER BY ${sanitizedSortBy} ${upperSortDirection}`);
        } else {
             logger.warn(`[Match] Invalid sortBy column specified: ${sortBy}. Defaulting to ID sort.`);
        }
    } else if (sortBy) {
         logger.warn(`[Match] sortBy column "${sortBy}" not found in dataset metadata. Defaulting to ID sort.`);
    }
    // Default sort if no valid sortBy provided
    if (!isValidSortBy) {
        query = query.order('id', { ascending: true }); // Default sort by primary key
    }


    // Apply pagination
    const offset = (pageNum - 1) * pageSizeNum;
    query = query.range(offset, offset + pageSizeNum - 1);

    // Execute the query
    logger.info(`[Match] Executing Supabase query for ${dbTableName}`);
    const { data: filteredProfiles, error: dbError, count: totalItems } = await query;

    if (dbError) {
        throw new Error(`Database error fetching match data: ${dbError.message}`);
    }

    // totalItems comes from the { count: 'exact' } option
    const totalPages = totalItems ? Math.ceil(totalItems / pageSizeNum) : 0;

    logger.info(`[Match] Found ${filteredProfiles ? filteredProfiles.length : 0} profiles on page ${pageNum} (Total matching: ${totalItems || 0}).`);


    // 5. Instantiate Matching Engine and Set Weights
    const engine = new MatchingEngine();
    if (weights) {
        engine.setWeights(weights);
        logger.info('[Match] Applied custom weights:', weights);
    }

    // 6. Calculate Scores using the Map
    const results = (filteredProfiles || []).map(profile => {
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
        totalItems: totalItems || 0,
        totalPages: totalPages,
        currentPage: pageNum,
        pageSize: pageSizeNum
      }
    };
    logger.info(`[Match] Sending ${responseData.matches.length} results for page ${pageNum}/${totalPages} (Total items: ${totalItems || 0}).`);
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

    // --- Filesystem logic removed ---
    // const userUploadDir = path.join(BASE_UPLOAD_DIR, `user_${userId}`);
    // const filePath = path.join(userUploadDir, safeRequestedFilename);
    // try {
    //   await fs.access(filePath);
    //   logger.info(`[Get Dataset] File found at: ${filePath}`);
    // } catch (accessError) {
    //   logger.warn(`[Get Dataset] File not found or inaccessible for user ${userId}: ${filePath}`);
    //   return res.status(404).json({ error: 'Dataset file not found.' });
    // }
    // const fileBuffer = await fs.readFile(filePath);
    // logger.info(`[Get Dataset] File read successfully: ${safeRequestedFilename}`);
    // --- End Filesystem logic removed ---

    // Return error as this endpoint is deprecated and relies on removed filesystem logic
    return res.status(410).json({ error: 'This endpoint is deprecated. Use dataset ID based endpoints.' }); // 410 Gone

  } catch (error) {
    logger.error("--- Error retrieving dataset content ---", { error });
    res.status(500).json({ error: 'Failed to retrieve dataset content', details: error.message });
  }
});

// --- Value Suggestions Endpoint --- (Refactored for Supabase)
// Define validation rules
const suggestValuesValidationRules = [
  queryValidator('datasetId', 'datasetId is required').notEmpty(), // Add .isInt() if applicable
  queryValidator('attributeName', 'attributeName is required').notEmpty().trim().escape(),
  queryValidator('searchTerm', 'searchTerm is required').notEmpty().trim().escape() // Escape to prevent XSS if reflected
];

router.get('/suggest/values', optionalAuthMiddleware, suggestValuesValidationRules, validateRequest, async (req, res) => { // Use optional auth
  logger.info('--- /api/suggest/values request received ---');
  try {
    // Check if Supabase client is available
    if (!supabase) {
        throw new Error('Supabase client is not initialized. Cannot process suggestions request.');
    }
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

    // Authorization Check
    const ownerId = metadata.owner_id;
    if (ownerId !== userId) {
        logger.warn(`[Suggest] Authorization failed: User ${userId} attempted to access dataset ${datasetId} owned by user ${ownerId}.`);
        return res.status(403).json({ error: 'Access denied to this dataset.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadata;

    // Find the sanitized name for the requested attribute
    const attributeMeta = columnsMetadata.find(col => col.originalName === attributeName);
    if (!attributeMeta) {
      return res.status(400).json({ error: `Attribute "${attributeName}" not found in this dataset.` });
    }
    const sanitizedColName = attributeMeta.sanitizedName;
    // const colType = attributeMeta.type; // Get type for potential casting - not strictly needed for ILIKE on TEXT cast

    // 2. Query for distinct values matching the searchTerm using Supabase
    // Cast to TEXT for consistent ILIKE comparison
    // Note: Supabase doesn't have a direct "distinct" modifier in the JS client easily combined with select.
    // Using RPC to call a function that performs the distinct query is often cleaner.
    // Alternative: Fetch more rows and filter distinct in backend (less efficient).
    // Let's use RPC assuming a helper function `get_distinct_values(table_name TEXT, column_name TEXT, search_term TEXT)` exists.

    logger.info(`[Suggest] Querying distinct values for ${sanitizedColName} in ${dbTableName} via RPC.`);
    const { data: suggestedValues, error: rpcError } = await supabase.rpc('get_distinct_values', {
        p_table_name: dbTableName,
        p_column_name: sanitizedColName,
        p_search_term: searchTerm // The function should handle adding wildcards and LIMIT
    });

    // TODO: Create the following PostgreSQL function in your Supabase SQL editor:
    /*
    CREATE OR REPLACE FUNCTION get_distinct_values(p_table_name TEXT, p_column_name TEXT, p_search_term TEXT)
    RETURNS SETOF TEXT -- Or the actual column type if known and consistent
    LANGUAGE plpgsql
    AS $$
    BEGIN
        RETURN QUERY EXECUTE format(
            'SELECT DISTINCT %I::TEXT
             FROM %I
             WHERE %I::TEXT ILIKE $1
             LIMIT 10',
             p_column_name, p_table_name, p_column_name
        ) USING '%' || p_search_term || '%';
    END;
    $$;
    */

    if (rpcError) {
        throw new Error(`Database error fetching suggestions: ${rpcError.message}`);
    }

    logger.info('[Suggest] Found values via RPC:', { count: suggestedValues ? suggestedValues.length : 0 });
    logger.debug('[Suggest] Values:', suggestedValues); // Log actual values only at debug level

    res.status(200).json({ suggestions: suggestedValues || [] }); // Return empty array if null

  } catch (error) {
    logger.error("--- Value suggestion error ---", { error });
    res.status(500).json({ error: 'Failed to fetch value suggestions', details: error.message });
  }
});

// --- Dataset Statistics Endpoint --- (Refactored for Supabase)
// Define validation rules
const datasetIdValidationRule = [
  param('datasetId', 'Dataset ID must be a positive integer').isInt({ min: 1 })
];

router.get('/datasets/:datasetId/stats', optionalAuthMiddleware, datasetIdValidationRule, validateRequest, async (req, res) => { // Use optional auth
  logger.info('--- /api/datasets/:datasetId/stats request received ---');
  try {
    // Check if Supabase client is available
    if (!supabase) {
        throw new Error('Supabase client is not initialized. Cannot process stats request.');
    }
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

    // Authorization Check
    const ownerId = metadata.owner_id;
    if (ownerId !== userId) {
        logger.warn(`[Stats] Authorization failed: User ${userId} attempted to access dataset ${datasetId} owned by user ${ownerId}.`);
        return res.status(403).json({ error: 'Access denied to this dataset.' });
    }

    const { db_table_name: dbTableName, columns_metadata: columnsMetadata } = metadata;
    logger.info(`[Stats] Found metadata for table: ${dbTableName}`);

    // 2. Calculate Statistics using Supabase RPC
    // It's much more efficient to calculate stats in the database using a single function call
    // than making multiple queries from the backend for each column.

    logger.info(`[Stats] Calculating statistics for table ${dbTableName} via RPC.`);
    const { data: stats, error: rpcError } = await supabase.rpc('calculate_dataset_stats', {
        p_table_name: dbTableName,
        p_columns_metadata: columnsMetadata // Pass metadata to the function
    });

    // TODO: Create the following (potentially complex) PostgreSQL function 'calculate_dataset_stats'
    // in your Supabase SQL editor. This function needs to:
    // - Accept table name and column metadata (JSONB) as input.
    // - Dynamically build and execute queries to calculate:
    //   - Total row count.
    //   - For each column: null count.
    //   - For NUMERIC columns: min, max, avg, stddev, p25, median, p75, histogram data.
    //   - For TEXT columns: top N frequent values.
    //   - Potentially stats for BOOLEAN, DATE types.
    // - Return a JSON object containing all the calculated statistics, structured similarly
    //   to the 'stats' object previously built in the Node.js code.
    // - Handle potential errors during dynamic SQL execution gracefully.

    if (rpcError) {
        throw new Error(`Database error calculating statistics via RPC: ${rpcError.message}`);
    }

    if (!stats) {
        // This might happen if the RPC function returns null or an error occurred silently
        logger.warn(`[Stats] RPC call 'calculate_dataset_stats' returned no data for table ${dbTableName}.`);
        return res.status(500).json({ error: 'Failed to calculate dataset statistics (RPC returned null).' });
    }


    logger.info('[Stats] Statistics calculation complete via RPC.');
    res.status(200).json(stats); // Return the stats object calculated by the DB function

  } catch (error) {
    logger.error("--- Dataset statistics error ---", { error });
    res.status(500).json({ error: 'Failed to fetch dataset statistics', details: error.message });
  }
});

// --- Get Dataset Metadata Endpoint --- (Refactored for Supabase)
// Use the same validation rule as /stats
router.get('/datasets/:datasetId/metadata', authMiddleware, datasetIdValidationRule, validateRequest, async (req, res) => {
  logger.info('--- /api/datasets/:datasetId/metadata request received ---');
  try {
    // Check if Supabase client is available
    if (!supabase) {
        throw new Error('Supabase client is not initialized. Cannot process metadata request.');
    }
    const userId = req.user?.id; // Auth middleware ensures this exists

    const { datasetId } = req.params;
    // Validation ensures datasetId is an integer string, parse it
    const numericDatasetId = parseInt(datasetId, 10);

    logger.info(`[Metadata] User ${userId} requesting metadata for dataset ID: ${numericDatasetId}`);

    // Fetch dataset metadata using cache helper (adjusting for user check)
    const metadata = await getMetadataWithCache(numericDatasetId);

    // Check if found and if owner matches the requesting user
    if (!metadata || metadata.owner_id !== userId) {
      logger.warn(`[Metadata] Metadata not found or access denied for ID ${numericDatasetId} and user ${userId}`);
      return res.status(404).json({ error: 'Dataset metadata not found or access denied.' });
    }

    // We need the original filename, which isn't in the cached object currently.
    // Fetch it directly.
    const { data: metaRecord, error: metaError } = await supabase
        .from('dataset_metadata')
        .select('dataset_identifier')
        .eq('id', numericDatasetId)
        .single();

    if (metaError || !metaRecord) {
        logger.error(`[Metadata] Failed to fetch dataset_identifier for ID ${numericDatasetId}`, { error: metaError });
        // Proceed without originalFileName or return error? Let's proceed.
    }

    const originalFileName = metaRecord ? metaRecord.dataset_identifier : 'unknown';
    logger.info(`[Metadata] Found metadata for ID ${numericDatasetId}: FileName: ${originalFileName}`);

    // Ensure columnsMetadata is parsed if stored as JSON string (it should be JSONB now, but good practice)
    const parsedColumnsMetadata = typeof metadata.columns_metadata === 'string'
        ? JSON.parse(metadata.columns_metadata)
        : metadata.columns_metadata;

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
