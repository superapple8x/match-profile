import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // Import createPortal
import PropTypes from 'prop-types';
import WeightAdjustmentModal from './WeightAdjustmentModal';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'; // Added icons

// Note: Removed darkMode prop, relying on Tailwind's dark: variants
function SearchBar({ importedData, onSearch }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCriteria, setSelectedCriteria] = useState([]);
  const [showWeightAdjuster, setShowWeightAdjuster] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null); // Ref for suggestions dropdown

  // Get the portal target element
  const portalRoot = document.getElementById('suggestions-portal');

  // Extract all available attributes from the dataset
  const attributes = importedData?.length > 0
    ? Object.keys(importedData[0])
    : [];

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setHighlightedIndex(-1); // Reset highlight on input change

    const [attr, val] = value.split(':').map(s => s.trim());

    if (!val && attr) { // Suggest attributes only if attr part is being typed
      const searchTerm = attr.toLowerCase();
      const matches = attributes
        .filter(a => a.toLowerCase().includes(searchTerm))
        .slice(0, 5);

      setSuggestions(matches.map(a => ({
        type: 'attribute',
        value: a,
        display: a.replace(
          new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i'), // Escape regex special chars
          '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded">$1</mark>' // Tailwind class for highlight + rounded
        )
      })));
    } else if (attr && val !== undefined && importedData?.length > 0) { // Suggest values only if val part exists
      // Only suggest if the attribute exists
      if (attributes.includes(attr)) {
          const uniqueValues = [...new Set(
            importedData.map(item => item[attr]).filter(v => v !== null && v !== undefined) // Filter out null/undefined
          )];
          const searchTerm = val.toLowerCase();
          const matches = uniqueValues
            .filter(v => String(v).toLowerCase().includes(searchTerm))
            .slice(0, 5);

          setSuggestions(matches.map(v => ({
            type: 'value',
            value: v,
            display: String(v).replace(
              new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i'), // Escape regex special chars
              '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded">$1</mark>' // Tailwind class for highlight + rounded
            )
          })));
       } else {
            setSuggestions([]); // Don't suggest values if attribute is invalid
       }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'attribute') {
      setInputValue(`${suggestion.value}: `); // Add space after colon
      setSuggestions([]); // Clear suggestions after selection
      inputRef.current.focus();
    } else if (suggestion.type === 'value') {
      const [attr] = inputValue.split(':');
      // Add the selected criterion directly
      setSelectedCriteria([...selectedCriteria, {
        attribute: attr.trim(),
        value: suggestion.value,
        weight: 5 // Default weight
      }]);
      setInputValue(''); // Clear input after adding
      setSuggestions([]); // Clear suggestions
      inputRef.current.focus();
    }
    setHighlightedIndex(-1);
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
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : 0
        );
      } else if ((e.key === 'Tab' || e.key === 'Enter') && highlightedIndex >= 0) {
        e.preventDefault();
        handleSuggestionSelect(suggestions[highlightedIndex]);
      }
    }
    // Enter to confirm search criteria if input has format "attr:val" and no suggestion selected
    else if (e.key === 'Enter' && highlightedIndex === -1 && inputValue.includes(':')) {
       e.preventDefault();
       const [attr, val] = inputValue.split(':').map(s => s.trim());
       if (attr && val && attributes.includes(attr)) { // Also check if attribute is valid
         setSelectedCriteria([...selectedCriteria, {
           attribute: attr,
           value: val,
           weight: 5
         }]);
         setInputValue('');
         setSuggestions([]);
       } else if (attr && val) {
           // Maybe show an error tooltip/message if attribute is invalid? For now, just don't add.
           console.warn(`Invalid attribute entered: ${attr}`);
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
    if (inputRef.current && suggestions.length > 0) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'absolute',
        top: `${rect.bottom + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
      });
    }
  }, [suggestions.length]);


  // Component for the suggestions dropdown content
  const SuggestionsDropdown = (
    <div
      ref={suggestionsRef}
      style={dropdownStyle}
      className="w-full max-h-60 overflow-y-auto mt-1.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200/80 dark:border-gray-600/70 rounded-lg shadow-2xl z-50 animate-fade-in-fast" // Slightly adjusted dark border
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={`${suggestion.type}-${suggestion.value}-${index}`}
          className={`px-3.5 py-2.5 cursor-pointer text-gray-800 dark:text-gray-200 transition-colors duration-150 ease-in-out text-sm ${ // Ensure text size consistency
            index === highlightedIndex
              ? 'bg-gray-200 dark:bg-gray-600' // Simple gray highlight
              : 'hover:bg-gray-100 dark:hover:bg-gray-700' // Simple gray hover
          }`}
          onClick={() => handleSuggestionSelect(suggestion)}
          dangerouslySetInnerHTML={{ __html: suggestion.display }}
        />
      ))}
    </div>
  );


  // Define button styles based on reference
  const baseButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";
  const primaryButtonStyle = "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-gray-400";
  const secondaryButtonStyle = "bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:focus:ring-gray-500"; // Lighter gray for secondary
  const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";


  return (
    <div className="flex flex-col w-full mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-800 shadow-md transition-shadow duration-300 ease-in-out hover:shadow-lg">
      {/* Selected Criteria Tags */}
      {selectedCriteria.length > 0 && (
        <div className="flex flex-wrap mb-4 gap-2">
          {selectedCriteria.map((criteria, index) => (
            <span
              key={index}
              // Using subtle gray-blue tags
              className="inline-flex items-center bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm"
            >
              {criteria.attribute}:{String(criteria.value)}
              <button
                type="button"
                aria-label={`Remove ${criteria.attribute}:${criteria.value}`}
                className="ml-1.5 -mr-0.5 flex-shrink-0 h-4 w-4 rounded-full inline-flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:bg-gray-500/20 focus:text-gray-700 dark:focus:bg-gray-600/30 dark:focus:text-gray-200 transition-all duration-150 ease-in-out"
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
      <div className="w-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter attribute:value (e.g., Age:30)"
          // Subtle input style
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-colors duration-200 ease-in-out shadow-sm"
        />

        {/* Render Suggestions Dropdown via Portal */}
        {suggestions.length > 0 && portalRoot && createPortal(SuggestionsDropdown, portalRoot)}
      </div>

      {/* Action Buttons */}
      <div className="flex mt-4 space-x-3">
        <button
          onClick={handleSearch}
          disabled={selectedCriteria.length === 0}
          // Subtle Dark Gray Style for "Search"
          className={`${baseButtonClasses} ${primaryButtonStyle} ${disabledClasses}`}
        >
           <MagnifyingGlassIcon className="h-4 w-4 mr-2"/> Search
        </button>
        {selectedCriteria.length > 0 && (
          <button
            onClick={() => setShowWeightAdjuster(true)}
             // Subtle Lighter Gray Style for "Adjust Weights"
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
          onWeightChange={(attr, weight) => setSelectedCriteria(
            selectedCriteria.map(c => c.attribute === attr ? {...c, weight: Number(weight) || 0 } : c)
          )}
          onClose={() => setShowWeightAdjuster(false)}
        />
      )}
    </div>
  );
}

SearchBar.propTypes = {
  importedData: PropTypes.arrayOf(PropTypes.object),
  onSearch: PropTypes.func.isRequired,
};

SearchBar.defaultProps = {
  importedData: [],
};


export default SearchBar;
