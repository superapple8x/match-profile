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

    required_cols = ['Location', 'Addiction Level', 'Self Control', 'Satisfaction']
    for col in required_cols:
        if col not in df.columns:
            analysis_results['error'] = f"Error: Column '{col}' not found."
            print(f"Error: Column '{col}' not found.")
            raise Exception(f"Column '{col}' not found.")

    df['Addiction_Level_numeric'] = pd.to_numeric(df['Addiction Level'], errors='coerce')
    df['Self_Control_numeric'] = pd.to_numeric(df['Self Control'], errors='coerce')
    df['Satisfaction_numeric'] = pd.to_numeric(df['Satisfaction'], errors='coerce')

    if df['Addiction_Level_numeric'].isnull().all() or df['Self_Control_numeric'].isnull().all() or df['Satisfaction_numeric'].isnull().all():
        analysis_results['warning'] = "Warning: One or more health-related columns could not be treated as numeric."
        print("Warning: One or more health-related columns could not be treated as numeric.")
    else:
        df['Health_Score'] = (df['Self_Control_numeric'] + df['Satisfaction_numeric'] - df['Addiction_Level_numeric']) / 3
        healthiest_by_country = df.loc[df.groupby('Location')['Health_Score'].idxmax()]
        healthiest_by_country = healthiest_by_country[['Location', 'UserID', 'Age', 'Gender', 'Health_Score']]
        analysis_results['healthiest_by_country'] = healthiest_by_country.to_dict('records')

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))