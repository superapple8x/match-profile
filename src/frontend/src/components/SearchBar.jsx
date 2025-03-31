import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import WeightAdjustmentModal from './WeightAdjustmentModal';
import { debounce } from 'lodash-es';
// Removed duplicate import: import { useEffect, useState } from 'react';

// Define supported operators
const SUPPORTED_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'];

// Helper function to parse input (remains the same)
const parseInput = (input, attributes) => {
    const trimmedInput = input.trim();
    let bestMatch = null;
    let matchedAttribute = null;
    let attributeEndIndex = -1;
    const sortedAttributes = [...(attributes || [])].sort((a, b) => b.originalName.length - a.originalName.length);

    for (const attrObj of sortedAttributes) {
        const attr = attrObj.originalName;
        if (trimmedInput.toLowerCase().startsWith(attr.toLowerCase())) {
            matchedAttribute = attr;
            attributeEndIndex = attr.length;
            break;
        }
    }
    if (!matchedAttribute) return null;

    let remainingInput = trimmedInput.substring(attributeEndIndex).trimStart();
    let matchedOperator = null;
    let operatorEndIndex = -1;
    const sortedOperators = [...SUPPORTED_OPERATORS].sort((a, b) => b.length - a.length);

    for (const op of sortedOperators) {
        if (remainingInput.toLowerCase().startsWith(op.toLowerCase())) {
            if (remainingInput.length === op.length || remainingInput[op.length] === ' ') {
                matchedOperator = op;
                operatorEndIndex = op.length;
                break;
            }
        }
    }
    if (!matchedOperator) return null;

    const value = remainingInput.substring(operatorEndIndex).trim();
    if (value) {
        bestMatch = { attribute: matchedAttribute, operator: matchedOperator, value };
    }
    return bestMatch;
};


function SearchBar({ datasetAttributes, onSearch, initialCriteria, datasetId, authToken, handleLogout }) {
  // State variables remain the same
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedCriteria, setSelectedCriteria] = useState(initialCriteria || []);
  const [showWeightAdjuster, setShowWeightAdjuster] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [inputState, setInputState] = useState('attribute');
  const [currentAttribute, setCurrentAttribute] = useState('');
  const [currentOperator, setCurrentOperator] = useState('');
  const [attributeWeights, setAttributeWeights] = useState({});
  const [inputError, setInputError] = useState(false);
  const [guideState, setGuideState] = useState('initial'); // 'initial', 'blinking', 'hidden'

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const portalRoot = document.getElementById('suggestions-portal');
  const attributes = datasetAttributes || [];
  const attributeNames = attributes.map(a => a.originalName);

  // Effects remain the same
  useEffect(() => {
    setSelectedCriteria(initialCriteria || []);
    setInputValue(''); setInputState('attribute'); setCurrentAttribute(''); setCurrentOperator('');
  }, [initialCriteria]);

   useEffect(() => {
       const initialWeights = {};
       const uniqueAttrs = new Set(attributes.map(a => a.originalName));
       uniqueAttrs.forEach(attr => {
           const criteriaWeight = initialCriteria?.find(c => c.attribute === attr)?.weight;
           initialWeights[attr] = criteriaWeight ?? 5;
       });
       initialCriteria?.forEach(c => {
           if (!(c.attribute in initialWeights)) { initialWeights[c.attribute] = c.weight ?? 5; }
       });
       setAttributeWeights(initialWeights);
   }, [initialCriteria, attributes]);

  // Fetch suggestions logic remains the same
  const fetchValueSuggestions = useCallback(
    debounce(async (attributeName, operator, searchTerm) => {
      if (!datasetId || !attributeName || !operator || !searchTerm) {
        setSuggestions([]); setIsLoadingSuggestions(false); return;
      }
      setIsLoadingSuggestions(true);
      try {
        const headers = { ...(authToken && { 'Authorization': `Bearer ${authToken}` }) };
        const response = await fetch(`/api/suggest/values?datasetId=${encodeURIComponent(datasetId)}&attributeName=${encodeURIComponent(attributeName)}&searchTerm=${encodeURIComponent(searchTerm)}`, { headers });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) { if (handleLogout) handleLogout(); }
          throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
        }
        const data = await response.json();
        setSuggestions(data.suggestions.map(val => ({ type: 'value', value: val, display: String(val) })));
      } catch (error) { console.error("Error fetching value suggestions:", error); setSuggestions([]); }
      finally { setIsLoadingSuggestions(false); }
    }, 300),
    [datasetId, authToken, handleLogout]
  );

  // Effect to manage the guide animation
  useEffect(() => {
    // Start the slide+blink animation shortly after mount
    const startTimer = setTimeout(() => {
      setGuideState('blinking');
    }, 100); // Small delay to ensure initial render

    // Set timer to hide the guide after slide (1.5s) + blink (10s)
    const hideTimer = setTimeout(() => {
      setGuideState('hidden');
    }, 11600); // 1500ms slide + 10000ms blink + 100ms buffer

    // Cleanup timers on unmount
    return () => {
      clearTimeout(startTimer);
      clearTimeout(hideTimer);
    };
  }, []); // Run only once on mount

  // Input change handler remains the same
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setHighlightedIndex(-1);
    setInputError(false);
    const trimmedValue = value.trimStart();
    const lastSpaceIndex = trimmedValue.lastIndexOf(' ');
    const parsedForContext = parseInput(trimmedValue, attributes);

    if (parsedForContext) {
        setInputState('value'); setCurrentAttribute(parsedForContext.attribute); setCurrentOperator(parsedForContext.operator);
        const valuePart = trimmedValue.substring(trimmedValue.toLowerCase().indexOf(parsedForContext.operator.toLowerCase()) + parsedForContext.operator.length).trimStart();
        fetchValueSuggestions(parsedForContext.attribute, parsedForContext.operator, valuePart);
    } else if (lastSpaceIndex > 0) {
        const potentialAttr = trimmedValue.substring(0, lastSpaceIndex).trim();
        const potentialOpOrVal = trimmedValue.substring(lastSpaceIndex + 1);
        const matchedAttrObj = attributes.find(a => a.originalName.toLowerCase() === potentialAttr.toLowerCase());
        if (matchedAttrObj) {
            const correctCaseAttr = matchedAttrObj.originalName;
            const potentialOp = potentialOpOrVal.toLowerCase();
            const matchingOperators = SUPPORTED_OPERATORS.filter(op => op.toLowerCase().startsWith(potentialOp));
            if (matchingOperators.length > 0 && !potentialOpOrVal.includes(' ')) {
                 setInputState('operator'); setCurrentAttribute(correctCaseAttr); setCurrentOperator('');
                 setSuggestions(matchingOperators.map(op => ({ type: 'operator', value: op, display: op }))); setIsLoadingSuggestions(false);
            } else {
                 setInputState('value'); setCurrentAttribute(correctCaseAttr);
                 const words = trimmedValue.split(' '); let inferredOperator = '';
                 if (words.length >= 2) {
                    const lastWord = words[words.length - 2];
                    if (SUPPORTED_OPERATORS.includes(lastWord)) {
                        inferredOperator = lastWord; setCurrentOperator(inferredOperator);
                        const valuePart = words[words.length - 1]; fetchValueSuggestions(correctCaseAttr, inferredOperator, valuePart);
                    } else { setSuggestions([]); setIsLoadingSuggestions(false); }
                 } else { setSuggestions([]); setIsLoadingSuggestions(false); }
            }
        } else {
            setInputState('attribute'); setCurrentAttribute(''); setCurrentOperator('');
            const searchTerm = trimmedValue.toLowerCase(); const matches = attributeNames.filter(a => a.toLowerCase().includes(searchTerm)).slice(0, 10);
            setSuggestions(matches.map(a => ({ type: 'attribute', value: a, display: a }))); setIsLoadingSuggestions(false);
        }
    } else {
        setInputState('attribute'); setCurrentAttribute(''); setCurrentOperator('');
        const searchTerm = trimmedValue.toLowerCase(); const matches = attributeNames.filter(a => a.toLowerCase().includes(searchTerm)).slice(0, 10);
        setSuggestions(matches.map(a => ({ type: 'attribute', value: a, display: a }))); setIsLoadingSuggestions(false);
    }
    if (value === '') { setSuggestions([]); setInputState('attribute'); setCurrentAttribute(''); setCurrentOperator(''); }
  };

  // Add criterion logic remains the same
  const addCriterion = (criterion) => {
      const exists = selectedCriteria.some(c => c.attribute === criterion.attribute && c.operator === criterion.operator && String(c.value) === String(criterion.value));
      if (!exists) { setSelectedCriteria([...selectedCriteria, criterion]); }
      setInputValue(''); setSuggestions([]); setInputState('attribute'); setCurrentAttribute(''); setCurrentOperator(''); setInputError(false); inputRef.current?.focus();
  };

  // Suggestion select logic remains the same
  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'attribute') {
      setInputValue(`${suggestion.value} `); setInputState('operator'); setCurrentAttribute(suggestion.value); setCurrentOperator('');
      setSuggestions(SUPPORTED_OPERATORS.map(op => ({ type: 'operator', value: op, display: op }))); setIsLoadingSuggestions(false);
    } else if (suggestion.type === 'operator') {
      setInputValue(`${currentAttribute} ${suggestion.value} `); setInputState('value'); setCurrentOperator(suggestion.value); setSuggestions([]);
      fetchValueSuggestions(currentAttribute, suggestion.value, '');
    } else if (suggestion.type === 'value') {
      if (currentAttribute && currentOperator) { addCriterion({ attribute: currentAttribute, operator: currentOperator, value: suggestion.value }); }
      else { console.warn("Could not add criterion: Attribute or Operator context missing."); }
    }
    setHighlightedIndex(-1); inputRef.current?.focus();
  };

  // Scroll effect remains the same
  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const highlightedItem = suggestionsRef.current.children[highlightedIndex];
      highlightedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // Add criterion button click handler remains the same
  const handleAddCriterionClick = () => {
      const parsed = parseInput(inputValue, attributes);
      if (parsed) { addCriterion(parsed); }
      else if (inputValue.trim() !== '') { setInputError(true); }
  };

  // Keydown handler remains the same
  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0)); }
      else if ((e.key === 'Tab' || e.key === 'Enter') && highlightedIndex >= 0) { e.preventDefault(); handleSuggestionSelect(suggestions[highlightedIndex]); }
    } else if (e.key === 'Enter' && highlightedIndex === -1) { e.preventDefault(); handleAddCriterionClick(); }
    else if (e.key === 'Escape') { setSuggestions([]); setHighlightedIndex(-1); }
  };

  // Remove criterion logic remains the same
   const removeCriterion = (indexToRemove) => { setSelectedCriteria(selectedCriteria.filter((_, index) => index !== indexToRemove)); };

  // Search handler remains the same
  const handleSearch = () => { if (selectedCriteria.length > 0) { onSearch({ criteria: selectedCriteria, weights: attributeWeights }); } else { alert("Please add at least one search criterion."); } };

  // Dropdown style calculation remains the same
  const [dropdownStyle, setDropdownStyle] = useState({});
  useEffect(() => {
    if (inputRef.current && suggestions.length > 0 && portalRoot) {
      const rect = inputRef.current.getBoundingClientRect(); const portalRect = portalRoot.getBoundingClientRect();
      setDropdownStyle({ position: 'absolute', top: `${rect.bottom - portalRect.top + 2}px`, left: `${rect.left - portalRect.left}px`, width: `${rect.width}px`, zIndex: 100 });
    }
  }, [suggestions.length, portalRoot]);

  // Suggestions dropdown component remains the same
  const SuggestionsDropdown = (
    <div ref={suggestionsRef} style={{ ...dropdownStyle, border: '2px outset #C0C0C0', backgroundColor: '#FFFFFF', maxHeight: '200px', overflowY: 'auto', boxShadow: '3px 3px 5px rgba(0,0,0,0.4)' }}>
      {isLoadingSuggestions && <div style={{ padding: '5px', color: '#000080', fontSize: '11px', fontStyle: 'italic' }}>Loading...</div>}
      {!isLoadingSuggestions && suggestions.map((suggestion, index) => (
        <div key={`${suggestion.type}-${suggestion.value}-${index}`}
          style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '12px', backgroundColor: index === highlightedIndex ? '#000080' : '#FFFFFF', color: index === highlightedIndex ? '#FFFFFF' : '#000000' }}
          onClick={() => handleSuggestionSelect(suggestion)} onMouseEnter={() => setHighlightedIndex(index)} >
          {suggestion.display}
        </div>
      ))}
       {!isLoadingSuggestions && suggestions.length === 0 && inputState !== 'attribute' && inputValue.trim() !== '' && ( <div style={{ padding: '5px', color: '#555555', fontSize: '11px', fontStyle: 'italic' }}>No suggestions</div> )}
    </div>
  );

  // Determine guide class based on state
  const guideClass = `search-guide ${guideState}`; // e.g., "search-guide blinking"

  return (
    <div className="form-section"> {/* Use form-section wrapper */}
       {/* Animated Search Guide */}
       {guideState !== 'hidden' && (
         <div className={guideClass}>
           Hint: Type Attribute, Operator, then Value (e.g., Age {'>='} 30)
         </div>
       )}

       <h2 className="section-title"> {/* Use section-title */}
           <span className="blink" style={{ color: '#FF00FF' }}>*</span> Build Your Search Query! <span className="blink" style={{ color: '#FF00FF' }}>*</span>
       </h2>

      {/* Selected Criteria Box */}
      {selectedCriteria.length > 0 && (
        <div className="criteria-list-box"> {/* Use criteria-list-box */}
           <strong>Current Search Filters:</strong>
           <ul>
               {selectedCriteria.map((criteria, index) => (
                 <li key={index}>
                   <span>
                     {criteria.attribute} {criteria.operator} {String(criteria.value)}
                   </span>
                   <button
                     type="button"
                     className="remove-button" // Use remove-button class
                     title={`Remove ${criteria.attribute} ${criteria.operator} ${criteria.value}`}
                     onClick={() => removeCriterion(index)}
                   >
                     X
                   </button>
                 </li>
               ))}
           </ul>
        </div>
      )}

      {/* Search Input using form-table */}
      <table className="form-table">
          <tbody>
              <tr>
                  <td><label htmlFor="searchInput">Add Filter:</label></td>
                  <td style={{ width: '70%', position: 'relative' }}> {/* Relative for suggestions */}
                      <input
                        ref={inputRef}
                        type="text"
                        id="searchInput"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Attribute Operator Value (e.g., Status == Active)"
                        style={{ border: inputError ? '2px solid red' : undefined }} // Conditional error border
                      />
                      {/* Render Suggestions Dropdown via Portal */}
                      {portalRoot && suggestions.length > 0 && createPortal(SuggestionsDropdown, portalRoot)}
                      {inputError && <p style={{ color: 'red', fontSize: '10px', fontWeight: 'bold', margin: '2px 0 0 0' }}>Invalid format.</p>}
                  </td>
                  <td>
                      <button
                        type="button"
                        className="button button-magenta" // Magenta Add button
                        style={{ width: '100%' }}
                        onClick={handleAddCriterionClick}
                      >
                          Add!
                      </button>
                  </td>
              </tr>
          </tbody>
      </table>

      {/* Action Buttons */}
      <div className="text-center mt-2">
        <button
          onClick={handleSearch}
          disabled={selectedCriteria.length === 0}
          className="button button-green button-large" // Green, large Search button
        >
           <span className="blink" style={{ color: '#FF0000' }}>!</span> SEARCH NOW <span className="blink" style={{ color: '#FF0000' }}>!</span>
        </button>
        {selectedCriteria.length > 0 && (
          <button
            onClick={() => setShowWeightAdjuster(true)}
            className="button button-yellow" // Yellow Weights button
            style={{ marginLeft: '15px' }}
            title="Adjust Attribute Weights"
          >
             Weights
          </button>
        )}
      </div>

      {/* Weight Adjustment Modal */}
      {showWeightAdjuster && (
        <WeightAdjustmentModal
          selectedCriteria={selectedCriteria}
          initialAttributeWeights={attributeWeights}
          onWeightsChange={setAttributeWeights}
          onClose={() => setShowWeightAdjuster(false)}
        />
      )}
    </div>
  );
}

// Update PropTypes
SearchBar.propTypes = {
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({ originalName: PropTypes.string.isRequired })).isRequired,
  onSearch: PropTypes.func.isRequired,
  initialCriteria: PropTypes.arrayOf(PropTypes.shape({
      attribute: PropTypes.string.isRequired, operator: PropTypes.string.isRequired, value: PropTypes.any.isRequired, weight: PropTypes.number,
  })),
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  authToken: PropTypes.string,
  handleLogout: PropTypes.func,
};

SearchBar.defaultProps = {
  initialCriteria: [], datasetId: null, authToken: null, handleLogout: () => {},
};

export default SearchBar;
