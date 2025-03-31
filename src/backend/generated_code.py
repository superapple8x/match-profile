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

    required_col = 'Addiction Level'
    if required_col not in df.columns:
        analysis_results['error'] = "Error: Column '" + required_col + "' not found."
        print("Error: Column '" + required_col + "' not found.")
    else:
        df[f'{required_col}_numeric'] = pd.to_numeric(df[required_col], errors='coerce')

        if not df[f'{required_col}_numeric'].isnull().all():
            top_addicted = df.nlargest(10, f'{required_col}_numeric')
            analysis_results['top_addicted_users'] = top_addicted[['UserID', 'Addiction Level']].to_dict('records')

            plt.figure(figsize=(10, 6))
            sns.barplot(data=top_addicted, x='UserID', y=f'{required_col}_numeric')
            plt.title('Top 10 Most Addicted Users')
            plt.xlabel('User ID')
            plt.ylabel('Addiction Level')
            plt.xticks(rotation=45)
            plt.tight_layout()
            plt.savefig('/output/plot_1.png')
            plt.close()
        else:
            analysis_results['warning'] = "Warning: Column '" + required_col + "' could not be treated as numeric."
            print("Warning: Column '" + required_col + "' could not be treated as numeric.")

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))