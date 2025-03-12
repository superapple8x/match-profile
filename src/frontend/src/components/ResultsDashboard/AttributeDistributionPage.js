import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AttributeDistributionChart from './AttributeDistributionChart';
import './AttributeDistributionChart.css';

function AttributeDistributionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const matchResults = location.state?.matchResults || [];

  return (
    <div className="chart-page">
      <h1>Attribute Distribution</h1>
      <button 
        className="back-button"
        onClick={() => navigate(-1)}
      >
        Back to Results
      </button>
      <AttributeDistributionChart matchResults={matchResults} />
    </div>
  );
}

export default AttributeDistributionPage;