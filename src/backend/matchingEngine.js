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
      email: { type: 'exact' }
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

  calculateMatchScore(searchCriteria, profile, matchingRules = this.defaultMatchingRules) {
    let totalScore = 0;
    let maxPossibleScore = 0;
    console.log('Calculating match score for profile:', profile);
    console.log('Using search criteria:', searchCriteria);
    console.log('Using matching rules:', matchingRules);

    for (const attribute in searchCriteria) {
      if (matchingRules.hasOwnProperty(attribute)) {
        const rule = matchingRules[attribute];
        const searchValue = searchCriteria[attribute];
        const profileValue = profile[attribute] || '';

        console.log(`Evaluating attribute: ${attribute}`);
        console.log(`Search value: "${searchValue}" (${typeof searchValue})`);
        console.log(`Profile value: "${profileValue}" (${typeof profileValue})`);

        const weight = this.weights[attribute] || 1;
        let score = 0;

        switch (rule.type) {
          case 'exact':
            score = this.exactMatch(searchValue, profileValue);
            break;
          case 'range':
            score = this.rangeMatch(searchValue, profileValue, rule.tolerance);
            break;
          case 'partial':
            score = this.partialTextMatch(searchValue, profileValue);
            break;
          case 'optional':
            score = this.optionalMatch(searchValue, profileValue);
            break;
          default:
            score = 0; // Default score for unknown rule types
        }

        console.log(`Score for ${attribute}: ${score} (weight: ${weight})`);
        totalScore += score * weight;
        maxPossibleScore += this.config.exactMatchWeight * weight;
      } else {
        console.log(`Attribute ${attribute} not found in matching rules, assigning a default score of 0.`);
      }
    }

    const finalScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    console.log(`Final match score: ${finalScore}%`);
    return finalScore;
  }
}

module.exports = MatchingEngine;
