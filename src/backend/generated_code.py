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

    required_cols = ['Location', 'ProductivityLoss']
    missing_cols = [col for col in required_cols if col not in df.columns]
    
    if missing_cols:
        analysis_results['error'] = f"Error: Columns {missing_cols} not found in dataset."
        print(f"Error: Columns {missing_cols} not found in dataset.")
    else:
        df['ProductivityLoss_numeric'] = pd.to_numeric(df['ProductivityLoss'], errors='coerce')
        
        if not df['ProductivityLoss_numeric'].isnull().all():
            max_loss_idx = df['ProductivityLoss_numeric'].idxmax()
            max_loss_country = df.loc[max_loss_idx, 'Location']
            max_loss_value = df.loc[max_loss_idx, 'ProductivityLoss_numeric']
            
            analysis_results['country_with_highest_productivity_loss'] = max_loss_country
            analysis_results['max_productivity_loss_value'] = max_loss_value
        else:
            analysis_results['warning'] = "Warning: Column 'ProductivityLoss' could not be treated as numeric."
            print("Warning: Column 'ProductivityLoss' could not be treated as numeric.")

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))