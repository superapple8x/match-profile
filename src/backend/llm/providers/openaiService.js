const OpenAI = require('openai');
const ILLMService = require('../ILLMService');
const logger = require('../../config/logger'); // Import logger

// Default model names (can be overridden by provider-specific env vars)
const DEFAULT_CODE_MODEL = 'gpt-3.5-turbo';
const DEFAULT_TEXT_MODEL = 'gpt-3.5-turbo';

class OpenAILLMService extends ILLMService {
  constructor() {
    super();
    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    let apiKey;
    let baseURL;
    let serviceName;

    if (provider === 'deepseek') {
      apiKey = process.env.DEEPSEEK_API_KEY;
      baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'; // Default DeepSeek URL
      this.codeModel = process.env.DEEPSEEK_CODE_MODEL || 'deepseek-coder'; // DeepSeek specific model
      this.textModel = process.env.DEEPSEEK_TEXT_MODEL || 'deepseek-chat'; // DeepSeek specific model
      serviceName = 'DeepSeek';
      if (!apiKey) {
        throw new Error("DeepSeek API key (DEEPSEEK_API_KEY) is missing from environment variables.");
      }
    } else { // Default to OpenAI
      apiKey = process.env.OPENAI_API_KEY;
      baseURL = undefined; // Use OpenAI SDK default
      this.codeModel = process.env.OPENAI_CODE_MODEL || DEFAULT_CODE_MODEL;
      this.textModel = process.env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
      serviceName = 'OpenAI';
      if (!apiKey) {
        throw new Error("OpenAI API key (OPENAI_API_KEY) is missing from environment variables.");
      }
    }

    // --- DEBUG LOG ---
    logger.debug(`Using API Key for ${serviceName}: ${apiKey ? apiKey.substring(0, 5) + '...' : 'Not Found!'}`);
    // --- END DEBUG LOG ---

    this.client = new OpenAI({ apiKey, baseURL }); // Pass baseURL if defined
    this.serviceName = serviceName; // Store service name for logging
    logger.info(`${this.serviceName} Service Initialized (using OpenAI SDK). Base URL: ${baseURL || 'Default'}`);
  }

  /**
   * Sanitizes a string to be safely embedded within a JavaScript template literal.
   * Escapes backticks, dollar signs followed by curly braces.
   * @param {string} str The string to sanitize.
   * @returns {string} The sanitized string.
   */
  _sanitizeForTemplateLiteral(str) {
      if (typeof str !== 'string') return str; // Return non-strings as is
      return str
          .replace(/\\/g, '\\\\') // Escape backslashes first
          .replace(/`/g, '\\`')   // Escape backticks
          .replace(/\$\{/g, '\\${'); // Escape ${ sequences
  }


  /**
   * Constructs the prompt for Python code generation with enhanced safety.
   * @param {string} userQuery
   * @param {object} datasetMetadata
   * @returns {string} The system prompt content.
   */
  _buildCodeGenerationPrompt(userQuery, datasetMetadata) {
    const metadataString = JSON.stringify(datasetMetadata, null, 2);
    // Sanitize the user query before inserting into the template literal
    const sanitizedUserQuery = this._sanitizeForTemplateLiteral(userQuery);

    // Enhanced prompt with stricter error handling and type checking:
    return `
You are a data analysis assistant writing Python code. Generate ONLY the raw Python code based on the user query and metadata.

**Dataset Metadata:**
\`\`\`json
${metadataString}
\`\`\`

**User Query:** "${sanitizedUserQuery}" {/* Use sanitized query */}

**CRITICAL Instructions (Follow Strictly):**
1.  **Imports:** ALWAYS import necessary libraries: \`import pandas as pd\`, \`import numpy as np\`, \`import matplotlib.pyplot as plt\`, \`import seaborn as sns\`, \`import json\`, \`import math\`.
2.  **Data Loading:** Load data using: \`df = pd.read_csv('/input/data.csv', encoding='utf-8')\`. Assume this is the first step inside the main try block. Handle potential bad lines if necessary within the try block. **DO NOT use the 'errors' keyword argument in read_csv.**
3.  **Error Handling (Mandatory):**
    *   Wrap ALL analysis code (AFTER loading data) inside a single \`try...except Exception as e:\` block.
    *   Inside the \`except\` block, you MUST print the specific Python error using standard concatenation: \`print("Python Error: " + str(e))\`. Do NOT raise the exception again.
4.  **Column Access (VERY IMPORTANT):**
    *   When accessing DataFrame columns, you MUST use the **exact \`originalName\`** provided in the \`columnsMetadata\` section of the Dataset Metadata above (e.g., \`df['Original Column Name']\`).
    *   Pandas column access is **case-sensitive** and requires exact matching, including spaces.
    *   BEFORE using any column, explicitly check if the exact \`originalName\` exists in \`df.columns\`. If not, print an informative error (e.g., \`print("Error: Column 'Original Column Name' not found in dataset.")\`) and stop analysis for that part, or store an error message in the stats.
5.  **Numeric Operations (Mandatory Safety):**
    *   BEFORE performing calculations like \`.mean()\`, \`.median()\`, \`.max()\`, \`.idxmax()\`, \`.corr()\`, or plotting histograms/scatter plots on a column assumed to be numeric, you MUST attempt to convert it to numeric using \`pd.to_numeric(df['Original Column Name'], errors='coerce')\` (using the exact \`originalName\`).
    *   Store the result in a new temporary column (e.g., \`df['column_name_numeric']\`).
    *   Check if the temporary numeric column contains non-NaN values (\`not df['column_name_numeric'].isnull().all()\`) before proceeding with the calculation.
    *   If the column cannot be converted or contains only NaN after conversion, print an informative error (e.g., \`print("Warning: Column 'column_name' could not be treated as numeric.")\`) or store this info in the stats, and skip the numeric operation.
    *   Use the temporary numeric column for the calculation (e.g., \`df['column_name_numeric'].max()\`).
6.  **Plotting:**
    *   Generate plots ONLY if requested or highly relevant (like for EDA).
    *   Save EACH plot to a SEPARATE file: '/output/plot_1.png', '/output/plot_2.png', etc.
    *   Use \`plt.figure(figsize=(10, 6))\`, create the plot, use \`plt.tight_layout()\`, then \`plt.savefig('/output/plot_X.png')\`, and ALWAYS call \`plt.close()\` immediately after saving each figure. Do NOT use \`plt.show()\`.
7.  **Statistics / Data Output ('/output/stats.json'):**
    *   Calculate relevant summary statistics OR find specific data points as requested.
    *   If finding specific rows (e.g., max value row), extract the necessary information into a dictionary.
    *   Store ALL results (stats dict, row dict, error messages if any) in a SINGLE Python dictionary named \`analysis_results\`.
    *   **JSON Conversion:** Include and ALWAYS use the \`convert_numpy_types\` helper function (provided below) on the \`analysis_results\` dictionary BEFORE saving it to '/output/stats.json'. \`final_stats = convert_numpy_types(analysis_results)\`.
    *   Save the converted dictionary: \`with open('/output/stats.json', 'w') as f: json.dump(final_stats, f, indent=2)\`.
8.  **Code Output:** Output ONLY the raw Python code. No explanations, comments outside code, or markdown formatting.

**Helper Function (MUST INCLUDE and USE for saving stats.json):**
\`\`\`python
import numpy as np
import json
import pandas as pd # Assuming pandas is imported
import math

def convert_numpy_types(obj):
    # DO NOT MODIFY THIS FUNCTION (except for NaN handling)
    if isinstance(obj, (np.integer, np.int64)): return int(obj)
    # Handle NaN -> null conversion BEFORE float conversion
    elif isinstance(obj, (np.floating, np.float64, float)) and math.isnan(obj): return None
    elif isinstance(obj, (np.floating, np.float64)): return float(obj)
    elif isinstance(obj, np.ndarray): return obj.tolist()
    elif isinstance(obj, pd.Timestamp): return obj.isoformat()
    elif isinstance(obj, (pd.Series, pd.Index)): return obj.tolist()
    elif isinstance(obj, dict): return {str(k): convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)): return [convert_numpy_types(i) for i in obj]
    elif hasattr(obj, 'isoformat'): return obj.isoformat() # Handle datetime objects
    try: json.dumps(obj); return obj # Check if already JSON serializable
    except TypeError: return str(obj) # Fallback to string
\`\`\`

**Example Structure:**
\`\`\`python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json
import math # Add math import to example too

# --- Include convert_numpy_types function definition here ---
def convert_numpy_types(obj):
    # ... (function code as defined above) ...
    if isinstance(obj, (np.integer, np.int64)): return int(obj)
    elif isinstance(obj, (np.floating, np.float64, float)) and math.isnan(obj): return None # Add NaN check here too
    # ... (rest of function) ...
    except TypeError: return str(obj)
# --- End of function definition ---

analysis_results = {} # Initialize results dict

try:
    # Load data safely
    df = pd.read_csv('/input/data.csv', encoding='utf-8') # Corrected example: removed errors='replace'

    # Check if required column exists
    required_col = 'SomeColumn'
    if required_col not in df.columns:
        analysis_results['error'] = "Error: Column '" + required_col + "' not found."
        print("Error: Column '" + required_col + "' not found.")
    else:
        # Attempt numeric conversion if needed
        df[f'{required_col}_numeric'] = pd.to_numeric(df[required_col], errors='coerce')

        # Perform analysis only if conversion worked
        if not df[f'{required_col}_numeric'].isnull().all():
            max_val = df[f'{required_col}_numeric'].max()
            analysis_results['max_value'] = max_val
            # ... other analysis ...

            # Example Plot
            plt.figure(figsize=(10, 6))
            sns.histplot(df[f'{required_col}_numeric'].dropna())
            plt.title(f'Distribution of {required_col}')
            plt.tight_layout()
            plt.savefig('/output/plot_1.png')
            plt.close()

        else:
            analysis_results['warning'] = "Warning: Column '" + required_col + "' could not be treated as numeric."
            print("Warning: Column '" + required_col + "' could not be treated as numeric.")

    # Convert the entire results dict before saving
    final_stats = convert_numpy_types(analysis_results)
    with open('/output/stats.json', 'w') as f:
        json.dump(final_stats, f, indent=2)

except Exception as e:
    # MANDATORY: Print the specific error
    print("Python Error: " + str(e))

\`\`\`

Generate the Python code now, adhering strictly to all instructions.
`;
  }

  // generatePythonCode remains the same as before
  async generatePythonCode(userQuery, datasetMetadata) {
    logger.info(`${this.serviceName} Service: Generating Python code for query: "${userQuery}" using model ${this.codeModel}`);
    // Call the function with sanitization
    const systemPrompt = this._buildCodeGenerationPrompt(userQuery, datasetMetadata);

    try {
      logger.debug(`${this.serviceName} Service: Attempting API call to model ${this.codeModel}...`);
      const completion = await this.client.chat.completions.create({
        model: this.codeModel,
        messages: [
          { role: "system", content: systemPrompt },
        ],
        temperature: 0.2, // Keep low temp for code
      });

      logger.debug(`${this.serviceName} Service: API call completed.`);
      const generatedCode = completion.choices[0]?.message?.content?.trim();

      if (!generatedCode) {
        throw new Error(`${this.serviceName} API returned an empty response for code generation.`);
      }

      logger.info(`${this.serviceName} Service: Code generation successful.`);
      // --- Post-processing: Force removal of 'errors' argument from pd.read_csv ---
      const cleanedCode = generatedCode.replace(/(pd\.read_csv\([^)]*?)(,\s*errors\s*=\s*['"][^'"]*['"]|errors\s*=\s*['"][^'"]*['"]\s*,?)([^)]*\))/g, '$1$3');
      logger.debug(`${this.serviceName} Service: Applied post-processing to remove errors= argument.`);
      // Clean potential markdown code blocks from the already cleaned code
      return cleanedCode.replace(/^```python\n?/, '').replace(/\n?```$/, '');

    } catch (error) {
      // Log the specific error from the API call
      logger.error(`${this.serviceName} Service: Error during code generation API call`, { error: error.message });
      // Also log the prompt that might have caused the issue (optional, might be large)
      // console.error("Prompt that potentially caused error:", systemPrompt);
      throw new Error(`${this.serviceName} API call failed: ${error.message}`);
    }
  }

  // _buildTextSummaryPrompt remains the same
   _buildTextSummaryPrompt(userQuery, statistics) {
    const statsString = JSON.stringify(statistics, null, 2);
    return `
You are a data analysis assistant. Your task is to provide a concise, natural language summary based on the results of a data analysis query.

**Original User Query:** "${userQuery}" {/* Keep original query here for context */}

**Calculated Statistics / Data Found:**
\`\`\`json
${statsString}
\`\`\`

**Instructions:**
1.  Analyze the provided statistics/data in the context of the original user query.
2.  Write a detailed, easy-to-understand summary explaining the key findings based *only* on the provided data. Elaborate on the meaning of the statistics or data points found in relation to the user's query.
3.  If the data includes details about a specific row (e.g., max value details), mention the key information from that row relevant to the query.
4.  If the data contains an 'error' or 'warning' key, state that the analysis could not be fully completed and mention the reason if provided.
5.  Do not invent information not present in the data.
6.  Focus on the most relevant insights related to the user's query.
7.  Output only the natural language summary text. Do not include greetings, explanations of your process, or markdown formatting.

**Example 1 (Stats):**
Query: "Show average income by gender"
Data: \`{"mean_income_male": 55000, "mean_income_female": 62000}\`
Summary: "The analysis shows that the average income for females ($62,000) was higher than for males ($55,000) in this dataset."

**Example 2 (Specific Row):**
Query: "Which user spent the most time?"
Data: \`{"max_time_details": {"UserID": 123, "Total Time Spent": 500, "Location": "USA"}}\`
Summary: "UserID 123 spent the most time (500 units), located in the USA."

**Example 3 (Error):**
Query: "Analyze Column Z"
Data: \`{"error": "Error: Column 'Column Z' not found."}\`
Summary: "The analysis could not be completed because column 'Column Z' was not found in the dataset."

Now, generate the summary based on the provided query and data.
`;
  }

  // generateTextSummary remains the same
  async generateTextSummary(userQuery, statistics) {
    logger.info(`${this.serviceName} Service: Generating text summary for query: "${userQuery}" using model ${this.textModel}`);

    // Also generate summary if stats contains an error message from the Python script
    if (!statistics || Object.keys(statistics).length === 0) {
       logger.debug(`${this.serviceName} Service: No statistics/data provided, returning default message.`);
       return "No specific statistics or data were generated by the analysis code to summarize.";
     }

    // If stats contains an error key, prioritize summarizing that
     if (statistics.error) {
         logger.debug(`${this.serviceName} Service: Analysis results contain an error message.`);
     } else if (statistics.warning) {
         logger.debug(`${this.serviceName} Service: Analysis results contain a warning message.`);
     }


    const systemPrompt = this._buildTextSummaryPrompt(userQuery, statistics);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.textModel,
        messages: [
          { role: "system", content: systemPrompt },
        ],
        temperature: 0.5,
      });

      const generatedSummary = completion.choices[0]?.message?.content?.trim();

      if (!generatedSummary) {
        // If LLM fails to summarize an error/warning, provide a generic fallback
        if (statistics.error) return `Analysis failed: ${statistics.error}`;
        if (statistics.warning) return `Analysis completed with warning: ${statistics.warning}`;
        throw new Error(`${this.serviceName} API returned an empty response for text summary generation.`);
      }

      logger.info(`${this.serviceName} Service: Text summary generation successful.`);
      return generatedSummary;

    } catch (error) {
      logger.error(`${this.serviceName} Service: Error during text summary API call`, { error });
      // Provide more specific fallback if summary gen fails for error/warning stats
      if (statistics.error) return `Analysis failed: ${statistics.error}`;
      if (statistics.warning) return `Analysis completed with warning: ${statistics.warning}`;
      throw new Error(`${this.serviceName} API call for summary failed: ${error.message}`);
    }
  }
}

module.exports = OpenAILLMService;