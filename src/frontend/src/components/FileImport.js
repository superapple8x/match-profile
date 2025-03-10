import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import './FileImport.css';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 10MB

function FileImport({ onFileImport }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [parseError, setParseError] = useState(null);
  const [fileSizeError, setFileSizeError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = useCallback((event) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        setFileSizeError('File size exceeds the limit (100MB).');
        setFile(null);
        setFileName('No file chosen');
        setParseError(null);
        setUploadSuccess(false);
      } else {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        setParseError(null);
        setFileSizeError(null);
        setUploadSuccess(false);
      }
    }
  }, []);
  const handleUpload = () => {
    if (file) {
      console.log('Uploading file:', fileName);
      Papa.parse(file, {
        complete: (results) => {
          console.log('Parsed data:', results.data);
          onFileImport(results.data); // Pass data to parent component
          setUploadSuccess(true);
          setParseError(null);
        },
        error: (error) => {
          console.error('Parsing error:', error.message);
          setParseError(error.message);
          setUploadSuccess(false);
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
      {fileSizeError && (
        <div className="error-message">{fileSizeError}</div>
      )}
      {parseError && (
        <div className="parse-error">
          Error parsing file: {parseError}
        </div>
      )}
      <button onClick={handleUpload} disabled={!file}>
        Upload
      </button>
      {uploadSuccess && (
        <div className="upload-success">File uploaded successfully!</div>
      )}
    </div>
  );
}

export default FileImport;
