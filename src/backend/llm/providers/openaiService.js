const OpenAI = require('openai');
const ILLMService = require('../ILLMService');

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
    console.log(`[DEBUG] Using API Key for ${serviceName}: ${apiKey ? apiKey.substring(0, 5) + '...' : 'Not Found!'}`);
    // --- END DEBUG LOG ---

    this.client = new OpenAI({ apiKey, baseURL }); // Pass baseURL if defined
    this.serviceName = serviceName; // Store service name for logging
    console.log(`${this.serviceName} Service Initialized (using OpenAI SDK). Base URL: ${baseURL || 'Default'}`);
  }

  /**
   * Constructs the prompt for Python code generation.
   * @param {string} userQuery
   * @param {object} datasetMetadata
   * @returns {string} The system prompt content.
   */
  _buildCodeGenerationPrompt(userQuery, datasetMetadata) {
    // Basic prompt template - needs refinement based on testing
    const metadataString = JSON.stringify(datasetMetadata, null, 2);
    // Updated prompt:
    return `
You are a data analysis assistant. Your task is to write Python code to analyze a dataset based on a user's query.

**Dataset Metadata:**
\`\`\`json
${metadataString}
\`\`\`

**User Query:** "${userQuery}"

**Instructions:**
1.  Use pandas for data manipulation. Assume data is loaded into a DataFrame \`df\` from '/input/data.csv'.
2.  Use matplotlib and seaborn for plotting.
3.  **Plotting:**
    *   If the query requires plot(s), generate them.
    *   You MAY generate MULTIPLE plots if relevant (e.g., for a general EDA query).
    *   Save EACH plot to a SEPARATE file in the '/output/' directory using indexed filenames: '/output/plot_1.png', '/output/plot_2.png', etc.
    *   **Crucially:** Do NOT display plots (e.g., using \`plt.show()\`). Call \`plt.close()\` after saving each plot figure to free memory.
4.  **Statistics:**
    *   Calculate relevant summary statistics based on the query (e.g., counts, means, correlations, value counts).
    *   Save ALL calculated statistics into a SINGLE JSON object to '/output/stats.json'.
    *   **VERY IMPORTANT for JSON:** Before saving to JSON, ensure all values are JSON serializable. NumPy types (like int64, float64) are NOT directly serializable. Convert them to standard Python types (int, float). You MUST include and use the provided \`convert_numpy_types\` helper function for this.
5.  **Code Output:** Output ONLY the raw Python code. No explanations, comments outside code, or markdown formatting.
6.  **Error Handling:** Handle potential errors (e.g., missing columns, non-numeric data for numeric operations). If an error occurs during analysis (e.g., attempting a numeric operation on text), print a descriptive error message to standard output and continue if possible, or exit gracefully if not.
7.  **Environment:** Assume a standard Python environment with pandas, matplotlib, seaborn installed.
8.  **Correlations:** When calculating correlations (e.g., \`df.corr()\`), select numeric columns first (\`df.select_dtypes(include='number').corr()\`).

**Helper Function (MUST INCLUDE and USE for saving stats.json):**
\`\`\`python
import numpy as np
import json
import pandas as pd # Assuming pandas is imported

def convert_numpy_types(obj):
    if isinstance(obj, (np.integer, np.int64)): # Handle numpy integers specifically
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64)): # Handle numpy floats specifically
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, pd.Timestamp):
        return obj.isoformat() # Convert timestamps to strings
    elif isinstance(obj, (pd.Series, pd.Index)): # Convert pandas Series/Index
        return obj.tolist()
    elif isinstance(obj, dict):
        return {str(k): convert_numpy_types(v) for k, v in obj.items()} # Ensure keys are strings
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(i) for i in obj]
    # Add handling for other non-serializable types if necessary
    elif hasattr(obj, 'isoformat'): # General date/time objects
        return obj.isoformat()
    try:
        # Attempt a default serialization test; if it fails, convert to string
        json.dumps(obj)
        return obj
    except TypeError:
        return str(obj) # Fallback: convert unknown types to string
\`\`\`

**Example Snippet (Saving Multiple Plots):**
\`\`\`python
import matplotlib.pyplot as plt
import pandas as pd
# ... perform analysis ...

# Plot 1
plt.figure(figsize=(10, 6)) # Recommend setting figsize
# ... create plot 1 ...
plt.tight_layout() # Adjust layout
plt.savefig('/output/plot_1.png')
plt.close() # Essential: close figure

# Plot 2
plt.figure(figsize=(10, 6))
# ... create plot 2 ...
plt.tight_layout()
plt.savefig('/output/plot_2.png')
plt.close()
\`\`\`

**Example Snippet (Saving Stats with Conversion):**
\`\`\`python
import json
import numpy as np
import pandas as pd

# --- Include the convert_numpy_types function definition here ---
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
# --- End of function definition ---

# ... perform analysis ...
raw_stats = {'mean_age': df['age'].mean(), 'counts': df['category'].value_counts()} # May contain numpy/pandas types

# Convert before saving
stats = convert_numpy_types(raw_stats)

with open('/output/stats.json', 'w') as f:
    json.dump(stats, f, indent=2) # Use indent for readability
\`\`\`

Now, generate the Python code for the user query, remembering to include and use the \`convert_numpy_types\` function when saving statistics. Ensure plots are saved as '/output/plot_1.png', '/output/plot_2.png', etc.
`;
  }

  /**
   * Generates Python code using the OpenAI API.
   * @param {string} userQuery
   * @param {object} datasetMetadata
   * @returns {Promise<string>} Generated Python code.
   */
  async generatePythonCode(userQuery, datasetMetadata) {
    console.log(`${this.serviceName} Service: Generating Python code for query: "${userQuery}" using model ${this.codeModel}`);
    const systemPrompt = this._buildCodeGenerationPrompt(userQuery, datasetMetadata);


        try {
          const completion = await this.client.chat.completions.create({
            model: this.codeModel, // Use the dynamic model name stored in the instance
            messages: [
              { role: "system", content: systemPrompt },
              // { role: "user", content: `Generate the Python code for my query: "${userQuery}"` } // User message might not be needed if prompt is clear
            ], // End of messages array
            temperature: 0.2, // Lower temperature for more deterministic code output
          }); // End of create() call object

      const generatedCode = completion.choices[0]?.message?.content?.trim();

      if (!generatedCode) {
        throw new Error(`${this.serviceName} API returned an empty response for code generation.`);
      }

      // Basic validation: Check if it looks like Python code (heuristic)
      // More robust validation might involve trying to parse it, but that's complex here.
      if (!generatedCode.includes('import ') && !generatedCode.includes('def ') && !generatedCode.includes('print(')) {
         console.warn(`${this.serviceName} Service: Generated content doesn't obviously look like Python code:`, generatedCode.substring(0, 100) + '...');
         // Decide whether to throw an error or return the potentially incorrect code
         // For now, let's return it and let the execution phase handle errors.
      }

      console.log(`${this.serviceName} Service: Code generation successful.`);
      // Clean potential markdown code blocks if the LLM doesn't follow instructions
      return generatedCode.replace(/^```python\n?/, '').replace(/\n?```$/, '');


        } catch (error) {
          console.error(`${this.serviceName} Service: Error during code generation API call:`, error);
          throw new Error(`${this.serviceName} API call failed: ${error.message}`);
        }
    } // Closing brace for generatePythonCode method

  /**
   * Constructs the prompt for text summary generation.
   * @param {string} userQuery
   * @param {object} statistics
   * @returns {string} The system prompt content.
   */
  _buildTextSummaryPrompt(userQuery, statistics) {
    const statsString = JSON.stringify(statistics, null, 2);
    return `
You are a data analysis assistant. Your task is to provide a concise, natural language summary based on the results of a data analysis query.

**Original User Query:** "${userQuery}"

**Calculated Statistics:**
\`\`\`json
${statsString}
\`\`\`

**Instructions:**
1.  Analyze the provided statistics in the context of the original user query.
2.  Write a brief, easy-to-understand summary (1-3 sentences) explaining the key findings based *only* on the provided statistics.
3.  Do not invent information not present in the statistics.
4.  Focus on the most relevant insights related to the user's query.
5.  Output only the natural language summary text. Do not include greetings, explanations of your process, or markdown formatting.

**Example:**
If the query was "Show average income by gender" and stats were \`{"mean_income_male": 55000, "mean_income_female": 62000}\`, a good summary would be: "The analysis shows that the average income for females ($62,000) was higher than for males ($55,000) in this dataset."

Now, generate the summary based on the provided query and statistics.
`;
  }

  /**
   * Generates a textual summary using the OpenAI API based on calculated statistics.
   * @param {string} userQuery The original user query.
   * @param {object | null} statistics The statistics calculated by the Python code (from stats.json), or null if none were generated/found.
   * @returns {Promise<string>} Generated text summary.
   */
  async generateTextSummary(userQuery, statistics) {
    console.log(`${this.serviceName} Service: Generating text summary for query: "${userQuery}" using model ${this.textModel}`);

    if (!statistics || Object.keys(statistics).length === 0) {
      console.log(`${this.serviceName} Service: No statistics provided, returning default message.`);
      return "No specific statistics were calculated by the analysis code to generate a summary from.";
    }

    const systemPrompt = this._buildTextSummaryPrompt(userQuery, statistics);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.textModel, // Use dynamic model name
        messages: [
          { role: "system", content: systemPrompt },
          // No explicit user message needed here as the system prompt contains all context
        ],
        temperature: 0.5, // Slightly higher temperature for more natural language
        max_tokens: 150, // Limit summary length
      });

      const generatedSummary = completion.choices[0]?.message?.content?.trim();

      if (!generatedSummary) {
        throw new Error(`${this.serviceName} API returned an empty response for text summary generation.`);
      }

      console.log(`${this.serviceName} Service: Text summary generation successful.`);
      return generatedSummary;

    } catch (error) {
      console.error(`${this.serviceName} Service: Error during text summary API call:`, error);
      // Return a fallback message instead of throwing an error to the main flow?
      // Or rethrow? Let's rethrow for now so the main endpoint knows it failed.
      throw new Error(`${this.serviceName} API call for summary failed: ${error.message}`);
    }
  }
}

module.exports = OpenAILLMService;