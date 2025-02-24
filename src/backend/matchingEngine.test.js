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
});