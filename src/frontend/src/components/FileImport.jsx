import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Updated FileImport component for new retro theme
function FileImport({ onFileImport, authToken, handleLogout }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [error, setError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = useCallback(async (fileToUpload) => {
    if (fileToUpload && !isUploading) {
      console.log('Uploading file to backend:', fileToUpload.name);
      setIsUploading(true);
      setError(null);
      setUploadSuccess(false);
      setFileName(fileToUpload.name);
      setFile(fileToUpload);

      const formData = new FormData();
      formData.append('file', fileToUpload);

      try {
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch('/api/import', {
          method: 'POST',
          headers: headers,
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('Backend upload error:', result);
          throw new Error(result.error || `Upload failed with status ${response.status}`);
        }

        console.log('Backend upload success:', result);
        if (result.datasetId && result.columnsMetadata) {
            onFileImport({
                datasetId: result.datasetId,
                columnsMetadata: result.columnsMetadata,
                originalFileName: fileToUpload.name
            });
            setUploadSuccess(true);
        } else {
            console.error('Backend response missing expected metadata:', result);
            throw new Error('Invalid response received from server after upload.');
        }

      } catch (err) {
        console.error('Upload/Parsing error:', err.message);
        setError(err.message);
        setUploadSuccess(false);
        if (err.message.includes('401') || err.message.includes('403')) {
            if (handleLogout) handleLogout();
        }
      } finally {
        setIsUploading(false);
      }

    } else {
      console.log('No file selected or upload already in progress.');
    }
  }, [isUploading, onFileImport, authToken, handleLogout]);

  const handleFileChange = useCallback((event) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setIsUploading(false);
      setUploadSuccess(false);
      setError(null);

      if (selectedFile.size > MAX_FILE_SIZE) {
        setError('File size exceeds the limit (100MB).');
        setFile(null);
        setFileName('No file chosen');
      } else {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        // Trigger upload immediately after selection
        handleUpload(selectedFile);
      }
    }
     // Reset input value to allow re-uploading the same file
     event.target.value = null;
  }, [handleUpload]);

  // Container styling - Keep dynamic border/background for status
  const statusContainerStyle = {
    border: '3px ridge #FFFF00', // Default border
    padding: '10px',
    marginBottom: '15px',
    textAlign: 'center',
    // Base background/text color inherited from .sidebar-cell
  };

  // Apply error/success styles conditionally by changing border/background
  if (error) {
    statusContainerStyle.borderColor = 'red';
    statusContainerStyle.backgroundColor = '#8B0000'; // Dark red background for error
  } else if (uploadSuccess) {
    statusContainerStyle.borderColor = '#00FF00'; // Lime green border for success
    statusContainerStyle.backgroundColor = '#006400'; // Dark green background for success
  }

  return (
    // Apply dynamic status styles to this outer div
    <div style={statusContainerStyle}>
      {/* Apply sidebar-section-title */}
      <div className="sidebar-section-title">Import Dataset</div>
      {/* Hidden actual file input */}
      <input
        id="file-upload-retro"
        type="file"
        onChange={handleFileChange}
        accept=".csv,.xls,.xlsx"
        disabled={isUploading}
        style={{ display: 'none' }} // Hide the actual input
      />
      {/* Visible "Browse" button that triggers the hidden input */}
      <button
        type="button"
        className="button button-green button-full"
        onClick={() => document.getElementById('file-upload-retro')?.click()} // Trigger hidden input
        disabled={isUploading}
      >
          Browse...
      </button>
      {/* Status display area */}
      <div style={{ fontSize: '10px', marginTop: '5px', border: '1px dashed #00FFFF', padding: '3px', backgroundColor: '#000080' }}>
        Selected: {fileName} <br />
        Status:
        {/* Status Messages */}
        {error && (
          <span style={{ color: '#FF8C00', fontWeight: 'bold' }}> !! ERROR !! {error}</span>
        )}
        {isUploading && (
             <span style={{ color: '#00FFFF', fontWeight: 'bold' }}> Uploading... <span className="blink">***</span></span>
        )}
        {uploadSuccess && !isUploading && (
          <span style={{ color: '#00FF00', fontWeight: 'bold' }}> Uploaded Successfully!</span>
        )}
        {!error && !isUploading && !uploadSuccess && (
            <span style={{ color: '#CCCCCC', fontStyle: 'italic' }}> Idle</span>
        )}
      </div>
    </div>
  );
}

// Simplified PropTypes
FileImport.propTypes = {
  onFileImport: PropTypes.func.isRequired,
  authToken: PropTypes.string,
  handleLogout: PropTypes.func.isRequired,
};

FileImport.defaultProps = {
  authToken: null,
};

export default FileImport;
