const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const MatchingEngine = require('../matchingEngine');
const cors = require('cors');
const fs = require('fs').promises; // Use fs.promises
const path = require('path'); // Need path module

// Define the upload directory path
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Multer setup for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB limit
  }
});

// File import endpoint
router.post('/import', upload.single('file'), async (req, res) => {
  console.log('--- /api/import request received ---');
  try {
    console.log('req.file received:', req.file ? `Name: ${req.file.originalname}, Size: ${req.file.size}` : 'No file object');
    // console.log('req.file object:', req.file); // Uncomment for more detail if needed
    // console.log('req.file.originalname type:', typeof req.file?.originalname); // Use optional chaining
        console.log('req.file.buffer:', typeof req.file.buffer);
        if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    // Sanitize filename to prevent path traversal and invalid characters
    const originalFileName = req.file.originalname;
    const safeFileName = path.basename(originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(UPLOAD_DIR, safeFileName);

    // Ensure upload directory exists
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      console.log(`Upload directory ensured: ${UPLOAD_DIR}`);
    } catch (dirError) {
      console.error(`Error creating upload directory ${UPLOAD_DIR}:`, dirError);
      throw new Error(`Failed to ensure upload directory exists: ${dirError.message}`);
    }

    // Save the file to disk
    try {
      await fs.writeFile(filePath, fileBuffer);
      console.log(`File saved successfully to: ${filePath}`);
    } catch (writeError) {
      console.error(`Error writing file to ${filePath}:`, writeError);
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
module.exports = router;
