import React from 'react';
import './MatchBreakdown.css';

const MatchBreakdown = ({ match }) => {
  return (
    <div className="match-breakdown">
      <h3>Match Breakdown - Profile #{match.id}</h3>
      <div className="overall-match">
        Overall Match: {match.matchPercentage.toFixed(2)}%
      </div>
      <div className="attribute-breakdown">
        <h4>Attribute Breakdown:</h4>
        {Object.keys(match).map((key) => {
          if (key !== 'id' && key !== 'matchPercentage') {
            return (
              <div key={key} className="attribute-item">
                <div className="attribute-name">{key}</div>
                <div className="attribute-values">
                  <div>Search: {match[key]}</div>
                  <div>Profile: {match[key]}</div>
                </div>
                <div className="attribute-rule">
                  Rule: Exact
                </div>
                <div className="attribute-weight">
                  Weight: 5
                </div>
                <div className="attribute-score">
                  Score: 100%
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default MatchBreakdown;
