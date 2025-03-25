export const parseInput = (text) => {
  const [left, right] = text.split(':').map(s => s.trim());
  
  if (!right) {
    return {
      stage: 'ATTRIBUTE_SELECTION',
      attribute: null,
      partialValue: left
    };
  }

  return {
    stage: 'VALUE_SELECTION',
    attribute: left,
    partialValue: right
  };
};

export const validateCriteria = (attribute, value, attributeRegistry) => {
  const isValidAttribute = attributeRegistry.has(attribute);
  const isValidValue = isValidAttribute && attributeRegistry.get(attribute).includes(value);
  
  return {
    isValid: isValidAttribute && isValidValue,
    attributeError: isValidAttribute ? null : `Invalid attribute: ${attribute}`,
    valueError: isValidValue ? null : `Invalid value for ${attribute}: ${value}`
  };
};

export const formatCriteria = (attribute, value) => {
  return `${attribute}:${value}`;
};
