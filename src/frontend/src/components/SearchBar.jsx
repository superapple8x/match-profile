import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // Import createPortal
import PropTypes from 'prop-types';
import WeightAdjustmentModal from './WeightAdjustmentModal';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon, XCircleIcon } from '@heroicons/react/24/outline'; // Added icons
import { debounce } from 'lodash-es'; // Import debounce

// Accept datasetAttributes, initialCriteria, datasetId, authToken, and handleLogout
function SearchBar({ datasetAttributes, onSearch, initialCriteria, datasetId, authToken, handleLogout }) { // Added handleLogout
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false); // Add loading state
  // Initialize selectedCriteria from initialCriteria prop if provided
  const [selectedCriteria, setSelectedCriteria] = useState(initialCriteria || []);
  const [showWeightAdjuster, setShowWeightAdjuster] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null); // Ref for suggestions dropdown

  // Get the portal target element
  const portalRoot = document.getElementById('suggestions-portal');

  // Use datasetAttributes directly (passed as prop)
  const attributes = datasetAttributes || [];

  // Effect to update selectedCriteria when initialCriteria changes (e.g., loading a session)
  useEffect(() => {
    setSelectedCriteria(initialCriteria || []);
  }, [initialCriteria]);

  // --- Debounced Fetch for Value Suggestions ---
  const fetchValueSuggestions = useRef(
    debounce(async (attributeName, searchTerm) => {
      if (!datasetId || !attributeName || !searchTerm) {
        setSuggestions([]);
        setIsLoadingSuggestions(false);
        return;
      }
      setIsLoadingSuggestions(true);
      try {
        const headers = { 'Authorization': `Bearer ${authToken}` };
        const response = await fetch(`/api/suggest/values?datasetId=${encodeURIComponent(datasetId)}&attributeName=${encodeURIComponent(attributeName)}&searchTerm=${encodeURIComponent(searchTerm)}`, { headers });
        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }
        const data = await response.json();
        // Format suggestions for display
        setSuggestions(data.suggestions.map(val => ({
            type: 'value',
            value: val,
            display: String(val).replace( // Highlight match
                 new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i'),
                 '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded">$1</mark>'
            )
        })));
      } catch (error) {
        console.error("Error fetching value suggestions:", error);
        setSuggestions([]); // Clear suggestions on error
        // Check for 401/403 errors
        if (error.message.includes('401') || error.message.includes('403')) {
            console.warn('Suggestion fetch failed due to invalid/expired token.');
            if (handleLogout) handleLogout(); // Trigger logout
        }
        // Note: We don't set a visible error state in the SearchBar for this,
        // as it might be too disruptive. The console warning and logout are sufficient.
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300) // 300ms debounce delay
  ).current;
  // ---

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setHighlightedIndex(-1); // Reset highlight on input change

    const parts = value.split(':');
    const attrPart = parts[0].trim();
    const valPart = parts.length > 1 ? parts[1] : undefined; // Don't trim value part yet

    // Suggest attributes ONLY if there's no colon OR nothing substantial after the colon
    if (value.includes(':') && valPart !== undefined) {
        // User is typing the value part - Fetch value suggestions (debounced)
        const currentAttribute = attrPart; // The attribute typed before the colon
        const currentSearchTerm = valPart.trim(); // Trim now for search term
        if (attributes.includes(currentAttribute)) { // Only fetch if attribute is valid
             fetchValueSuggestions(currentAttribute, currentSearchTerm);
        } else {
             setSuggestions([]); // Clear if attribute is invalid
        }
    } else if (attrPart) {
        // User is typing the attribute part - Show attribute suggestions
        setIsLoadingSuggestions(false); // Not loading value suggestions here
        const searchTerm = attrPart.toLowerCase();
        const matches = attributes
        .filter(a => a.toLowerCase().includes(searchTerm))
        .slice(0, 10); // Show more attribute suggestions if needed

      setSuggestions(matches.map(a => ({
        type: 'attribute', // Only type 'attribute' suggestions now
        value: a,
        display: a.replace(
          new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i'), // Escape regex special chars
          '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded">$1</mark>' // Tailwind class for highlight + rounded
        )
      })));
    } else {
      // Clear suggestions if input is empty or doesn't match attribute pattern start
      setSuggestions([]);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'attribute') {
      setInputValue(`${suggestion.value}: `); // Add space after colon
      setSuggestions([]);
      inputRef.current.focus();
    } else if (suggestion.type === 'value') {
      // Add criterion when a value suggestion is selected
      const [attr] = inputValue.split(':');
      setSelectedCriteria([...selectedCriteria, {
        attribute: attr.trim(),
        value: suggestion.value, // Use the selected value
        weight: 5 // Default weight
      }]);
      setInputValue(''); // Clear input
      setSuggestions([]);
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
       // Check if attribute is valid before adding
       if (attr && val !== undefined && val !== '' && attributes.includes(attr)) {
         setSelectedCriteria([...selectedCriteria, {
           attribute: attr,
           value: val, // Keep value as entered
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
      className="w-full max-h-60 overflow-y-auto mt-1.5 bg-indigo-50/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200/80 dark:border-gray-600/70 rounded-lg shadow-2xl z-50 animate-fade-in-fast" // Light: indigo-50 tint
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={`${suggestion.type}-${suggestion.value}-${index}`}
          className={`px-3.5 py-2.5 cursor-pointer text-gray-800 dark:text-gray-200 transition-colors duration-150 ease-in-out text-sm ${ // Ensure text size consistency
            index === highlightedIndex
              ? 'bg-indigo-200/70 dark:bg-gray-600' // Light: indigo-200 highlight
              : 'hover:bg-indigo-100/80 dark:hover:bg-gray-700' // Light: indigo-100 hover
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
    <div className="flex flex-col w-full mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-indigo-50/70 dark:bg-gray-800 shadow-md transition-shadow duration-300 ease-in-out hover:shadow-lg"> {/* Light: indigo-50 tint */}
      {/* Selected Criteria Tags */}
      {selectedCriteria.length > 0 && (
        <div className="flex flex-wrap mb-4 gap-2">
          {selectedCriteria.map((criteria, index) => (
            <span
              key={index}
              // Using subtle indigo tags
              className="inline-flex items-center bg-indigo-100 dark:bg-gray-700 border border-indigo-200 dark:border-gray-600 rounded-full px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:text-gray-200 shadow-sm" // Light: indigo-100 bg, indigo-800 text
            >
              {criteria.attribute}:{String(criteria.value)}
              <button
                type="button"
                aria-label={`Remove ${criteria.attribute}:${criteria.value}`}
                className="ml-1.5 -mr-0.5 flex-shrink-0 h-4 w-4 rounded-full inline-flex items-center justify-center text-indigo-500 hover:text-indigo-700 hover:bg-indigo-200/70 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:bg-indigo-500/20 focus:text-indigo-700 dark:focus:bg-gray-600/30 dark:focus:text-gray-200 transition-all duration-150 ease-in-out" // Light: indigo colors
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
             // Subtle Indigo Style for "Adjust Weights"
            className={`${baseButtonClasses} bg-indigo-100 hover:bg-indigo-200 text-indigo-800 focus:ring-indigo-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:focus:ring-gray-500 ${disabledClasses}`} // Light: Indigo secondary button
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

// Corrected PropTypes definition
SearchBar.propTypes = {
  datasetAttributes: PropTypes.arrayOf(PropTypes.string),
  onSearch: PropTypes.func.isRequired,
  initialCriteria: PropTypes.arrayOf(PropTypes.shape({
      attribute: PropTypes.string,
      value: PropTypes.any,
      weight: PropTypes.number,
      operator: PropTypes.string
  })),
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Add datasetId
  authToken: PropTypes.string, // Add authToken
  handleLogout: PropTypes.func.isRequired, // Add handleLogout
};

// Corrected defaultProps definition
SearchBar.defaultProps = {
  datasetAttributes: [],
  initialCriteria: [],
  datasetId: null,
  authToken: null,
  // handleLogout is required, so no default needed, but added here for consistency pattern
};


export default SearchBar;
