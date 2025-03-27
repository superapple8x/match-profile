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
    return `
You are a data analysis assistant. Your task is to write Python code to analyze a dataset based on a user's query.

**Dataset Metadata:**
\`\`\`json
${metadataString}
\`\`\`

**User Query:** "${userQuery}"

**Instructions:**
1.  Use the pandas library for data manipulation. Assume the data is loaded into a DataFrame named \`df\` from '/input/data.csv'.
2.  Use matplotlib and seaborn for plotting.
3.  **Crucially:** If a plot is generated, save it ONLY to '/output/plot.png'. Do not display it.
4.  Calculate relevant summary statistics based on the query (e.g., counts, means, correlations). Save these statistics as a JSON object to '/output/stats.json'.
5.  Output ONLY the raw Python code. Do not include any explanations, comments outside the code, or markdown formatting.
6.  Handle potential errors gracefully (e.g., if a column mentioned in the query doesn't exist).
7.  Ensure the code is runnable in a standard Python environment with pandas, matplotlib, and seaborn installed.
8.  **Important:** When calculating correlations (e.g., using \`df.corr()\`), ensure you only select numeric columns first (e.g., \`df.select_dtypes(include='number').corr()\`).

**Example Snippet (Saving Plot):**
\`\`\`python
import matplotlib.pyplot as plt
import pandas as pd
# ... perform analysis ...
plt.figure()
# ... create plot ...
plt.savefig('/output/plot.png')
plt.close() # Important to close the plot
\`\`\`

**Example Snippet (Saving Stats):**
\`\`\`python
import json
# ... perform analysis ...
stats = {'mean_age': df['age'].mean(), 'count': len(df)}
with open('/output/stats.json', 'w') as f:
    json.dump(stats, f)
\`\`\`

Now, generate the Python code for the user query.
`;
  }

  /**
   * Generates Python code using the OpenAI API.
   * @param {string} userQuery
   * @param {object} datasetMetadata
   * @returns {Promise<string>} Generated Python code.
   */
  async generatePythonCode(userQuery, datasetMetadata) {
    console.log(`OpenAI Service: Generating Python code for query: "${userQuery}"`);
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
        throw new Error("OpenAI API returned an empty response for code generation.");
      }

      // Basic validation: Check if it looks like Python code (heuristic)
      // More robust validation might involve trying to parse it, but that's complex here.
      if (!generatedCode.includes('import ') && !generatedCode.includes('def ') && !generatedCode.includes('print(')) {
         console.warn("OpenAI Service: Generated content doesn't look like Python code:", generatedCode);
         // Decide whether to throw an error or return the potentially incorrect code
         // For now, let's return it and let the execution phase handle errors.
      }

      console.log("OpenAI Service: Code generation successful.");
      // Clean potential markdown code blocks if the LLM doesn't follow instructions
      return generatedCode.replace(/^```python\n?/, '').replace(/\n?```$/, '');

    
        } catch (error) {
          console.error(`${this.serviceName} Service: Error during code generation API call:`, error);
          throw new Error(`${this.serviceName} API call failed: ${error.message}`);
        }
    } // <<< Add missing closing brace for generatePythonCode method

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
        throw new Error("OpenAI API returned an empty response for text summary generation.");
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