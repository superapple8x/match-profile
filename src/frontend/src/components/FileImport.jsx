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
        handleUpload(selectedFile);
      }
    }
     event.target.value = null;
  }, [handleUpload]);

  // Basic container styling - use inline styles for simple cases or specific overrides
  const containerStyle = {
    border: '3px ridge #FFFF00', // Match main container border style
    padding: '10px',
    marginBottom: '15px',
    backgroundColor: '#000080', // Match main container background
    textAlign: 'center',
    color: '#FFFFFF', // White text for this container
  };

  // Apply error/success styles conditionally by changing border/background
  if (error) {
    containerStyle.borderColor = 'red';
    containerStyle.backgroundColor = '#8B0000'; // Dark red background for error
  } else if (uploadSuccess) {
    containerStyle.borderColor = '#00FF00'; // Lime green border for success
    containerStyle.backgroundColor = '#006400'; // Dark green background for success
  }

  return (
    <div style={containerStyle}>
      {/* Use a simpler heading, styled by parent or default */}
      <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#FFFF00', fontFamily: 'Impact', textShadow: '1px 1px #FF00FF' }}>Import Dataset</h4>
      {/* Basic file input - should inherit from index.css */}
      <input
        id="file-upload-retro"
        type="file"
        onChange={handleFileChange}
        accept=".csv,.xls,.xlsx"
        disabled={isUploading}
        style={{
            display: 'block',
            margin: '0 auto 10px auto',
            width: '90%', // Make it wider
            // Let index.css handle border, padding, background, color
        }}
      />
      <div style={{ marginBottom: '10px', fontSize: '11px', fontStyle: 'italic', color: '#CCCCCC' }}>
        Selected: {fileName}
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{ color: '#FF8C00', fontWeight: 'bold', marginBottom: '10px', fontSize: '11px' }}>
          !! ERROR !! {error}
        </div>
      )}
      {isUploading && (
           <div style={{ color: '#00FFFF', fontWeight: 'bold', marginBottom: '10px', fontSize: '11px' }}>
               Uploading... Please Wait! <span className="blink">***</span>
           </div>
      )}
      {uploadSuccess && !isUploading && (
        <div style={{ color: '#00FF00', fontWeight: 'bold', marginBottom: '10px', fontSize: '11px' }}>
            File uploaded successfully! Dataset ready.
        </div>
      )}
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
