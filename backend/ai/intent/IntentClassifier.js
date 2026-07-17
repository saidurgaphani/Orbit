export default class IntentClassifier {
  constructor(aiProvider) {
    this.aiProvider = aiProvider;
    this.categories = [
      'MORNING_BRIEF',
      'HEALTH_ANALYSIS',
      'DOCUMENT_QUERY',
      'DOCUMENT_EXTRACT',
      'FINANCIAL_DECISION',
      'FINANCIAL_ANALYSIS',
      'GOAL_GENERATION',
      'GOAL_ANALYSIS',
      'SCAM_ANALYSIS',
      'GENERAL_QUERY'
    ];
  }

  async classify(query, contextHint = '') {
    const lowerQuery = query.toLowerCase();
    const lowerHint = (contextHint || '').toLowerCase();

    // Establish deterministic fallbacks based on query keywords
    let heuristicIntent = null;
    let required_sources = [];
    let requires_rag = false;

    if (lowerQuery.includes('scam') || lowerQuery.includes('phish') || lowerQuery.includes('block') || lowerQuery.includes('urgent') || lowerHint.includes('scam')) {
      heuristicIntent = 'SCAM_ANALYSIS';
      required_sources = ['security'];
    } else if (lowerQuery.includes('buy') || lowerQuery.includes('afford') || lowerQuery.includes('cost') || lowerQuery.includes('price') || lowerQuery.includes('laptop') || lowerHint.includes('decision')) {
      heuristicIntent = 'FINANCIAL_DECISION';
      required_sources = ['finance', 'goals'];
    } else if (lowerQuery.includes('expense') || lowerQuery.includes('budget') || lowerQuery.includes('spending') || lowerQuery.includes('saving') || lowerHint.includes('finance')) {
      heuristicIntent = 'FINANCIAL_ANALYSIS';
      required_sources = ['finance'];
    } else if (lowerQuery.includes('sleep') || lowerQuery.includes('step') || lowerQuery.includes('hydration') || lowerQuery.includes('water') || lowerQuery.includes('heart') || lowerQuery.includes('health') || lowerHint.includes('health')) {
      heuristicIntent = 'HEALTH_ANALYSIS';
      required_sources = ['profile', 'goals', 'sleep_logs', 'step_logs', 'heart_rate_logs', 'workout_logs', 'weight_logs', 'water_logs'];
    } else if (lowerQuery.includes('insurance') || lowerQuery.includes('passport') || lowerQuery.includes('document') || lowerQuery.includes('pdf') || lowerHint.includes('doc')) {
      heuristicIntent = 'DOCUMENT_QUERY';
      required_sources = ['documents'];
      requires_rag = true;
    } else if (lowerQuery.includes('goal') || lowerQuery.includes('habit') || lowerQuery.includes('achieve') || lowerHint.includes('goal')) {
      heuristicIntent = 'GOAL_ANALYSIS';
      required_sources = ['goals'];
    }

    const systemInstruction = `You are an AI Intent Classifier for EVA (Everyday Virtual Assistant).
Your job is to classify the user's input query into exactly one of the following intents:
- MORNING_BRIEF: User wants a daily brief or dashboard update.
- HEALTH_ANALYSIS: Queries about sleep, steps, water, workouts, or physiological data.
- DOCUMENT_QUERY: Questions asking to retrieve information or verify details from documents (RAG).
- DOCUMENT_EXTRACT: Processing a newly uploaded document or OCR extraction.
- FINANCIAL_DECISION: Evaluating if the user can afford a purchase, comparing pricing against budgets.
- FINANCIAL_ANALYSIS: Inquiries about spending habits, budget breakdowns, or categories.
- GOAL_GENERATION: Prompting to create a new goal roadmap or milestone timeline.
- GOAL_ANALYSIS: Assessing progress on habits, goal timelines, or consistency.
- SCAM_ANALYSIS: Analyzing messages, links, screenshots, or emails for potential scams.
- GENERAL_QUERY: General chit-chat or assistance.

Return a JSON object conforming exactly to this schema:
{
  "intent": "one of the intent names above",
  "confidence": 0.0 to 1.0,
  "required_sources": ["array of database sources to load: profile, goals, finance, documents, security, sleep_logs, step_logs, heart_rate_logs, workout_logs, weight_logs, water_logs, learning"],
  "requires_rag": true/false
}`;

    const prompt = `User query: "${query}"
Context hint: "${contextHint}"`;

    try {
      const response = await this.aiProvider.generateStructured(prompt, systemInstruction);
      if (response && response.intent && this.categories.includes(response.intent)) {
        return {
          intent: response.intent,
          confidence: response.confidence ?? 0.9,
          required_sources: response.required_sources ?? required_sources,
          requires_rag: response.requires_rag ?? requires_rag
        };
      }
    } catch (err) {
      console.warn('AI Intent Classification failed, falling back to heuristics:', err.message);
    }

    return {
      intent: heuristicIntent || 'GENERAL_QUERY',
      confidence: 0.7,
      required_sources: required_sources.length ? required_sources : ['profile'],
      requires_rag: requires_rag
    };
  }
}
