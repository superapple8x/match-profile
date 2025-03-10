const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const MatchingEngine = require('../matchingEngine');
const cors = require('cors');

// Multer setup for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  }
});

// File import endpoint
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    console.log('Inside /import route handler');
        console.log('req.file:', req.file);
        console.log('req.file.originalname:', typeof req.file.originalname);
        console.log('req.file.buffer:', typeof req.file.buffer);
        if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    let parsedData = [];

    // Handle different file types
    if (fileName.endsWith('.csv')) {
      await new Promise((resolve, reject) => {
        require('stream').Readable.from(fileBuffer)
          .pipe(csv())
          .on('data', (row) => {
            parsedData.push(row);
          })
          .on('end', () => {
            console.log('CSV parsing complete');
            resolve();
          })
          .on('error', (error) => {
            console.error('CSV parsing error:', error);
            reject(error);
          });
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      parsedData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      console.log('Excel parsing complete');
    } else {
      throw new Error('Unsupported file type');
    }

    res.status(200).json({ message: 'File uploaded and parsed successfully', data: parsedData, fileName: fileName });
  } catch (error) {
    console.error("Error during file import:", error);
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

    const results = compareProfiles.map(profile => ({
      profileId: profile.id,
      matchPercentage: engine.calculateMatchScore(baseProfile, profile, matchingRules)
    }));
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