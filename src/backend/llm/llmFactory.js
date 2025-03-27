const ILLMService = require('./ILLMService');
// Import implemented services
const OpenAILLMService = require('./providers/openaiService'); // Now implemented
// const GeminiLLMService = require('./providers/geminiService'); // Placeholder
// const DeepSeekLLMService = require('./providers/deepseekService'); // Placeholder
// const OllamaLLMService = require('./providers/ollamaService'); // Placeholder

/**
 * Factory function to get an instance of the configured LLM service.
 * Reads the LLM_PROVIDER environment variable.
 *
 * @returns {ILLMService} An instance of the configured LLM service.
 * @throws {Error} If the configured provider is invalid or not implemented.
 */
function getLLMServiceInstance() {
  // Ensure dotenv is configured at the entry point of your application (e.g., index.js)
  // require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Adjust path if needed

  const provider = process.env.LLM_PROVIDER?.toLowerCase();

  console.log(`LLM Factory: Configuring LLM service for provider: ${provider}`);

  switch (provider) {
    case 'openai':
      return new OpenAILLMService(); // Use the implemented service
    case 'gemini':
      // return new GeminiLLMService(); // Uncomment when implemented
      console.warn(`LLM provider '${provider}' is configured but the implementation is not yet uncommented in llmFactory.js.`);
      throw new Error(`LLM provider '${provider}' is configured but not yet implemented.`);
    case 'deepseek':
      // return new DeepSeekLLMService(); // Uncomment when implemented
      console.warn(`LLM provider '${provider}' is configured but the implementation is not yet uncommented in llmFactory.js.`);
      throw new Error(`LLM provider '${provider}' is configured but not yet implemented.`);
    case 'ollama':
      // return new OllamaLLMService(); // Uncomment when implemented
      console.warn(`LLM provider '${provider}' is configured but the implementation is not yet uncommented in llmFactory.js.`);
      throw new Error(`LLM provider '${provider}' is configured but not yet implemented.`);
    default:
      console.error(`LLM Factory: Invalid or missing LLM_PROVIDER environment variable: '${process.env.LLM_PROVIDER}'`);
      throw new Error(`Invalid or missing LLM provider specified in environment variables (LLM_PROVIDER). Valid options: openai, gemini, deepseek, ollama.`);
  }
}

module.exports = {
  getLLMServiceInstance,
};