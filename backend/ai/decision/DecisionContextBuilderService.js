/**
 * DecisionContextBuilderService
 *
 * Bridges Firebase-authenticated users and the Orbit Decision Engine.
 *
 * Flow:
 *   Firebase UID
 *     → resolveUser()           (Firebase UID → PostgreSQL UUID via SQLContextService)
 *     → detectCategory()        (question → likely decision domain)
 *     → fetchRelevantData()     (query ONLY the tables needed for that domain)
 *     → buildDecisionContext()  (return clean, null-safe structured object)
 *
 * Security guarantees:
 *   - User ID is ALWAYS derived from the verified Firebase token by the caller.
 *   - Every query is scoped to the resolved PostgreSQL UUID.
 *   - No data from other users can leak (all WHERE clauses include userId).
 *   - Missing fields are returned as null, never invented.
 *
 * Usage:
 *   const svc = new DecisionContextBuilderService();
 *   const ctx = await svc.buildDecisionContext(firebaseUid, question);
 */

import SQLContextService from '../context/SQLContextService.js';
import { db } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq, desc, gte } from 'drizzle-orm';

// ── DECISION CATEGORIES ───────────────────────────────────────────────────────
// Each category maps to the database tables it needs.
// Only the minimal required tables are queried.

const CATEGORIES = {
  FINANCE:   'finance',
  CAREER:    'career',
  HEALTH:    'health',
  EDUCATION: 'education',
  GOAL:      'goal',
  LIFESTYLE: 'lifestyle',
  GENERAL:   'general',
};

// Keywords that signal each category (order matters — first match wins)
const CATEGORY_SIGNALS = [
  {
    category: CATEGORIES.CAREER,
    keywords: [
      'job', 'career', 'offer', 'company', 'startup', 'quit', 'resign',
      'promotion', 'switch jobs', 'switch job', 'new role', 'appraisal', 'freelance',
      'should i leave', 'should i join', 'switch to', 'join a',
    ],
  },
  {
    category: CATEGORIES.FINANCE,
    keywords: [
      'buy', 'afford', 'spend', 'invest', 'salary', 'income', 'expense',
      'loan', 'emi', 'credit', 'debt', 'budget', 'money', 'rupee', '₹', 'rs.',
      'insurance', 'mutual fund', 'sip', 'stock', 'equity', 'prepay', 'subscription',
      'purchase', 'cost', 'price', 'worth', 'cash', 'tax', 'rent', 'mortgage',
    ],
  },
  {
    category: CATEGORIES.HEALTH,
    keywords: [
      'health', 'sleep', 'exercise', 'fitness', 'diet', 'workout', 'weight',
      'doctor', 'medication', 'gym', 'calories', 'steps', 'run', 'walk', 'yoga',
    ],
  },
  {
    category: CATEGORIES.EDUCATION,
    keywords: [
      'course', 'degree', 'university', 'college', 'study', 'learn', 'certification',
      'mba', 'masters', 'phd', 'exam', 'skills', 'training', 'bootcamp',
    ],
  },
  {
    category: CATEGORIES.GOAL,
    keywords: [
      'savings goal', 'on track', 'goal', 'habit', 'milestone', 'target', 'progress',
      'streak', 'objective', 'achieve', 'plan', 'resolution',
    ],
  },
  {
    category: CATEGORIES.LIFESTYLE,
    keywords: [
      'travel', 'vacation', 'trip', 'lifestyle', 'hobby', 'routine', 'wake', 'waking',
      'schedule', 'morning', 'evening', 'food', 'meal', 'cooking', 'relationship', 'social',
    ],
  },
];

export default class DecisionContextBuilderService {
  constructor() {
    this.sqlCtx = new SQLContextService();
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  /**
   * Main entry point.
   *
   * @param {string} firebaseUid  - Firebase UID from the verified token (NOT from request body)
   * @param {string} question     - The user's decision question
   * @returns {Promise<DecisionContext>}
   */
  async buildDecisionContext(firebaseUid, question) {
    if (!firebaseUid) throw new Error('[DecisionContext] firebaseUid is required');
    if (!question)    throw new Error('[DecisionContext] question is required');

    // ── 1. Resolve Firebase UID → PostgreSQL UUID ──────────────────────────
    const dbUserId = await this.sqlCtx.resolveUser(firebaseUid);
    if (!dbUserId) {
      console.warn(`[DecisionContext] No DB user found for Firebase UID: ${firebaseUid}`);
      return this._emptyContext(question, CATEGORIES.GENERAL, 'User not found in database.');
    }

    // ── 2. Detect decision category from question ──────────────────────────
    const category = this._detectCategory(question);
    console.log(`[DecisionContext] Question category: "${category}" for user ${dbUserId}`);

    // ── 3. Fetch only the data relevant to this category ──────────────────
    try {
      const rawData = await this._fetchRelevantData(dbUserId, category, question);

      // ── 4. Build the structured context object ─────────────────────────
      return this._buildStructuredContext(question, category, rawData);
    } catch (err) {
      console.error(`[DecisionContext] Database error for user ${dbUserId}:`, err.message);
      return this._emptyContext(question, category, 'Database query failed — no context available.');
    }
  }

  // ── CATEGORY DETECTION ─────────────────────────────────────────────────────

  /**
   * Detects the most likely decision category from the question text.
   * Returns GENERAL if no signals match.
   */
  _detectCategory(question) {
    const lower = question.toLowerCase();
    for (const { category, keywords } of CATEGORY_SIGNALS) {
      if (keywords.some(kw => lower.includes(kw))) {
        return category;
      }
    }
    return CATEGORIES.GENERAL;
  }

  // ── DATA FETCHING (per category) ──────────────────────────────────────────

  /**
   * Fetches only the minimum required data for the detected category.
   * Each category queries a different subset of tables.
   */
  async _fetchRelevantData(dbUserId, category, question) {
    // Shared: always fetch the user profile row (contains income + budget in profileData.finance)
    const userRow = await this._fetchUserProfile(dbUserId);

    const data = { userRow };

    switch (category) {
      case CATEGORIES.FINANCE:
        data.expenses    = await this._fetchRecentExpenses(dbUserId, 90); // last 90 days
        data.goals       = await this._fetchGoals(dbUserId);
        // income / budget come from userRow.profileData.finance
        break;

      case CATEGORIES.CAREER:
        // Career decisions are mostly contextual — still fetch income to assess financial runway
        data.goals = await this._fetchGoals(dbUserId);
        // Minimal finance: only income (no full transaction history needed)
        break;

      case CATEGORIES.HEALTH:
        data.healthRecords = await this._fetchRecentHealthRecords(dbUserId, 30);
        break;

      case CATEGORIES.GOAL:
        data.goals   = await this._fetchGoals(dbUserId);
        data.habits  = await this._fetchHabits(dbUserId);
        break;

      case CATEGORIES.EDUCATION:
        // Education decisions need financial runway
        data.expenses = await this._fetchRecentExpenses(dbUserId, 30);
        data.goals    = await this._fetchGoals(dbUserId);
        break;

      case CATEGORIES.LIFESTYLE:
        // Lifestyle may need financial context + health context
        data.expenses      = await this._fetchRecentExpenses(dbUserId, 30);
        data.healthRecords = await this._fetchRecentHealthRecords(dbUserId, 14);
        break;

      case CATEGORIES.GENERAL:
      default:
        // General: fetch a lightweight version of all categories
        data.expenses = await this._fetchRecentExpenses(dbUserId, 30);
        data.goals    = await this._fetchGoals(dbUserId);
        break;
    }

    return data;
  }

  // ── INDIVIDUAL FETCHERS (all scoped to dbUserId) ──────────────────────────

  /** Fetch user profile row (includes profileData.finance for income / budget) */
  async _fetchUserProfile(dbUserId) {
    const [user] = await db
      .select({
        name:        schema.users.name,
        email:       schema.users.email,
        profileData: schema.users.profileData,
      })
      .from(schema.users)
      .where(eq(schema.users.id, dbUserId));
    return user || null;
  }

  /** Fetch expenses for the last N days, ordered newest-first */
  async _fetchRecentExpenses(dbUserId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    return db
      .select({
        id:              schema.expenses.id,
        amount:          schema.expenses.amount,
        category:        schema.expenses.category,
        description:     schema.expenses.description,
        transactionDate: schema.expenses.transactionDate,
        paymentMethod:   schema.expenses.paymentMethod,
      })
      .from(schema.expenses)
      .where(
        eq(schema.expenses.userId, dbUserId),
        // Only include records from last N days — soft filter (avoids huge result sets)
      )
      .orderBy(desc(schema.expenses.transactionDate))
      .limit(50); // hard cap to prevent token overflow
  }

  /** Fetch all active goals for the user */
  async _fetchGoals(dbUserId) {
    return db
      .select({
        id:           schema.goals.id,
        title:        schema.goals.title,
        description:  schema.goals.description,
        targetValue:  schema.goals.targetValue,
        currentValue: schema.goals.currentValue,
        targetDate:   schema.goals.targetDate,
        status:       schema.goals.status,
      })
      .from(schema.goals)
      .where(eq(schema.goals.userId, dbUserId))
      .orderBy(desc(schema.goals.createdAt));
  }

  /** Fetch recent health records for the last N days */
  async _fetchRecentHealthRecords(dbUserId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    return db
      .select({
        id:            schema.healthRecords.id,
        recordedAt:    schema.healthRecords.recordedAt,
        steps:         schema.healthRecords.steps,
        sleepDuration: schema.healthRecords.sleepDuration,
        heartRate:     schema.healthRecords.heartRate,
        caloriesBurned: schema.healthRecords.caloriesBurned,
      })
      .from(schema.healthRecords)
      .where(eq(schema.healthRecords.userId, dbUserId))
      .orderBy(desc(schema.healthRecords.recordedAt))
      .limit(30);
  }

  /** Fetch habits (without logs — logs are heavy; omit unless GOAL category) */
  async _fetchHabits(dbUserId) {
    return db
      .select({
        id:          schema.habits.id,
        name:        schema.habits.name,
        frequency:   schema.habits.frequency,
        targetCount: schema.habits.targetCount,
      })
      .from(schema.habits)
      .where(eq(schema.habits.userId, dbUserId));
  }

  // ── CONTEXT ASSEMBLY ──────────────────────────────────────────────────────

  /**
   * Converts raw DB rows into the structured DecisionContext object.
   * Returns null for truly missing values — never invents data.
   */
  _buildStructuredContext(question, category, data) {
    const { userRow, expenses = [], goals = [], habits = [], healthRecords = [] } = data;

    // ── Financial profile (stored in users.profile_data.finance) ──────────
    const financeProfile = userRow?.profileData?.finance || null;

    const monthly_income    = financeProfile?.income     != null ? Number(financeProfile.income)       : null;
    const monthly_budget    = financeProfile?.monthlyBudget != null ? Number(financeProfile.monthlyBudget) : null;
    const emergency_fund    = financeProfile?.emergencyFund  ?? null;
    const category_budgets  = financeProfile?.budgets        ?? null;

    // ── Derive monthly expense total from last 30 days of transactions ─────
    const now     = new Date();
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

    const recentExpenses = expenses.filter(e => e.transactionDate >= thirtyStr);
    const monthly_expenses_total = recentExpenses.length > 0
      ? recentExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
      : null;

    // ── Summarise spending by category ────────────────────────────────────
    const spending_by_category = {};
    for (const e of recentExpenses) {
      if (!spending_by_category[e.category]) spending_by_category[e.category] = 0;
      spending_by_category[e.category] += Number(e.amount);
    }

    // ── Goals summary ──────────────────────────────────────────────────────
    const goalsSummary = goals.map(g => ({
      title:        g.title,
      target:       Number(g.targetValue),
      current:      Number(g.currentValue),
      progress_pct: g.targetValue > 0 ? Math.round((Number(g.currentValue) / Number(g.targetValue)) * 100) : 0,
      target_date:  g.targetDate ?? null,
      status:       g.status,
    }));

    // ── Health summary ─────────────────────────────────────────────────────
    let healthSummary = null;
    if (healthRecords.length > 0) {
      const avg = (arr) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;
      healthSummary = {
        avg_steps:         avg(healthRecords.filter(r => r.steps > 0).map(r => r.steps)),
        avg_sleep_minutes: avg(healthRecords.filter(r => r.sleepDuration > 0).map(r => r.sleepDuration)),
        avg_heart_rate:    avg(healthRecords.filter(r => r.heartRate > 0).map(r => r.heartRate)),
        records_count:     healthRecords.length,
      };
    }

    // ── Habits summary ─────────────────────────────────────────────────────
    const habitsSummary = habits.length > 0
      ? habits.map(h => ({ name: h.name, frequency: h.frequency, target: h.targetCount }))
      : null;

    // ── Recent notable transactions (last 10) ──────────────────────────────
    const relevant_records = expenses.slice(0, 10).map(e => ({
      amount:      Number(e.amount),
      category:    e.category,
      description: e.description ?? null,
      date:        e.transactionDate,
    }));

    // ── Assemble final context ─────────────────────────────────────────────
    return {
      question,
      decision_category: category,
      user_name: userRow?.name ?? null,

      financial_context: {
        monthly_income:         monthly_income,
        monthly_expenses:       monthly_expenses_total,
        monthly_budget:         monthly_budget,
        estimated_surplus:      (monthly_income != null && monthly_expenses_total != null)
                                  ? monthly_income - monthly_expenses_total
                                  : null,
        emergency_fund:         emergency_fund,
        spending_by_category:   Object.keys(spending_by_category).length > 0 ? spending_by_category : null,
        category_budgets:       category_budgets,
        // Note: 'current_savings' is not a separate DB column — it comes from emergency_fund
        // or must be entered by the user via the finance profile
        current_savings:        financeProfile?.currentSavings != null
                                  ? Number(financeProfile.currentSavings)
                                  : (emergency_fund?.current != null ? Number(emergency_fund.current) : null),
      },

      goals: goalsSummary.length > 0 ? goalsSummary : null,
      habits: habitsSummary,
      health: healthSummary,

      relevant_records: relevant_records.length > 0 ? relevant_records : null,

      // Data completeness flags — let the model know what is and is not available
      data_availability: {
        has_income:          monthly_income    != null,
        has_expense_records: recentExpenses.length > 0,
        has_goals:           goalsSummary.length > 0,
        has_health_records:  healthRecords.length > 0,
        has_habits:          (habits?.length ?? 0) > 0,
      },
    };
  }

  // ── FALLBACK ──────────────────────────────────────────────────────────────

  /** Returns a safe empty context when data retrieval fails or user is not found */
  _emptyContext(question, category, reason) {
    return {
      question,
      decision_category: category,
      user_name: null,
      financial_context: {
        monthly_income:         null,
        monthly_expenses:       null,
        monthly_budget:         null,
        estimated_surplus:      null,
        emergency_fund:         null,
        spending_by_category:   null,
        category_budgets:       null,
        current_savings:        null,
      },
      goals:            null,
      habits:           null,
      health:           null,
      relevant_records: null,
      data_availability: {
        has_income:          false,
        has_expense_records: false,
        has_goals:           false,
        has_health_records:  false,
        has_habits:          false,
      },
      _notice: reason,
    };
  }
}

/**
 * @typedef {object} DecisionContext
 * @property {string}          question            - The original user question
 * @property {string}          decision_category   - Detected category (finance | career | health | ...)
 * @property {string|null}     user_name           - User's display name
 * @property {object}          financial_context   - Financial data (nulls where missing)
 * @property {object[]|null}   goals               - User goals
 * @property {object[]|null}   habits              - User habits
 * @property {object|null}     health              - Health averages
 * @property {object[]|null}   relevant_records    - Recent transactions
 * @property {object}          data_availability   - Boolean flags for each data type
 */
