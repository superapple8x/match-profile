import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import SearchInput from './SearchInput';
import SuggestionsList from './SuggestionsList';
import CriteriaTags from './CriteriaTags';
import WeightAdjustmentLauncher from './WeightAdjustmentLauncher';
import { updateDraftCriteria, commitCriteria } from '../../store/searchActions';

const SearchBar = () => {
  const dispatch = useDispatch();
  const { draft, activeCriteria, suggestions } = useSelector(state => state.search);

  const handleInputChange = (text) => {
    dispatch(updateDraftCriteria(text));
  };

  const handleCriteriaCommit = (criteria) => {
    dispatch(commitCriteria(criteria));
  };

  return (
    <div className="search-bar">
      <div className="criteria-container">
        <CriteriaTags criteria={activeCriteria} />
        <SearchInput
          value={draft}
          onChange={handleInputChange}
          onCommit={handleCriteriaCommit}
        />
      </div>
      <SuggestionsList suggestions={suggestions} />
      <WeightAdjustmentLauncher />
    </div>
  );
};

export default SearchBar;
