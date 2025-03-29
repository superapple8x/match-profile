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

    required_col = 'Income'
    location_col = 'Location'

    if required_col not in df.columns:
        analysis_results['error'] = f"Error: Column '{required_col}' not found."
        print(f"Error: Column '{required_col}' not found.")
    elif location_col not in df.columns:
        analysis_results['error'] = f"Error: Column '{location_col}' not found."
        print(f"Error: Column '{location_col}' not found.")
    else:
        df[f'{required_col}_numeric'] = pd.to_numeric(df[required_col], errors='coerce')

        if not df[f'{required_col}_numeric'].isnull().all():
            max_income_idx = df[f'{required_col}_numeric'].idxmax()
            max_income_country = df.loc[max_income_idx, location_col]
            max_income_value = df.loc[max_income_idx, f'{required_col}_numeric']

            analysis_results['highest_salary_country'] = max_income_country
            analysis_results['highest_salary_value'] = max_income_value
        else:
            analysis_results['warning'] = f"Warning: Column '{required_col}' could not be treated as numeric."
            print(f"Warning: Column '{required_col}' could not be treated as numeric.")

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))