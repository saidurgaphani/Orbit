import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import SQLContextService from '../ai/context/SQLContextService.js';

async function runTests() {
  console.log('=== STARTING SQL CONTEXT PROVIDER TEST SUITE ===\n');

  const sqlContextService = new SQLContextService();

  // 1. Create two temporary test users
  const userA_Uid = 'firebase_test_user_a_' + Date.now();
  const userB_Uid = 'firebase_test_user_b_' + Date.now();

  console.log(`[Test Setup] Creating User A (${userA_Uid}) and User B (${userB_Uid})...`);
  const [dbUserA] = await db.insert(schema.users).values({
    firebaseUid: userA_Uid,
    email: `${userA_Uid}@test.com`,
    name: 'User A',
    profileData: {
      profile: { name: 'User A', height: 180, weight: 75 },
      finance: { income: 60000, monthlyBudget: 45000, budgets: { Food: 500 } }
    }
  }).returning();

  const [dbUserB] = await db.insert(schema.users).values({
    firebaseUid: userB_Uid,
    email: `${userB_Uid}@test.com`,
    name: 'User B',
    profileData: {
      profile: { name: 'User B', height: 170, weight: 65 },
      finance: { income: 40000, monthlyBudget: 30000 }
    }
  }).returning();

  const idA = dbUserA.id;
  const idB = dbUserB.id;

  console.log(`[Test Setup] Resolved PostgreSQL UUIDs: User A = ${idA}, User B = ${idB}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Empty Data Retrieval
    // ----------------------------------------------------
    console.log('--- TEST 1: Empty Data Retrieval ---');
    const emptyContext = await sqlContextService.getContext(userB_Uid, ['finance', 'health', 'goals']);
    
    // Check profile is returned
    if (emptyContext.profile && emptyContext.profile.name === 'User B') {
      console.log('✅ Correct empty profile details fetched.');
    } else {
      throw new Error(`Profile name mismatch: expected User B, got ${emptyContext.profile?.name}`);
    }

    // Check empty categories are returned correctly
    if (
      emptyContext.finance && 
      emptyContext.finance.transactions.length === 0 &&
      emptyContext.health &&
      emptyContext.health.sleep.length === 0 &&
      emptyContext.goals &&
      emptyContext.goals.length === 0
    ) {
      console.log('✅ Empty data structures returned correctly.');
    } else {
      throw new Error('Expected empty lists for new user B, got data.');
    }
    console.log();

    // ----------------------------------------------------
    // TEST 2: Seed data for User A and retrieve
    // ----------------------------------------------------
    console.log('--- TEST 2: Correct Data Retrieval & Multiple Records ---');
    
    // Insert expenses
    console.log('[Test Setup] Seeding expenses for User A...');
    await db.insert(schema.expenses).values([
      { userId: idA, amount: '150.00', category: 'Food', description: 'Groceries A1', transactionDate: '2026-07-10', paymentMethod: 'Card' },
      { userId: idA, amount: '80.00', category: 'Transport', description: 'Fuel A2', transactionDate: '2026-07-12', paymentMethod: 'Cash' },
      { userId: idA, amount: '45.50', category: 'Food', description: 'Dinner A3', transactionDate: '2026-07-15', paymentMethod: 'Card' }
    ]);

    // Insert health records
    console.log('[Test Setup] Seeding health records for User A...');
    await db.insert(schema.healthRecords).values([
      { userId: idA, recordedAt: '2026-07-10', steps: 12000, sleepDuration: 480, heartRate: 70 },
      { userId: idA, recordedAt: '2026-07-11', steps: 8500, sleepDuration: 420, heartRate: 72 },
      { userId: idA, recordedAt: '2026-07-15', steps: 11000, sleepDuration: 450, heartRate: 68 }
    ]);

    // Insert goals and habits
    console.log('[Test Setup] Seeding goals and habits for User A...');
    const [goalObj] = await db.insert(schema.goals).values({
      userId: idA,
      title: 'Run a marathon',
      description: 'Train weekly',
      targetValue: '42',
      currentValue: '10',
      status: 'active'
    }).returning();

    const [habitObj] = await db.insert(schema.habits).values({
      userId: idA,
      name: 'Drink water',
      frequency: 'daily',
      targetCount: 3
    }).returning();

    // Insert habit log
    await db.insert(schema.habitLogs).values({
      habitId: habitObj.id,
      completedAt: '2026-07-15',
      status: 'completed'
    });

    // Retrieve context for User A
    const contextA = await sqlContextService.getContext(userA_Uid, ['finance', 'health', 'goals']);
    
    // Verify Finance
    if (contextA.finance && contextA.finance.transactions.length === 3) {
      console.log('✅ Correctly fetched multiple expenses.');
      if (contextA.finance.income === 60000 && contextA.finance.monthlyBudget === 45000) {
        console.log('✅ Correctly parsed finance profile details.');
      } else {
        throw new Error('Finance profile details mismatch');
      }
    } else {
      throw new Error(`Expected 3 expenses, got ${contextA.finance?.transactions?.length}`);
    }

    // Verify Health
    if (contextA.health && contextA.health.steps.length === 3 && contextA.health.sleep.length === 3) {
      console.log('✅ Correctly fetched physiological health records.');
    } else {
      throw new Error(`Expected 3 health logs, got steps: ${contextA.health?.steps?.length}, sleep: ${contextA.health?.sleep?.length}`);
    }

    // Verify Goals and Habits
    if (contextA.goals && contextA.goals.length === 1 && contextA.goals[0].title === 'Run a marathon') {
      console.log('✅ Goals retrieved correctly.');
    } else {
      throw new Error('Goals retrieval mismatch');
    }

    if (contextA.habits && contextA.habits.length === 1 && contextA.habits[0].logs.length === 1) {
      console.log('✅ Habits and completed logs retrieved correctly.');
    } else {
      throw new Error('Habits retrieval mismatch');
    }
    console.log();

    // ----------------------------------------------------
    // TEST 3: User Isolation
    // ----------------------------------------------------
    console.log('--- TEST 3: Strict User Isolation ---');
    const contextB = await sqlContextService.getContext(userB_Uid, ['finance', 'health', 'goals']);
    
    if (
      (!contextB.finance || contextB.finance.transactions.length === 0) &&
      (!contextB.health || contextB.health.steps.length === 0) &&
      (!contextB.goals || contextB.goals.length === 0)
    ) {
      console.log('✅ Strict User Isolation verified: User B cannot access User A\'s data.');
    } else {
      throw new Error('CRITICAL: User isolation failed! User B retrieved data belonging to User A.');
    }
    console.log();

    // ----------------------------------------------------
    // TEST 4: Date Filtering
    // ----------------------------------------------------
    console.log('--- TEST 4: Date Filtering ---');
    
    // Test explicit options date filter (e.g. July 12 to July 16)
    const dateFiltered = await sqlContextService.getContext(userA_Uid, ['finance', 'health'], {
      startDate: '2026-07-12',
      endDate: '2026-07-16'
    });

    // Expenses between 12th and 16th: Transport (12th), Dinner (15th) -> total 2
    if (dateFiltered.finance && dateFiltered.finance.transactions.length === 2) {
      console.log('✅ Date filtering correctly restricted expenses context.');
    } else {
      throw new Error(`Expected 2 date-filtered expenses, got ${dateFiltered.finance?.transactions?.length}`);
    }

    // Health records: 11th is excluded, 15th is included -> steps: 15th, sleep: 15th (10th is excluded)
    // Wait, the 10th and 11th are both before the 12th. So only the record of July 15 should be included.
    if (dateFiltered.health && dateFiltered.health.steps.length === 1 && dateFiltered.health.steps[0].date === '2026-07-15') {
      console.log('✅ Date filtering correctly restricted health records context.');
    } else {
      throw new Error(`Expected 1 date-filtered health log (July 15), got steps count: ${dateFiltered.health?.steps?.length}`);
    }
    console.log();

    // ----------------------------------------------------
    // TEST 5: Date Heuristic Parsing
    // ----------------------------------------------------
    console.log('--- TEST 5: NLP Heuristic Date Range Detection ---');
    
    const filters = sqlContextService.parseFilters('what did I do in the last 7 days?');
    if (filters.startDate && filters.endDate) {
      console.log(`✅ NLP parsing parsed 'last 7 days' into: ${filters.startDate} to ${filters.endDate}`);
    } else {
      throw new Error('Failed to parse NLP date range');
    }
    console.log();

    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! SQL CONTEXT SERVICE IS SECURE AND FUNCTIONAL.');

  } finally {
    // Clean up all inserted records
    console.log('\n[Cleanup] Removing temporary test records...');
    if (idA) {
      await db.delete(schema.goals).where(eq(schema.goals.userId, idA));
      await db.delete(schema.expenses).where(eq(schema.expenses.userId, idA));
      await db.delete(schema.healthRecords).where(eq(schema.healthRecords.userId, idA));
      
      const habits = await db.select().from(schema.habits).where(eq(schema.habits.userId, idA));
      const habitIds = habits.map(h => h.id);
      if (habitIds.length > 0) {
        await db.delete(schema.habitLogs).where(inArray(schema.habitLogs.habitId, habitIds));
      }
      await db.delete(schema.habits).where(eq(schema.habits.userId, idA));
      await db.delete(schema.users).where(eq(schema.users.id, idA));
    }
    if (idB) {
      await db.delete(schema.users).where(eq(schema.users.id, idB));
    }
    console.log('[Cleanup] Cleanup complete.');
  }
}

runTests().catch(e => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', e);
  process.exit(1);
});
