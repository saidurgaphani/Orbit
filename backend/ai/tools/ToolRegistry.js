export default class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  /**
   * Registers a pluggable tool.
   * @param {string} name - Unique tool identifier.
   * @param {string[]} keywords - Keywords trigger list.
   * @param {function} executeFn - Async execution logic.
   */
  register(name, keywords, executeFn) {
    this.tools.set(name, { keywords, executeFn });
  }

  /**
   * Matches keywords in user query to find a tool.
   * @param {string} query - User input string.
   * @returns {string|null} Matched tool name.
   */
  match(query) {
    const q = query.toLowerCase();
    for (const [name, tool] of this.tools.entries()) {
      if (tool.keywords.some(kw => q.includes(kw))) {
        return name;
      }
    }
    return null;
  }

  /**
   * Executes a matched tool.
   * @param {string} name - Tool name.
   * @param {string} userId - User UID.
   * @param {object} params - Dynamic execution parameters.
   * @returns {Promise<any>} Execution output.
   */
  async execute(name, userId, params = {}) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return await tool.executeFn(userId, params);
  }
}
