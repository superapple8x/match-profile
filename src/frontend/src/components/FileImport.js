import React, { useState } from 'react';
import Papa from 'papaparse';
import './FileImport.css';

function FileImport() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [fileContent, setFileContent] = useState(null); // Add state for file content
  const [parseError, setParseError] = useState(null); // Add state for parsing errors

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setFileContent(null); // Reset content on new file selection
      setParseError(null);

      // Use PapaParse to parse the file
      Papa.parse(selectedFile, {
        complete: (results) => {
          console.log('Parsed data:', results.data);
          setFileContent(results.data);
        },
        error: (error) => {
          console.error('Parsing error:', error.message);
          setParseError(error.message);
        },
        header: true, // Assumes the first row is the header
      });
    }
  };

  const handleUpload = () => {
    // Placeholder for upload logic (will integrate with backend later)
    if (file) {
      console.log('Uploading file:', fileName);
      const formData = new FormData();
      formData.append('file', file);

      fetch('http://localhost:3000/api/files/import', {
        method: 'POST',
        body: formData,
      })
        .then(response => response.json())
        .then(data => {
          console.log('Upload success:', data);
        })
        .catch(error => {
          console.error('Upload error:', error);
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
      {fileContent && (
        <div className="file-content">
          File parsed successfully! (First 5 rows):
          <pre>{JSON.stringify(fileContent.slice(0, 5), null, 2)}</pre>
        </div>
      )}
      {parseError && (
        <div className="parse-error">
          Error parsing file: {parseError}
        </div>
      )}
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
}

export default FileImport;