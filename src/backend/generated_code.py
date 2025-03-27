import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json

def convert_numpy_types(obj):
    if isinstance(obj, (np.integer, np.int64)): return int(obj)
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

    # Basic info
    analysis_results['basic_info'] = {
        'shape': df.shape,
        'columns': df.columns.tolist(),
        'missing_values': df.isnull().sum().to_dict()
    }

    # Numeric columns summary
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    numeric_summary = {}
    for col in numeric_cols:
        df[f'{col}_numeric'] = pd.to_numeric(df[col], errors='coerce')
        if not df[f'{col}_numeric'].isnull().all():
            numeric_summary[col] = {
                'min': df[f'{col}_numeric'].min(),
                'max': df[f'{col}_numeric'].max(),
                'mean': df[f'{col}_numeric'].mean(),
                'median': df[f'{col}_numeric'].median(),
                'std': df[f'{col}_numeric'].std()
            }
    analysis_results['numeric_summary'] = numeric_summary

    # Categorical columns summary
    categorical_cols = df.select_dtypes(include=['object']).columns
    categorical_summary = {}
    for col in categorical_cols:
        categorical_summary[col] = {
            'unique_values': df[col].unique().tolist(),
            'value_counts': df[col].value_counts().to_dict()
        }
    analysis_results['categorical_summary'] = categorical_summary

    # Correlation matrix
    numeric_cols_clean = [col for col in numeric_cols if not df[f'{col}_numeric'].isnull().all()]
    if len(numeric_cols_clean) > 1:
        corr_matrix = df[[f'{col}_numeric' for col in numeric_cols_clean]].corr()
        analysis_results['correlation_matrix'] = corr_matrix.to_dict()
        
        plt.figure(figsize=(12, 8))
        sns.heatmap(corr_matrix, annot=True, cmap='coolwarm')
        plt.title('Correlation Matrix')
        plt.tight_layout()
        plt.savefig('/output/plot_1.png')
        plt.close()

    # Distribution plots for numeric columns
    for i, col in enumerate(numeric_cols_clean[:5]):
        plt.figure(figsize=(10, 6))
        sns.histplot(df[f'{col}_numeric'].dropna(), kde=True)
        plt.title(f'Distribution of {col}')
        plt.tight_layout()
        plt.savefig(f'/output/plot_{i+2}.png')
        plt.close()

    # Count plots for categorical columns
    for i, col in enumerate(categorical_cols[:5]):
        plt.figure(figsize=(10, 6))
        sns.countplot(data=df, x=col)
        plt.title(f'Count of {col}')
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(f'/output/plot_{i+7}.png')
        plt.close()

    # Box plots for numeric columns by categorical columns
    if len(categorical_cols) > 0 and len(numeric_cols_clean) > 0:
        for i, num_col in enumerate(numeric_cols_clean[:3]):
            for j, cat_col in enumerate(categorical_cols[:3]):
                plt.figure(figsize=(10, 6))
                sns.boxplot(data=df, x=cat_col, y=f'{num_col}_numeric')
                plt.title(f'{num_col} by {cat_col}')
                plt.xticks(rotation=45)
                plt.tight_layout()
                plt.savefig(f'/output/plot_{10 + i*3 + j}.png')
                plt.close()

    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))