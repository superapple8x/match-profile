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
    p-4 border rounded-lg mb-6 shadow-md {/* Changed to solid border, adjusted padding/shadow */}
    bg-white/80 dark:bg-gray-700/60 {/* Adjusted background for contrast with sidebar */}
    border-gray-200 dark:border-gray-600/80 {/* Subtle border */}
    transition-all duration-300 ease-in-out {/* Smoother transition */}
    min-h-[200px] flex flex-col items-center justify-center text-center
    ${fileSizeError || parseError ? 'border-red-400 dark:border-red-500 bg-red-50/80 dark:bg-red-900/30' : ''} {/* Adjusted error state colors */}
    ${uploadSuccess ? 'border-green-400 dark:border-green-500 bg-green-50/80 dark:bg-green-900/30' : ''} {/* Adjusted success state colors */}
  `;

  return (
    <div className={containerClasses.trim()}>
      <div className="mb-4"> {/* Increased margin */}
        <label
          htmlFor="file-upload"
          className="inline-block px-4 py-2 bg-primary-500 hover:bg-primary-600 dark:bg-primary-700 dark:hover:bg-primary-800 text-white font-semibold rounded-md shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800" // Style like App.jsx button
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
        className="px-4 py-2 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold rounded-md shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800" // Style like App.jsx button, added disabled state styles
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
