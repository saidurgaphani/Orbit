export default class AIProvider {
  /**
   * Generates a raw text response from the LLM.
   * @param {string} prompt 
   * @param {string} systemInstruction 
   * @param {object} options 
   * @returns {Promise<string>}
   */
  async generate(prompt, systemInstruction = '', options = {}) {
    throw new Error('generate() not implemented');
  }

  /**
   * Generates a validated structured JSON object from the LLM.
   * @param {string} prompt 
   * @param {string} systemInstruction 
   * @param {object} schema 
   * @param {object} options 
   * @returns {Promise<object>}
   */
  async generateStructured(prompt, systemInstruction = '', schema = null, options = {}) {
    throw new Error('generateStructured() not implemented');
  }

  /**
   * Generates embedding vectors for the given text.
   * @param {string} text 
   * @returns {Promise<number[]>}
   */
  async embed(text) {
    throw new Error('embed() not implemented');
  }

  /**
   * Classifies the text into one of the provided categories.
   * @param {string} text 
   * @param {string[]} categories 
   * @returns {Promise<string>}
   */
  async classify(text, categories) {
    throw new Error('classify() not implemented');
  }
}
