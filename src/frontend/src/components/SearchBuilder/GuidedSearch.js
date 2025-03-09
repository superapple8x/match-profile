import React, { useState, useCallback } from 'react';
import './GuidedSearch.css';
import AttributeSelector from '../AttributeSelector';
import CriteriaBuilder from '../CriteriaBuilder';
import ResultsTable from '../ResultsDashboard/ResultsTable.tsx';

function GuidedSearch({ importedData }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [matchingRules, setMatchingRules] = useState({});
  const [filteredData, setFilteredData] = useState([]);
  const [searchValues, setSearchValues] = useState({});

  const nextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleAttributeSelect = useCallback((attribute) => {
    setSelectedAttributes(prev => [...prev, attribute]);
  }, [setSelectedAttributes]);

  const handleAttributeDeselect = useCallback((attribute) => {
    setSelectedAttributes(prev => prev.filter((attr) => attr !== attribute));
  }, [selectedAttributes, setSelectedAttributes]);

  const handleRuleChange = useCallback((attribute, rule) => {
    setMatchingRules(prevRules => ({
      ...prevRules,
      [attribute]: rule
    }));
  }, [setMatchingRules]);

  const handleSearchValueChange = useCallback((attribute, value) => {
    setSearchValues(prevValues => ({
      ...prevValues,
      [attribute]: value
    }));
  }, [setSearchValues]);

  const handleSearch = (selectedAttributes, matchingRules) => {
    // Implement search logic here
    const newFilteredData = importedData.filter(item => {
      return selectedAttributes.every(attribute => {
        const rule = matchingRules[attribute] || 'exact';
        const itemValue = item[attribute] ? String(item[attribute]) : '';
        const searchValue = searchValues[attribute] ? String(searchValues[attribute]) : '';

        if (rule === 'exact') {
          return itemValue === searchValue;
        } else if (rule === 'partial') {
          return itemValue.toLowerCase().includes(searchValue.toLowerCase());
        } else {
          return true;
        }
      });
    });
    setFilteredData(newFilteredData);
  };

  return (
    <div className="guided-search">
      <h2>Guided Search Wizard</h2>
      {currentStep === 1 && (
        <div>
          <h3>Step 1: Select Attributes</h3>
          <AttributeSelector
            importedData={importedData}
            onAttributeSelect={handleAttributeSelect}
            onAttributeDeselect={handleAttributeDeselect}
          />
          <div className="step-navigation">
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}
      {currentStep === 2 && (
        <div>
          <h3>Step 2: Define Matching Rules</h3>
          {selectedAttributes.map((attribute) => (
            <CriteriaBuilder
              key={attribute}
              attribute={attribute}
              onRuleChange={handleRuleChange}
              onSearchValueChange={handleSearchValueChange}
            />
          ))}
          <div className="step-navigation">
            <button onClick={prevStep}>Previous</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}
      {currentStep === 3 && (
        <div>
          <h3>Step 3: Preview Results</h3>
          <ResultsTable importedData={importedData} filteredData={filteredData} />
          <div className="step-navigation">
            <button onClick={prevStep}>Previous</button>
            <button onClick={() => handleSearch(selectedAttributes, matchingRules)}>Run Search</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuidedSearch;
