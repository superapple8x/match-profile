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
    
    # Basic dataset info
    analysis_results['dataset_info'] = {
        'shape': df.shape,
        'missing_values': df.isnull().sum().to_dict(),
        'duplicates': df.duplicated().sum()
    }
    
    # Numeric columns summary
    numeric_summary = {}
    for col in numeric_cols:
        numeric_summary[col] = {
            'mean': df[col].mean(),
            'median': df[col].median(),
            'std': df[col].std(),
            'min': df[col].min(),
            'max': df[col].max(),
            'skewness': df[col].skew(),
            'kurtosis': df[col].kurtosis()
        }
        
        plt.figure(figsize=(10, 6))
        sns.histplot(df[col].dropna(), kde=True)
        plt.title(f'Distribution of {col}')
        plt.tight_layout()
        plt.savefig(f'/output/plot_{col}_hist.png')
        plt.close()
        
        plt.figure(figsize=(10, 6))
        sns.boxplot(x=df[col])
        plt.title(f'Boxplot of {col}')
        plt.tight_layout()
        plt.savefig(f'/output/plot_{col}_box.png')
        plt.close()
    
    analysis_results['numeric_summary'] = numeric_summary
    
    # Categorical columns summary
    categorical_summary = {}
    for col in categorical_cols:
        categorical_summary[col] = {
            'unique_values': df[col].nunique(),
            'top_value': df[col].mode()[0] if not df[col].mode().empty else None,
            'top_value_count': df[col].value_counts().max(),
            'value_counts': df[col].value_counts().to_dict()
        }
        
        plt.figure(figsize=(10, 6))
        if df[col].nunique() > 20:
            top_20 = df[col].value_counts().nlargest(20).index
            sns.countplot(data=df[df[col].isin(top_20)], y=col, order=top_20)
        else:
            sns.countplot(data=df, y=col, order=df[col].value_counts().index)
        plt.title(f'Counts for {col}')
        plt.tight_layout()
        plt.savefig(f'/output/plot_{col}_count.png')
        plt.close()
    
    analysis_results['categorical_summary'] = categorical_summary
    
    # Correlation matrix for numeric columns
    if len(numeric_cols) > 1:
        corr_matrix = df[numeric_cols].corr()
        analysis_results['correlation_matrix'] = corr_matrix.to_dict()
        
        plt.figure(figsize=(12, 8))
        sns.heatmap(corr_matrix, annot=True, fmt=".2f", cmap='coolwarm', center=0)
        plt.title('Correlation Matrix')
        plt.tight_layout()
        plt.savefig('/output/plot_corr_matrix.png')
        plt.close()
    
    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    print("Python Error: " + str(e))