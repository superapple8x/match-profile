import React from 'react';
import { Chart } from 'chart.js/auto';

const FrequencyHeatmap = ({ data, labels }) => {
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    const chartCanvas = chartRef.current.getContext('2d');

    new Chart(chartCanvas, {
      type: 'heatmap',
      data: {
        datasets: [{
          data: data,
        }]
      },
      options: {
        scales: {
          x: {
            type: 'category',
            labels: labels.x,
          },
          y: {
            type: 'category',
            labels: labels.y,
          }
        }
      }
    });
  }, [data, labels]);

  return (
    <canvas ref={chartRef} />
  );
};

export default FrequencyHeatmap;
