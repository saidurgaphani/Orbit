import { db } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm';

export default class SQLContextService {
  /**
   * Resolves a Firebase UID string or direct PostgreSQL UUID to the user's DB UUID.
   * @param {string} userId - Firebase UID or DB UUID.
   * @returns {Promise<string|null>} PostgreSQL DB UUID or null if not found.
   */
  async resolveUser(userId) {
    if (!userId) return null;
    
    // Check if matching firebaseUid
    const userMatch = await db.select().from(schema.users).where(eq(schema.users.firebaseUid, userId));
    if (userMatch.length > 0) {
      return userMatch[0].id;
    }

    // Fallback: If it's a valid UUID v4 string, check if it matches id directly (useful for tests)
    // Uses a strict UUID regex to prevent passing non-UUID strings to the UUID column (which causes a Postgres error)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof userId === 'string' && UUID_REGEX.test(userId)) {
      const idMatch = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (idMatch.length > 0) {
        return idMatch[0].id;
      }
    }

    return null;
  }


  /**
   * Formats a date value (Date object or timestamp string) into YYYY-MM-DD format.
   * @param {Date|string|number} date 
   * @returns {string|null} Date string or null.
   */
  formatDateString(date) {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }

  /**
   * Helper to parse query keywords and options for date filtering.
   * @param {string} query 
   * @param {object} options 
   * @returns {object} Parsed date range and limits.
   */
  parseFilters(query = '', options = {}) {
    const now = new Date();
    let startDate = options.startDate ? this.formatDateString(options.startDate) : null;
    let endDate = options.endDate ? this.formatDateString(options.endDate) : null;
    const limit = options.limit || 15; // default to 15 items to prevent token overflow

    const lowerQuery = (query || '').toLowerCase();

    // If no explicit dates, try to infer from query keywords
    if (!startDate && !endDate) {
      if (lowerQuery.includes('today')) {
        const todayStr = this.formatDateString(now);
        startDate = todayStr;
        endDate = todayStr;
      } else if (lowerQuery.includes('yesterday')) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = this.formatDateString(yesterday);
        startDate = yesterdayStr;
        endDate = yesterdayStr;
      } else if (lowerQuery.includes('last 7 days') || lowerQuery.includes('7 days') || lowerQuery.includes('this week') || lowerQuery.includes('last week')) {
        const past = new Date(now);
        past.setDate(now.getDate() - 7);
        startDate = this.formatDateString(past);
        endDate = this.formatDateString(now);
      } else if (lowerQuery.includes('last 30 days') || lowerQuery.includes('30 days') || lowerQuery.includes('this month') || lowerQuery.includes('last month')) {
        const past = new Date(now);
        past.setDate(now.getDate() - 30);
        startDate = this.formatDateString(past);
        endDate = this.formatDateString(now);
      }
    }

    return { startDate, endDate, limit };
  }

  /**
   * Retrieves structured finance context (expenses, income, budgets, emergency fund).
   */
  async fetchFinanceContext(dbUserId, options = {}) {
    const [user] = await db.select({ profileData: schema.users.profileData }).from(schema.users).where(eq(schema.users.id, dbUserId));
    const financeProfile = user?.profileData?.finance || {};

    const conditions = [eq(schema.expenses.userId, dbUserId)];
    if (options.startDate) {
      conditions.push(gte(schema.expenses.transactionDate, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(schema.expenses.transactionDate, options.endDate));
    }

    const expensesList = await db.select()
      .from(schema.expenses)
      .where(and(...conditions))
      .orderBy(desc(schema.expenses.transactionDate))
      .limit(options.limit || 15);

    const transactions = expensesList.map(e => ({
      id: e.id,
      amount: Number(e.amount),
      category: e.category,
      description: e.description,
      date: e.transactionDate,
      paymentMethod: e.paymentMethod,
      source: e.source
    }));

    return {
      income: Number(financeProfile.income || 0),
      monthlyBudget: Number(financeProfile.monthlyBudget || 0),
      emergencyFund: financeProfile.emergencyFund || {},
      budgets: financeProfile.budgets || {},
      transactions
    };
  }

  /**
   * Retrieves structured health context (physiological steps, sleep, heart rate, workouts).
   */
  async fetchHealthContext(dbUserId, options = {}) {
    const conditions = [eq(schema.healthRecords.userId, dbUserId)];
    if (options.startDate) {
      conditions.push(gte(schema.healthRecords.recordedAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(schema.healthRecords.recordedAt, options.endDate));
    }

    const healthList = await db.select()
      .from(schema.healthRecords)
      .where(and(...conditions))
      .orderBy(desc(schema.healthRecords.recordedAt))
      .limit(options.limit || 15);

    const sleepLogs = [];
    const stepLogs = [];
    const heartRateLogs = [];

    healthList.forEach(r => {
      const date = r.recordedAt;
      const source = r.source || 'google-fit';
      if (r.sleepDuration && r.sleepDuration > 0) {
        sleepLogs.push({ date, duration: r.sleepDuration, source });
      }
      if (r.steps && r.steps > 0) {
        stepLogs.push({ date, count: r.steps, distance: r.distance, calories: r.caloriesBurned, source });
      }
      if (r.heartRate && r.heartRate > 0) {
        heartRateLogs.push({ date, bpm: r.heartRate, source });
      }
    });

    const [user] = await db.select({ profileData: schema.users.profileData }).from(schema.users).where(eq(schema.users.id, dbUserId));
    const profileData = user?.profileData || {};

    const filterByDate = (logs = []) => {
      return logs.filter(log => {
        if (!log.date) return true;
        if (options.startDate && log.date < options.startDate) return false;
        if (options.endDate && log.date > options.endDate) return false;
        return true;
      }).slice(-(options.limit || 15));
    };

    return {
      sleep: sleepLogs,
      steps: stepLogs,
      heartRate: heartRateLogs,
      workouts: filterByDate(profileData.workout_logs || []),
      weight: filterByDate(profileData.weight_logs || []),
      water: filterByDate(profileData.water_logs || [])
    };
  }

  /**
   * Retrieves structured goals context (goals, habits, habit logs, progress).
   */
  async fetchGoalContext(dbUserId, options = {}) {
    const goalsList = await db.select().from(schema.goals).where(eq(schema.goals.userId, dbUserId));
    const habitsList = await db.select().from(schema.habits).where(eq(schema.habits.userId, dbUserId));

    const habitIds = habitsList.map(h => h.id);
    let logsList = [];

    if (habitIds.length > 0) {
      const logConditions = [inArray(schema.habitLogs.habitId, habitIds)];
      if (options.startDate) {
        logConditions.push(gte(schema.habitLogs.completedAt, options.startDate));
      }
      if (options.endDate) {
        logConditions.push(lte(schema.habitLogs.completedAt, options.endDate));
      }

      logsList = await db.select()
        .from(schema.habitLogs)
        .where(and(...logConditions))
        .orderBy(desc(schema.habitLogs.completedAt));
    }

    return {
      goals: goalsList.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        targetValue: Number(g.targetValue),
        currentValue: Number(g.currentValue),
        targetDate: g.targetDate,
        status: g.status
      })),
      habits: habitsList.map(h => {
        const habitLogs = logsList.filter(l => l.habitId === h.id).map(l => ({
          id: l.id,
          completedAt: l.completedAt,
          status: l.status
        }));
        return {
          id: h.id,
          name: h.name,
          frequency: h.frequency,
          targetCount: h.targetCount,
          logs: habitLogs
        };
      })
    };
  }

  /**
   * Retrieves structured document metadata (excl base64 or large text).
   */
  async fetchDocumentContext(dbUserId, options = {}) {
    const docList = await db.select({
      id: schema.documents.id,
      fileName: schema.documents.fileName,
      fileType: schema.documents.fileType,
      summary: schema.documents.summary,
      category: schema.documents.category,
      issueDate: schema.documents.issueDate,
      expiryDate: schema.documents.expiryDate,
      aiInsight: schema.documents.aiInsight,
      createdAt: schema.documents.createdAt
    })
    .from(schema.documents)
    .where(eq(schema.documents.userId, dbUserId))
    .orderBy(desc(schema.documents.createdAt))
    .limit(options.limit || 15);

    return {
      documents: docList
    };
  }

  /**
   * Retrieves and formats dynamic structured context data based on user query and intent sources.
   * @param {string} userId - The user's Firebase UID.
   * @param {string[]} requiredSources - The required data source identifiers.
   * @param {object} [options] - Optional custom filters (startDate, endDate, limit, query).
   * @returns {Promise<object>} Scoped context data.
   */
  async getContext(userId, requiredSources = [], options = {}) {
    try {
      const dbUserId = await this.resolveUser(userId);
      if (!dbUserId) {
        return {};
      }

      // Always retrieve base user details
      const [userRecord] = await db.select().from(schema.users).where(eq(schema.users.id, dbUserId));
      const profileInfo = userRecord?.profileData?.profile || {};

      const context = {
        profile: {
          name: userRecord?.name || profileInfo.name || 'User',
          height: profileInfo.height,
          weight: profileInfo.weight,
          bloodType: profileInfo.bloodType,
          allergies: profileInfo.allergies,
          conditions: profileInfo.conditions
        }
      };

      if (!requiredSources || requiredSources.length === 0) {
        return context;
      }

      // Parse filters using prompt query string and custom options
      const parsedOpts = this.parseFilters(options.query || '', options);

      // Dynamically load only specified SQL sources
      const fetchers = [];

      if (requiredSources.some(s => s === 'finance')) {
        fetchers.push(
          this.fetchFinanceContext(dbUserId, parsedOpts).then(data => {
            context.finance = data;
          })
        );
      }

      if (requiredSources.some(s => s === 'health' || s.endsWith('_logs'))) {
        fetchers.push(
          this.fetchHealthContext(dbUserId, parsedOpts).then(data => {
            context.health = data;
          })
        );
      }

      if (requiredSources.some(s => s === 'goals' || s === 'goalEngine')) {
        fetchers.push(
          this.fetchGoalContext(dbUserId, parsedOpts).then(data => {
            context.goals = data.goals;
            context.habits = data.habits;
          })
        );
      }

      if (requiredSources.some(s => s === 'documents')) {
        fetchers.push(
          this.fetchDocumentContext(dbUserId, parsedOpts).then(data => {
            context.documents = data.documents;
          })
        );
      }

      await Promise.all(fetchers);
      return context;
    } catch (err) {
      console.error('Error fetching isolated structured context from Neon:', err);
      return {};
    }
  }
}

