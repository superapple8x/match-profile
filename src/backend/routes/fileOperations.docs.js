/**
 * @swagger
 * tags:
 *   name: Datasets & Matching
 *   description: API endpoints for managing datasets (import, metadata, stats) and performing profile matching.
 *
 * components:
 *   schemas:
 *     ColumnMetadata:
 *       type: object
 *       properties:
 *         originalName:
 *           type: string
 *           description: The original column name from the uploaded file.
 *           example: "First Name"
 *         sanitizedName:
 *           type: string
 *           description: The sanitized column name used in the database table.
 *           example: "first_name"
 *         type:
 *           type: string
 *           description: The inferred database type for the column.
 *           enum: [TEXT, NUMERIC, BOOLEAN, TIMESTAMP WITH TIME ZONE]
 *           example: TEXT
 *
 *     ImportResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: File processed and data stored successfully.
 *         datasetId:
 *           type: integer
 *           description: The unique ID assigned to the newly imported dataset.
 *           example: 42
 *         columnsMetadata:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ColumnMetadata'
 *
 *     MatchCriterion:
 *       type: object
 *       required:
 *         - attribute
 *         - operator
 *         - value
 *       properties:
 *         attribute:
 *           type: string
 *           description: The original name of the attribute (column) to filter on.
 *           example: "Age"
 *         operator:
 *           type: string
 *           description: The comparison operator.
 *           enum: ["=", "!=", ">", "<", ">=", "<=", "LIKE", "ILIKE", "NOT LIKE", "NOT ILIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL"]
 *           example: ">="
 *         value:
 *           # type can be string, number, boolean, or array (for IN/NOT IN)
 *           description: The value to compare against. For IN/NOT IN, this should be an array. For IS NULL/IS NOT NULL, this can be omitted or null.
 *           example: 30
 *
 *     MatchRequest:
 *       type: object
 *       required:
 *         - datasetId
 *         - criteria
 *       properties:
 *         datasetId:
 *           type: integer
 *           description: The ID of the dataset to perform matching against.
 *           example: 42
 *         criteria:
 *           type: array
 *           description: An array of criteria objects used for filtering records before scoring.
 *           items:
 *             $ref: '#/components/schemas/MatchCriterion'
 *         weights:
 *           type: object
 *           description: Optional weights for specific attributes (original names) to influence the match score. Higher weights mean more importance. Default weight is 1.
 *           additionalProperties:
 *             type: number
 *             format: float
 *           example:
 *             City: 2.5
 *             Skill: 1.5
 *         matchingRules:
 *           type: object
 *           description: Optional rules for specific attributes (original names) to define matching behavior (e.g., partial match).
 *           additionalProperties:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [exact, partial]
 *                 description: Type of matching rule.
 *                 example: partial
 *           example:
 *             Job Title:
 *               type: partial
 *         page:
 *           type: integer
 *           description: The page number for pagination (1-based).
 *           default: 1
 *           example: 1
 *         pageSize:
 *           type: integer
 *           description: The number of results per page.
 *           default: 20
 *           example: 10
 *         sortBy:
 *           type: string
 *           description: The original attribute name to sort the results by before scoring.
 *           example: "LastName"
 *         sortDirection:
 *           type: string
 *           description: The sort direction.
 *           enum: [ASC, DESC]
 *           default: ASC
 *           example: DESC
 *
 *     MatchResult:
 *       type: object
 *       properties:
 *         matchPercentage:
 *           type: number
 *           format: float
 *           description: The calculated match score percentage (0-100).
 *           example: 85.7
 *         profileData:
 *           type: object
 *           description: The full data record from the dataset that matched. Keys are the sanitized column names. Includes 'id' and 'original_row_index'.
 *           example:
 *             id: 123
 *             original_row_index: 5
 *             first_name: "Jane"
 *             last_name: "Doe"
 *             age: 32
 *             city: "New York"
 *
 *     PaginationInfo:
 *       type: object
 *       properties:
 *         totalItems:
 *           type: integer
 *           description: Total number of items matching the filter criteria across all pages.
 *           example: 153
 *         totalPages:
 *           type: integer
 *           description: Total number of pages available.
 *           example: 16
 *         currentPage:
 *           type: integer
 *           description: The current page number (1-based).
 *           example: 1
 *         pageSize:
 *           type: integer
 *           description: The number of items per page.
 *           example: 10
 *
 *     MatchResponse:
 *       type: object
 *       properties:
 *         matches:
 *           type: array
 *           description: An array of matching profiles, sorted by match percentage (descending).
 *           items:
 *             $ref: '#/components/schemas/MatchResult'
 *         pagination:
 *           $ref: '#/components/schemas/PaginationInfo'
 *
 *     SuggestionResponse:
 *       type: object
 *       properties:
 *         suggestions:
 *           type: array
 *           description: An array of distinct string values matching the search term for the given attribute.
 *           items:
 *             type: string
 *           example: ["Developer", "Senior Developer", "Lead Developer"]
 *
 *     NumericColumnStats:
 *       type: object
 *       properties:
 *         min:
 *           type: number
 *           format: float
 *           nullable: true
 *           example: 18
 *         max:
 *           type: number
 *           format: float
 *           nullable: true
 *           example: 65
 *         average:
 *           type: number
 *           format: float
 *           nullable: true
 *           example: 35.2
 *         standardDeviation:
 *           type: number
 *           format: float
 *           nullable: true
 *           example: 8.1
 *         p25:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: 25th percentile.
 *           example: 28
 *         median:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: 50th percentile (median).
 *           example: 34
 *         p75:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: 75th percentile.
 *           example: 42
 *         histogram:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               bucket:
 *                 type: integer
 *               count:
 *                 type: integer
 *               lower_bound:
 *                 type: number
 *                 format: float
 *               upper_bound:
 *                 type: number
 *                 format: float
 *           example: [{ bucket: 1, count: 10, lower_bound: 18, upper_bound: 22.7 }]
 *
 *     CategoricalValueCount:
 *       type: object
 *       properties:
 *         value:
 *           type: string
 *           example: "New York"
 *         count:
 *           type: integer
 *           example: 55
 *
 *     CategoricalColumnStats:
 *       type: array
 *       description: An array of the top 5 most frequent non-empty values and their counts.
 *       items:
 *         $ref: '#/components/schemas/CategoricalValueCount'
 *
 *     ColumnDetails:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           description: The inferred database type for the column.
 *           enum: [TEXT, NUMERIC, BOOLEAN, TIMESTAMP WITH TIME ZONE]
 *           example: NUMERIC
 *         nullCount:
 *           type: integer
 *           description: The number of null values in this column.
 *           example: 5
 *
 *     StatsResponse:
 *       type: object
 *       properties:
 *         totalRows:
 *           type: integer
 *           example: 250
 *         numericStats:
 *           type: object
 *           description: Statistics for numeric columns (keyed by original column name).
 *           additionalProperties:
 *             $ref: '#/components/schemas/NumericColumnStats'
 *         categoricalStats:
 *           type: object
 *           description: Statistics for text columns (keyed by original column name).
 *           additionalProperties:
 *             $ref: '#/components/schemas/CategoricalColumnStats'
 *         columnDetails:
 *           type: object
 *           description: Basic details (type, null count) for all columns (keyed by original column name).
 *           additionalProperties:
 *             $ref: '#/components/schemas/ColumnDetails'
 *
 *     MetadataResponse:
 *       type: object
 *       properties:
 *         originalFileName:
 *           type: string
 *           description: The original name of the uploaded file for this dataset.
 *           example: "employees.xlsx"
 *         columnsMetadata:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ColumnMetadata'
 *
 *   securitySchemes:
 *     bearerAuth: # Defined here for reference within this file, also defined in swaggerOptions.js
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT token obtained from /auth/login. Prefix with 'Bearer '.
 */

// --- Route Definitions ---

/**
 * @swagger
 * /import:
 *   post:
 *     summary: Upload and import a dataset file
 *     tags: [Datasets & Matching]
 *     description: >
 *       Uploads a CSV or Excel file (.csv, .xls, .xlsx). The server parses the file,
 *       infers column types, creates a new database table for the data, and stores metadata.
 *       If a dataset with the same original filename already exists for the authenticated user
 *       (or for anonymous uploads), the previous dataset (metadata and table) will be deleted
 *       before importing the new one. Supports optional authentication; if authenticated,
 *       the dataset is associated with the user.
 *     security:
 *       - bearerAuth: [] # Indicates JWT Bearer token is optional
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The CSV or Excel file to upload. Max size 100MB.
 *           encoding:
 *             file:
 *               contentType: text/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *     responses:
 *       '200':
 *         description: File processed and data stored successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImportResponse'
 *       '400':
 *         description: Bad request (e.g., no file uploaded, invalid file type, parsing error, empty file, duplicate sanitized column names).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 error:
 *                   example: "Invalid Excel file format detected."
 *       '401':
 *         description: Unauthorized (JWT token is invalid or expired - only if token was provided).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 message:
 *                   example: "Invalid token."
 *       '500':
 *         description: Internal server error during file processing or database operations.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 error:
 *                   example: "Failed to process file"
 *                 details:
 *                   example: "Database operation failed: connection refused"
 */

/**
 * @swagger
 * /match:
 *   post:
 *     summary: Perform profile matching against a dataset
 *     tags: [Datasets & Matching]
 *     description: >
 *       Filters records in a specified dataset based on the provided criteria,
 *       calculates a match score for each filtered record based on the criteria and optional weights/rules,
 *       and returns a paginated list of results sorted by match score (descending).
 *       Supports optional authentication; users can only match against datasets they own or anonymous datasets if they are anonymous.
 *     security:
 *       - bearerAuth: [] # Optional JWT Bearer token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MatchRequest'
 *     responses:
 *       '200':
 *         description: Matching successful. Returns matches and pagination info.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MatchResponse'
 *       '400':
 *         description: Bad request (e.g., missing required fields, invalid criteria attribute, invalid pagination parameters).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized (JWT token is invalid or expired - only if token was provided).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Forbidden (User does not have permission to access the requested dataset).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 error:
 *                   example: "Access denied to this dataset."
 *       '404':
 *         description: Dataset metadata not found for the given datasetId.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               properties:
 *                 error:
 *                   example: "Dataset metadata not found."
 *       '500':
 *         description: Internal server error during matching process.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /suggest/values:
 *   get:
 *     summary: Get value suggestions for an attribute
 *     tags: [Datasets & Matching]
 *     description: >
 *       Provides distinct value suggestions for a specified attribute (column) within a dataset,
 *       based on a partial search term. Useful for typeahead/autocomplete functionality.
 *       Supports optional authentication; users can only get suggestions for datasets they own or anonymous datasets if they are anonymous.
 *     security:
 *       - bearerAuth: [] # Optional JWT Bearer token
 *     parameters:
 *       - in: query
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the dataset to search within.
 *         example: 42
 *       - in: query
 *         name: attributeName
 *         required: true
 *         schema:
 *           type: string
 *         description: The original name of the attribute (column) to get suggestions for.
 *         example: "City"
 *       - in: query
 *         name: searchTerm
 *         required: true
 *         schema:
 *           type: string
 *         description: The partial text to search for within the attribute's values.
 *         example: "New"
 *     responses:
 *       '200':
 *         description: Successfully retrieved suggestions.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuggestionResponse'
 *       '400':
 *         description: Bad request (e.g., missing parameters, attribute not found in dataset).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized (JWT token is invalid or expired - only if token was provided).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Forbidden (User does not have permission to access the requested dataset).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Dataset metadata not found for the given datasetId.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error while fetching suggestions.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /datasets/{datasetId}/stats:
 *   get:
 *     summary: Get statistics for a dataset
 *     tags: [Datasets & Matching]
 *     description: >
 *       Retrieves summary statistics for a specified dataset, including total row count,
 *       and detailed statistics for numeric (min, max, avg, stddev, percentiles, histogram)
 *       and categorical (top values) columns. Also provides basic info (type, null count) for all columns.
 *       Supports optional authentication; users can only get stats for datasets they own or anonymous datasets if they are anonymous.
 *     security:
 *       - bearerAuth: [] # Optional JWT Bearer token
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the dataset to retrieve statistics for.
 *         example: 42
 *     responses:
 *       '200':
 *         description: Successfully retrieved dataset statistics.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatsResponse'
 *       '400':
 *         description: Bad request (e.g., invalid dataset ID format).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized (JWT token is invalid or expired - only if token was provided).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Forbidden (User does not have permission to access the requested dataset).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Dataset metadata not found for the given datasetId.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error while calculating statistics.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /datasets/{datasetId}/metadata:
 *   get:
 *     summary: Get metadata for a dataset
 *     tags: [Datasets & Matching]
 *     description: >
 *       Retrieves metadata for a specific dataset, including the original filename
 *       and details about each column (original name, sanitized name, inferred type).
 *       Requires authentication; users can only retrieve metadata for datasets they own.
 *     security:
 *       - bearerAuth: [] # JWT Bearer token is REQUIRED
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the dataset to retrieve metadata for.
 *         example: 42
 *     responses:
 *       '200':
 *         description: Successfully retrieved dataset metadata.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetadataResponse'
 *       '400':
 *         description: Bad request (e.g., invalid dataset ID format).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized (Missing, invalid, or expired JWT token).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Forbidden (User does not own the dataset).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Dataset metadata not found for the given datasetId.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error while retrieving metadata.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */