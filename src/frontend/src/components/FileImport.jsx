import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { DocumentArrowUpIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function FileImport({ onFileImport }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [parseError, setParseError] = useState(null);
  const [fileSizeError, setFileSizeError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = useCallback((event) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setIsUploading(false);
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

  const handleUpload = async () => {
    if (file && !isUploading) {
      console.log('Uploading file to backend:', fileName);
      setIsUploading(true);
      setParseError(null);
      setUploadSuccess(false);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/import', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('Backend upload error:', result);
          throw new Error(result.error || `Upload failed with status ${response.status}`);
        }

        console.log('Backend upload success:', result);
        onFileImport(result.data, result.fileName);
        setUploadSuccess(true);

      } catch (error) {
        console.error('Upload/Parsing error:', error.message);
        setParseError(error.message);
        setUploadSuccess(false);
      } finally {
        setIsUploading(false);
      }

    } else {
      console.log('No file selected or upload already in progress.');
    }
  };

  const containerClasses = `
    p-4 border rounded-lg mb-6 shadow-md
    bg-white/80 dark:bg-gray-700/60
    border-gray-200 dark:border-gray-600/80
    transition-all duration-300 ease-in-out
    min-h-[200px] flex flex-col items-center justify-center text-center
    ${fileSizeError || parseError ? 'border-red-400 dark:border-red-500 bg-red-50/80 dark:bg-red-900/30' : ''}
    ${uploadSuccess ? 'border-green-400 dark:border-green-500 bg-green-50/80 dark:bg-green-900/30' : ''}
  `;

  // Common button classes using solid indigo, matching toggle style format
  const commonButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors duration-200 ease-in-out";
  const disabledButtonClasses = "disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-indigo-400 disabled:dark:bg-indigo-800 disabled:hover:bg-indigo-400 disabled:dark:hover:bg-indigo-800"; // Adjusted disabled style

  return (
    <div className={containerClasses.trim()}>
      <div className="mb-4">
        <label
          htmlFor="file-upload"
          // Solid Indigo Style
          className={`${commonButtonClasses} cursor-pointer`}
        >
          Choose File
        </label>
        <input
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          accept=".csv,.xls,.xlsx"
          className="hidden"
        />
      </div>
      <div className="mb-3 text-sm text-gray-600 dark:text-gray-300 truncate w-full px-2" title={fileName}>
        Selected: <span className="font-medium text-gray-800 dark:text-gray-100">{fileName}</span>
      </div>
      {fileSizeError && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400 flex items-center">
            <ExclamationTriangleIcon className="h-4 w-4 mr-1"/> {fileSizeError}
        </div>
      )}
      {parseError && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400 flex items-center">
            <ExclamationTriangleIcon className="h-4 w-4 mr-1"/> Error: {parseError}
        </div>
      )}
      <button
        onClick={handleUpload}
        disabled={!file || isUploading || uploadSuccess}
        // Solid Indigo Style - Apply common classes + disabled classes
        className={`${commonButtonClasses} ${disabledButtonClasses}`}
      >
        {isUploading ? (
            <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
            </>
        ) : (
            <>
                <DocumentArrowUpIcon className="-ml-1 mr-2 h-5 w-5" />
                Upload
            </>
        )}
      </button>
      {uploadSuccess && (
        <div className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center">
            <CheckCircleIcon className="h-4 w-4 mr-1"/> File uploaded successfully!
        </div>
      )}
    </div>
  );
}

export default FileImport;
