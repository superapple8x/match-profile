import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json
import math

def convert_numpy_types(obj):
    if isinstance(obj, (np.integer, np.int64)): return int(obj)
    elif isinstance(obj, (np.floating, np.float64, float)) and math.isnan(obj): return None
    elif isinstance(obj, (np.floating, np.float64)): return float(obj)
    elif isinstance(obj, np.ndarray): return obj.tolist()
    elif isinstance(obj, pd.Timestamp): return obj.isoformat()
    elif isinstance(obj, (pd.Series, pd.Index)): return obj.tolist()
    elif isinstance(obj, dict): return {str(k): convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)): return [convert_numpy_types(i) for i in obj]
    elif hasattr(obj, 'isoformat'): return obj.isoformat()
    try: json.dumps(obj); return obj
    except TypeError: return str(obj)

analysis_results = {}

try:
    df = pd.read_csv('/input/data.csv', encoding='utf-8')

    numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
    categorical_cols = df.select_dtypes(include=['object', 'category', 'boolean']).columns.tolist()
    analysis_results['identified_numeric_columns'] = numeric_cols
    analysis_results['identified_categorical_columns'] = categorical_cols

    if 'Location' in df.columns and 'Total Time Spent' in df.columns:
        df['Total Time Spent_numeric'] = pd.to_numeric(df['Total Time Spent'], errors='coerce')
        if not df['Total Time Spent_numeric'].isnull().all():
            top_countries = df.groupby('Location')['Total Time Spent_numeric'].sum().nlargest(5)
            analysis_results['top_5_countries_most_wasted_time'] = top_countries.to_dict()
            
            plt.figure(figsize=(10, 6))
            sns.barplot(x=top_countries.values, y=top_countries.index)
            plt.title('Top 5 Countries with Most Wasted Time')
            plt.xlabel('Total Time Spent')
            plt.ylabel('Country')
            plt.tight_layout()
            plt.savefig('/output/plot_1.png')
            plt.close()
        else:
            analysis_results['error'] = "Column 'Total Time Spent' could not be treated as numeric."
    else:
        analysis_results['error'] = "Required columns 'Location' or 'Total Time Spent' not found in dataset."

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))