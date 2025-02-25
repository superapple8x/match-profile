
import React, { useState, useEffect } from 'react';

function AttributeSelector({ importedData }) {
  const [attributes, setAttributes] = useState([]);

  useEffect(() => {
    if (importedData && importedData.length > 0) {
      const keys = Object.keys(importedData[0]);
      setAttributes(keys);
    }
  }, [importedData]);

  return (
    <div>
      <h3>Select Attributes</h3>
      <ul>
        {attributes.map(attribute => (
          <li key={attribute}>{attribute}</li>
        ))}
      </ul>
    </div>
  );
}

export default AttributeSelector;