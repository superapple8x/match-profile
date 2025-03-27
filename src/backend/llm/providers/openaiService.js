const OpenAI = require('openai');
const ILLMService = require('../ILLMService');

// Consider making the model configurable via .env as well
const CODE_GENERATION_MODEL = process.env.OPENAI_CODE_MODEL || 'gpt-3.5-turbo';
const TEXT_GENERATION_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-3.5-turbo';

class OpenAILLMService extends ILLMService {
  constructor() {
    super();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key (OPENAI_API_KEY) is missing from environment variables.");
    }
    this.client = new OpenAI({ apiKey });
    console.log("OpenAI Service Initialized.");
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
        model: CODE_GENERATION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the Python code for my query: "${userQuery}"` } // Reiterate query for clarity? Maybe not needed if in system prompt.
        ],
        temperature: 0.2, // Lower temperature for more deterministic code output
      });

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
      console.error("OpenAI Service: Error during code generation API call:", error);
      throw new Error(`OpenAI API call failed: ${error.message}`);
    }
  }

  /**
   * Generates a textual summary (Placeholder for Phase 4).
   * @param {string} userQuery
   * @param {object} statistics
   * @returns {Promise<string>}
   */
  async generateTextSummary(userQuery, statistics) {
    console.log("OpenAI Service: generateTextSummary called (Not Implemented Yet).");
    // TODO: Implement in Phase 4
    // 1. Build prompt using userQuery and statistics
    // 2. Call OpenAI chat completion API (using TEXT_GENERATION_MODEL)
    // 3. Extract and return summary text
    return Promise.resolve(`Summary generation for query "${userQuery}" based on provided statistics is not yet implemented.`);
  }
}

module.exports = OpenAILLMService;