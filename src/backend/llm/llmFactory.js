const ILLMService = require('./ILLMService');
const logger = require('../config/logger'); // Import logger
// Import implemented services
const OpenAILLMService = require('./providers/openaiService'); // Now implemented
// const GeminiLLMService = require('./providers/geminiService'); // Placeholder
// const DeepSeekLLMService = require('./providers/deepseekService'); // Placeholder
// const OllamaLLMService = require('./providers/ollamaService'); // Placeholder

let llmServiceInstance = null;
let initializationError = null;

/**
 * Factory function to get an instance of the configured LLM service.
 * Reads the LLM_PROVIDER environment variable.
 *
 * Internal factory function (renamed). Creates an instance based on env vars.
 *
 * @returns {ILLMService} An instance of the configured LLM service.
 * @throws {Error} If the configured provider is invalid or not implemented.
 */
function createLLMServiceInstance() { // Renamed from getLLMServiceInstance
  // Ensure dotenv is configured at the entry point of your application (e.g., index.js)
  // require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Adjust path if needed

  const provider = process.env.LLM_PROVIDER?.toLowerCase();

  // Use logger instead of console.log
  logger.info(`LLM Factory: Attempting to configure LLM service for provider: ${provider}`);

  switch (provider) {
    case 'openai':
      return new OpenAILLMService(); // Use the implemented service
    case 'gemini':
      // return new GeminiLLMService(); // Uncomment when implemented
      logger.warn(`LLM provider '${provider}' is configured but the implementation is not yet uncommented in llmFactory.js.`);
      throw new Error(`LLM provider '${provider}' is configured but not yet implemented.`);
    case 'deepseek':
      // Use the modified OpenAILLMService which handles deepseek config internally
      return new OpenAILLMService();
    case 'ollama':
      // return new OllamaLLMService(); // Uncomment when implemented
      logger.warn(`LLM provider '${provider}' is configured but the implementation is not yet uncommented in llmFactory.js.`);
      throw new Error(`LLM provider '${provider}' is configured but not yet implemented.`);
    default:
      logger.error(`LLM Factory: Invalid or missing LLM_PROVIDER environment variable: '${process.env.LLM_PROVIDER}'`);
      throw new Error(`Invalid or missing LLM provider specified in environment variables (LLM_PROVIDER). Valid options: openai, gemini, deepseek, ollama.`);
  }
}

// --- Initialize Singleton Instance ---
try {
  llmServiceInstance = createLLMServiceInstance();
  logger.info(`LLM Service singleton instance created successfully for provider: ${process.env.LLM_PROVIDER}`);
} catch (error) {
  initializationError = error;
  logger.error(`Failed to initialize LLM Service singleton during module load: ${error.message}`, { error });
  // llmServiceInstance remains null
}
// ---

/**
 * Getter function to access the singleton LLM service instance.
 * Throws an error if initialization failed during module load.
 *
 * @returns {ILLMService} The singleton instance of the configured LLM service.
 * @throws {Error} If the LLM service failed to initialize.
 */
function getLLMService() {
  if (initializationError) {
    // Throw a new error that references the original cause but provides context
    throw new Error(`LLM Service could not be initialized: ${initializationError.message}`);
  }
  if (!llmServiceInstance) {
    // This case should ideally not happen if initializationError is set, but acts as a safeguard
    throw new Error('LLM Service instance is null, but no initialization error was recorded. Check llmFactory.js.');
  }
  return llmServiceInstance;
}

module.exports = {
  getLLMService, // Export the getter for the singleton instance
  // Optionally export the factory if direct creation is ever needed elsewhere (unlikely for singleton pattern)
  // createLLMServiceInstance,
};
