// File: src/frontend/src/store/searchReducer.js
export const searchReducer = (state, action) => {
  switch(action.type) {
    case 'INPUT_CHANGE':
      return { ...state, input: action.payload };
    case 'SET_ERRORS':
      return { ...state, errors: action.payload };
    case 'ADD_CRITERION':
      return {
        ...state,
        criteria: [...state.criteria, action.payload],
        input: ''
      };
    case 'REMOVE_CRITERION':
      return {
        ...state,
        criteria: state.criteria.filter((_, i) => i !== action.payload)
      };
    case 'UPDATE_WEIGHT':
      return {
        ...state,
        weights: {
          ...state.weights,
          [action.payload.criterion]: action.payload.weight
        }
      };
    case 'TOGGLE_WEIGHT_MODAL':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          showWeightModal: !state.uiState.showWeightModal,
          activeCriterion: action.payload
        }
      };
    default:
      return state;
  }
};
