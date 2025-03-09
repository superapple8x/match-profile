import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import './FileImport.css';

function FileImport({ onFileImport }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [parseError, setParseError] = useState(null);

  const handleFileChange = useCallback((event) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setParseError(null);
    }
  }, []);
  const handleUpload = () => {
    if (file) {
      console.log('Uploading file:', fileName);
      Papa.parse(file, {
        complete: (results) => {
          console.log('Parsed data:', results.data);
          onFileImport(results.data); // Pass data to parent component
        },
        error: (error) => {
          console.error('Parsing error:', error.message);
          setParseError(error.message);
        },
        header: true,
      });
    } else {
      console.log('No file selected.');
    }
  };

  return (
    <div className="file-import-container">
      <div className="file-input-wrapper">
        <label htmlFor="file-upload" className="file-upload-label">
          Choose File
        </label>
        <input
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          accept=".csv,.xls,.xlsx"
        />
      </div>
      <div className="file-info">Selected File: {fileName}</div>
      {parseError && (
        <div className="parse-error">
          Error parsing file: {parseError}
        </div>
      )}
      <button onClick={handleUpload} disabled={!file}>
        Upload
      </button>
    </div>
  );
}

export default FileImport;
