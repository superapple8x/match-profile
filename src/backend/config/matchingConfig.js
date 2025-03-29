// Configuration for the Matching Engine

const matchingConfig = {
  // Base weights for different match types (used for scaling scores)
  exactMatchWeight: 1.0,
  rangeMatchWeight: 0.8,
  partialMatchWeight: 0.6,
  optionalMatchWeight: 0.4, // Example, adjust if optionalMatch is used differently

  // Default rules defining how to compare different attributes
  defaultMatchingRules: {
    Age: { type: 'range', tolerance: 5 },
    Gender: { type: 'exact' },
    Location: { type: 'partial' }, // Will use fuzzy matching now
    Profession: { type: 'partial' }, // Will use fuzzy matching now
    Platform: { type: 'exact' },
    'Video Category': { type: 'exact' },
    'Watch Reason': { type: 'partial' }, // Will use fuzzy matching now
    DeviceType: { type: 'partial' }, // Will use fuzzy matching now
    OS: { type: 'partial' }, // Will use fuzzy matching now
    name: { type: 'exact' },
    email: { type: 'exact' },
    // Added rules for boolean columns from the dataset sample
    Debt: { type: 'exact' },
    'Owns Property': { type: 'exact' }
    // Add more attribute-specific rules here as needed
  }
};

module.exports = matchingConfig;