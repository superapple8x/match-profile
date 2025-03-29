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

    required_cols = ['Gender', 'Medical Condition']
    missing_cols = [col for col in required_cols if col not in df.columns]
    
    if missing_cols:
        analysis_results['error'] = f"Error: Columns {missing_cols} not found in dataset."
        for col in missing_cols:
            print(f"Error: Column '{col}' not found in dataset.")
    else:
        cancer_patients = df[df['Medical Condition'] == 'Cancer']
        gender_counts = cancer_patients['Gender'].value_counts().to_dict()
        
        analysis_results['gender_counts'] = gender_counts
        analysis_results['most_sufferers'] = max(gender_counts, key=gender_counts.get)

        plt.figure(figsize=(10, 6))
        sns.countplot(data=cancer_patients, x='Gender')
        plt.title('Cancer Patients by Gender')
        plt.tight_layout()
        plt.savefig('/output/plot_1.png')
        plt.close()

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))