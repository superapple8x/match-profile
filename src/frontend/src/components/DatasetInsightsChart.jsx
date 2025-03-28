import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// --- Helper Functions ---
function calculateMean(arr) {
  if (!arr || arr.length === 0) return NaN;
  const sum = arr.reduce((acc, val) => acc + val, 0);
  return sum / arr.length;
}

function calculateMedian(arr) {
  if (!arr || arr.length === 0) return NaN;
  const sortedArr = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sortedArr.length / 2);
  return sortedArr.length % 2 !== 0
    ? sortedArr[mid]
    : (sortedArr[mid - 1] + sortedArr[mid]) / 2;
}
// --- End Helper Functions ---


// Helper function to analyze data for categorical, numerical insights, and missing values
const analyzeData = (data) => {
  if (!data || data.length === 0) {
    return { recordCount: 0, attributeCount: 0, categoricalAnalyses: [], numericalAnalyses: [], missingValueCounts: {} }; // Initialize numericalAnalyses as array
  }

  // --- DIAGNOSTIC LOG ---
  // if (data.length > 0) {
  //   console.log("DatasetInsightsChart - Data types in first row:", Object.entries(data[0]).map(([key, value]) => `${key}: ${typeof value}`).join(', '));
  // }
  // --- END DIAGNOSTIC LOG ---

  const recordCount = data.length;
  const attributes = Object.keys(data[0]);
  const attributeCount = attributes.length;
  const categoricalAnalyses = [];
  const numericalAnalyses = []; // Store analysis for ALL suitable numerical columns
  const missingValueCounts = {};

  // console.log(`DatasetInsightsChart: Starting analysis for ${recordCount} records, ${attributeCount} attributes.`);

  for (const attr of attributes) {
    // console.log(`DatasetInsightsChart: Checking attribute '${attr}'...`);

    const uniqueValues = new Set();
    let isPotentialCategorical = true;
    let isPotentialNumerical = true;
    let firstValueType = null;
    let missingCount = 0;
    const numericalValues = [];

    // --- First Pass: Check types, count missing, collect values ---
    for (const row of data) {
      const value = row[attr];
      const valueType = typeof value;
      if (firstValueType === null && value !== null && value !== undefined && value !== "") firstValueType = valueType;

      if (value === null || value === undefined || value === "") {
        missingCount++;
      }

      if (valueType !== 'string' && valueType !== 'boolean' && value !== null && value !== undefined && value !== "") {
        isPotentialCategorical = false;
      }

      if (valueType !== 'number' && value !== null && value !== undefined && value !== "") {
         isPotentialNumerical = false;
      } else if (valueType === 'number') {
         numericalValues.push(value);
      }

      const valueStr = String(value);
      uniqueValues.add(valueStr);
    } // End row loop

    missingValueCounts[attr] = missingCount;

    // --- Process Categorical ---
    const uniqueValueCount = uniqueValues.size;
    if (missingCount === recordCount && uniqueValueCount <= 1) {
        isPotentialCategorical = false;
    } else if (uniqueValueCount > 15) {
        isPotentialCategorical = false;
    } else if (uniqueValueCount <= 1) {
         isPotentialCategorical = false;
    }

    if (isPotentialCategorical) {
      const frequency = {};
      for (const row of data) {
         if (row[attr] !== null && row[attr] !== undefined && row[attr] !== "") {
            const valueStr = String(row[attr]);
            frequency[valueStr] = (frequency[valueStr] || 0) + 1;
         }
      }
      const chartData = Object.entries(frequency)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      categoricalAnalyses.push({ attributeName: attr, chartData: chartData });
    }

    // --- Process Numerical (For ALL suitable columns) ---
    // Ensure it's primarily numeric and not an ID field
    if (isPotentialNumerical && numericalValues.length > 0 && !attr.toLowerCase().includes('id')) { // Removed numericalAnalysis === null check
        // console.log(`DatasetInsightsChart: Attribute '${attr}' is suitable (Numerical). Calculating stats and histogram.`);

        const min = Math.min(...numericalValues);
        const max = Math.max(...numericalValues);
        const mean = calculateMean(numericalValues);
        const median = calculateMedian(numericalValues);

        const numBins = 10;
        const binWidth = (max - min) / numBins;
        const bins = Array(numBins).fill(0);
        const binLabels = [];

        // Handle case where min === max (all values are the same)
        if (binWidth === 0) {
             binLabels.push(`[${min.toFixed(1)}]`);
             bins[0] = numericalValues.length;
        } else {
            for (let i = 0; i < numBins; i++) {
                const binMin = min + i * binWidth;
                const binMax = min + (i + 1) * binWidth;
                const label = `[${binMin.toFixed(1)}, ${ (i === numBins - 1) ? max.toFixed(1) + ']' : binMax.toFixed(1) + ')'}`;
                binLabels.push(label);

                for (const val of numericalValues) {
                    if ((val >= binMin && val < binMax) || (i === numBins - 1 && val === max)) {
                        bins[i]++;
                    }
                }
            }
        }

         const histogramData = bins.map((count, i) => ({
            name: binLabels[i] || '', // Ensure name is always a string
            count: count,
         })).filter(bin => bin.count > 0 || bins.length === 1); // Filter out empty bins unless it's the only bin

        // Push analysis for this numerical column
        numericalAnalyses.push({
            attributeName: attr,
            stats: { min, max, mean, median },
            histogramData: histogramData,
        });
    }
    // else if (isPotentialNumerical) { // Log if it was numerical but failed (e.g., ID)
    //      console.log(`DatasetInsightsChart: Attribute '${attr}' disqualified (Numerical). Reason: ${attr.toLowerCase().includes('id') ? 'Is ID field' : 'No valid numerical values found'}.`);
    // }

  } // End attribute loop

  console.log(`DatasetInsightsChart: Finished analysis. Found ${categoricalAnalyses.length} suitable categorical attributes. Found ${numericalAnalyses.length} suitable numerical attributes.`);

  return { recordCount, attributeCount, categoricalAnalyses, numericalAnalyses, missingValueCounts }; // Return numericalAnalyses array
};

// Define tab constants locally as well for conditional rendering
const TABS = {
  MISSING: 'missing',
  NUMERICAL: 'numerical',
  CATEGORICAL: 'categorical',
};

// Modified component to accept activeTab prop
function DatasetInsightsChart({ data, activeTab }) {
  // Use numericalAnalyses (plural)
  const { recordCount, attributeCount, categoricalAnalyses, numericalAnalyses, missingValueCounts } = useMemo(() => analyzeData(data), [data]);

  // Basic data validation
  if (!data || data.length === 0) {
    return <p className="p-4 text-gray-600 dark:text-gray-400">No data available to display insights.</p>;
  }

  // Filter missing counts to show only those > 0
  const significantMissing = Object.entries(missingValueCounts)
                                .filter(([key, value]) => value > 0)
                                .sort(([, countA], [, countB]) => countB - countA);

  return (
    <div className="p-4"> {/* Add padding to the content area */}

      {/* --- Conditionally Render Sections Based on activeTab --- */}

      {/* Missing Values Section */}
      {activeTab === TABS.MISSING && (
        <div>
          {significantMissing.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {significantMissing.map(([key, value]) => (
                <li key={`missing-${key}`}>
                  <span className="font-medium">{key}:</span> {value} ({((value / recordCount) * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No missing values detected.</p>
          )}
        </div>
      )}

      {/* Numerical Analysis Section - Loop through numericalAnalyses */}
      {activeTab === TABS.NUMERICAL && (
        <div className="space-y-8"> {/* Add space between numerical analyses */}
          {numericalAnalyses && numericalAnalyses.length > 0 ? (
             numericalAnalyses.map((analysis) => ( // Loop through each numerical analysis
                <div key={`numerical-${analysis.attributeName}`} className="pb-4 border-b border-gray-200 dark:border-gray-600 last:border-b-0"> {/* Add border between analyses */}
                  {/* Simplified heading to just the attribute name */}
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 text-center">
                    '{analysis.attributeName}'
                  </h3>
                  {/* Stats Display */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-sm text-center">
                        <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded">
                            <div className="font-medium text-gray-500 dark:text-gray-300">Min</div>
                            <div className="text-gray-800 dark:text-gray-100">{analysis.stats.min.toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded">
                            <div className="font-medium text-gray-500 dark:text-gray-300">Max</div>
                            <div className="text-gray-800 dark:text-gray-100">{analysis.stats.max.toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded">
                            <div className="font-medium text-gray-500 dark:text-gray-300">Mean</div>
                            <div className="text-gray-800 dark:text-gray-100">{analysis.stats.mean.toFixed(2)}</div>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded">
                            <div className="font-medium text-gray-500 dark:text-gray-300">Median</div>
                            <div className="text-gray-800 dark:text-gray-100">{analysis.stats.median.toFixed(2)}</div>
                        </div>
                  </div>
                  {/* Histogram */}
                  <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3 text-center">
                    Histogram
                  </h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analysis.histogramData} margin={{ top: 5, right: 5, left: 5, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} className="stroke-gray-300 dark:stroke-gray-600" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={50} interval={0} className="text-xs text-gray-600 dark:text-gray-400" />
                      <YAxis allowDecimals={false} className="text-xs text-gray-600 dark:text-gray-400" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(4px)',
                          border: '1px solid #ccc', borderRadius: '4px', color: '#333'
                        }}
                        cursor={{ fill: 'rgba(200, 200, 200, 0.3)' }}
                      />
                      <Bar dataKey="count" fill="#82ca9d" name="Count" className="fill-green-500 dark:fill-green-600" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             ))
          ) : (
             <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center">No suitable numerical attributes found for analysis.</p>
          )}
        </div>
      )}

      {/* Categorical Charts Section */}
      {activeTab === TABS.CATEGORICAL && (
         <div className="space-y-8">
           {categoricalAnalyses && categoricalAnalyses.length > 0 ? (
             categoricalAnalyses.map((analysis) => (
               <div key={analysis.attributeName}>
                 <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3 text-center">
                   '{analysis.attributeName}'
                 </h4>
                 <ResponsiveContainer width="100%" height={250}>
                   <BarChart
                     data={analysis.chartData}
                     margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                     layout="vertical"
                   >
                     <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} className="stroke-gray-300 dark:stroke-gray-600" />
                     <XAxis type="number" allowDecimals={false} className="text-xs text-gray-600 dark:text-gray-400" />
                     <YAxis type="category" dataKey="name" width={100} className="text-xs text-gray-600 dark:text-gray-400" interval={0} />
                     <Tooltip
                         contentStyle={{
                             backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(4px)',
                             border: '1px solid #ccc', borderRadius: '4px', color: '#333'
                         }}
                         cursor={{ fill: 'rgba(200, 200, 200, 0.3)' }}
                     />
                     <Bar dataKey="count" fill="#8884d8" name="Frequency" className="fill-primary-500 dark:fill-primary-600" />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             ))
           ) : (
             <p className="text-center text-gray-500 dark:text-gray-400 italic">
               No suitable categorical attributes found for quick overview charts.
               <br/>(Looking for STRING or BOOLEAN columns with 2-15 unique values)
             </p>
           )}
         </div>
       )}

    </div>
  );
}

export default DatasetInsightsChart;