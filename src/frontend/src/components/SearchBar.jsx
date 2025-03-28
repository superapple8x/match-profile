import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // Import createPortal
import PropTypes from 'prop-types';
import WeightAdjustmentModal from './WeightAdjustmentModal';

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
          '<mark class="bg-yellow-200 dark:bg-yellow-600">$1</mark>' // Tailwind class for highlight
        )
      })));
    } else if (attr && val !== undefined && importedData?.length > 0) { // Suggest values only if val part exists
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
          '<mark class="bg-yellow-200 dark:bg-yellow-600">$1</mark>' // Tailwind class for highlight
        )
      })));
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'attribute') {
      setInputValue(`${suggestion.value}:`);
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
          prev > 0 ? prev - 1 : 0 // Allow selecting the first item
        );
      } else if ((e.key === 'Tab' || e.key === 'Enter') && highlightedIndex >= 0) {
        e.preventDefault();
        handleSuggestionSelect(suggestions[highlightedIndex]);
      }
    }
    // Enter to confirm search criteria if input has format "attr:val" and no suggestion selected
    else if (e.key === 'Enter' && highlightedIndex === -1 && inputValue.includes(':')) {
       e.preventDefault(); // Prevent form submission if any
       const [attr, val] = inputValue.split(':').map(s => s.trim());
       if (attr && val) {
         setSelectedCriteria([...selectedCriteria, {
           attribute: attr,
           value: val,
           weight: 5
         }]);
         setInputValue('');
         setSuggestions([]);
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
        position: 'absolute', // Use absolute positioning relative to viewport
        top: `${rect.bottom + window.scrollY}px`, // Position below the input
        left: `${rect.left + window.scrollX}px`, // Align with the left of the input
        width: `${rect.width}px`, // Match input width
      });
    }
  }, [suggestions.length]); // Recalculate when suggestions appear/disappear


  // Component for the suggestions dropdown content
  const SuggestionsDropdown = (
    <div
      ref={suggestionsRef}
      style={dropdownStyle} // Apply calculated position
      className="w-full max-h-60 overflow-y-auto mt-1.5 bg-white/95 dark:bg-gray-700/95 backdrop-blur-md border border-gray-200/80 dark:border-gray-600/50 rounded-lg shadow-2xl z-50 animate-fade-in-fast" // Increased max-h, adjusted mt, bg, border, shadow, added animation class
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={`${suggestion.type}-${suggestion.value}-${index}`} // More robust key
          className={`px-3.5 py-2.5 cursor-pointer text-gray-800 dark:text-gray-200 transition-colors duration-150 ease-in-out ${ // Adjusted padding, added transition
            index === highlightedIndex
              ? 'bg-primary-100/90 dark:bg-primary-700/70' // Adjusted highlight opacity
              : 'hover:bg-gray-100/80 dark:hover:bg-gray-600/60' // Adjusted hover opacity
          }`}
          onClick={() => handleSuggestionSelect(suggestion)}
          // Use Tailwind class for highlighting instead of <mark> tag directly in display
          dangerouslySetInnerHTML={{ __html: suggestion.display }}
        />
      ))}
    </div>
  );


  return (
    // Main container - Reverted to opaque background, simpler shadow/border
    <div className="flex flex-col w-full mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-800 shadow-md transition-shadow duration-300 ease-in-out hover:shadow-lg">
      {/* Selected Criteria Tags */}
      {selectedCriteria.length > 0 && (
        <div className="flex flex-wrap mb-4 gap-2"> {/* Increased margin-bottom and gap */}
          {selectedCriteria.map((criteria, index) => (
            <span
              key={index}
              className="inline-flex items-center bg-primary-100/80 dark:bg-primary-900/60 border border-primary-200/80 dark:border-primary-700/50 rounded-full px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:text-primary-100 shadow-sm" // Adjusted opacity, border, rounded-full, padding, text size, shadow
            >
              {criteria.attribute}:{String(criteria.value)} {/* Ensure value is string */}
              <button // Changed span to button for accessibility
                type="button"
                aria-label={`Remove ${criteria.attribute}:${criteria.value}`}
                className="ml-1.5 -mr-0.5 flex-shrink-0 h-4 w-4 rounded-full inline-flex items-center justify-center text-red-500/80 dark:text-red-400/80 hover:bg-red-200/50 dark:hover:bg-red-800/50 hover:text-red-600 dark:hover:text-red-300 focus:outline-none focus:bg-red-500/20 focus:text-red-700 dark:focus:bg-red-700/30 dark:focus:text-red-200 transition-all duration-150 ease-in-out" // Adjusted remove button style
                onClick={() => setSelectedCriteria(
                  selectedCriteria.filter((_, i) => i !== index)
                )}
              >
                <svg className="h-2.5 w-2.5" stroke="currentColor" fill="none" viewBox="0 0 8 8"> {/* SVG for X icon */}
                  <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input - Removed relative positioning from wrapper */}
      <div className="w-full"> {/* Removed group class as focus-within won't work with portal */}
        {/* Input styling remains slightly transparent for depth */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter attribute:value (e.g., Age:30)"
          className="w-full p-3.5 border border-gray-300/60 dark:border-gray-600/40 rounded-lg text-base bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500/80 focus:border-transparent outline-none transition-all duration-200 ease-in-out hover:border-gray-400/80 dark:hover:border-gray-500/60 shadow-sm focus:shadow-md" // Increased padding, adjusted border/bg opacity, added placeholder style, refined focus/hover, added shadow
        />

        {/* Render Suggestions Dropdown via Portal */}
        {suggestions.length > 0 && portalRoot && createPortal(SuggestionsDropdown, portalRoot)}
      </div>

      {/* Action Buttons */}
      <div className="flex mt-4 space-x-3"> {/* Increased margin-top */}
        <button
          onClick={handleSearch}
          disabled={selectedCriteria.length === 0}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 dark:bg-primary-700 dark:hover:bg-primary-800 text-white font-semibold rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800" // Matched App.jsx button style
        >
          Search
        </button>
        {selectedCriteria.length > 0 && (
          <button
            onClick={() => setShowWeightAdjuster(true)}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold border border-gray-300 dark:border-gray-500 rounded-md shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800" // Matched App.jsx button style (secondary variant)
          >
            Adjust Weights
          </button>
        )}
      </div>

      {/* Weight Adjustment Modal */}
      {showWeightAdjuster && (
        <WeightAdjustmentModal
          selectedCriteria={selectedCriteria}
          onWeightChange={(attr, weight) => setSelectedCriteria(
            selectedCriteria.map(c => c.attribute === attr ? {...c, weight: Number(weight) || 0 } : c) // Ensure weight is number
          )}
          onClose={() => setShowWeightAdjuster(false)}
        />
      )}
    </div>
  );
}

SearchBar.propTypes = {
  // Ensure importedData is an array of objects, even if empty
  importedData: PropTypes.arrayOf(PropTypes.object),
  onSearch: PropTypes.func.isRequired,
  // darkMode prop removed
};

// Default prop for importedData if it might be null/undefined initially
SearchBar.defaultProps = {
  importedData: [],
};


export default SearchBar;
