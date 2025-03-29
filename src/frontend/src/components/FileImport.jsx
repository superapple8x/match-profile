import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import Papa from 'papaparse';
import { DocumentArrowUpIcon, CheckCircleIcon, ExclamationTriangleIcon, FolderOpenIcon } from '@heroicons/react/24/outline'; // Added FolderOpenIcon

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB


// Accept isCollapsed, authToken, and handleLogout props
function FileImport({ onFileImport, isCollapsed, authToken, handleLogout }) { // Added handleLogout
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [parseError, setParseError] = useState(null);
  const [fileSizeError, setFileSizeError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Define handleUpload BEFORE handleFileChange because handleFileChange depends on it
  // Modified handleUpload to accept file directly
  // Wrapped in useCallback to satisfy useEffect dependency linting
  const handleUpload = useCallback(async (fileToUpload) => {
    if (fileToUpload && !isUploading) {
      console.log('Uploading file to backend:', fileToUpload.name);
      setIsUploading(true);
      setParseError(null);
      setUploadSuccess(false);
      setFileName(fileToUpload.name); // Ensure filename state is updated
      setFile(fileToUpload); // Ensure file state is updated

      const formData = new FormData();
      formData.append('file', fileToUpload);

      try {
        // Add Authorization header to the fetch request
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        // Note: Don't set Content-Type for FormData, browser does it correctly with boundary

        const response = await fetch('/api/import', {
          method: 'POST',
          headers: headers, // Add the headers object
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('Backend upload error:', result);
          throw new Error(result.error || `Upload failed with status ${response.status}`);
        }

        console.log('Backend upload success:', result);
        // Pass the new metadata structure to the parent component
        // The backend now returns { datasetId, columnsMetadata }
        if (result.datasetId && result.columnsMetadata) {
            onFileImport({
                datasetId: result.datasetId,
                columnsMetadata: result.columnsMetadata,
                originalFileName: fileToUpload.name // Pass the original name for display/reference
            });
            setUploadSuccess(true);
        } else {
            // Handle cases where the expected metadata is missing in the response
            console.error('Backend response missing expected metadata:', result);
            throw new Error('Invalid response received from server after upload.');
        }

      } catch (error) {
        console.error('Upload/Parsing error:', error.message);
        setParseError(error.message);
        setUploadSuccess(false);
        // Check for auth error and trigger logout
        if (error.message.includes('401') || error.message.includes('403')) {
            if (handleLogout) handleLogout();
        }
      } finally {
        setIsUploading(false);
      }

    } else {
      console.log('No file selected or upload already in progress.');
    }
  }, [isUploading, onFileImport]); // Added dependencies

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
        // Automatically trigger upload after selecting a valid file
        handleUpload(selectedFile); // Pass the selected file directly
      }
    }
     // Reset the input value so the same file can be selected again
     event.target.value = null;
  }, [onFileImport, handleUpload]); // Added handleUpload dependency

  const containerClasses = `
    p-4 border rounded-lg mb-6 shadow-md
    bg-indigo-100/60 dark:bg-gray-700/60  /* Light: indigo-100 tint */
    border-gray-200 dark:border-gray-600/80
    transition-all duration-300 ease-in-out
    flex flex-col items-center justify-center text-center
    ${isCollapsed ? 'min-h-[auto] py-2' : 'min-h-[200px]'} /* Adjust height when collapsed */
    ${fileSizeError || parseError ? 'border-red-400 dark:border-red-500 bg-red-50/80 dark:bg-red-900/30' : ''}
    ${uploadSuccess ? 'border-green-400 dark:border-green-500 bg-green-50/80 dark:bg-green-900/30' : ''}
  `;

  // Common button classes using the subtle dark gray style
  const baseButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2";
  const activeStyle = "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-gray-400 dark:focus:ring-offset-gray-900"; // Primary action style
  const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";


  // --- Render Collapsed View ---
  if (isCollapsed) {
    // Render only the button-like label when collapsed
    return (
      <>
        <label
          htmlFor="file-upload"
          // Use button classes, ensure centering, remove margin bottom from containerClasses
          className={`${baseButtonClasses} ${activeStyle} cursor-pointer w-full flex items-center justify-center h-10`} // Use fixed height h-10, remove py
          title={`Selected: ${fileName}`} // Show filename on hover
        >
          {/* Show status icon or default - USE h-6 w-6 */}
          {isUploading ? (
             <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
          ) : uploadSuccess ? (
            <CheckCircleIcon className="h-6 w-6 text-green-400" />
          ) : fileSizeError || parseError ? (
            <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
          ) : (
            <FolderOpenIcon className="h-6 w-6 text-gray-100" />
          )}
        </label>
        <input
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          accept=".csv,.xls,.xlsx"
          className="hidden"
        />
      </>
    );
  }

  // --- Render Expanded View ---
  return (
    <div className={containerClasses.trim()}>
      <div className="mb-4">
        <label
          htmlFor="file-upload"
          className={`${baseButtonClasses} ${activeStyle} cursor-pointer ring-2 ring-transparent hover:ring-primary-700 hover:ring-offset-2 dark:hover:ring-offset-gray-900`}
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
        <div className="mb-3 text-sm text-red-600 dark:text-red-400 flex items-center justify-center">
            <ExclamationTriangleIcon className="h-4 w-4 mr-1"/> {fileSizeError}
        </div>
      )}
      {parseError && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400 flex items-center justify-center">
            <ExclamationTriangleIcon className="h-4 w-4 mr-1"/> Error: {parseError}
        </div>
      )}
      {/* Removed explicit Upload button - upload happens on file change */}
      {/* <button ... /> */}
      {isUploading && (
           <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center">
               <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Uploading...
           </div>
      )}
      {uploadSuccess && !isUploading && (
        <div className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center justify-center">
            <CheckCircleIcon className="h-4 w-4 mr-1"/> File uploaded!
        </div>
      )}
    </div>
  );
}

// Add PropTypes
FileImport.propTypes = {
  onFileImport: PropTypes.func.isRequired,
  isCollapsed: PropTypes.bool,
  authToken: PropTypes.string, // authToken is optional but should be a string if provided
  handleLogout: PropTypes.func.isRequired, // handleLogout is required
};

// Add defaultProps
FileImport.defaultProps = {
  isCollapsed: false,
  authToken: null, // Default authToken to null
};


export default FileImport;
