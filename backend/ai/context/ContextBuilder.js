export default class ContextBuilder {
  /**
   * Filters and normalizes user database records based on intent and required data sources.
   * @param {object} fullDb - The full readDb() output.
   * @param {string[]} requiredSources - The list of sources to include.
   * @returns {object} Filtered context subset.
   */
  static build(fullDb, requiredSources = []) {
    if (!fullDb) return {};
    
    // Always include profile for basic user personalization
    const context = {
      profile: {
        name: fullDb.profile?.name || 'Sai',
        height: fullDb.profile?.height,
        weight: fullDb.profile?.weight,
        bloodType: fullDb.profile?.bloodType,
        allergies: fullDb.profile?.allergies,
        conditions: fullDb.profile?.conditions
      }
    };

    if (!requiredSources || requiredSources.length === 0) {
      return context;
    }

    requiredSources.forEach(source => {
      if (source.endsWith('_logs') && Array.isArray(fullDb[source])) {
        // Limit log entries to last 7 items to save token context
        context[source] = fullDb[source].slice(-7);
      } else if (fullDb[source] !== undefined) {
        context[source] = fullDb[source];
      }
    });

    if (requiredSources.includes('health')) {
      context.health = {
        goals: fullDb.goals,
        sleep: fullDb.sleep_logs?.slice(-7),
        steps: fullDb.step_logs?.slice(-7),
        water: fullDb.water_logs?.slice(-7),
        heartRate: fullDb.heart_rate_logs?.slice(-7),
        workouts: fullDb.workout_logs?.slice(-7)
      };
    }

    return context;
  }
}
