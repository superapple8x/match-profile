const Fuse = require('fuse.js'); // Import Fuse.js
const matchingConfig = require('./config/matchingConfig'); // Import external config

class MatchingEngine {
  constructor() {
    this.weights = {};
    // Use imported configuration
    this.config = {
        exactMatchWeight: matchingConfig.exactMatchWeight,
        rangeMatchWeight: matchingConfig.rangeMatchWeight,
        partialMatchWeight: matchingConfig.partialMatchWeight,
        optionalMatchWeight: matchingConfig.optionalMatchWeight
    };
    this.defaultMatchingRules = matchingConfig.defaultMatchingRules;
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

  partialTextMatch(profileText, criterionText) {
    if (typeof profileText !== 'string' || typeof criterionText !== 'string') return 0;

    // Normalize strings
    const normalizedProfileText = profileText.normalize('NFC').trim().toLowerCase();
    const normalizedCriterionText = criterionText.normalize('NFC').trim().toLowerCase();

    if (!normalizedProfileText || !normalizedCriterionText) return 0; // Cannot match empty strings

    // Use Fuse.js for fuzzy matching
    // We search for the criterionText within the profileText.
    // Since Fuse expects a list, we wrap profileText in an array.
    // We'll use a simple configuration for now.
    const fuseOptions = {
      includeScore: true, // Ensure score is included in results
      // isCaseSensitive: false, // Already handled by toLowerCase
      shouldSort: true, // Sort results by score (best match first)
      threshold: 0.6, // Adjust threshold (0=perfect match, 1=match anything)
      // location: 0, // Start search at beginning
      // distance: 100, // How far to search
      // minMatchCharLength: 1, // Minimum characters to match
      // keys: ["value"] // If searching objects in array
    };

    // Create a Fuse instance with the text to search within (profileText)
    // Since we are comparing two strings, we can search for criterionText in a list containing just profileText
    const fuse = new Fuse([normalizedProfileText], fuseOptions);

    // Search for the criterionText
    const results = fuse.search(normalizedCriterionText);

    // Check if any result is found within the threshold
    // Fuse.js returns a score between 0 (perfect match) and 1.
    // We want a high score for a good match, so invert the Fuse score.
    // Let's return a score based on the best match found.
    if (results.length > 0) {
        // Assuming the first result is the best match (Fuse sorts by score)
        const fuseScore = results[0].score;
        // Invert and scale the score: (1 - fuseScore) * baseWeight
        // A lower fuseScore (better match) results in a higher final score.
        const matchQuality = 1 - fuseScore; // 0 to 1, where 1 is perfect match
        return matchQuality * this.config.partialMatchWeight; // Scale by the configured weight
    }

    return 0; // No match found within threshold
  }

  optionalMatch(value1, value2) {
    return value1 && value2 ? this.config.optionalMatchWeight : 0;
  }

  // Modify to accept the full searchCriteria array (with operators)
  // Logic changed: Assume rows passed DB filter fully satisfy the criteria used.
  // Logic updated for granular scoring based on specific match functions and criteria
  calculateMatchScore(searchCriteriaArray, profile, originalToSanitizedMap, rules = this.defaultMatchingRules) {
    let totalScore = 0;
    let maxPossibleScore = 0;

    console.log('[Score] Calculating granular score for profile ID:', profile.id); // Assuming profile has an ID
    // console.log('[Score] Profile data (sanitized keys):', profile);
    // console.log('[Score] Search Criteria:', searchCriteriaArray);
    // console.log('[Score] Weights:', this.weights);
    // console.log('[Score] Rules:', rules);

    // Iterate through each criterion provided in the search
    searchCriteriaArray.forEach(criterion => {
      const attribute = criterion.attribute;
      const criterionValue = criterion.value;
      // Operator might be used in future enhancements (e.g., different scoring for '>' vs '=')
      // const operator = criterion.operator;

      // Check if the attribute exists in the profile's metadata map and rules
      if (originalToSanitizedMap.hasOwnProperty(attribute)) {
        const sanitizedAttributeName = originalToSanitizedMap[attribute];
        const profileValue = profile[sanitizedAttributeName];
        const rule = rules[attribute] || { type: 'exact' }; // Default to exact match if no rule
        const weight = this.weights[attribute] || 1; // Get weight or default to 1

        let criterionMatchScore = 0;
        let maxCriterionScore = 0;

        // Determine match type and calculate score
        switch (rule.type) {
          case 'exact':
            criterionMatchScore = this.exactMatch(profileValue, criterionValue);
            maxCriterionScore = this.config.exactMatchWeight;
            break;
          case 'range':
            // Ensure tolerance is provided in the rule, default if necessary
            const tolerance = rule.tolerance || 0;
            criterionMatchScore = this.rangeMatch(profileValue, criterionValue, tolerance);
            maxCriterionScore = this.config.rangeMatchWeight;
            break;
          case 'partial':
            criterionMatchScore = this.partialTextMatch(profileValue, criterionValue);
            maxCriterionScore = this.config.partialMatchWeight;
            break;
          case 'optional': // Assuming optionalMatch is still relevant for some use case
            criterionMatchScore = this.optionalMatch(profileValue, criterionValue);
            maxCriterionScore = this.config.optionalMatchWeight;
            break;
          default:
            console.warn(`[Score] Unknown match type "${rule.type}" for attribute "${attribute}". Defaulting to exact match.`);
            criterionMatchScore = this.exactMatch(profileValue, criterionValue);
            maxCriterionScore = this.config.exactMatchWeight;
        }

        // Apply weight to the scores
        const weightedScore = criterionMatchScore * weight;
        const weightedMaxScore = maxCriterionScore * weight;

        totalScore += weightedScore;
        maxPossibleScore += weightedMaxScore; // Add this criterion's max possible weighted score

        console.log(`[Score] Attribute: "${attribute}", Type: ${rule.type}, Weight: ${weight}, ProfileVal: "${profileValue}", CriterionVal: "${criterionValue}", Match: ${criterionMatchScore.toFixed(2)}, WeightedScore: ${weightedScore.toFixed(2)}, MaxPossible: ${weightedMaxScore.toFixed(2)}`);

      } else {
        console.warn(`[Score] Attribute "${attribute}" from criteria not found in dataset metadata map. Skipping criterion.`);
      }
    });

    // Handle cases where no criteria were applicable or max score is zero
    if (maxPossibleScore === 0) {
        if (searchCriteriaArray.length > 0) {
            console.warn("[Score] No applicable criteria found or max possible score is zero. Returning 0.");
        } else {
            console.log("[Score] No search criteria provided. Score is 0.");
        }
        return 0;
    }

    const finalScore = (totalScore / maxPossibleScore) * 100;
    console.log(`[Score] Final Score: ${totalScore.toFixed(2)} / ${maxPossibleScore.toFixed(2)} = ${finalScore.toFixed(2)}%`);
    // Ensure score is within 0-100 range (might happen with unusual weights/configs)
    return Math.max(0, Math.min(100, finalScore));
  }
}

module.exports = MatchingEngine;
