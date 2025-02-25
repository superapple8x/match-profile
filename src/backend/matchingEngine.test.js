const MatchingEngine = require('./matchingEngine');

describe('Matching Engine', () => {
  let engine;

  beforeEach(() => {
    engine = new MatchingEngine();
    engine.setWeights({
      age: 1.5,
      location: 1.0,
      skills: 0.8
    });
  });

  test('exact match calculation', () => {
    const profileA = { age: "30", location: "New York" };
    const profileB = { age: "30", location: "New York" };
    const rules = {
      age: { type: 'exact' },
      location: { type: 'exact' }
    };
    
    expect(engine.calculateMatchScore(profileA, profileB, rules)).toBe(100);
  });

  test('range match with tolerance', () => {
    const profileA = { age: "30" };
    const profileB = { age: "32" };
    const rules = {
      age: { type: 'range', tolerance: 3 }
    };
    
    expect(engine.calculateMatchScore(profileA, profileB, rules)).toBeCloseTo(80);
  });

  test('partial text match', () => {
    const profileA = { skills: "JavaScript, Python" };
    const profileB = { skills: "python" };
    const rules = {
      skills: { type: 'partial' }
    };
    
    expect(engine.calculateMatchScore(profileA, profileB, rules)).toBe(60);
  });

  test('optional match scoring', () => {
    const profileA = { certification: "AWS" };
    const profileB = { certification: "Azure" };
    const rules = {
      certification: { type: 'optional' }
    };
    
    expect(engine.calculateMatchScore(profileA, profileB, rules)).toBe(40);
  });

  test('partial attribute matching with search criteria', () => {
    const profileA = {
      Age: "28",
      Gender: "Female",
      Location: "China",
      CurrentActivity: "Nothing",
      Platform: "TikTok",
      Income: "50000",
      Profession: "Engineer"
    };

    const searchCriteria = {
      Age: "28",
      Location: "China",
      CurrentActivity: "Nothing",
      Platform: "TikTok",
      Gender: "Female"
    };

    const rules = {
      Age: { type: 'range', tolerance: 5 },
      Gender: { type: 'exact' },
      Location: { type: 'partial' },
      CurrentActivity: { type: 'exact' },
      Platform: { type: 'exact' }
    };

    const score = engine.calculateMatchScore(searchCriteria, profileA, rules);

    // Verify that only the specified attributes are considered
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100); // Shouldn't be a perfect match
  });

  test('partial attribute matching with missing attributes in profile', () => {
    const profileA = {
      Age: "28",
      Location: "China",
      CurrentActivity: "Nothing",
    };

    const searchCriteria = {
      Age: "28",
      Location: "China",
      CurrentActivity: "Nothing",
      Platform: "TikTok",
      Gender: "Female"
    };

    const rules = {
      Age: { type: 'range', tolerance: 5 },
      Gender: { type: 'exact' },
      Location: { type: 'partial' },
      CurrentActivity: { type: 'exact' },
      Platform: { type: 'exact' }
    };

    const score = engine.calculateMatchScore(searchCriteria, profileA, rules);

    // Verify that the missing attributes are handled correctly
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100); // Shouldn't be a perfect match
  });
});