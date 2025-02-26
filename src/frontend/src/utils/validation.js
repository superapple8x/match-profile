// File: src/utils/validation.js
export const validateAttribute = (input) => {
  const regex = /^[a-zA-Z0-9_]+:/;
  return regex.test(input) ? null : 'Invalid attribute format';
};

export const validateValue = (input) => {
  return input.length > 2 ? null : 'Value too short';
};
