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

    required_columns = ['Gender', 'Age', 'Blood Type', 'Medical Condition']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        analysis_results['error'] = f"Error: Columns {missing_columns} not found in dataset."
        print(f"Error: Columns {missing_columns} not found in dataset.")
    else:
        df['Age_numeric'] = pd.to_numeric(df['Age'], errors='coerce')
        if df['Age_numeric'].isnull().all():
            analysis_results['warning'] = "Warning: Column 'Age' could not be treated as numeric."
            print("Warning: Column 'Age' could not be treated as numeric.")
        else:
            filtered_df = df[
                (df['Gender'] == 'Male') &
                (df['Age_numeric'] >= 30) &
                (df['Age_numeric'] <= 50) &
                (df['Blood Type'] == 'O+')
            ]
            if filtered_df.empty:
                analysis_results['warning'] = "No records found for males aged 30-50 with blood type O+."
                print("No records found for males aged 30-50 with blood type O+.")
            else:
                condition_counts = filtered_df['Medical Condition'].value_counts().to_dict()
                analysis_results['medical_condition_distribution'] = condition_counts

                plt.figure(figsize=(10, 6))
                sns.countplot(data=filtered_df, y='Medical Condition', order=filtered_df['Medical Condition'].value_counts().index)
                plt.title('Distribution of Medical Conditions for Males (30-50, O+)')
                plt.tight_layout()
                plt.savefig('/output/plot_1.png')
                plt.close()

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))