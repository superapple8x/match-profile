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

    required_cols = ['Location', 'Watch Reason']
    for col in required_cols:
        if col not in df.columns:
            analysis_results['error'] = f"Error: Column '{col}' not found."
            print(f"Error: Column '{col}' not found.")
            raise Exception(f"Column '{col}' not found.")

    procrastination_df = df[df['Watch Reason'] == 'Procrastination']
    if procrastination_df.empty:
        analysis_results['error'] = "No data found for 'Procrastination' watch reason."
        print("No data found for 'Procrastination' watch reason.")
    else:
        country_counts = procrastination_df['Location'].value_counts()
        most_procrastinating_country = country_counts.idxmax()
        count = country_counts.max()
        
        analysis_results['most_procrastinating_country'] = most_procrastinating_country
        analysis_results['procrastination_count'] = count

        plt.figure(figsize=(10, 6))
        sns.barplot(x=country_counts.index, y=country_counts.values)
        plt.title('Procrastination Count by Country')
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig('/output/plot_1.png')
        plt.close()

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))