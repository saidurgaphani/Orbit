import { authStorage } from './authStore.js';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { eq, and } from 'drizzle-orm';

if (!process.env.DATABASE_URL) {
  throw new Error("CRITICAL: DATABASE_URL is not configured. Neon PostgreSQL is the mandatory database provider.");
}

// Default Data Schema Setup
const getInitialData = (userName = 'User') => {
  const todayStr = new Date().toISOString().split('T')[0];

  return {
    profile: {
      name: userName,
      height: null,
      weight: null,
      bloodPressure: null,
      bloodSugar: null,
      bloodType: null,
      allergies: '',
      conditions: '',
      connectedGoogleFit: false,
      connectedHealthConnect: false,
    },
    goals: [],
    medications: [],
    sleep_logs: [],
    step_logs: [],
    heart_rate_logs: [],
    workout_logs: [],
    weight_logs: [],
    water_logs: [],
    timeline: [],
    medical_reports: [],
    insights: [],
    recommendations: [],
    finance: {
      income: 0,
      monthlyBudget: 0,
      spent: 0,
      remaining: 0,
      saved: 0,
      billsDue: 0,
      emergencyFund: {
        monthlyEssential: 0,
        target: 0,
        current: 0
      },
      financialGoals: [],
      subscriptions: [],
      budgets: {
        'Food': 0,
        'Transport': 0,
        'Housing': 0,
        'Shopping': 0,
        'Bills': 0,
        'Entertainment': 0,
        'Other': 0
      },
      transactions: [],
      recurringBills: []
    },
    documents: [],
    learning: {
      todayPlan: [],
      revisionReminders: []
    },
    security: {
      overallScore: 100,
      scamLog: [],
      trustedEntities: []
    },
    dailyChallenge: {
      title: 'Log your first health entry today',
      reward: '+5 Health Score',
      completed: false
    },
    goalEngine: {
      goals: [],
      milestones: [],
      habits: [],
      habitLogs: [],
      goalInsights: []
    },
    morningBriefs: {},
    homeBriefCache: null
  };
};



// Calculates dynamic Health Score out of 100 based on biometrics of target date
export const calculateHealthScore = (db, targetDateStr = null) => {
  const todayStr = targetDateStr || new Date().toISOString().split('T')[0];

  const todaySleep = db.sleep_logs.find(log => log.date === todayStr);
  const sleepDuration = todaySleep ? todaySleep.duration : 0;
  const sleepScore = Math.min(20, (sleepDuration / 450) * 20);

  const todaySteps = db.step_logs.find(log => log.date === todayStr);
  const stepsCount = todaySteps ? todaySteps.count : 0;
  const stepsScore = Math.min(20, (stepsCount / 10000) * 20);

  const todayWater = db.water_logs.find(log => log.date === todayStr);
  const waterAmount = todayWater ? todayWater.amount : 0;
  const waterScore = Math.min(20, (waterAmount / 3000) * 20);

  const todayHR = db.heart_rate_logs.find(log => log.date === todayStr);
  const hrBpm = todayHR ? todayHR.bpm : 72;
  let hrScore = 20;
  if (hrBpm < 50 || hrBpm > 100) hrScore = 5;
  else if (hrBpm > 85) hrScore = 12;
  else if (hrBpm > 80) hrScore = 16;

  const todayWorkout = db.workout_logs.find(log => log.date === todayStr);
  const workoutScore = todayWorkout ? 20 : 0;

  const totalScore = Math.round(sleepScore + stepsScore + waterScore + hrScore + workoutScore);

  return {
    score: Math.max(0, Math.min(100, totalScore)),
    components: {
      sleep: sleepDuration >= 450,
      activity: stepsCount >= 8000,
      heartRate: hrBpm >= 60 && hrBpm <= 80,
      exercise: todayWorkout !== undefined,
      water: waterAmount >= 2500
    }
  };
};



// Helper: Seed Neon user tables with initial metrics
const seedUserNeon = async (neonUserId, initialData) => {
  try {
    // 1. Seed health records
    const dateMap = {};
    const getRec = (d) => {
      if (!dateMap[d]) dateMap[d] = { recordedAt: d, steps: 0, sleepDuration: 0, heartRate: 72, caloriesBurned: 0, distance: 0, source: 'google-fit' };
      return dateMap[d];
    };
    initialData.sleep_logs.forEach(l => { getRec(l.date).sleepDuration = l.duration; getRec(l.date).source = l.source || 'google-fit'; });
    initialData.step_logs.forEach(l => { getRec(l.date).steps = l.count; getRec(l.date).distance = l.distance; getRec(l.date).caloriesBurned = l.calories; getRec(l.date).source = l.source || 'google-fit'; });
    initialData.heart_rate_logs.forEach(l => { getRec(l.date).heartRate = l.bpm; getRec(l.date).source = l.source || 'google-fit'; });

    for (const record of Object.values(dateMap)) {
      await db.insert(schema.healthRecords).values({
        userId: neonUserId,
        recordedAt: record.recordedAt,
        steps: record.steps,
        sleepDuration: record.sleepDuration,
        heartRate: record.heartRate,
        caloriesBurned: record.caloriesBurned,
        distance: record.distance,
        source: record.source
      });
    }

    // 2. Seed expenses
    for (const tx of initialData.finance.transactions) {
      await db.insert(schema.expenses).values({
        userId: neonUserId,
        amount: String(tx.amount),
        category: tx.category,
        description: tx.description || '',
        transactionDate: tx.date,
        paymentMethod: tx.category === 'Housing' || tx.category === 'Bills' ? 'Bank Transfer' : 'Card',
        source: 'seed'
      });
    }

    // 3. Seed goals
    const allSeedGoals = [];
    initialData.goals.forEach(g => {
      allSeedGoals.push({ title: g.title, description: `Target: ${g.targetValue} ${g.unit}`, targetValue: String(g.targetValue), currentValue: String(g.currentValue), status: 'active' });
    });
    initialData.finance.financialGoals.forEach(g => {
      allSeedGoals.push({ title: g.name, description: 'Financial saving goal', targetValue: String(g.target_amount), currentValue: String(g.current_amount), targetDate: g.target_date, status: 'active' });
    });
    initialData.goalEngine.goals.forEach(g => {
      if (!allSeedGoals.some(ex => ex.title === g.title)) {
        allSeedGoals.push({ title: g.title, description: g.description, targetValue: String(g.target_value), currentValue: String(g.current_value), targetDate: g.targetDate, status: g.status });
      }
    });

    for (const goal of allSeedGoals) {
      await db.insert(schema.goals).values({
        userId: neonUserId,
        title: goal.title,
        description: goal.description,
        targetValue: goal.targetValue,
        currentValue: goal.currentValue,
        targetDate: goal.targetDate || null,
        status: goal.status
      });
    }

    // 4. Seed habits
    for (const h of initialData.goalEngine.habits) {
      const inserted = await db.insert(schema.habits).values({
        userId: neonUserId,
        name: h.title,
        frequency: h.frequency,
        targetCount: h.targetValue
      }).returning();

      const habitId = inserted[0].id;
      const matchedLogs = initialData.goalEngine.habitLogs.filter(log => log.habitId === h.id);
      for (const log of matchedLogs) {
        await db.insert(schema.habitLogs).values({
          habitId,
          completedAt: log.date,
          status: log.completed ? 'completed' : 'pending'
        });
      }
    }
  } catch (err) {
    console.error('Error seeding initial tables in Neon:', err);
  }
};

// Relational Neon PostgreSQL Database Adapter readDb
export const readDb = async (userId = null) => {
  const activeUserId = userId || authStorage.getStore()?.userId;



  try {
    if (!activeUserId) {
      return getInitialData();
    }

    // 1. Get or create Neon user
    let userMatch = await db.select().from(schema.users).where(eq(schema.users.firebaseUid, activeUserId));
    let dbUser;

    if (userMatch.length === 0) {
      const initial = getInitialData();
      const name = initial.profile?.name || 'Sai';
      const email = `${activeUserId}@example.com`;

      const inserted = await db.insert(schema.users).values({
        firebaseUid: activeUserId,
        email,
        name,
        profileData: {
          profile: initial.profile,
          medications: initial.medications,
          timeline: initial.timeline,
          medical_reports: initial.medical_reports,
          insights: initial.insights,
          recommendations: initial.recommendations,
          finance: {
            income: initial.finance.income,
            monthlyBudget: initial.finance.monthlyBudget,
            spent: initial.finance.spent,
            remaining: initial.finance.remaining,
            saved: initial.finance.saved,
            billsDue: initial.finance.billsDue,
            emergencyFund: initial.finance.emergencyFund,
            budgets: initial.finance.budgets,
            recurringBills: initial.finance.recurringBills
          },
          learning: initial.learning,
          security: initial.security,
          dailyChallenge: initial.dailyChallenge,
          goalEngine: {
            milestones: initial.goalEngine.milestones,
            goalInsights: initial.goalEngine.goalInsights
          },
          homeBriefCache: initial.homeBriefCache
        }
      }).returning();
      dbUser = inserted[0];

      await seedUserNeon(dbUser.id, initial);
    } else {
      dbUser = userMatch[0];
    }

    // 2. Query Neon relational tables
    const neonHealth = await db.select().from(schema.healthRecords).where(eq(schema.healthRecords.userId, dbUser.id));
    const neonExpenses = await db.select().from(schema.expenses).where(eq(schema.expenses.userId, dbUser.id));
    const neonGoals = await db.select().from(schema.goals).where(eq(schema.goals.userId, dbUser.id));
    const neonHabits = await db.select().from(schema.habits).where(eq(schema.habits.userId, dbUser.id));
    const neonScams = await db.select().from(schema.scamAnalyses).where(eq(schema.scamAnalyses.userId, dbUser.id));
    const neonBriefs = await db.select().from(schema.dailyBriefs).where(eq(schema.dailyBriefs.userId, dbUser.id));

    // 3. Reconstruct arrays expected by frontend logic
    const sleepLogs = [];
    const stepLogs = [];
    const heartRateLogs = [];

    neonHealth.forEach(r => {
      const date = r.recordedAt;
      const source = r.source || 'google-fit';

      if (r.sleepDuration > 0) {
        sleepLogs.push({ date, duration: r.sleepDuration, deep: Math.round(r.sleepDuration * 0.2), rem: Math.round(r.sleepDuration * 0.21), light: Math.round(r.sleepDuration * 0.59), source });
      }
      if (r.steps > 0) {
        stepLogs.push({ date, count: r.steps, distance: r.distance, calories: Math.round(r.steps * 0.24), source });
      }
      if (r.heartRate > 0) {
        heartRateLogs.push({ date, bpm: r.heartRate, source });
      }
    });

    const transactions = neonExpenses.map(e => ({
      id: e.id,
      amount: Number(e.amount),
      type: 'expense',
      category: e.category,
      merchant: e.description || 'Merchant',
      description: e.description || '',
      date: e.transactionDate
    }));

    const totalSpent = transactions.reduce((acc, curr) => acc + curr.amount, 0);

    const goalsArray = neonGoals.map(g => ({
      id: g.id,
      title: g.title,
      description: g.description,
      targetValue: Number(g.targetValue),
      currentValue: Number(g.currentValue),
      targetDate: g.targetDate,
      status: g.status
    }));

    const scamLog = neonScams.map(s => {
      const raw = s.detectedSignals || {};
      let parsedAnalysis = {};
      try {
        parsedAnalysis = typeof s.analysis === 'string' ? JSON.parse(s.analysis) : s.analysis;
      } catch {
        parsedAnalysis = { summary: s.analysis };
      }
      return {
        id: raw.custom_id || s.id,
        input_type: s.inputType,
        question: s.inputText,
        risk_level: raw.risk_level || (s.riskScore >= 70 ? 'HIGH RISK' : s.riskScore >= 40 ? 'MEDIUM RISK' : 'LOW RISK'),
        risk_score: s.riskScore,
        category: raw.category || 'General',
        analysis: parsedAnalysis,
        created_at: s.createdAt.toISOString()
      };
    });

    const morningBriefs = {};
    neonBriefs.forEach(b => {
      try {
        morningBriefs[b.briefDate] = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
      } catch {
        morningBriefs[b.briefDate] = { greeting: b.content };
      }
    });

    const p = dbUser.profileData || {};
    return {
      profile: p.profile || { name: dbUser.name || 'Sai', height: 180, weight: 80, bloodPressure: '120/80', bloodSugar: 95, bloodType: 'O+', allergies: '', conditions: '', connectedGoogleFit: false },
      goals: goalsArray.slice(0, 5),
      medications: p.medications || [],
      sleep_logs: sleepLogs,
      step_logs: stepLogs,
      heart_rate_logs: heartRateLogs,
      workout_logs: p.workout_logs || [],
      weight_logs: p.weight_logs || [],
      water_logs: p.water_logs || [],
      timeline: p.timeline || [],
      medical_reports: p.medical_reports || [],
      insights: p.insights || [],
      recommendations: p.recommendations || [],
      finance: {
        income: p.finance?.income || 50000,
        monthlyBudget: p.finance?.monthlyBudget || 40000,
        spent: totalSpent,
        remaining: Math.max(0, (p.finance?.monthlyBudget || 40000) - totalSpent),
        saved: Math.max(0, (p.finance?.income || 50000) - totalSpent),
        billsDue: p.finance?.billsDue || 0,
        emergencyFund: p.finance?.emergencyFund || { monthlyEssential: 25000, target: 150000, current: 90000 },
        financialGoals: goalsArray.filter(g => g.description?.includes('saving') || g.status === 'active').map(g => ({
          id: g.id, name: g.title, target_amount: g.targetValue, current_amount: g.currentValue, target_date: g.targetDate
        })),
        subscriptions: p.finance?.subscriptions || [],
        budgets: p.finance?.budgets || {},
        transactions,
        recurringBills: p.finance?.recurringBills || []
      },
      documents: p.documents || [],
      learning: p.learning || { todayPlan: [], revisionReminders: [] },
      security: {
        overallScore: p.security?.overallScore || 98,
        scamLog,
        trustedEntities: p.security?.trustedEntities || []
      },
      dailyChallenge: p.dailyChallenge || { title: 'Walk 10,000 steps today', reward: '+5 Health Score', completed: false },
      goalEngine: {
        goals: goalsArray,
        milestones: p.goalEngine?.milestones || [],
        habits: neonHabits.map(h => ({
          id: h.id, title: h.name, frequency: h.frequency, targetValue: h.targetCount
        })),
        habitLogs: [],
        goalInsights: p.goalEngine?.goalInsights || []
      },
      morningBriefs,
      homeBriefCache: p.homeBriefCache || null
    };
  } catch (err) {
    console.error('Error reading relational DB from Neon:', err);
    return getInitialData();
  }
};

// Relational Neon PostgreSQL Database Adapter writeDb
export const writeDb = async (userId = null, data, isSavingCache = false) => {
  const activeUserId = userId || authStorage.getStore()?.userId;



  try {
    if (!activeUserId || !data) return false;

    let userMatch = await db.select().from(schema.users).where(eq(schema.users.firebaseUid, activeUserId));
    if (userMatch.length === 0) {
      await readDb(activeUserId);
      userMatch = await db.select().from(schema.users).where(eq(schema.users.firebaseUid, activeUserId));
    }
    const dbUser = userMatch[0];

    if (!isSavingCache) {
      data.homeBriefCache = null;
    }

    // 2. Persist profileData column
    await db.update(schema.users).set({
      name: data.profile?.name || dbUser.name,
      profileData: {
        profile: data.profile,
        medications: data.medications || [],
        timeline: data.timeline || [],
        medical_reports: data.medical_reports || [],
        insights: data.insights || [],
        recommendations: data.recommendations || [],
        finance: {
          income: data.finance?.income || 50000,
          monthlyBudget: data.finance?.monthlyBudget || 40000,
          spent: data.finance?.spent || 0,
          remaining: data.finance?.remaining || 0,
          saved: data.finance?.saved || 0,
          billsDue: data.finance?.billsDue || 0,
          emergencyFund: data.finance?.emergencyFund || {},
          budgets: data.finance?.budgets || {},
          recurringBills: data.finance?.recurringBills || []
        },
        learning: data.learning || {},
        security: {
          overallScore: data.security?.overallScore || 98,
          trustedEntities: data.security?.trustedEntities || []
        },
        dailyChallenge: data.dailyChallenge || {},
        goalEngine: {
          milestones: data.goalEngine?.milestones || [],
          goalInsights: data.goalEngine?.goalInsights || []
        },
        workout_logs: data.workout_logs || [],
        weight_logs: data.weight_logs || [],
        water_logs: data.water_logs || [],
        homeBriefCache: data.homeBriefCache || null,
        googleOAuth: dbUser.profileData?.googleOAuth || null
      },
      updatedAt: new Date()
    }).where(eq(schema.users.id, dbUser.id));

    // 3. Upsert health records
    const dateMap = {};
    const getRec = (d) => {
      if (!dateMap[d]) dateMap[d] = { recordedAt: d, steps: 0, sleepDuration: 0, heartRate: 72, caloriesBurned: 0, distance: 0, source: 'manual' };
      return dateMap[d];
    };
    if (data.sleep_logs) data.sleep_logs.forEach(l => { getRec(l.date).sleepDuration = l.duration; getRec(l.date).source = l.source || 'google-fit'; });
    if (data.step_logs) data.step_logs.forEach(l => { getRec(l.date).steps = l.count; getRec(l.date).distance = l.distance; getRec(l.date).caloriesBurned = l.calories; getRec(l.date).source = l.source || 'google-fit'; });
    if (data.heart_rate_logs) data.heart_rate_logs.forEach(l => { getRec(l.date).heartRate = l.bpm; getRec(l.date).source = l.source || 'google-fit'; });

    for (const record of Object.values(dateMap)) {
      // In PostgreSQL, to upsert cleanly on conflict of (userId, recordedAt) we use a custom delete-and-insert fallback or standard query
      await db.delete(schema.healthRecords).where(and(eq(schema.healthRecords.userId, dbUser.id), eq(schema.healthRecords.recordedAt, record.recordedAt)));
      await db.insert(schema.healthRecords).values({
        userId: dbUser.id,
        recordedAt: record.recordedAt,
        steps: record.steps,
        sleepDuration: record.sleepDuration,
        heartRate: record.heartRate,
        caloriesBurned: record.caloriesBurned,
        distance: record.distance,
        source: record.source
      });
    }

    // 4. Update Expenses
    if (data.finance?.transactions) {
      for (const tx of data.finance.transactions) {
        if (tx.type === 'expense') {
          const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(tx.id);
          await db.insert(schema.expenses).values({
            id: isUuid ? tx.id : undefined,
            userId: dbUser.id,
            amount: String(tx.amount),
            category: tx.category,
            description: tx.merchant || tx.description || '',
            transactionDate: tx.date,
            source: 'manual'
          }).onConflictDoUpdate({
            target: schema.expenses.id,
            set: {
              amount: String(tx.amount),
              category: tx.category,
              description: tx.merchant || tx.description || '',
              transactionDate: tx.date
            }
          });
        }
      }
    }

    // 5. Update Goals
    if (data.goalEngine?.goals) {
      for (const g of data.goalEngine.goals) {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(g.id);
        await db.insert(schema.goals).values({
          id: isUuid ? g.id : undefined,
          userId: dbUser.id,
          title: g.title,
          description: g.description || '',
          targetValue: String(g.targetValue),
          currentValue: String(g.currentValue || 0),
          targetDate: g.targetDate || null,
          status: g.status || 'active'
        }).onConflictDoUpdate({
          target: schema.goals.id,
          set: {
            title: g.title,
            description: g.description || '',
            targetValue: String(g.targetValue),
            currentValue: String(g.currentValue || 0),
            targetDate: g.targetDate || null,
            status: g.status || 'active'
          }
        });
      }
    }

    // 6. Update Scam Analyses
    if (data.security?.scamLog) {
      for (const s of data.security.scamLog) {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s.id);
        await db.insert(schema.scamAnalyses).values({
          id: isUuid ? s.id : undefined,
          userId: dbUser.id,
          inputText: s.question || s.input_text || '',
          inputType: s.input_type || 'text',
          riskScore: s.risk_score || 0,
          analysis: typeof s.analysis === 'string' ? s.analysis : JSON.stringify(s.analysis),
          detectedSignals: {
            risk_level: s.risk_level,
            category: s.category,
            custom_id: s.id,
            analysis_raw: s.analysis
          },
          createdAt: s.created_at ? new Date(s.created_at) : new Date()
        }).onConflictDoUpdate({
          target: schema.scamAnalyses.id,
          set: {
            inputText: s.question || s.input_text || '',
            inputType: s.input_type || 'text',
            riskScore: s.risk_score || 0,
            analysis: typeof s.analysis === 'string' ? s.analysis : JSON.stringify(s.analysis),
            detectedSignals: {
              risk_level: s.risk_level,
              category: s.category,
              custom_id: s.id,
              analysis_raw: s.analysis
            }
          }
        });
      }
    }

    // 7. Update Morning Briefs
    if (data.morningBriefs) {
      for (const [dateStr, brief] of Object.entries(data.morningBriefs)) {
        await db.insert(schema.dailyBriefs).values({
          userId: dbUser.id,
          briefDate: dateStr,
          content: typeof brief === 'string' ? brief : JSON.stringify(brief),
          lifeScore: brief.lifeScore || 80
        }).onConflictDoUpdate({
          target: [schema.dailyBriefs.userId, schema.dailyBriefs.briefDate],
          set: {
            content: typeof brief === 'string' ? brief : JSON.stringify(brief),
            lifeScore: brief.lifeScore || 80
          }
        });
      }
    }

    return true;
  } catch (err) {
    console.error('Error writing database to Neon:', err);
    return false;
  }
};

// Get Google OAuth tokens for a user
export const getUserGoogleTokens = async (firebaseUid) => {
  try {
    const userMatch = await db.select().from(schema.users).where(eq(schema.users.firebaseUid, firebaseUid));
    if (userMatch.length === 0) return null;
    return userMatch[0].profileData?.googleOAuth || null;
  } catch (err) {
    console.error('Error getting Google tokens from DB:', err);
    return null;
  }
};

// Save Google OAuth tokens for a user
export const saveUserGoogleTokens = async (firebaseUid, tokens) => {
  try {
    const userMatch = await db.select().from(schema.users).where(eq(schema.users.firebaseUid, firebaseUid));
    if (userMatch.length === 0) return false;
    
    const dbUser = userMatch[0];
    const profileData = dbUser.profileData || {};
    profileData.googleOAuth = {
      ...(profileData.googleOAuth || {}),
      ...tokens
    };
    
    await db.update(schema.users).set({
      profileData,
      updatedAt: new Date()
    }).where(eq(schema.users.id, dbUser.id));
    return true;
  } catch (err) {
    console.error('Error saving Google tokens to DB:', err);
    return false;
  }
};
