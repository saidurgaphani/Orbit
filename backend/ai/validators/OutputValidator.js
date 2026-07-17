export default class OutputValidator {
  /**
   * Validates structured outputs against expected model response fields.
   * @param {string} intent - The classified intent.
   * @param {object} parsedJSON - The JSON returned by the model.
   * @returns {object} { valid: boolean, errors: string[] }
   */
  static validate(intent, parsedJSON) {
    if (!parsedJSON || typeof parsedJSON !== 'object') {
      return { valid: false, errors: ['Output is not a valid JSON object.'] };
    }

    const errors = [];

    switch (intent) {
      case 'SCAM_ANALYSIS':
        if (parsedJSON.score === undefined) errors.push('Missing key: "score"');
        if (parsedJSON.summary === undefined) errors.push('Missing key: "summary"');
        if (!Array.isArray(parsedJSON.reasons)) errors.push('Missing or invalid key: "reasons" (must be array)');
        if (!Array.isArray(parsedJSON.actions)) errors.push('Missing or invalid key: "actions" (must be array)');
        break;

      case 'FINANCIAL_DECISION':
        if (parsedJSON.score === undefined) errors.push('Missing key: "score"');
        if (parsedJSON.summary === undefined) errors.push('Missing key: "summary"');
        if (!Array.isArray(parsedJSON.reasons)) errors.push('Missing or invalid key: "reasons" (must be array)');
        if (!Array.isArray(parsedJSON.actions)) errors.push('Missing or invalid key: "actions" (must be array)');
        break;

      case 'FINANCIAL_ANALYSIS':
        if (parsedJSON.summary === undefined) errors.push('Missing key: "summary"');
        if (!Array.isArray(parsedJSON.actions)) errors.push('Missing or invalid key: "actions" (must be array)');
        break;

      case 'HEALTH_ANALYSIS':
        if (parsedJSON.score === undefined) errors.push('Missing key: "score"');
        if (parsedJSON.summary === undefined) errors.push('Missing key: "summary"');
        if (!Array.isArray(parsedJSON.reasons)) errors.push('Missing or invalid key: "reasons" (must be array)');
        if (!Array.isArray(parsedJSON.actions)) errors.push('Missing or invalid key: "actions" (must be array)');
        break;

      case 'GOAL_GENERATION':
        if (!parsedJSON.goal_title) errors.push('Missing key: "goal_title"');
        if (!parsedJSON.category) errors.push('Missing key: "category"');
        if (!Array.isArray(parsedJSON.milestones)) errors.push('Missing or invalid key: "milestones" (must be array)');
        if (!Array.isArray(parsedJSON.habits)) errors.push('Missing or invalid key: "habits" (must be array)');
        break;

      case 'MORNING_BRIEF':
        if (parsedJSON.greeting === undefined) errors.push('Missing key: "greeting"');
        if (parsedJSON.summary === undefined) errors.push('Missing key: "summary"');
        if (!Array.isArray(parsedJSON.priorities)) errors.push('Missing or invalid key: "priorities" (must be array)');
        if (!Array.isArray(parsedJSON.recommendations)) errors.push('Missing or invalid key: "recommendations" (must be array)');
        break;

      default:
        if (parsedJSON.summary === undefined && parsedJSON.text === undefined && parsedJSON.message === undefined) {
          errors.push('Missing key: "summary" or "message"');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
