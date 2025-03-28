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

// Define the base upload directory path
const BASE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

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
    const safeFileName = path.basename(originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');

    // Create user-specific directory path
    const userUploadDir = path.join(BASE_UPLOAD_DIR, `user_${userId}`);
    const filePath = path.join(userUploadDir, safeFileName);

    // Ensure user-specific upload directory exists
    try {
      console.log(`[Import] Attempting to create directory: ${userUploadDir}`); // Added log
      await fs.mkdir(userUploadDir, { recursive: true });
      console.log(`[Import] User upload directory ensured: ${userUploadDir}`); // Added log
    } catch (dirError) {
      console.error(`[Import] Error creating user upload directory ${userUploadDir}:`, dirError); // Added log marker
      // Log the specific error code if available
      console.error(`[Import] Directory creation failed with code: ${dirError.code}`);
      throw new Error(`Failed to ensure user upload directory exists: ${dirError.message}`);
    }

    // Save the file to disk in the user's directory
    try {
      console.log(`[Import] Attempting to write file to: ${filePath}`); // Added log
      await fs.writeFile(filePath, fileBuffer);
      console.log(`[Import] File saved successfully to: ${filePath}`); // Added log
    } catch (writeError) {
      console.error(`[Import] Error writing file to ${filePath}:`, writeError); // Added log marker
      // Log the specific error code if available
      console.error(`[Import] File writing failed with code: ${writeError.code}`);
      throw new Error(`Failed to save uploaded file: ${writeError.message}`);
    }

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

    // Return the potentially sanitized filename used for saving
    console.log(`Sending success response for ${safeFileName}. Parsed data length: ${parsedData.length}`);
    res.status(200).json({ message: 'File uploaded, saved, and parsed successfully', data: parsedData, fileName: safeFileName });
  } catch (error) {
    console.error("--- Error during file import ---:", error); // Add marker for easier log searching
    // Ensure a JSON error response is always sent
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

// Match profiles endpoint
router.post('/match', cors(), (req, res) => {
  console.log('Inside /match route handler');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  if (!req.body) {
    console.error('No request body received');
    return res.status(400).json({ error: 'No request body received' });
  }
  try {
    const { baseProfile, compareProfiles, matchingRules, weights } = req.body;
    const engine = new MatchingEngine();
    engine.setWeights(weights);

    const results = compareProfiles.map(profile => {
      const mappedProfile = {};
      for (const key in baseProfile) {
        mappedProfile[key] = profile[key] || ''; // Use empty string if property doesn't exist
      }
      return {
        profileId: profile.id,
        matchPercentage: engine.calculateMatchScore(baseProfile, mappedProfile, matchingRules)
      };
    });
    console.log('Matching results:', results);
    const responseData = {
      baseProfileId: baseProfile.id,
      matches: results.sort((a, b) => b.matchPercentage - a.matchPercentage)
    };
    console.log('Response data:', responseData);
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Matching error:", error);
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

module.exports = router;
