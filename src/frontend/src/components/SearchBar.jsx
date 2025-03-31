import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import WeightAdjustmentModal from './WeightAdjustmentModal';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'; // Keep icons for now, style later
import { debounce } from 'lodash-es';

// Define supported operators
const SUPPORTED_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'];

// Helper function to parse input: "attribute operator value" (Revised for robustness)
const parseInput = (input, attributes) => {
    const trimmedInput = input.trim();
    let bestMatch = null;

    // 1. Find the longest matching attribute from the start
    let matchedAttribute = null;
    let attributeEndIndex = -1;

    // Sort attributes by length descending to match longest first (e.g., "Video Category" before "Video")
    // Ensure attributes is an array of objects with originalName
    const sortedAttributes = [...(attributes || [])].sort((a, b) => b.originalName.length - a.originalName.length);

    for (const attrObj of sortedAttributes) {
        const attr = attrObj.originalName; // Use originalName for matching
        if (trimmedInput.toLowerCase().startsWith(attr.toLowerCase())) { // Case-insensitive match
            matchedAttribute = attr; // Store the original casing
            attributeEndIndex = attr.length;
            break; // Found the longest matching attribute
        }
    }

    if (!matchedAttribute) {
        return null; // No valid attribute found at the beginning
    }

    // 2. Find the longest matching operator after the attribute
    let remainingInput = trimmedInput.substring(attributeEndIndex).trimStart(); // Text after attribute
    let matchedOperator = null;
    let operatorEndIndex = -1;

    // Sort operators by length descending
    const sortedOperators = [...SUPPORTED_OPERATORS].sort((a, b) => b.length - a.length);

    for (const op of sortedOperators) {
        if (remainingInput.toLowerCase().startsWith(op.toLowerCase())) { // Case-insensitive match
            // Check if the character after the operator is a space or end of string
            if (remainingInput.length === op.length || remainingInput[op.length] === ' ') {
                matchedOperator = op; // Store the canonical operator casing
                operatorEndIndex = op.length;
                break; // Found the longest matching operator
            }
        }
    }

    if (!matchedOperator) {
        return null; // No valid operator found after attribute
    }

    // 3. The rest is the value
    const value = remainingInput.substring(operatorEndIndex).trim();

    if (value) { // Ensure value is not empty
        bestMatch = { attribute: matchedAttribute, operator: matchedOperator, value };
    }

    return bestMatch;
};


// Renamed props to match expected usage from App.jsx if needed, added datasetAttributes
function SearchBar({ datasetAttributes, onSearch, initialCriteria, datasetId, authToken, handleLogout }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedCriteria, setSelectedCriteria] = useState(initialCriteria || []);
  const [showWeightAdjuster, setShowWeightAdjuster] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [inputState, setInputState] = useState('attribute'); // 'attribute', 'operator', 'value'
  const [currentAttribute, setCurrentAttribute] = useState(''); // Store selected attribute
  const [currentOperator, setCurrentOperator] = useState(''); // Store selected operator
  const [attributeWeights, setAttributeWeights] = useState({}); // State for per-attribute weights
  const [inputError, setInputError] = useState(false); // State for input parsing error

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const portalRoot = document.getElementById('suggestions-portal');
  // Ensure attributes is the array of objects with originalName
  const attributes = datasetAttributes || [];
  const attributeNames = attributes.map(a => a.originalName); // Get just the names for parsing/suggestions

  useEffect(() => {
    setSelectedCriteria(initialCriteria || []);
    // Reset internal state if initial criteria change significantly
    setInputValue('');
    setInputState('attribute');
    setCurrentAttribute('');
    setCurrentOperator('');
  }, [initialCriteria]);

  // Initialize attributeWeights from initialCriteria or defaults
   useEffect(() => {
       const initialWeights = {};
       const uniqueAttrs = new Set(attributes.map(a => a.originalName));
       uniqueAttrs.forEach(attr => {
           // Find weight from initialCriteria if present, otherwise default
           const criteriaWeight = initialCriteria?.find(c => c.attribute === attr)?.weight;
           initialWeights[attr] = criteriaWeight ?? 5; // Default to 5 if not found
       });
       // Also include weights from criteria for attributes perhaps not in datasetAttributes (less likely but safe)
       initialCriteria?.forEach(c => {
           if (!(c.attribute in initialWeights)) {
               initialWeights[c.attribute] = c.weight ?? 5;
           }
       });
       setAttributeWeights(initialWeights);
   }, [initialCriteria, attributes]); // Re-run if attributes list changes too


  const fetchValueSuggestions = useCallback(
    debounce(async (attributeName, operator, searchTerm) => {
      // Only fetch if attribute, operator, and datasetId are valid, and searchTerm is not empty
      if (!datasetId || !attributeName || !operator || !searchTerm) {
        setSuggestions([]);
        setIsLoadingSuggestions(false);
        return;
      }
      setIsLoadingSuggestions(true);
      try {
        const headers = { ...(authToken && { 'Authorization': `Bearer ${authToken}` }) }; // Add auth header if token exists
        const response = await fetch(`/api/suggest/values?datasetId=${encodeURIComponent(datasetId)}&attributeName=${encodeURIComponent(attributeName)}&searchTerm=${encodeURIComponent(searchTerm)}`, { headers });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            console.warn('Suggestion fetch failed due to invalid/expired token.');
            if (handleLogout) handleLogout(); // Trigger logout if auth fails
          }
          throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
        }
        const data = await response.json();
        // Simple display for retro theme, no highlighting for now
        setSuggestions(data.suggestions.map(val => ({
            type: 'value',
            value: val,
            display: String(val) // Just display the value directly
        })));
      } catch (error) {
        console.error("Error fetching value suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300), // 300ms debounce delay
    [datasetId, authToken, handleLogout] // Dependencies for useCallback
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setHighlightedIndex(-1); // Reset highlight
    setInputError(false); // Clear error on input change

    const trimmedValue = value.trimStart();
    const lastSpaceIndex = trimmedValue.lastIndexOf(' ');

    // Try parsing first to see if we have a complete structure already
    const parsedForContext = parseInput(trimmedValue, attributes); // Pass attribute objects

    if (parsedForContext) {
        // Potentially entering value part
        setInputState('value');
        setCurrentAttribute(parsedForContext.attribute);
        setCurrentOperator(parsedForContext.operator);
        const valuePart = trimmedValue.substring(
            trimmedValue.toLowerCase().indexOf(parsedForContext.operator.toLowerCase()) + parsedForContext.operator.length
        ).trimStart();
        fetchValueSuggestions(parsedForContext.attribute, parsedForContext.operator, valuePart);

    } else if (lastSpaceIndex > 0) {
        // Could be entering operator or value
        const potentialAttr = trimmedValue.substring(0, lastSpaceIndex).trim();
        const potentialOpOrVal = trimmedValue.substring(lastSpaceIndex + 1);

        // Check if potentialAttr matches any attribute name (case-insensitive)
        const matchedAttrObj = attributes.find(a => a.originalName.toLowerCase() === potentialAttr.toLowerCase());

        if (matchedAttrObj) {
            const correctCaseAttr = matchedAttrObj.originalName;
            // Attribute is valid, now check if the next part is an operator
            const potentialOp = potentialOpOrVal.toLowerCase();
            const matchingOperators = SUPPORTED_OPERATORS.filter(op => op.toLowerCase().startsWith(potentialOp));

            if (matchingOperators.length > 0 && !potentialOpOrVal.includes(' ')) {
                 // Suggest operators if the part after attribute looks like a start of an operator
                 setInputState('operator');
                 setCurrentAttribute(correctCaseAttr); // Store the valid attribute (correct casing)
                 setCurrentOperator(''); // Reset operator
                 setSuggestions(matchingOperators.map(op => ({
                     type: 'operator',
                     value: op,
                     display: op // Simple display
                 })));
                 setIsLoadingSuggestions(false);
            } else {
                 // Assume entering value if attribute is valid but next part isn't a starting operator
                 setInputState('value');
                 setCurrentAttribute(correctCaseAttr);
                 // Try to infer operator if only one possibility makes sense based on last word
                 const words = trimmedValue.split(' ');
                 let inferredOperator = '';
                 if (words.length >= 2) {
                    const lastWord = words[words.length - 2]; // Word before the last space
                    if (SUPPORTED_OPERATORS.includes(lastWord)) {
                        inferredOperator = lastWord;
                        setCurrentOperator(inferredOperator);
                        const valuePart = words[words.length - 1]; // The very last part
                        fetchValueSuggestions(correctCaseAttr, inferredOperator, valuePart);
                    } else {
                        setSuggestions([]); setIsLoadingSuggestions(false);
                    }
                 } else {
                     setSuggestions([]); setIsLoadingSuggestions(false);
                 }
            }
        } else {
            // Attribute part is invalid or incomplete, suggest attributes
            setInputState('attribute');
            setCurrentAttribute('');
            setCurrentOperator('');
            const searchTerm = trimmedValue.toLowerCase();
            const matches = attributeNames // Use names array for filtering
                .filter(a => a.toLowerCase().includes(searchTerm))
                .slice(0, 10);
            setSuggestions(matches.map(a => ({
                type: 'attribute',
                value: a,
                display: a // Simple display
            })));
            setIsLoadingSuggestions(false);
        }
    } else {
        // No spaces, must be typing the attribute
        setInputState('attribute');
        setCurrentAttribute('');
        setCurrentOperator('');
        const searchTerm = trimmedValue.toLowerCase();
        const matches = attributeNames // Use names array for filtering
            .filter(a => a.toLowerCase().includes(searchTerm))
            .slice(0, 10);
        setSuggestions(matches.map(a => ({
            type: 'attribute',
            value: a,
            display: a // Simple display
        })));
        setIsLoadingSuggestions(false);
    }

    // Clear suggestions if input is completely empty
    if (value === '') {
        setSuggestions([]);
        setInputState('attribute');
        setCurrentAttribute('');
        setCurrentOperator('');
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'attribute') {
      setInputValue(`${suggestion.value} `); // Add space after attribute
      setInputState('operator'); // Expect operator next
      setCurrentAttribute(suggestion.value); // Store selected attribute
      setCurrentOperator('');
      setSuggestions(SUPPORTED_OPERATORS.map(op => ({ type: 'operator', value: op, display: op }))); // Show all operators
      setIsLoadingSuggestions(false);
    } else if (suggestion.type === 'operator') {
      setInputValue(`${currentAttribute} ${suggestion.value} `); // Add space after operator
      setInputState('value'); // Expect value next
      setCurrentOperator(suggestion.value); // Store selected operator
      setSuggestions([]); // Clear suggestions, wait for user input or fetch values
      fetchValueSuggestions(currentAttribute, suggestion.value, ''); // Fetch initial values if desired
    } else if (suggestion.type === 'value') {
      // Ensure we have attribute and operator stored from the input context
      if (currentAttribute && currentOperator) {
        const newCriterion = {
          attribute: currentAttribute,
          operator: currentOperator,
          value: suggestion.value
          // Weight is handled by attributeWeights map, not per criterion anymore
        };
        // Avoid adding duplicates
        const exists = selectedCriteria.some(c =>
            c.attribute === newCriterion.attribute &&
            c.operator === newCriterion.operator &&
            String(c.value) === String(newCriterion.value)
        );
        if (!exists) {
            setSelectedCriteria([...selectedCriteria, newCriterion]);
        }
        setInputValue(''); // Clear input
        setSuggestions([]);
        setInputState('attribute'); // Reset state
        setCurrentAttribute('');
        setCurrentOperator('');
      } else {
          console.warn("Could not add criterion: Attribute or Operator context missing.");
          // Fallback parsing attempt (less reliable now)
          const parsed = parseInput(inputValue.substring(0, inputValue.lastIndexOf(suggestion.value)), attributes);
          if (parsed) {
               const newCriterion = {
                  attribute: parsed.attribute,
                  operator: parsed.operator,
                  value: suggestion.value,
               };
               const exists = selectedCriteria.some(c =>
                   c.attribute === newCriterion.attribute &&
                   c.operator === newCriterion.operator &&
                   String(c.value) === String(newCriterion.value)
               );
               if (!exists) {
                   setSelectedCriteria([...selectedCriteria, newCriterion]);
               }
               setInputValue('');
               setSuggestions([]);
               setInputState('attribute');
               setCurrentAttribute('');
               setCurrentOperator('');
          } else {
              console.error("Failed to add criterion even after parsing fallback.");
              setSuggestions([]); // Clear suggestions to avoid loops
          }
      }
    }
    setHighlightedIndex(-1);
    inputRef.current.focus();
  };

  // Effect to scroll suggestions into view
  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const highlightedItem = suggestionsRef.current.children[highlightedIndex];
      if (highlightedItem) {
        // Basic scroll into view, might need refinement for retro look
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if ((e.key === 'Tab' || e.key === 'Enter') && highlightedIndex >= 0) {
        e.preventDefault();
        handleSuggestionSelect(suggestions[highlightedIndex]);
      }
    }
    // Enter to confirm search criteria ONLY if input is valid and no suggestion selected
    else if (e.key === 'Enter' && highlightedIndex === -1) {
       e.preventDefault();
       const parsed = parseInput(inputValue, attributes); // Pass attribute objects
       if (parsed) {
         const newCriterion = {
           attribute: parsed.attribute,
           operator: parsed.operator,
           value: parsed.value
         };
         const exists = selectedCriteria.some(c =>
             c.attribute === newCriterion.attribute &&
             c.operator === newCriterion.operator &&
             String(c.value) === String(newCriterion.value)
         );
         if (!exists) {
             setSelectedCriteria([...selectedCriteria, newCriterion]);
         }
         setInputValue('');
         setSuggestions([]);
         setInputState('attribute');
         setCurrentAttribute('');
         setCurrentOperator('');
         setInputError(false); // Clear error on successful parse
       } else if (inputValue.trim() !== '') { // Only show error if input is not empty
           console.warn(`Invalid input format: "${inputValue}". Use "Attribute Operator Value".`);
           setInputError(true); // Set error state
       }
    } else if (e.key === 'Escape') { // Escape to clear suggestions
        setSuggestions([]);
        setHighlightedIndex(-1);
    }
  };

   const removeCriterion = (indexToRemove) => {
     setSelectedCriteria(selectedCriteria.filter((_, index) => index !== indexToRemove));
   };

  const handleSearch = () => {
    if (selectedCriteria.length > 0) {
      // Pass both criteria and the attribute weights map
      onSearch({ criteria: selectedCriteria, weights: attributeWeights });
    } else {
        alert("Please add at least one search criterion."); // Simple alert for retro feel
    }
  };

  // Calculate dropdown position relative to the input
  const [dropdownStyle, setDropdownStyle] = useState({});
  useEffect(() => {
    if (inputRef.current && suggestions.length > 0 && portalRoot) {
      const rect = inputRef.current.getBoundingClientRect();
      const portalRect = portalRoot.getBoundingClientRect();
      setDropdownStyle({
        position: 'absolute',
        top: `${rect.bottom - portalRect.top + 2}px`, // Position below input, relative to portal
        left: `${rect.left - portalRect.left}px`,
        width: `${rect.width}px`,
        zIndex: 100, // High z-index
      });
    }
  }, [suggestions.length, portalRoot]); // Re-calculate when suggestions appear/disappear


  // Component for the suggestions dropdown content - Retro styled
  const SuggestionsDropdown = (
    <div
      ref={suggestionsRef}
      style={{
          ...dropdownStyle,
          border: '2px outset #C0C0C0',
          backgroundColor: '#FFFFFF', // White background
          maxHeight: '200px', // Limit height
          overflowY: 'auto',
          boxShadow: '3px 3px 5px rgba(0,0,0,0.4)',
      }}
    >
      {isLoadingSuggestions && <div style={{ padding: '5px', color: '#000080', fontSize: '11px', fontStyle: 'italic' }}>Loading...</div>}
      {!isLoadingSuggestions && suggestions.map((suggestion, index) => (
        <div
          key={`${suggestion.type}-${suggestion.value}-${index}`} // Ensure key uniqueness
          style={{
              padding: '4px 8px',
              cursor: 'pointer',
              color: '#000000',
              fontSize: '12px',
              backgroundColor: index === highlightedIndex ? '#000080' : '#FFFFFF', // Highlight with navy
              color: index === highlightedIndex ? '#FFFFFF' : '#000000', // White text on highlight
          }}
          onClick={() => handleSuggestionSelect(suggestion)}
          onMouseEnter={() => setHighlightedIndex(index)} // Highlight on mouse enter
        >
          {/* Simple text display */}
          {suggestion.display}
        </div>
      ))}
       {!isLoadingSuggestions && suggestions.length === 0 && inputState !== 'attribute' && inputValue.trim() !== '' && (
           <div style={{ padding: '5px', color: '#555555', fontSize: '11px', fontStyle: 'italic' }}>No suggestions</div>
       )}
    </div>
  );

  // --- Retro Styles ---
   const containerStyle = {
     border: '3px ridge #00FF00', // Lime green ridge border
     padding: '15px',
     marginBottom: '15px',
     backgroundColor: '#C0C0C0', // Silver background
   };

   const criteriaTagStyle = {
     display: 'inline-flex',
     alignItems: 'center',
     border: '1px solid #000080', // Navy border
     borderRadius: '3px',
     padding: '2px 6px',
     margin: '2px',
     fontSize: '11px',
     backgroundColor: '#E0E0E0', // Light grey background
     color: '#000000',
   };

   const removeButtonStyle = {
     marginLeft: '8px',
     fontSize: '10px',
     padding: '0 3px',
     color: 'red',
     border: '1px outset red',
     cursor: 'pointer',
     background: '#FFDAB9', // Peach background
     fontWeight: 'bold',
   };

   const inputStyle = {
       // Use styles from index.css by default, add error border if needed
       border: inputError ? '2px solid red' : undefined,
   };


  return (
    <div style={containerStyle}>
       <h3 className="form-title" style={{ color: '#0000FF', textShadow: '1px 1px yellow' }}>Build Your Search Query!</h3>

      {/* Selected Criteria Tags */}
      {selectedCriteria.length > 0 && (
        <div style={{ marginBottom: '10px', border: '1px solid black', padding: '5px', backgroundColor: '#E0E0E0' }}>
           <strong style={{ color: '#000080' }}>Current Criteria:</strong>
           <div style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {selectedCriteria.map((criteria, index) => (
                <span key={index} style={criteriaTagStyle}>
                  <span style={{ color: '#006400' }}>{criteria.attribute}</span>
                  <strong style={{ margin: '0 4px', color: '#8B0000' }}>{criteria.operator}</strong>
                  <span style={{ color: '#00008B' }}>{String(criteria.value)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${criteria.attribute} ${criteria.operator} ${criteria.value}`}
                    style={removeButtonStyle}
                    onClick={() => removeCriterion(index)}
                  >
                    X
                  </button>
                </span>
              ))}
           </div>
        </div>
      )}

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '10px' }}> {/* Relative positioning for suggestions */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Attribute Operator Value (e.g., Age >= 30)"
          style={{ ...inputStyle, width: '100%', padding: '8px' }} // Ensure width and padding
          className="input-retro" // Assuming a base class for retro inputs
        />
        {/* Render Suggestions Dropdown via Portal */}
        {portalRoot && suggestions.length > 0 && createPortal(SuggestionsDropdown, portalRoot)}
      </div>
       {inputError && <p style={{ color: 'red', fontSize: '10px', fontWeight: 'bold', marginTop: '-5px', marginBottom: '5px' }}>Invalid format. Use "Attribute Operator Value".</p>}


      {/* Action Buttons */}
      <div style={{ display: 'flex', marginTop: '10px', gap: '10px' }}>
        <button
          onClick={handleSearch}
          disabled={selectedCriteria.length === 0}
          className="button" // Use base retro button class
          style={{ flexGrow: 1, padding: '10px', fontSize: '14px', fontWeight: 'bold' }} // Lime green is default
        >
           <MagnifyingGlassIcon style={{ height: '1em', width: '1em', marginRight: '5px', display: 'inline-block', verticalAlign: 'middle' }}/>
           SEARCH NOW!
        </button>
        {selectedCriteria.length > 0 && (
          <button
            onClick={() => setShowWeightAdjuster(true)}
            className="button" // Use base retro button class
            style={{ backgroundColor: '#FFFF00', borderColor: '#AAAA00', color: '#000000', flexShrink: 0, padding: '10px' }} // Yellow button
            title="Adjust Attribute Weights"
          >
             <AdjustmentsHorizontalIcon style={{ height: '1em', width: '1em', marginRight: '5px', display: 'inline-block', verticalAlign: 'middle' }}/>
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

// Update PropTypes to match expected props
SearchBar.propTypes = {
  datasetAttributes: PropTypes.arrayOf(PropTypes.shape({
      originalName: PropTypes.string.isRequired,
      // Add other properties if they exist, e.g., type, sanitizedName
  })).isRequired, // Make it required if suggestions depend on it
  onSearch: PropTypes.func.isRequired,
  initialCriteria: PropTypes.arrayOf(PropTypes.shape({
      attribute: PropTypes.string.isRequired,
      operator: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
      weight: PropTypes.number, // Keep weight for initializing weights map
  })),
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Needed for suggestions
  authToken: PropTypes.string, // Needed for suggestions API
  handleLogout: PropTypes.func, // Needed for suggestions API error handling
};

SearchBar.defaultProps = {
  datasetAttributes: [], // Default to empty array
  initialCriteria: [],
  datasetId: null,
  authToken: null,
  handleLogout: () => {}, // Provide a default no-op function
};


export default SearchBar;
