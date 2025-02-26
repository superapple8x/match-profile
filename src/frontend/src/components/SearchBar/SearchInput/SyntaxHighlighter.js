import React from 'react';
import PropTypes from 'prop-types';

const SyntaxHighlighter = ({ text, stage }) => {
  const [beforeColon, afterColon] = text.split(':');
  
  const getClassName = (part) => {
    if (part === 'before' && stage === 'ATTRIBUTE_SELECTION') {
      return 'highlight-attribute';
    }
    if (part === 'after' && stage === 'VALUE_SELECTION') {
      return 'highlight-value';
    }
    return '';
  };

  return (
    <div className="syntax-highlighter">
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
  stage: PropTypes.oneOf(['ATTRIBUTE_SELECTION', 'VALUE_SELECTION']).isRequired
};

export default SyntaxHighlighter;
