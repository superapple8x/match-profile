class MatchingEngine {
  constructor() {
    this.weights = {};
    this.config = {
      exactMatchWeight: 1.0,
      rangeMatchWeight: 0.8,
      partialMatchWeight: 0.6,
      optionalMatchWeight: 0.4
    };
    this.defaultMatchingRules = {
      Age: { type: 'range', tolerance: 5 },
      Gender: { type: 'exact' },
      Location: { type: 'partial' },
      Profession: { type: 'partial' },
      Platform: { type: 'exact' },
      'Video Category': { type: 'exact' },
      'Watch Reason': { type: 'partial' },
      DeviceType: { type: 'partial' },
      OS: { type: 'partial' },
      name: { type: 'exact' },
      email: { type: 'exact' },
      // Added rules for boolean columns from the dataset sample
      Debt: { type: 'exact' },
      'Owns Property': { type: 'exact' }
    };
  }

  setWeights(weights) {
    this.weights = weights;
  }

  exactMatch(value1, value2) {
    // Normalize strings to handle encoding issues
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      const normalizedValue1 = value1.normalize('NFC').trim();
      const normalizedValue2 = value2.normalize('NFC').trim();
      return normalizedValue1 === normalizedValue2 ? this.config.exactMatchWeight : 0;
    }
    return value1 === value2 ? this.config.exactMatchWeight : 0;
  }

  rangeMatch(value1, value2, tolerance) {
    const num1 = parseFloat(value1);
    const num2 = parseFloat(value2);
    if (isNaN(num1) || isNaN(num2)) return 0;
    return Math.abs(num1 - num2) <= tolerance ? this.config.rangeMatchWeight : 0;
  }

  partialTextMatch(text1, text2) {
    if (typeof text1 !== 'string' || typeof text2 !== 'string') return 0;
    
    // Normalize strings to handle encoding issues
    const normalizedText1 = text1.normalize('NFC').trim().toLowerCase();
    const normalizedText2 = text2.normalize('NFC').trim().toLowerCase();
    
    return normalizedText1.includes(normalizedText2) || 
           normalizedText2.includes(normalizedText1) 
            ? this.config.partialMatchWeight : 0;
  }

  optionalMatch(value1, value2) {
    return value1 && value2 ? this.config.optionalMatchWeight : 0;
  }

  // Modify to accept the full searchCriteria array (with operators)
  // Logic changed: Assume rows passed DB filter fully satisfy the criteria used.
  // Score is based on the weights of the attributes included in the search.
  calculateMatchScore(searchCriteriaArray, profile, originalToSanitizedMap, matchingRules = this.defaultMatchingRules) {
    let totalScore = 0;
    let maxPossibleScore = 0;

    // Create a Set of attributes that were actually used in the search criteria for quick lookup
    const searchedAttributes = new Set(searchCriteriaArray.map(c => c.attribute));

    console.log('[Score] Calculating score based on searched attributes:', searchedAttributes);
    // console.log('[Score] Profile data (sanitized keys):', profile);

    // Iterate through all attributes that *could* have a weight or were searched
    // Combine keys from weights and searchedAttributes to cover all relevant attributes
    const relevantAttributes = new Set([...Object.keys(this.weights), ...searchedAttributes]);

    relevantAttributes.forEach(attribute => {
        // Check if the attribute exists in the profile's metadata map
        if (originalToSanitizedMap.hasOwnProperty(attribute)) {
            const weight = this.weights[attribute] || 1; // Get weight or default to 1
            const maxAttributeScore = this.config.exactMatchWeight * weight; // Max potential score for this attribute

            // Add to the maximum possible score regardless of whether it was searched
            maxPossibleScore += maxAttributeScore;

            // If this attribute was part of the search criteria that the profile passed...
            if (searchedAttributes.has(attribute)) {
                // ...grant the full score for this attribute.
                // The database already did the filtering (>, =, IN, LIKE etc.)
                totalScore += maxAttributeScore;
                console.log(`[Score] Attribute "${attribute}" was searched. Adding full score: ${maxAttributeScore}`);
            } else {
                 console.log(`[Score] Attribute "${attribute}" was not searched. Max score contribution: ${maxAttributeScore}, Added score: 0`);
            }
        } else {
            console.warn(`[Score] Attribute "${attribute}" from weights/criteria not found in dataset metadata map. Skipping.`);
        }
    });


    // Handle the case where no relevant weighted/searched attributes were found
    if (maxPossibleScore === 0 && searchedAttributes.size > 0) {
        // If criteria were provided but none had weights or matched metadata,
        // assign a baseline score or handle as needed. For now, let it be 0.
         console.warn("[Score] Search criteria were provided, but no relevant attributes found in metadata/weights. Score might be 0.");
         // Or, alternatively, if *any* match means 100% if no weights apply:
         // return 100;
    }
     else if (maxPossibleScore === 0 && searchedAttributes.size === 0) {
         // If no criteria were provided (e.g., just browsing/sorting), score is irrelevant or could be 100?
         // Let's return 0 for consistency, as no matching criteria were evaluated.
         console.log("[Score] No search criteria provided. Score is 0.");
         return 0;
     }


    const finalScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    console.log(`[Score] Final Score: ${totalScore} / ${maxPossibleScore} = ${finalScore.toFixed(2)}%`);
    return finalScore;
  }
}

module.exports = MatchingEngine;
