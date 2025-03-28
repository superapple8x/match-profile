import React from 'react';
import PropTypes from 'prop-types';
import './SyntaxHighlighter.css';

const SyntaxHighlighter = ({ text, stage, darkMode = false }) => {
  const [beforeColon, afterColon] = text.split(':');
  
  const getClassName = (part) => {
    if (part === 'before' && stage === 'ATTRIBUTE_SELECTION') {
      return `highlight-attribute ${darkMode ? 'dark' : ''}`;
    }
    if (part === 'after' && stage === 'VALUE_SELECTION') {
      return `highlight-value ${darkMode ? 'dark' : ''}`;
    }
    return '';
  };

  return (
    <div className={`syntax-highlighter ${darkMode ? 'dark' : ''}`}>
      {beforeColon && (
        <span className={getClassName('before')}>
          {beforeColon}
        </span>
      )}
      {text.includes(':') && ':'}
      {afterColon && (
        <span className={getClassName('after')}>
          {afterColon}
        </span>
      )}
    </div>
  );
};

SyntaxHighlighter.propTypes = {
  text: PropTypes.string.isRequired,
  stage: PropTypes.oneOf(['ATTRIBUTE_SELECTION', 'VALUE_SELECTION']).isRequired,
  darkMode: PropTypes.bool
};

export default SyntaxHighlighter;
