import { authStorage } from './authStore.js';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { eq, and } from 'drizzle-orm';

if (!process.env.DATABASE_URL) {
  throw new Error("CRITICAL: DATABASE_URL is not configured. Neon PostgreSQL is the mandatory database provider.");
}

// Default Data Schema Setup
const getInitialData = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const [d6, d5, d4, d3, d2, d1, today] = dates;

  return {
    profile: {
      name: 'Sai',
      height: 180, // cm
      weight: 80,  // kg
      bloodPressure: '120/80',
      bloodSugar: 95, // mg/dL
      bloodType: 'O+',
      allergies: 'Pollen, Penicillin',
      conditions: 'None',
      connectedGoogleFit: false,
      connectedHealthConnect: false,
    },
    goals: [
      { id: '1', title: 'Walk 10,000 steps/day', type: 'steps', targetValue: 10000, currentValue: 8432, unit: 'steps', period: 'daily' },
      { id: '2', title: 'Sleep 7.5 hours/night', type: 'sleep', targetValue: 450, currentValue: 402, unit: 'mins', period: 'daily' },
      { id: '3', title: 'Drink 3L water/day', type: 'water', targetValue: 3000, currentValue: 2300, unit: 'ml', period: 'daily' },
      { id: '4', title: 'Exercise 150 minutes/week', type: 'exercise', targetValue: 150, currentValue: 125, unit: 'mins', period: 'weekly' },
      { id: '5', title: 'Lose 5 kg', type: 'weight', targetValue: 75, currentValue: 80, unit: 'kg', period: 'long-term' },
    ],
    medications: [
      { id: 'm1', name: 'Multivitamin', dosage: '1 tablet', frequency: 'Daily', startDate: '2026-01-01', endDate: '', refillReminder: true, refillCount: 15, history: { [today]: true } },
      { id: 'm2', name: 'Omega-3 Fish Oil', dosage: '1 softgel', frequency: 'Daily', startDate: '2026-01-01', endDate: '', refillReminder: false, refillCount: 30, history: { [today]: true } },
      { id: 'm3', name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', startDate: '2026-06-15', endDate: '', refillReminder: true, refillCount: 5, history: {} }
    ],
    sleep_logs: [
      { date: d6, duration: 460, deep: 90, rem: 100, light: 270, source: 'google-fit' },
      { date: d5, duration: 440, deep: 85, rem: 95, light: 260, source: 'google-fit' },
      { date: d4, duration: 410, deep: 80, rem: 85, light: 245, source: 'google-fit' },
      { date: d3, duration: 390, deep: 75, rem: 80, light: 235, source: 'google-fit' },
      { date: d2, duration: 380, deep: 70, rem: 75, light: 235, source: 'google-fit' },
      { date: d1, duration: 370, deep: 65, rem: 70, light: 235, source: 'google-fit' },
      { date: today, duration: 402, deep: 80, rem: 85, light: 237, source: 'google-fit' },
    ],
    step_logs: [
      { date: d6, count: 10200, distance: 7800, calories: 2450, source: 'google-fit' },
      { date: d5, count: 9800, distance: 7400, calories: 2380, source: 'google-fit' },
      { date: d4, count: 8500, distance: 6400, calories: 2100, source: 'google-fit' },
      { date: d3, count: 6200, distance: 4600, calories: 1850, source: 'google-fit' },
      { date: d2, count: 5500, distance: 4100, calories: 1720, source: 'google-fit' },
      { date: d1, count: 7100, distance: 5300, calories: 1980, source: 'google-fit' },
      { date: today, count: 8432, distance: 6300, calories: 2040, source: 'google-fit' },
    ],
    heart_rate_logs: [
      { date: d6, bpm: 68, source: 'google-fit' },
      { date: d5, bpm: 69, source: 'google-fit' },
      { date: d4, bpm: 71, source: 'google-fit' },
      { date: d3, bpm: 73, source: 'google-fit' },
      { date: d2, bpm: 74, source: 'google-fit' },
      { date: d1, bpm: 73, source: 'google-fit' },
      { date: today, bpm: 72, source: 'google-fit' },
    ],
    workout_logs: [
      { date: d6, type: 'Running', duration: 45, calories: 400, source: 'google-fit' },
      { date: d4, type: 'Strength Training', duration: 60, calories: 500, source: 'google-fit' },
      { date: today, type: 'Cardio Gym', duration: 45, calories: 350, source: 'google-fit' },
    ],
    weight_logs: [
      { date: d6, weight: 80.5 },
      { date: d5, weight: 80.4 },
      { date: d4, weight: 80.4 },
      { date: d3, weight: 80.3 },
      { date: d2, weight: 80.2 },
      { date: d1, weight: 80.1 },
      { date: today, weight: 80.0 },
    ],
    water_logs: [
      { date: d6, amount: 2800 },
      { date: d5, amount: 3100 },
      { date: d4, amount: 2500 },
      { date: d3, amount: 2000 },
      { date: d2, amount: 1800 },
      { date: d1, amount: 2100 },
      { date: today, amount: 2300 },
    ],
    timeline: [
      { time: '07:30', text: 'Morning Walk (3,200 steps synced)', type: 'activity' },
      { time: '08:15', text: 'Logged medication: Multivitamin taken', type: 'medication' },
      { time: '08:20', text: 'Logged medication: Omega-3 Fish Oil taken', type: 'medication' },
      { time: '13:00', text: 'Water Intake: Reached 1.2L (40% of target)', type: 'water' },
      { time: '18:00', text: 'Workout: 45 min Cardio Gym synced', type: 'workout' },
      { time: '21:00', text: 'Evening Walk (2,100 steps synced)', type: 'activity' }
    ],
    medical_reports: [],
    insights: [
      { id: '1', date: today, text: 'Your sleep has been below your weekly average for four consecutive days. Improving your bedtime consistency by even 30 minutes may help increase recovery.', category: 'sleep' },
      { id: '2', date: today, text: "You've met your step goal five days in a row. Great consistency — aim for one longer walk this weekend.", category: 'activity' },
      { id: '3', date: today, text: 'Your activity has decreased while restaurant spending increased this week. Consider planning home-cooked meals and short evening walks.', category: 'general' }
    ],
    recommendations: [
      { id: 'rec1', text: 'Walk 1,568 more steps to reach today\'s goal.', completed: false },
      { id: 'rec2', text: 'Drink another 700 mL of water to hit your target.', completed: false },
      { id: 'rec3', text: 'Take Lisinopril medication before sleep.', completed: false }
    ],
    finance: {
      income: 50000,
      monthlyBudget: 40000,
      spent: 28400,
      remaining: 11600,
      saved: 21600,
      billsDue: 2,
      emergencyFund: {
        monthlyEssential: 25000,
        target: 150000,
        current: 90000
      },
      financialGoals: [
        { id: 'g1', name: 'Buy MacBook', target_amount: 150000, current_amount: 68000, target_date: '2027-06-01' },
        { id: 'g2', name: 'Emergency Fund', target_amount: 150000, current_amount: 90000, target_date: '2026-12-31' },
        { id: 'g3', name: 'Europe Trip', target_amount: 200000, current_amount: 50000, target_date: '2027-09-01' }
      ],
      subscriptions: [
        { id: 's1', name: 'Netflix', amount: 649, billing_cycle: 'monthly', next_billing_date: '2026-07-20', status: 'active', lastUsedDaysAgo: 3 },
        { id: 's2', name: 'Spotify Premium', amount: 119, billing_cycle: 'monthly', next_billing_date: '2026-07-25', status: 'active', lastUsedDaysAgo: 1 },
        { id: 's3', name: 'Cloud Storage', amount: 130, billing_cycle: 'monthly', next_billing_date: '2026-07-28', status: 'active', lastUsedDaysAgo: 0 },
        { id: 's4', name: 'Gym Membership', amount: 1000, billing_cycle: 'monthly', next_billing_date: '2026-08-01', status: 'active', lastUsedDaysAgo: 47 }
      ],
      budgets: {
        'Food': 10000,
        'Transport': 5000,
        'Housing': 15000,
        'Shopping': 5000,
        'Bills': 4000,
        'Entertainment': 3000,
        'Other': 3000
      },
      transactions: [
        { id: 't1', amount: 15000, type: 'expense', category: 'Housing', merchant: 'Landlord', description: 'Monthly Rent', date: d6 },
        { id: 't2', amount: 2500, type: 'expense', category: 'Food', merchant: 'DMart', description: 'Weekly Groceries', date: d6 },
        { id: 't3', amount: 1200, type: 'expense', category: 'Bills', merchant: 'MSEB', description: 'Electricity Bill', date: d5 },
        { id: 't4', amount: 350, type: 'expense', category: 'Transport', merchant: 'Uber', description: 'Ride to office', date: d5 },
        { id: 't5', amount: 999, type: 'expense', category: 'Bills', merchant: 'Jio Fiber', description: 'Internet Subscription', date: d4 },
        { id: 't6', amount: 649, type: 'expense', category: 'Subscriptions', merchant: 'Netflix', description: 'Monthly Plan', date: d4 },
        { id: 't7', amount: 119, type: 'expense', category: 'Subscriptions', merchant: 'Spotify', description: 'Premium Plan', date: d4 },
        { id: 't8', amount: 130, type: 'expense', category: 'Subscriptions', merchant: 'Google One', description: 'Cloud Storage', date: d4 },
        { id: 't9', amount: 1000, type: 'expense', category: 'Subscriptions', merchant: 'Gold Gym', description: 'Gym Membership', date: d3 },
        { id: 't10', amount: 450, type: 'expense', category: 'Food', merchant: 'Zomato', description: 'Dinner at home', date: d3 },
        { id: 't11', amount: 850, type: 'expense', category: 'Food', merchant: 'Swiggy', description: 'Lunch with colleagues', date: d2 },
        { id: 't12', amount: 150, type: 'expense', category: 'Transport', merchant: 'Auto Rickshaw', description: 'Local commute', date: d2 },
        { id: 't13', amount: 2500, type: 'expense', category: 'Shopping', merchant: 'Amazon', description: 'Noise Cancelling Earbuds', date: d2 },
        { id: 't14', amount: 450, type: 'expense', category: 'Food', merchant: 'Zomato', description: 'Late night dinner', date: d1 },
        { id: 't15', amount: 1000, type: 'expense', category: 'Investments', merchant: 'Zerodha', description: 'Mutual Fund SIP', date: d1 },
        { id: 't16', amount: 502, type: 'expense', category: 'Other', merchant: 'Chemist', description: 'First aid medicines', date: today },
        { id: 't17', amount: 551, type: 'expense', category: 'Food', merchant: 'Starbucks', description: 'Coffee with friend', date: today }
      ],
      recurringBills: [
        { id: 'b1', name: 'Electricity Bill', amount: 1200, dueDate: today, status: 'unpaid', urgency: 'High' },
        { id: 'b2', name: 'Internet Subscription', amount: 999, dueDate: today, status: 'paid', urgency: 'Medium' }
      ]
    },
    documents: [
      { id: 'd1', name: 'Passport', expiryDate: '2027-01-21', status: 'Expires in 6 Months', type: 'Identification' },
      { id: 'd2', name: 'Driving License', expiryDate: '2031-11-09', status: 'Valid', type: 'Identification' },
      { id: 'd3', name: 'Health Insurance', expiryDate: '2026-08-15', status: 'Renewal Next Month', type: 'Finance' }
    ],
    learning: {
      todayPlan: [
        { id: 'l1', subject: 'DSA (Spaced Repetition)', durationMins: 60, status: 'pending' },
        { id: 'l2', subject: 'React Patterns', durationMins: 45, status: 'pending' },
        { id: 'l3', subject: 'Mock Interview preparation', durationMins: 30, status: 'completed' }
      ],
      revisionReminders: [
        { id: 'r1', subject: 'System Design', details: 'Review database partitioning and caching strategies.' },
        { id: 'r2', subject: 'Javascript Event Loop', details: 'Review microtask queue vs. macrotask queue.' }
      ]
    },
    security: {
      overallScore: 98,
      scamLog: [],
      trustedEntities: [
        { id: 't1', name: 'State Bank of India', domain: 'sbi.co.in' },
        { id: 't2', name: 'HDFC Bank', domain: 'hdfcbank.com' },
        { id: 't3', name: 'Zomato', domain: 'zomato.com' },
        { id: 't4', name: 'Amazon India', domain: 'amazon.in' },
        { id: 't5', name: 'Identity verification system', domain: 'indiapost.gov.in' }
      ]
    },
    dailyChallenge: {
      title: 'Walk 10,000 steps today',
      reward: '+5 Health Score',
      completed: false
    },
    goalEngine: {
      goals: [
        {
          id: 'goal_1',
          title: 'Become a Full-Stack Developer',
          description: 'Master HTML, CSS, JavaScript, React, Node.js, and databases to become a job-ready full-stack developer.',
          category: 'Learning',
          goalType: 'milestone',
          targetValue: 100,
          currentValue: 18,
          unit: '%',
          startDate: today,
          targetDate: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split('T')[0],
          status: 'active',
          successProbability: 72,
          predictedCompletionDate: new Date(new Date().setMonth(new Date().getMonth() + 7)).toISOString().split('T')[0],
          healthStatus: 'at_risk',
          icon: '🎓',
          nextAction: 'Complete JavaScript Arrays module',
          linkedModule: null
        },
        {
          id: 'goal_2',
          title: 'Buy MacBook Pro',
          description: 'Save ₹1,50,000 for a MacBook Pro by reducing discretionary spending and increasing monthly savings.',
          category: 'Finance',
          goalType: 'outcome',
          targetValue: 150000,
          currentValue: 68000,
          unit: '₹',
          startDate: d6,
          targetDate: '2027-06-01',
          status: 'active',
          successProbability: 88,
          predictedCompletionDate: '2027-05-15',
          healthStatus: 'on_track',
          icon: '💻',
          nextAction: 'Save ₹333 today',
          linkedModule: 'finance'
        },
        {
          id: 'goal_3',
          title: 'Get Healthier',
          description: 'Build consistent daily health habits: walk 10,000 steps, sleep 7+ hours, drink 3L water, exercise 4x/week.',
          category: 'Health',
          goalType: 'habit',
          targetValue: 100,
          currentValue: 62,
          unit: '%',
          startDate: d6,
          targetDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
          status: 'active',
          successProbability: 81,
          predictedCompletionDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
          healthStatus: 'on_track',
          icon: '❤️',
          nextAction: 'Walk 1,568 more steps to hit today\'s goal',
          linkedModule: 'health'
        }
      ],
      milestones: [
        { id: 'm1', goalId: 'goal_1', title: 'HTML + CSS + JavaScript Basics', description: 'Complete fundamentals of the web.', targetValue: 100, dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0], status: 'active', completedAt: null, order: 1 },
        { id: 'm2', goalId: 'goal_1', title: 'React & Frontend Frameworks', description: 'Build UIs with React, hooks, routing.', targetValue: 100, dueDate: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().split('T')[0], status: 'locked', completedAt: null, order: 2 },
        { id: 'm3', goalId: 'goal_1', title: 'Backend with Node.js & Express', description: 'Build REST APIs, auth, middleware.', targetValue: 100, dueDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0], status: 'locked', completedAt: null, order: 3 },
        { id: 'm4', goalId: 'goal_1', title: 'Databases (SQL + NoSQL)', description: 'Learn PostgreSQL and MongoDB.', targetValue: 100, dueDate: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0], status: 'locked', completedAt: null, order: 4 },
        { id: 'm5', goalId: 'goal_1', title: 'Full-Stack Projects', description: 'Build 2 complete full-stack applications.', targetValue: 100, dueDate: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().split('T')[0], status: 'locked', completedAt: null, order: 5 },
        { id: 'm6', goalId: 'goal_1', title: 'Interview Preparation', description: 'DSA, system design, mock interviews.', targetValue: 100, dueDate: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split('T')[0], status: 'locked', completedAt: null, order: 6 },
        { id: 'm7', goalId: 'goal_2', title: 'Save first ₹50,000', description: 'Foundation fund established.', targetValue: 50000, dueDate: d3, status: 'completed', completedAt: d3, order: 1 },
        { id: 'm8', goalId: 'goal_2', title: 'Reach ₹1,00,000 milestone', description: 'Halfway point reached.', targetValue: 100000, dueDate: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().split('T')[0], status: 'active', completedAt: null, order: 2 },
        { id: 'm9', goalId: 'goal_2', title: 'Final ₹1,50,000 target', description: 'MacBook purchase ready.', targetValue: 150000, dueDate: '2027-06-01', status: 'locked', completedAt: null, order: 3 }
      ],
      habits: [
        { id: 'h1', goalId: 'goal_1', title: 'Study JavaScript for 2 hours', frequency: 'daily', targetValue: 2, unit: 'hours', currentStreak: 4, bestStreak: 9, completionRate: 71, startDate: d6 },
        { id: 'h2', goalId: 'goal_1', title: 'Solve 2 coding problems', frequency: 'daily', targetValue: 2, unit: 'problems', currentStreak: 2, bestStreak: 6, completionRate: 57, startDate: d6 },
        { id: 'h3', goalId: 'goal_1', title: 'Review & commit code to GitHub', frequency: 'daily', targetValue: 1, unit: 'commit', currentStreak: 6, bestStreak: 14, completionRate: 85, startDate: d6 },
        { id: 'h4', goalId: 'goal_2', title: 'Track every expense', frequency: 'daily', targetValue: 1, unit: 'log entry', currentStreak: 7, bestStreak: 12, completionRate: 90, startDate: d6 },
        { id: 'h5', goalId: 'goal_2', title: 'Save ₹333 today', frequency: 'daily', targetValue: 333, unit: '₹', currentStreak: 5, bestStreak: 18, completionRate: 82, startDate: d6 },
        { id: 'h6', goalId: 'goal_2', title: 'Review finances weekly', frequency: 'weekly', targetValue: 1, unit: 'session', currentStreak: 2, bestStreak: 5, completionRate: 75, startDate: d6 },
        { id: 'h7', goalId: 'goal_3', title: 'Walk 10,000 steps', frequency: 'daily', targetValue: 10000, unit: 'steps', currentStreak: 3, bestStreak: 8, completionRate: 68, startDate: d6 },
        { id: 'h8', goalId: 'goal_3', title: 'Drink 3L water', frequency: 'daily', targetValue: 3000, unit: 'ml', currentStreak: 1, bestStreak: 5, completionRate: 55, startDate: d6 },
        { id: 'h9', goalId: 'goal_3', title: 'Sleep before 11 PM', frequency: 'daily', targetValue: 1, unit: 'check-in', currentStreak: 2, bestStreak: 7, completionRate: 60, startDate: d6 },
        { id: 'h10', goalId: 'goal_3', title: 'Exercise or workout', frequency: 'daily', targetValue: 1, unit: 'session', currentStreak: 1, bestStreak: 4, completionRate: 43, startDate: d6 }
      ],
      habitLogs: [
        { id: 'hl1', habitId: 'h1', date: d6, value: 2, completed: true },
        { id: 'hl2', habitId: 'h1', date: d5, value: 1.5, completed: true },
        { id: 'hl3', habitId: 'h1', date: d4, value: 0, completed: false },
        { id: 'hl4', habitId: 'h1', date: d3, value: 2, completed: true },
        { id: 'hl5', habitId: 'h2', date: d6, value: 2, completed: true },
        { id: 'hl6', habitId: 'h7', date: d6, value: 10200, completed: true }
      ],
      goalInsights: [
        { id: 'gi1', goalId: 'goal_1', message: 'Your study completion rate is 30% higher on days when you sleep more than 7 hours. Consider protecting your sleep schedule to accelerate learning.', severity: 'info', type: 'health_correlation', createdAt: today },
        { id: 'gi2', goalId: 'goal_1', message: 'You missed 2 study sessions this week. At this pace, you will likely finish 12 days after your target date. Adding one extra session per week would put you back on track.', severity: 'warning', type: 'drift', createdAt: today }
      ]
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
        homeBriefCache: data.homeBriefCache || null
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
