/**
 * DecisionContextBuilder
 *
 * Assembles a clean, structured prompt block for the Orbit Decision Engine.
 * It accepts:
 *   - question         : The user's natural-language question
 *   - user_context     : Structured financial/personal context (from SQL or client)
 *   - retrieved_context: Optional RAG document snippets
 *
 * It does NOT invent any data. Missing fields are marked explicitly so the
 * model knows what information is absent.
 */

export default class DecisionContextBuilder {
  /**
   * Builds the full prompt sent to the Decision Engine.
   * @param {object} params
   * @param {string}   params.question          - The user's question
   * @param {object}   params.user_context       - Structured user data (may be partial)
   * @param {string[]} params.retrieved_context  - Optional RAG chunks (default [])
   * @returns {{ prompt: string, missingFields: string[] }}
   */
  build({ question, user_context = {}, retrieved_context = [] }) {
    const missingFields = [];
    const lines = [];

    // ── FINANCIAL CONTEXT ──────────────────────────────────────────────────
    lines.push('=== USER FINANCIAL CONTEXT ===');

    const financialFields = [
      { key: 'monthly_income',    label: 'Monthly Income' },
      { key: 'monthly_expenses',  label: 'Monthly Expenses' },
      { key: 'current_savings',   label: 'Current Savings' },
      { key: 'upcoming_expenses', label: 'Upcoming Expenses (next 3 months)' },
    ];

    for (const { key, label } of financialFields) {
      if (user_context[key] !== undefined && user_context[key] !== null) {
        lines.push(`${label}: ${this._formatCurrency(user_context[key])}`);
      } else {
        lines.push(`${label}: [NOT PROVIDED]`);
        missingFields.push(label);
      }
    }

    // ── DERIVED METRICS (only when both income and expenses are available) ──
    if (user_context.monthly_income != null && user_context.monthly_expenses != null) {
      const surplus = user_context.monthly_income - user_context.monthly_expenses;
      lines.push(`Monthly Surplus: ${this._formatCurrency(surplus)}`);
    }

    // ── FINANCIAL GOALS ────────────────────────────────────────────────────
    if (Array.isArray(user_context.financial_goals) && user_context.financial_goals.length > 0) {
      lines.push(`Financial Goals: ${user_context.financial_goals.join(', ')}`);
    } else if (user_context.financial_goals !== undefined) {
      lines.push('Financial Goals: [NOT PROVIDED]');
      missingFields.push('Financial Goals');
    }

    // ── CAREER CONTEXT (optional) ──────────────────────────────────────────
    if (user_context.job_title || user_context.industry || user_context.years_experience) {
      lines.push('\n=== USER CAREER CONTEXT ===');
      if (user_context.job_title)        lines.push(`Job Title: ${user_context.job_title}`);
      if (user_context.industry)         lines.push(`Industry: ${user_context.industry}`);
      if (user_context.years_experience !== undefined) lines.push(`Years of Experience: ${user_context.years_experience}`);
    }

    // ── HEALTH / LIFESTYLE CONTEXT (optional) ──────────────────────────────
    if (user_context.activity_level || user_context.health_conditions || user_context.fitness_goals) {
      lines.push('\n=== USER HEALTH CONTEXT ===');
      if (user_context.activity_level)   lines.push(`Activity Level: ${user_context.activity_level}`);
      if (user_context.health_conditions) lines.push(`Health Conditions: ${user_context.health_conditions}`);
      if (user_context.fitness_goals)    lines.push(`Fitness Goals: ${user_context.fitness_goals}`);
    }

    // ── RELEVANT AI MEMORIES (optional) ──────────────────────────────────────
    if (Array.isArray(user_context.relevant_memories) && user_context.relevant_memories.length > 0) {
      lines.push('\n=== RELEVANT AI MEMORIES ===');
      for (const mem of user_context.relevant_memories) {
        lines.push(`- ${mem}`);
      }
    }

    // ── EXTRA CONTEXT (arbitrary key-values passed by caller) ──────────────
    const knownKeys = new Set([
      'monthly_income', 'monthly_expenses', 'current_savings', 'upcoming_expenses',
      'financial_goals', 'job_title', 'industry', 'years_experience',
      'activity_level', 'health_conditions', 'fitness_goals', 'relevant_memories'
    ]);
    const extraKeys = Object.keys(user_context).filter(k => !knownKeys.has(k));
    if (extraKeys.length > 0) {
      lines.push('\n=== ADDITIONAL CONTEXT ===');
      for (const k of extraKeys) {
        lines.push(`${k}: ${JSON.stringify(user_context[k])}`);
      }
    }

    // ── DOCUMENT CONTEXT (RAG) ─────────────────────────────────────────────
    if (Array.isArray(retrieved_context) && retrieved_context.length > 0) {
      lines.push('\n=== RELEVANT DOCUMENT EXCERPTS ===');
      retrieved_context.forEach((chunk, i) => {
        lines.push(`[Document ${i + 1}]`);
        lines.push(typeof chunk === 'string' ? chunk : JSON.stringify(chunk));
      });
    } else {
      lines.push('\n=== RELEVANT DOCUMENT EXCERPTS ===');
      lines.push('[No document context provided]');
    }

    // ── USER QUESTION ──────────────────────────────────────────────────────
    lines.push('\n=== USER QUESTION ===');
    lines.push(question);

    return {
      prompt: lines.join('\n'),
      missingFields,
    };
  }

  _formatCurrency(value) {
    if (typeof value !== 'number') return String(value);
    // Format as Indian currency style with commas
    return '₹' + value.toLocaleString('en-IN');
  }
}
