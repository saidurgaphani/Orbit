/**
 * DecisionOrchestrator
 * 
 * Exposes the final, unified orchestration layer for Orbit's Decision Engine.
 * Coordinates:
 *   1. Question category classification (Intent detection)
 *   2. SQL context retrieval (Neon DB)
 *   3. RAG context retrieval (pgvector matching with threshold filter)
 *   4. Context building & merging
 *   5. Decision Engine inference execution
 *   6. Response verification
 * 
 * Logging is strictly controlled to protect user privacy (no PII or document text).
 */

import DecisionContextBuilderService from './DecisionContextBuilderService.js';
import DecisionEngineService from './DecisionEngineService.js';
import RAGService from '../context/RAGService.js';
import GeminiProvider from '../providers/GeminiProvider.js';
import MemoryService from '../memory/MemoryService.js';

export default class DecisionOrchestrator {
  /**
   * @param {object} [options]
   * @param {import('../providers/AIProvider.js').default} [options.provider]
   *   AI provider instance. Defaults to GeminiProvider.
   */
  constructor(options = {}) {
    this.provider = options.provider ?? new GeminiProvider();
    this.contextBuilder = new DecisionContextBuilderService();
    this.engine = new DecisionEngineService({ provider: this.provider });
    this.ragService = new RAGService(this.provider);
    this.memoryService = new MemoryService({ provider: this.provider });
  }

  /**
   * Analyzes a decision question using user context from SQL and unstructured files from RAG.
   * 
   * @param {string} userId - Firebase UID of the authenticated user.
   * @param {string} question - Question to evaluate.
   * @param {object} [options] - Options (threshold, limit).
   * @returns {Promise<object>} Clean, formatted, structured decision response.
   */
  async analyzeDecision(userId, question, options = {}) {
    const LOG = '[DecisionOrchestrator]';
    if (!userId) throw new Error(`${LOG} userId is required`);
    if (!question || typeof question !== 'string' || question.trim() === '') {
      throw new Error(`${LOG} A non-empty question is required`);
    }

    const cleanQuestion = question.trim();

    // ── 1. Category Classification & Neon DB Context Retrieval ────────────────
    const decisionContext = await this.contextBuilder.buildDecisionContext(userId, cleanQuestion);
    const category = decisionContext.decision_category;

    // Count SQL records retrieved for clean metadata metrics logging
    const numExpenses = decisionContext.relevant_records?.length || 0;
    const numGoals = decisionContext.goals?.length || 0;
    const numHabits = decisionContext.habits?.length || 0;
    const numHealth = decisionContext.health?.records_count || 0;
    const totalSqlRecords = numExpenses + numGoals + numHabits + numHealth;

    // ── 2. User-Specific RAG Context Retrieval ────────────────────────────────
    let ragChunks = [];
    try {
      ragChunks = await this.ragService.retrieveRelevantContext(userId, cleanQuestion, {
        threshold: options.threshold ?? 0.70,
        limit: options.limit ?? 3
      });
    } catch (ragErr) {
      console.warn(`${LOG} RAG context retrieval failed (non-fatal fallback):`, ragErr.message);
    }

    // ── 2b. User-Specific AI Memories Context Retrieval ───────────────────────
    let relevantMemories = [];
    try {
      relevantMemories = await this.memoryService.retrieveRelevantMemories(userId, cleanQuestion);
    } catch (memErr) {
      console.warn(`${LOG} Memory context retrieval failed (non-fatal):`, memErr.message);
    }

    // ── 3. Merging and Preparing Context ──────────────────────────────────────
    const fc = decisionContext.financial_context;
    const mergedUserContext = {
      monthly_income:       fc.monthly_income,
      monthly_expenses:     fc.monthly_expenses,
      current_savings:      fc.current_savings,
      upcoming_expenses:    null,
      monthly_budget:       fc.monthly_budget,
      spending_by_category: fc.spending_by_category,
      financial_goals: Array.isArray(decisionContext.goals)
        ? decisionContext.goals.map(g => `${g.title} (${g.progress_pct}% done)`)
        : [],
      relevant_memories: relevantMemories.map(m => m.content),
      ...(decisionContext.health ? {
        avg_steps:         decisionContext.health.avg_steps,
        avg_sleep_minutes: decisionContext.health.avg_sleep_minutes,
        avg_heart_rate:    decisionContext.health.avg_heart_rate,
      } : {}),
    };

    // ── 4. Logging Operations (PII-Safe) ──────────────────────────────────────
    const activeDataSources = [];
    if (decisionContext.data_availability?.has_income) activeDataSources.push('users.profileData.finance');
    if (decisionContext.data_availability?.has_expense_records) activeDataSources.push('expenses');
    if (decisionContext.data_availability?.has_goals) activeDataSources.push('goals');
    if (decisionContext.data_availability?.has_health_records) activeDataSources.push('health_records');
    if (decisionContext.data_availability?.has_habits) activeDataSources.push('habits');
    if (ragChunks.length > 0) activeDataSources.push('RAG (document_chunks)');
    if (relevantMemories.length > 0) activeDataSources.push('AI Memories');

    console.log(`${LOG} Processing Question: "${cleanQuestion.substring(0, 60)}..."`);
    console.log(`${LOG} Decision Category:    ${category}`);
    console.log(`${LOG} Data Sources Used:     ${activeDataSources.join(', ') || 'none (default profile)'}`);
    console.log(`${LOG} SQL Records Fetched:   ${totalSqlRecords}`);
    console.log(`${LOG} RAG Chunks Fetched:    ${ragChunks.length}`);
    console.log(`${LOG} AI Memories Loaded:   ${relevantMemories.length}`);

    // ── 5. AI Inference Execution ─────────────────────────────────────────────
    let result;
    try {
      result = await this.engine.decide({
        question: cleanQuestion,
        user_context: mergedUserContext,
        retrieved_context: ragChunks
      });
      console.log(`${LOG} AI Response Status:   SUCCESS (Confidence: ${result.confidence})`);
    } catch (aiErr) {
      console.error(`${LOG} AI Response Status:   FAILED (${aiErr.message})`);
      throw aiErr;
    }

    // ── 6. Response Validation ───────────────────────────────────────────────
    const REQUIRED_KEYS = ['decision', 'reasoning', 'tradeoffs', 'risks', 'missing_information', 'next_step'];
    const missingKeys = REQUIRED_KEYS.filter(k => !(k in result));
    if (missingKeys.length > 0) {
      console.error(`${LOG} AI response validation failed. Missing keys:`, missingKeys);
      throw new Error(`[DecisionOrchestrator] AI output schema violation. Missing keys: ${missingKeys.join(', ')}`);
    }

    // ── 7. Return Clean Structured Result ─────────────────────────────────────
    return {
      success: true,
      decision:             result.decision,
      reasoning:            result.reasoning,
      tradeoffs:            Array.isArray(result.tradeoffs) ? result.tradeoffs : [],
      risks:                Array.isArray(result.risks) ? result.risks : [],
      missing_information:  Array.isArray(result.missing_information) ? result.missing_information : [],
      next_step:            result.next_step,
      confidence:           result.confidence ?? 'MEDIUM',
      context_summary: {
        category,
        data_available: decisionContext.data_availability,
        structured_records_used: totalSqlRecords,
        rag_chunks_used: ragChunks.length
      }
    };

  }
}
