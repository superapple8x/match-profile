/**
 * @interface ILLMService
 * Defines the contract for interacting with different LLM providers.
 */
class ILLMService {
  /**
   * Generates Python code based on a natural language query and dataset context.
   * @param {string} userQuery - The user's natural language query.
   * @param {object} datasetMetadata - Metadata extracted from the dataset (columns, types, summaries).
   * @returns {Promise<string>} A promise that resolves with the generated Python code string.
   * @throws {Error} If the LLM call fails or returns an invalid response.
   */
  async generatePythonCode(userQuery, datasetMetadata) {
    throw new Error("Method 'generatePythonCode()' must be implemented.");
  }

  /**
   * Generates a textual summary based on a query and calculated statistics.
   * @param {string} userQuery - The original user query.
   * @param {object} statistics - The statistics calculated by the executed Python code (from stats.json).
   * @returns {Promise<string>} A promise that resolves with the generated text summary.
   * @throws {Error} If the LLM call fails or returns an invalid response.
   */
  async generateTextSummary(userQuery, statistics) {
    throw new Error("Method 'generateTextSummary()' must be implemented.");
  }
}

module.exports = ILLMService;