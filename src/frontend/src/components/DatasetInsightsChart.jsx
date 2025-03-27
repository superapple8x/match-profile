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
    return { recordCount: 0, attributeCount: 0, categoricalAnalyses: [], numericalAnalyses: [], missingValueCounts: {} };
  }

  const recordCount = data.length;
  const attributes = Object.keys(data[0]);
  const attributeCount = attributes.length;
  const categoricalAnalyses = [];
  const numericalAnalyses = [];
  const missingValueCounts = {};
  const NUMERIC_THRESHOLD = 0.8; // Require 80% of non-empty values to be parsable as numbers

  console.log(`DatasetInsightsChart: Starting analysis for ${recordCount} records, ${attributeCount} attributes.`);

  for (const attr of attributes) {
    // console.log(`DatasetInsightsChart: Checking attribute '${attr}'...`);

    const uniqueValues = new Set();
    let isPotentialCategorical = true;
    let firstValueType = null;
    let missingCount = 0;
    const numericalValues = [];
    let parsableNumericCount = 0;
    let nonMissingCount = 0;

    // --- First Pass: Check types, count missing/numeric, collect values ---
    for (const row of data) {
      let value = row[attr];
      const isEmpty = value === null || value === undefined || value === "";

      if (isEmpty) {
        missingCount++;
      } else {
        nonMissingCount++;
        // Attempt numeric conversion
        const numValue = parseFloat(value); // Try parsing as float
        if (!isNaN(numValue)) {
            numericalValues.push(numValue); // Store the parsed number
            parsableNumericCount++;
        }

        // Check for potential categorical
        if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') { // Allow numbers for categorical too initially
          isPotentialCategorical = false;
        }
        if (firstValueType === null) firstValueType = typeof value; // Note type of first non-empty
      }

      const valueStr = String(value); // Use string for uniqueness check
      uniqueValues.add(valueStr);
    } // End row loop

    missingValueCounts[attr] = missingCount;

    // --- Determine if Numerical ---
    const numericRatio = nonMissingCount > 0 ? parsableNumericCount / nonMissingCount : 0;
    const isNumerical = numericRatio >= NUMERIC_THRESHOLD && numericalValues.length > 0 && !attr.toLowerCase().includes('id'); // Check ratio and ensure not an ID
    // console.log(`DatasetInsightsChart: Attribute '${attr}' - Numeric Ratio: ${numericRatio.toFixed(2)}, Is Numerical: ${isNumerical}`);


    // --- Process Numerical (If deemed numerical) ---
    if (isNumerical) {
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
        if (binWidth === 0 && max !== undefined) { // Check max exists
             binLabels.push(`[${min.toFixed(1)}]`);
             bins[0] = numericalValues.length;
        } else if (max !== undefined) { // Proceed only if max is valid
            for (let i = 0; i < numBins; i++) {
                const binMin = min + i * binWidth;
                // Make the last bin inclusive of the max value
                const binMax = (i === numBins - 1) ? max : (min + (i + 1) * binWidth);
                const label = `[${binMin.toFixed(1)}, ${binMax.toFixed(1)}${i === numBins - 1 ? ']' : ')'}`; // Adjust label for last bin
                binLabels.push(label);

                for (const val of numericalValues) {
                    // Check if value falls into the bin, ensuring last bin includes max
                    if ((val >= binMin && val < binMax) || (i === numBins - 1 && val === max)) {
                        bins[i]++;
                    }
                }
            }
        } else {
             console.log(`DatasetInsightsChart: Skipping histogram for '${attr}' due to invalid min/max.`);
        }


         const histogramData = binLabels.length > 0 ? bins.map((count, i) => ({ // Check if binLabels were generated
            name: binLabels[i] || '', // Ensure name is always a string
            count: count,
         })).filter(bin => bin.count > 0 || bins.length === 1) // Filter empty bins unless only one bin
         : []; // Default to empty if no labels

        // Push analysis for this numerical column
        numericalAnalyses.push({
            attributeName: attr,
            stats: {
                min: isNaN(min) ? null : min, // Handle potential NaN
                max: isNaN(max) ? null : max,
                mean: isNaN(mean) ? null : mean,
                median: isNaN(median) ? null : median
             },
            histogramData: histogramData,
        });
    }

    // --- Process Categorical ---
    // Refined Categorical Check: Exclude if it was determined to be numerical, limit unique values
    const uniqueValueCount = uniqueValues.size - (uniqueValues.has("null") || uniqueValues.has("undefined") || uniqueValues.has("") ? 1 : 0); // Effective unique count
    if (!isNumerical && uniqueValueCount >= 2 && uniqueValueCount <= 15) {
      isPotentialCategorical = true; // Re-affirm if not numerical and fits criteria
      // console.log(`DatasetInsightsChart: Attribute '${attr}' is suitable (Categorical). Unique values: ${uniqueValueCount}`);
    } else {
      isPotentialCategorical = false;
      // console.log(`DatasetInsightsChart: Attribute '${attr}' disqualified (Categorical). Reason: ${isNumerical ? 'Is Numerical' : uniqueValueCount < 2 ? 'Too few unique' : 'Too many unique'}. Unique count: ${uniqueValueCount}`);
    }

    if (isPotentialCategorical) {
      const frequency = {};
      for (const row of data) {
         const value = row[attr];
         if (value !== null && value !== undefined && value !== "") {
            const valueStr = String(value);
            frequency[valueStr] = (frequency[valueStr] || 0) + 1;
         }
      }
      const chartData = Object.entries(frequency)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      categoricalAnalyses.push({ attributeName: attr, chartData: chartData });
    }

  } // End attribute loop

  console.log(`DatasetInsightsChart: Finished analysis. Found ${categoricalAnalyses.length} suitable categorical attributes. Found ${numericalAnalyses.length} suitable numerical attributes.`);

  return { recordCount, attributeCount, categoricalAnalyses, numericalAnalyses, missingValueCounts };
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
                        {analysis.stats.min !== null && <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded">
                            <div className="font-medium text-gray-500 dark:text-gray-300">Min</div>
                            <div className="text-gray-800 dark:text-gray-100">{analysis.stats.min.toFixed(2)}</div>
                        </div>}
                        {analysis.stats.max !== null && <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded">
                            <div className="font-medium text-gray-500 dark:text-gray-300">Max</div>
                            <div className="text-gray-800 dark:text-gray-100">{analysis.stats.max.toFixed(2)}</div>
                        </div>}
                        {analysis.stats.mean !== null && <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded">
                            <div className="font-medium text-gray-500 dark:text-gray-300">Mean</div>
                            <div className="text-gray-800 dark:text-gray-100">{analysis.stats.mean.toFixed(2)}</div>
                        </div>}
                        {analysis.stats.median !== null && <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded">
                            <div className="font-medium text-gray-500 dark:text-gray-300">Median</div>
                            <div className="text-gray-800 dark:text-gray-100">{analysis.stats.median.toFixed(2)}</div>
                        </div>}
                  </div>
                  {/* Histogram */}
                   {analysis.histogramData.length > 0 ? (
                     <>
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
                    </>
                   ) : (
                     <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center">Could not generate histogram (e.g., single value or parsing issue).</p>
                   )}
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