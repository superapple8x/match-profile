import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
// Removed: import './SearchBar.css';
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

  return (
    // Main container
    <div className="flex flex-col w-full mb-5 border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700 transition-colors duration-150">
      {/* Selected Criteria Tags */}
      {selectedCriteria.length > 0 && (
        <div className="flex flex-wrap mb-3 gap-1">
          {selectedCriteria.map((criteria, index) => (
            <span
              key={index}
              className="inline-flex items-center bg-blue-100 dark:bg-blue-800 border border-blue-200 dark:border-blue-700 rounded-md px-3 py-1 text-sm font-medium text-blue-800 dark:text-blue-100 transition-colors duration-150"
            >
              {criteria.attribute}:{String(criteria.value)} {/* Ensure value is string */}
              <button // Changed span to button for accessibility
                type="button"
                aria-label={`Remove ${criteria.attribute}:${criteria.value}`}
                className="ml-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold transition-colors duration-150"
                onClick={() => setSelectedCriteria(
                  selectedCriteria.filter((_, i) => i !== index)
                )}
              >
                &times; {/* Use times symbol */}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input and Suggestions */}
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter attribute:value (e.g., Age:30)"
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors duration-150"
        />

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute w-full max-h-52 overflow-y-auto mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-10 transition-colors duration-150"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.type}-${suggestion.value}-${index}`} // More robust key
                className={`p-3 cursor-pointer text-gray-800 dark:text-gray-200 transition-colors duration-150 ${
                  index === highlightedIndex
                    ? 'bg-blue-100 dark:bg-blue-700'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => handleSuggestionSelect(suggestion)}
                // Use Tailwind class for highlighting instead of <mark> tag directly in display
                dangerouslySetInnerHTML={{ __html: suggestion.display }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex mt-3 space-x-3">
        <button
          onClick={handleSearch}
          disabled={selectedCriteria.length === 0}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold rounded-md shadow transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Search
        </button>
        {selectedCriteria.length > 0 && (
          <button
            onClick={() => setShowWeightAdjuster(true)}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold border border-gray-300 dark:border-gray-500 rounded-md shadow transition-colors duration-150"
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
