export const updateDraftCriteria = (text) => ({
  type: 'SEARCH/UPDATE_DRAFT',
  payload: text
});

export const commitCriteria = (criteria) => ({
  type: 'SEARCH/COMMIT_CRITERIA',
  payload: criteria
});

export const removeCriteria = (id) => ({
  type: 'SEARCH/REMOVE_CRITERIA',
  payload: id
});

export const updateCriteriaWeight = (id, weight) => ({
  type: 'SEARCH/UPDATE_WEIGHT',
  payload: { id, weight }
});

export const showWeightModal = (id) => ({
  type: 'SEARCH/SHOW_WEIGHT_MODAL',
  payload: id
});

export const hideWeightModal = () => ({
  type: 'SEARCH/HIDE_WEIGHT_MODAL'
});
