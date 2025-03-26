import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
// Removed: import './FileImport.css';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

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

  // Dynamically set container classes based on state
  const containerClasses = `
    p-6 border-2 border-dashed rounded-lg mb-6
    bg-white dark:bg-gray-700
    border-gray-300 dark:border-gray-600
    transition-colors duration-150
    min-h-[200px] flex flex-col items-center justify-center text-center
    ${fileSizeError || parseError ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20' : ''}
    ${uploadSuccess ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20' : ''}
  `;

  return (
    <div className={containerClasses.trim()}>
      <div className="mb-3">
        <label
          htmlFor="file-upload"
          className="inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-md shadow cursor-pointer transition-colors duration-150"
        >
          Choose File
        </label>
        <input
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          accept=".csv,.xls,.xlsx"
          className="hidden" // Hide the default input
        />
      </div>
      <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Selected File: <span className="font-medium text-gray-800 dark:text-gray-100">{fileName}</span>
      </div>
      {fileSizeError && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">{fileSizeError}</div>
      )}
      {parseError && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">
          Error parsing file: {parseError}
        </div>
      )}
      <button
        onClick={handleUpload}
        disabled={!file}
        className="px-4 py-2 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold rounded-md shadow transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Upload
      </button>
      {uploadSuccess && (
        <div className="mt-3 text-sm text-green-600 dark:text-green-400">File uploaded successfully!</div>
      )}
    </div>
  );
}

export default FileImport;
