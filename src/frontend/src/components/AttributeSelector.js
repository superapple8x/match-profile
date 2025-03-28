import React, { useState, useEffect, useCallback } from 'react';
import './AttributeSelector.css';

const attributeCategories = {
  Demographics: ['Age', 'Gender', 'Location'],
  'Platform & Activity': ['Platform', 'CurrentActivity'],
  Other: [],
};

function AttributeSelector({ importedData, onAttributeSelect, onAttributeDeselect }) {
  // Validate props
  if (typeof onAttributeSelect !== 'function') {
    console.error('AttributeSelector: onAttributeSelect prop is not a function');
    // Provide fallback
    onAttributeSelect = () => {};
  }
  
  if (typeof onAttributeDeselect !== 'function') {
    console.error('AttributeSelector: onAttributeDeselect prop is not a function');
    // Provide fallback
    onAttributeDeselect = () => {};
  }

  const [attributes, setAttributes] = useState([]);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (importedData && importedData.length > 0) {
      const keys = Object.keys(importedData[0]);
      setAttributes(keys);

      // Populate the 'Other' category with attributes not in other categories
      const otherAttributes = keys.filter(key => {
        return !Object.values(attributeCategories).flat().includes(key);
      });
      attributeCategories.Other = otherAttributes;
    }
  }, [importedData]);

  const handleAttributeChange = useCallback((e) => {
    const attribute = e.target.value;
    if (selectedAttributes.includes(attribute)) {
      setSelectedAttributes(prev => prev.filter((attr) => attr !== attribute));
      onAttributeDeselect(attribute);
    } else {
      setSelectedAttributes(prev => [...prev, attribute]);
      onAttributeSelect(attribute);
    }
  }, [selectedAttributes, onAttributeSelect, onAttributeDeselect]);

  const filteredAttributes = (category) => {
    return attributeCategories[category].filter(attribute =>
      attribute.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="attribute-selector-container">
      <h3>Select Attributes</h3>
      <input
        type="text"
        placeholder="Search attributes..."
        className="attribute-search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {Object.keys(attributeCategories).map(category => (
        <div key={category} className="attribute-category">
          <h4>{category}</h4>
          <ul className="attribute-list">
            {filteredAttributes(category).map(attribute => (
              <li key={attribute} className="attribute-item">
                <label>
                  <input
                    type="checkbox"
                    value={attribute}
                    checked={selectedAttributes.includes(attribute)}
                    onChange={handleAttributeChange}
                  />
                  {attribute}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default AttributeSelector;
