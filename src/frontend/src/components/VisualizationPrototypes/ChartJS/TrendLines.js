import React from 'react';
import { Chart } from 'chart.js/auto';

const TrendLines = ({ data, labels }) => {
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    const chartCanvas = chartRef.current.getContext('2d');

    new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Trend',
          data: data,
          borderColor: 'blue',
          borderWidth: 2,
          fill: false,
        }]
      },
      options: {
        scales: {
          x: {
            type: 'category',
            labels: labels,
          },
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }, [data, labels]);

  return (
    <canvas ref={chartRef} />
  );
};

export default TrendLines;
