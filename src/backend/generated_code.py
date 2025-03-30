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

    required_cols = ['Location', 'Addiction Level']
    missing_cols = [col for col in required_cols if col not in df.columns]
    
    if missing_cols:
        analysis_results['error'] = f"Error: Columns {missing_cols} not found in dataset."
        print(f"Error: Columns {missing_cols} not found in dataset.")
    else:
        df['Addiction Level_numeric'] = pd.to_numeric(df['Addiction Level'], errors='coerce')
        
        if not df['Addiction Level_numeric'].isnull().all():
            max_addiction = df['Addiction Level_numeric'].max()
            most_addicted_location = df.loc[df['Addiction Level_numeric'].idxmax(), 'Location']
            
            analysis_results['most_addicted_country'] = most_addicted_location
            analysis_results['max_addiction_level'] = max_addiction
            
            plt.figure(figsize=(10, 6))
            sns.barplot(x='Location', y='Addiction Level_numeric', data=df.groupby('Location')['Addiction Level_numeric'].mean().reset_index().sort_values('Addiction Level_numeric', ascending=False).head(10))
            plt.title('Top 10 Countries by Average Addiction Level')
            plt.xticks(rotation=45)
            plt.tight_layout()
            plt.savefig('/output/plot_1.png')
            plt.close()
        else:
            analysis_results['warning'] = "Warning: 'Addiction Level' column could not be treated as numeric."
            print("Warning: 'Addiction Level' column could not be treated as numeric.")

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))