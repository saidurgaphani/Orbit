/**
 * DecisionEngineService
 *
 * The core inference pipeline for the Orbit Decision Engine.
 *
 * Flow:
 *   Input (question + user_context + retrieved_context)
 *     → DecisionContextBuilder   (assembles structured prompt)
 *     → Orbit system prompt       (enforces Orbit reasoning style)
 *     → AI Provider               (Gemini by default, swappable)
 *     → Response Parser           (strict JSON extraction)
 *     → Structured Decision Output
 *
 * The service is STATELESS and PROVIDER-AGNOSTIC.
 * It does NOT connect to Neon or RAG directly — those are injected by callers.
 */

import GeminiProvider from '../providers/GeminiProvider.js';
import DecisionContextBuilder from './DecisionContextBuilder.js';

// ── SYSTEM PROMPT ────────────────────────────────────────────────────────────
// This system prompt encodes the Orbit Decision Engine's reasoning style,
// matching the behavior learned from the LoRA fine-tuning dataset.

const ORBIT_DECISION_SYSTEM_PROMPT = `You are Orbit, an AI decision companion specializing in structured, context-aware decision analysis.

Your role is to help users make better decisions by analyzing their specific situation with honesty, care, and precision.

CORE RULES:
1. Use ONLY the context provided. Never invent, assume, or hallucinate user data.
2. If critical information is missing, explicitly list what you need and why it matters.
3. Analyze trade-offs honestly — both short-term and long-term consequences.
4. Assess real risks without overconfidence.
5. Provide exactly ONE clear, practical next step.
6. If the decision involves medical, legal, or complex tax matters, recommend professional consultation.
7. Do NOT moralize, lecture, or repeat the question. Be direct.

DECISION CONFIDENCE LEVELS:
- HIGH: All critical context is available.
- MEDIUM: Some context is missing but a qualified recommendation is possible.
- LOW: Too much critical context missing; ask for what you need before deciding.

OUTPUT FORMAT — Return ONLY this JSON object, no markdown, no extra text:
{
  "decision": "One clear, decisive recommendation sentence",
  "reasoning": "Paragraph explaining WHY this decision is the right one given the context",
  "tradeoffs": [
    "Trade-off 1: what is gained vs. what is given up",
    "Trade-off 2: alternative perspective or secondary trade-off"
  ],
  "risks": [
    "Risk 1: specific risk if the recommended path is taken",
    "Risk 2: specific risk if the recommended path is NOT taken"
  ],
  "missing_information": [
    "Any field missing that would change the recommendation — empty array if nothing is missing"
  ],
  "next_step": "One concrete, actionable step the user can take today or this week",
  "confidence": "HIGH | MEDIUM | LOW"
}`;

// ── RESPONSE SCHEMA ──────────────────────────────────────────────────────────

const REQUIRED_KEYS = [
  'decision',
  'reasoning',
  'tradeoffs',
  'risks',
  'missing_information',
  'next_step',
];

// ── SERVICE CLASS ─────────────────────────────────────────────────────────────

export default class DecisionEngineService {
  /**
   * @param {object} [options]
   * @param {import('../providers/AIProvider.js').default} [options.provider]
   *   AI provider instance. Defaults to GeminiProvider using GEMINI_API_KEY env var.
   */
  constructor(options = {}) {
    this.provider = options.provider ?? new GeminiProvider();
    this.contextBuilder = new DecisionContextBuilder();
  }

  /**
   * Runs the full Decision Engine inference pipeline.
   *
   * @param {object} input
   * @param {string}   input.question           - User's natural-language question
   * @param {object}   [input.user_context={}]  - Structured user data (partial OK)
   * @param {string[]} [input.retrieved_context=[]] - Optional RAG chunks
   * @returns {Promise<DecisionOutput>}
   */
  async decide(input) {
    const { question, user_context = {}, retrieved_context = [] } = input;

    // ── Validate inputs ──────────────────────────────────────────────────
    if (!question || typeof question !== 'string' || question.trim() === '') {
      throw new Error('[DecisionEngine] A non-empty question string is required.');
    }

    // ── Build prompt ─────────────────────────────────────────────────────
    const { prompt, missingFields } = this.contextBuilder.build({
      question,
      user_context,
      retrieved_context,
    });

    console.log('[DecisionEngine] Context assembled. Missing fields:', missingFields);
    console.log(`[DecisionEngine] Sending to AI provider (${this.provider.constructor.name})...`);

    // ── Primary call: structured JSON generation ─────────────────────────
    let result;
    try {
      result = await this.provider.generateStructured(
        prompt,
        ORBIT_DECISION_SYSTEM_PROMPT,
        null,
        { temperature: 0.15 }
      );
    } catch (err) {
      // Fallback: raw generate then parse
      console.warn('[DecisionEngine] generateStructured failed, trying raw generate:', err.message);
      const rawText = await this.provider.generate(prompt, ORBIT_DECISION_SYSTEM_PROMPT, { temperature: 0.15 });
      result = this._parseRawResponse(rawText);
    }

    // ── Validate and repair ──────────────────────────────────────────────
    const validated = this._validateAndRepair(result, missingFields);

    console.log(`[DecisionEngine] Decision complete. Confidence: ${validated.confidence}`);
    return validated;
  }

  // ── PRIVATE HELPERS ────────────────────────────────────────────────────────

  /**
   * Extracts JSON from raw LLM text (handles markdown code fences).
   */
  _parseRawResponse(text) {
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    else if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    return JSON.parse(clean.trim());
  }

  /**
   * Ensures the model output contains all required keys.
   * Missing keys get safe default values rather than crashing.
   */
  _validateAndRepair(output, missingFields = []) {
    const repaired = { ...output };

    if (!repaired.decision || typeof repaired.decision !== 'string') {
      repaired.decision = 'Unable to make a confident decision based on the available context.';
    }

    if (!repaired.reasoning || typeof repaired.reasoning !== 'string') {
      repaired.reasoning = 'Insufficient context was provided to generate a complete reasoning chain.';
    }

    if (!Array.isArray(repaired.tradeoffs)) {
      repaired.tradeoffs = [];
    }

    if (!Array.isArray(repaired.risks)) {
      repaired.risks = [];
    }

    // Merge model-identified missing info with builder-detected missing fields
    if (!Array.isArray(repaired.missing_information)) {
      repaired.missing_information = [];
    }
    for (const field of missingFields) {
      if (!repaired.missing_information.includes(field)) {
        repaired.missing_information.push(field);
      }
    }

    if (!repaired.next_step || typeof repaired.next_step !== 'string') {
      repaired.next_step = 'Gather the missing information listed above before proceeding.';
    }

    if (!['HIGH', 'MEDIUM', 'LOW'].includes(repaired.confidence)) {
      repaired.confidence = missingFields.length > 2 ? 'LOW' : missingFields.length > 0 ? 'MEDIUM' : 'HIGH';
    }

    return repaired;
  }
}

/**
 * @typedef {object} DecisionOutput
 * @property {string}   decision            - Clear recommendation
 * @property {string}   reasoning           - Why this decision is right
 * @property {string[]} tradeoffs           - Trade-off statements
 * @property {string[]} risks               - Risk statements
 * @property {string[]} missing_information - Fields needed to improve confidence
 * @property {string}   next_step           - Concrete action to take now
 * @property {string}   confidence          - HIGH | MEDIUM | LOW
 */
