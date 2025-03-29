import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import WeightAdjustmentModal from './WeightAdjustmentModal';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { debounce } from 'lodash-es';

// Define supported operators
const SUPPORTED_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'];

// Helper function to parse input: "attribute operator value"
const parseInput = (input, attributes) => {
    const trimmedInput = input.trim();
    // Try to find the last valid operator preceded by a space
    let operatorIndex = -1;
    let operator = null;
    for (const op of SUPPORTED_OPERATORS.slice().sort((a, b) => b.length - a.length)) { // Check longer operators first
        const index = trimmedInput.lastIndexOf(` ${op} `);
        if (index > 0) { // Ensure operator is not at the beginning
            operatorIndex = index + 1; // Index of the operator itself
            operator = op;
            break;
        }
    }

    if (operatorIndex > 0 && operator) {
        const attribute = trimmedInput.substring(0, operatorIndex - 1).trim(); // -1 for the space before operator
        const value = trimmedInput.substring(operatorIndex + operator.length + 1).trim(); // +1 for the space after operator

        // Validate attribute
        if (attributes.includes(attribute) && value) {
            return { attribute, operator, value };
        }
    }

    // Fallback or invalid format
    return null;
};


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

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const portalRoot = document.getElementById('suggestions-portal');
  const attributes = datasetAttributes || [];

  useEffect(() => {
    setSelectedCriteria(initialCriteria || []);
    // Reset internal state if initial criteria change significantly
    setInputValue('');
    setInputState('attribute');
    setCurrentAttribute('');
    setCurrentOperator('');
  }, [initialCriteria]);

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
        const headers = { 'Authorization': `Bearer ${authToken}` };
        // Adjust API endpoint if needed, assuming it can handle operator context or just filters by value prefix
        const response = await fetch(`/api/suggest/values?datasetId=${encodeURIComponent(datasetId)}&attributeName=${encodeURIComponent(attributeName)}&searchTerm=${encodeURIComponent(searchTerm)}`, { headers });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            console.warn('Suggestion fetch failed due to invalid/expired token.');
            if (handleLogout) handleLogout();
          }
          throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
        }
        const data = await response.json();
        setSuggestions(data.suggestions.map(val => ({
            type: 'value',
            value: val,
            display: String(val).replace(
                 new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i'),
                 '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded">$1</mark>'
            )
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

    const trimmedValue = value.trimStart(); // Keep trailing space if user adds one intentionally
    const lastSpaceIndex = trimmedValue.lastIndexOf(' ');

    // Determine context based on structure "Attribute Operator Value"
    // Try parsing first to see if we have a complete structure already
    const parsedForContext = parseInput(trimmedValue, attributes);

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

        if (attributes.includes(potentialAttr)) {
            // Attribute is valid, now check if the next part is an operator
            const potentialOp = potentialOpOrVal.toLowerCase();
            const matchingOperators = SUPPORTED_OPERATORS.filter(op => op.toLowerCase().startsWith(potentialOp));

            if (matchingOperators.length > 0 && !potentialOpOrVal.includes(' ')) {
                 // Suggest operators if the part after attribute looks like a start of an operator
                 setInputState('operator');
                 setCurrentAttribute(potentialAttr); // Store the valid attribute
                 setCurrentOperator(''); // Reset operator
                 setSuggestions(matchingOperators.map(op => ({
                     type: 'operator',
                     value: op,
                     display: op.replace(
                         new RegExp(`^(${potentialOp.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i'),
                         '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded">$1</mark>'
                     )
                 })));
                 setIsLoadingSuggestions(false);
            } else {
                 // Assume entering value if attribute is valid but next part isn't a starting operator
                 // Or if the potential operator part contains spaces (likely part of value)
                 setInputState('value');
                 setCurrentAttribute(potentialAttr);
                 // Try to infer operator if only one possibility makes sense based on last word
                 const words = trimmedValue.split(' ');
                 let inferredOperator = '';
                 if (words.length >= 2) {
                    const lastWord = words[words.length - 2]; // Word before the last space
                    if (SUPPORTED_OPERATORS.includes(lastWord)) {
                        inferredOperator = lastWord;
                        setCurrentOperator(inferredOperator);
                        const valuePart = words[words.length - 1]; // The very last part
                        fetchValueSuggestions(potentialAttr, inferredOperator, valuePart);
                    } else {
                        // Cannot reliably determine operator, clear suggestions
                        setSuggestions([]);
                        setIsLoadingSuggestions(false);
                    }
                 } else {
                     setSuggestions([]);
                     setIsLoadingSuggestions(false);
                 }
            }
        } else {
            // Attribute part is invalid or incomplete, suggest attributes
            setInputState('attribute');
            setCurrentAttribute('');
            setCurrentOperator('');
            const searchTerm = trimmedValue.toLowerCase();
            const matches = attributes
                .filter(a => a.toLowerCase().includes(searchTerm))
                .slice(0, 10);
            setSuggestions(matches.map(a => ({
                type: 'attribute',
                value: a,
                display: a.replace(
                    new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i'),
                    '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded">$1</mark>'
                )
            })));
            setIsLoadingSuggestions(false);
        }
    } else {
        // No spaces, must be typing the attribute
        setInputState('attribute');
        setCurrentAttribute('');
        setCurrentOperator('');
        const searchTerm = trimmedValue.toLowerCase();
        const matches = attributes
            .filter(a => a.toLowerCase().includes(searchTerm))
            .slice(0, 10);
        setSuggestions(matches.map(a => ({
            type: 'attribute',
            value: a,
            display: a.replace(
                new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i'),
                '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded">$1</mark>'
            )
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
        setSelectedCriteria([...selectedCriteria, {
          attribute: currentAttribute,
          operator: currentOperator,
          value: suggestion.value,
          weight: 5 // Default weight
        }]);
        setInputValue(''); // Clear input
        setSuggestions([]);
        setInputState('attribute'); // Reset state
        setCurrentAttribute('');
        setCurrentOperator('');
      } else {
          console.warn("Could not add criterion: Attribute or Operator context missing.");
          // Maybe try parsing the input again as a fallback?
          const parsed = parseInput(inputValue.substring(0, inputValue.lastIndexOf(suggestion.value)), attributes);
          if (parsed) {
               setSelectedCriteria([...selectedCriteria, {
                  attribute: parsed.attribute,
                  operator: parsed.operator,
                  value: suggestion.value,
                  weight: 5
               }]);
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
       const parsed = parseInput(inputValue, attributes);
       if (parsed) {
         setSelectedCriteria([...selectedCriteria, {
           attribute: parsed.attribute,
           operator: parsed.operator,
           value: parsed.value,
           weight: 5
         }]);
         setInputValue('');
         setSuggestions([]);
         setInputState('attribute');
         setCurrentAttribute('');
         setCurrentOperator('');
       } else {
           console.warn(`Invalid input format: "${inputValue}". Use "Attribute Operator Value".`);
           // Optionally provide user feedback here (e.g., flash input border red)
       }
     }
  };

  const handleSearch = () => {
    if (selectedCriteria.length > 0) {
      onSearch(selectedCriteria);
    }
  };

  // Calculate dropdown position relative to the input
  const [dropdownStyle, setDropdownStyle] = useState({});
  useEffect(() => {
    if (inputRef.current && suggestions.length > 0 && portalRoot) {
      const rect = inputRef.current.getBoundingClientRect();
      // Adjust position calculation if portalRoot has offset parents or transforms
      const portalRect = portalRoot.getBoundingClientRect();
      setDropdownStyle({
        position: 'absolute',
        top: `${rect.bottom - portalRect.top}px`, // Position relative to portal
        left: `${rect.left - portalRect.left}px`, // Position relative to portal
        width: `${rect.width}px`,
        zIndex: 50, // Ensure dropdown is above other elements
      });
    }
  }, [suggestions.length, portalRoot]); // Re-calculate when suggestions appear/disappear or portal is available


  // Component for the suggestions dropdown content
  const SuggestionsDropdown = (
    <div
      ref={suggestionsRef}
      style={dropdownStyle}
      className="absolute w-full max-h-60 overflow-y-auto mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 animate-fade-in-fast"
    >
      {isLoadingSuggestions && <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">Loading...</div>}
      {!isLoadingSuggestions && suggestions.map((suggestion, index) => (
        <div
          key={`${suggestion.type}-${suggestion.value}-${index}`} // Ensure key uniqueness
          className={`px-3 py-2 cursor-pointer text-gray-800 dark:text-gray-200 transition-colors duration-150 ease-in-out text-sm ${
            index === highlightedIndex
              ? 'bg-indigo-100 dark:bg-gray-700' // Highlight color
              : 'hover:bg-gray-100 dark:hover:bg-gray-600' // Hover color
          }`}
          onClick={() => handleSuggestionSelect(suggestion)}
          // Use dangerouslySetInnerHTML only if suggestion.display contains HTML (like highlighting)
          dangerouslySetInnerHTML={suggestion.display.includes('<mark') ? { __html: suggestion.display } : undefined}
        >
          {!suggestion.display.includes('<mark') ? suggestion.display : null}
        </div>
      ))}
       {!isLoadingSuggestions && suggestions.length === 0 && inputState !== 'attribute' && inputValue.trim() !== '' && (
           <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">No suggestions</div>
       )}
    </div>
  );


  // Define button styles based on reference
  const baseButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900"; // Adjusted dark offset
  const primaryButtonStyle = "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-indigo-400"; // Primary indigo
  const secondaryButtonStyle = "bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-indigo-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:focus:ring-gray-500";
  const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";


  return (
    <div className="flex flex-col w-full mb-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm transition-shadow duration-300 ease-in-out"> {/* Standard background */}
      {/* Selected Criteria Tags */}
      {selectedCriteria.length > 0 && (
        <div className="flex flex-wrap mb-3 gap-2">
          {selectedCriteria.map((criteria, index) => (
            <span
              key={index}
              className="inline-flex items-center bg-indigo-100 dark:bg-gray-700 border border-indigo-200 dark:border-gray-600 rounded-full px-3 py-1 text-xs font-medium text-indigo-800 dark:text-gray-200 shadow-sm"
            >
              {/* Display format: Attribute Operator Value */}
              {criteria.attribute} <strong className="mx-1">{criteria.operator}</strong> {String(criteria.value)}
              <button
                type="button"
                aria-label={`Remove ${criteria.attribute} ${criteria.operator} ${criteria.value}`}
                className="ml-1.5 -mr-1 flex-shrink-0 h-4 w-4 rounded-full inline-flex items-center justify-center text-indigo-500 hover:text-indigo-700 hover:bg-indigo-200/70 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:bg-indigo-500/20 focus:text-indigo-700 dark:focus:bg-gray-600/30 dark:focus:text-gray-200 transition-all duration-150 ease-in-out"
                onClick={() => setSelectedCriteria(
                  selectedCriteria.filter((_, i) => i !== index)
                )}
              >
                <svg className="h-2.5 w-2.5" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                  <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative w-full"> {/* Added relative positioning for potential inline error messages */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Attribute Operator Value (e.g., Age >= 30)" // Updated placeholder
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors duration-200 ease-in-out shadow-sm" // Indigo focus ring
        />

        {/* Render Suggestions Dropdown via Portal if portalRoot exists */}
        {portalRoot && suggestions.length > 0 && createPortal(SuggestionsDropdown, portalRoot)}
        {/* Fallback: Render directly if portalRoot doesn't exist (though it should) */}
        {!portalRoot && suggestions.length > 0 && SuggestionsDropdown}
      </div>

      {/* Action Buttons */}
      <div className="flex mt-4 space-x-3">
        <button
          onClick={handleSearch}
          disabled={selectedCriteria.length === 0}
          className={`${baseButtonClasses} ${primaryButtonStyle} ${disabledClasses}`}
        >
           <MagnifyingGlassIcon className="h-4 w-4 mr-2"/> Search
        </button>
        {selectedCriteria.length > 0 && (
          <button
            onClick={() => setShowWeightAdjuster(true)}
            className={`${baseButtonClasses} ${secondaryButtonStyle} ${disabledClasses}`}
          >
             <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2"/> Adjust Weights
          </button>
        )}
      </div>

      {/* Weight Adjustment Modal */}
      {showWeightAdjuster && (
        <WeightAdjustmentModal
          selectedCriteria={selectedCriteria}
          onWeightChange={(attr, op, val, weight) => setSelectedCriteria( // Adjust key based on how criteria are uniquely identified if needed
             selectedCriteria.map(c =>
                c.attribute === attr && c.operator === op && c.value === val
                ? { ...c, weight: Number(weight) || 0 }
                : c
             )
          )}
          onClose={() => setShowWeightAdjuster(false)}
        />
      )}
    </div>
  );
}

SearchBar.propTypes = {
  datasetAttributes: PropTypes.arrayOf(PropTypes.string),
  onSearch: PropTypes.func.isRequired,
  initialCriteria: PropTypes.arrayOf(PropTypes.shape({
      attribute: PropTypes.string.isRequired, // Made required
      operator: PropTypes.string.isRequired, // Added operator, made required
      value: PropTypes.any.isRequired,       // Made required
      weight: PropTypes.number,
  })),
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  authToken: PropTypes.string,
  handleLogout: PropTypes.func.isRequired,
};

SearchBar.defaultProps = {
  datasetAttributes: [],
  initialCriteria: [],
  datasetId: null,
  authToken: null,
};


export default SearchBar;
