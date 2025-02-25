import React from 'react';

const MatchBreakdown = ({ match }) => {
  return (
    <div>
      <h3>Match Breakdown - Profile #{match.id}</h3>
      <div>Overall Match: {match.matchPercentage}</div>
      <h4>Attribute Breakdown:</h4>
      <ul>
        <li>
          <div>Age</div>
          <div>Search: {match.searchAge} | Profile: {match.profileAge}</div>
          <div>Rule: {match.ageRule} | Weight: {match.ageWeight}</div>
          <div>Score: {match.ageScore}</div>
        </li>
        <li>
          <div>Gender</div>
          <div>Search: {match.searchGender} | Profile: {match.profileGender}</div>
          <div>Rule: {match.genderRule} | Weight: {match.genderWeight}</div>
          <div>Score: {match.genderScore}</div>
        </li>
        <li>
          <div>Location</div>
          <div>Search: {match.searchLocation} | Profile: {match.profileLocation}</div>
          <div>Rule: {match.locationRule} | Weight: {match.locationWeight}</div>
          <div>Score: {match.locationScore}</div>
        </li>
      </ul>
    </div>
  );
};

export default MatchBreakdown;