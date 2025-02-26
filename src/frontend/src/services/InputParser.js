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
  if (!attributeRegistry.has(attribute)) {
    throw new Error(`Invalid attribute: ${attribute}`);
  }

  const validValues = attributeRegistry.get(attribute);
  if (!validValues.includes(value)) {
    throw new Error(`Invalid value for ${attribute}: ${value}`);
  }

  return true;
};

export const formatCriteria = (attribute, value) => {
  return `${attribute}:${value}`;
};
