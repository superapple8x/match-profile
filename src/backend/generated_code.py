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

    required_col = 'Location'
    if required_col not in df.columns:
        analysis_results['error'] = "Error: Column '" + required_col + "' not found."
        print("Error: Column '" + required_col + "' not found.")
    else:
        health_metrics = ['ProductivityLoss', 'Satisfaction', 'Self Control', 'Addiction Level']
        numeric_cols = []
        
        for metric in health_metrics:
            if metric not in df.columns:
                print(f"Error: Column '{metric}' not found in dataset.")
                continue
            df[f'{metric}_numeric'] = pd.to_numeric(df[metric], errors='coerce')
            if not df[f'{metric}_numeric'].isnull().all():
                numeric_cols.append(f'{metric}_numeric')
            else:
                print(f"Warning: Column '{metric}' could not be treated as numeric.")
        
        if numeric_cols:
            df['health_score'] = df[numeric_cols].mean(axis=1)
            top_countries = df.groupby('Location')['health_score'].mean().sort_values(ascending=True).head(5)
            
            plt.figure(figsize=(10, 6))
            top_countries.plot(kind='barh', color='green')
            plt.title('Top 5 Healthiest Countries by Health Score')
            plt.xlabel('Health Score (Lower is Better)')
            plt.ylabel('Country')
            plt.tight_layout()
            plt.savefig('/output/plot_1.png')
            plt.close()
            
            analysis_results['top_5_healthiest_countries'] = top_countries.to_dict()
        else:
            analysis_results['error'] = "No valid health metrics could be processed."

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))