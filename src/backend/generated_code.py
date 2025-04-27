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

    if numeric_cols:
        numeric_summary = {}
        for col in numeric_cols:
            numeric_summary[col] = {
                'count': df[col].count(),
                'mean': df[col].mean(),
                'std': df[col].std(),
                'min': df[col].min(),
                '25%': df[col].quantile(0.25),
                '50%': df[col].median(),
                '75%': df[col].quantile(0.75),
                'max': df[col].max()
            }
        analysis_results['numeric_summary'] = numeric_summary

        for i, col in enumerate(numeric_cols[:3]):  # Limit to first 3 numeric columns for plots
            plt.figure(figsize=(10, 6))
            sns.histplot(df[col].dropna(), kde=True)
            plt.title(f'Distribution of {col}')
            plt.tight_layout()
            plt.savefig(f'/output/plot_{i+1}.png')
            plt.close()
    else:
        analysis_results['numeric_summary_warning'] = "No numeric columns identified for summary."

    if categorical_cols:
        categorical_summary = {}
        for col in categorical_cols:
            categorical_summary[col] = {
                'count': df[col].count(),
                'unique': df[col].nunique(),
                'top': df[col].mode()[0] if not df[col].mode().empty else None,
                'freq': df[col].value_counts().iloc[0] if not df[col].value_counts().empty else None
            }
        analysis_results['categorical_summary'] = categorical_summary

        for i, col in enumerate(categorical_cols[:3]):  # Limit to first 3 categorical columns for plots
            plt.figure(figsize=(10, 6))
            sns.countplot(data=df, y=col, order=df[col].value_counts().index)
            plt.title(f'Counts for {col}')
            plt.tight_layout()
            plt.savefig(f'/output/plot_{i+4}.png')
            plt.close()
    else:
        analysis_results['categorical_summary_warning'] = "No categorical columns identified for summary."

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))