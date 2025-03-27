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

    # General summary statistics
    general_stats = {}
    
    # Numeric columns summary
    numeric_cols = [col for col in df.columns if df[col].dtype in ['int64', 'float64']]
    for col in numeric_cols:
        df[f'{col}_numeric'] = pd.to_numeric(df[col], errors='coerce')
        if not df[f'{col}_numeric'].isnull().all():
            general_stats[col] = {
                'min': df[f'{col}_numeric'].min(),
                'max': df[f'{col}_numeric'].max(),
                'mean': df[f'{col}_numeric'].mean(),
                'median': df[f'{col}_numeric'].median(),
                'std': df[f'{col}_numeric'].std()
            }
        else:
            general_stats[col] = "Warning: Could not be treated as numeric."
    
    # Categorical columns summary
    categorical_cols = [col for col in df.columns if df[col].dtype == 'object']
    for col in categorical_cols:
        general_stats[col] = {
            'unique_values': df[col].unique().tolist(),
            'count': df[col].nunique()
        }
    
    analysis_results['general_summary'] = general_stats

    # Plot numeric distributions
    for i, col in enumerate(numeric_cols):
        if not df[f'{col}_numeric'].isnull().all():
            plt.figure(figsize=(10, 6))
            sns.histplot(df[f'{col}_numeric'].dropna())
            plt.title(f'Distribution of {col}')
            plt.tight_layout()
            plt.savefig(f'/output/plot_{i+1}.png')
            plt.close()

    # Plot categorical distributions
    for i, col in enumerate(categorical_cols):
        plt.figure(figsize=(10, 6))
        sns.countplot(data=df, x=col)
        plt.title(f'Distribution of {col}')
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(f'/output/plot_{len(numeric_cols)+i+1}.png')
        plt.close()

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))