/**
 * Integration test: Decision Context Builder Service → Neon DB
 *
 * This test verifies that:
 *   1. A Firebase UID is correctly resolved to a DB UUID
 *   2. Financial, goal, and health data are fetched from the real database
 *   3. Only the authenticated user's data is returned
 *   4. Missing values are returned as null (not invented)
 *   5. The full pipeline (DB → Decision Engine) produces a valid structured output
 *
 * Usage:
 *   node --env-file=.env scratch/test_decision_context.js
 */

import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import DecisionContextBuilderService from '../ai/decision/DecisionContextBuilderService.js';
import DecisionEngineService from '../ai/decision/DecisionEngineService.js';

const ctxBuilder = new DecisionContextBuilderService();
const engine     = new DecisionEngineService();

// ── HELPERS ──────────────────────────────────────────────────────────────────

function assertField(label, value, expected, strict = false) {
  if (strict) {
    if (value !== expected) {
      throw new Error(`Assertion failed — ${label}: expected "${expected}", got "${value}"`);
    }
  } else {
    if (value === undefined) {
      throw new Error(`Assertion failed — ${label}: field is undefined (missing from output)`);
    }
  }
  console.log(`  ✓ ${label}: ${JSON.stringify(value)}`);
}

function assertNull(label, value) {
  if (value !== null) {
    throw new Error(`Assertion failed — ${label}: expected null, got "${value}"`);
  }
  console.log(`  ✓ ${label}: correctly null`);
}

function assertArray(label, arr) {
  if (!Array.isArray(arr)) throw new Error(`${label} must be an array`);
  console.log(`  ✓ ${label}: array with ${arr.length} items`);
}

// ── SETUP / TEARDOWN ──────────────────────────────────────────────────────────

async function seedTestUser(firebaseUid, label) {
  const [user] = await db.insert(schema.users).values({
    firebaseUid,
    email: `${firebaseUid}@orbit-test.com`,
    name: label,
    profileData: {
      profile: { name: label },
      finance: {
        income: 75000,
        monthlyBudget: 50000,
        currentSavings: 200000,
        emergencyFund: { target: 300000, current: 200000 },
        budgets: { Food: 10000, Transport: 5000, Entertainment: 3000 },
      }
    }
  }).returning();
  return user;
}

async function cleanupUser(dbUserId, habitIds = []) {
  if (habitIds.length > 0) {
    await db.delete(schema.habitLogs).where(inArray(schema.habitLogs.habitId, habitIds));
    await db.delete(schema.habits).where(inArray(schema.habits.id, habitIds));
  }
  await db.delete(schema.goals).where(eq(schema.goals.userId, dbUserId));
  await db.delete(schema.expenses).where(eq(schema.expenses.userId, dbUserId));
  await db.delete(schema.healthRecords).where(eq(schema.healthRecords.userId, dbUserId));
  await db.delete(schema.users).where(eq(schema.users.id, dbUserId));
  console.log(`  [Cleanup] Removed test user ${dbUserId}`);
}

// ── TESTS ──────────────────────────────────────────────────────────────────────

async function testCategoryDetection() {
  console.log('\n─── TEST 1: Category Detection ───────────────────────────────');
  const cases = [
    { q: 'Can I buy a laptop for ₹70,000?',                      expected: 'finance'   },
    { q: 'Should I switch jobs for a better opportunity?',        expected: 'career'    },
    { q: 'How can I improve my sleep quality?',                   expected: 'health'    },
    { q: 'Should I enroll in an MBA program?',                    expected: 'education' },
    { q: 'Am I on track for my savings goal?',                    expected: 'goal'      },
    { q: 'Should I start waking up at 5 AM?',                     expected: 'lifestyle' },
    { q: 'What should I focus on this week?',                     expected: 'general'   },
  ];

  for (const { q, expected } of cases) {
    const detected = ctxBuilder._detectCategory(q);
    if (detected !== expected) {
      throw new Error(`Category mismatch for "${q}": expected "${expected}", got "${detected}"`);
    }
    console.log(`  ✓ "${q.substring(0, 45)}..." → ${detected}`);
  }
}

async function testContextWithRealData() {
  console.log('\n─── TEST 2: Context with Real DB Data ────────────────────────');

  const firebaseUid = `orbit_test_ctx_${Date.now()}`;
  const user = await seedTestUser(firebaseUid, 'Test User Alpha');
  const dbUserId = user.id;

  // Seed expenses (30-day window)
  const today = new Date().toISOString().split('T')[0];
  const fifteenDaysAgo = new Date(); fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const fifteenStr = fifteenDaysAgo.toISOString().split('T')[0];

  await db.insert(schema.expenses).values([
    { userId: dbUserId, amount: '12000', category: 'Food',       description: 'Monthly groceries', transactionDate: today },
    { userId: dbUserId, amount: '4500',  category: 'Transport',  description: 'Fuel',             transactionDate: fifteenStr },
    { userId: dbUserId, amount: '3000',  category: 'Entertainment', description: 'OTT + games',   transactionDate: fifteenStr },
  ]);

  // Seed goal
  await db.insert(schema.goals).values({
    userId: dbUserId,
    title: 'Build Emergency Fund',
    targetValue: '300000',
    currentValue: '200000',
    status: 'active',
  });

  try {
    const ctx = await ctxBuilder.buildDecisionContext(firebaseUid, 'Can I buy a laptop for ₹70,000?');

    console.log('  Decision category:', ctx.decision_category);
    assertField('decision_category', ctx.decision_category, 'finance', true);
    assertField('user_name',         ctx.user_name, 'Test User Alpha', true);

    // Financial context
    const fc = ctx.financial_context;
    assertField('monthly_income',   fc.monthly_income,  75000, true);
    assertField('monthly_budget',   fc.monthly_budget,  50000, true);
    assertField('current_savings',  fc.current_savings, 200000, true);
    assertField('monthly_expenses', fc.monthly_expenses); // computed from transactions

    // Ensure expense total is > 0 (real data, not null)
    if (!fc.monthly_expenses || fc.monthly_expenses <= 0) {
      throw new Error('Expected monthly_expenses > 0 from real transaction data');
    }
    console.log(`  ✓ monthly_expenses computed from real transactions: ₹${fc.monthly_expenses}`);

    // Goals
    if (!ctx.goals || ctx.goals.length === 0) {
      throw new Error('Expected at least 1 goal');
    }
    console.log(`  ✓ goals: ${ctx.goals.length} goal(s) — "${ctx.goals[0].title}"`);
    assertField('goal progress', ctx.goals[0].progress_pct);

    // Data availability flags
    const da = ctx.data_availability;
    if (!da.has_income)          throw new Error('has_income should be true');
    if (!da.has_expense_records) throw new Error('has_expense_records should be true');
    if (!da.has_goals)           throw new Error('has_goals should be true');
    console.log('  ✓ data_availability flags correct');

    console.log('  ✓ TEST 2 PASSED: Real data context built correctly');
  } finally {
    await cleanupUser(dbUserId);
  }
}

async function testContextMissingData() {
  console.log('\n─── TEST 3: Graceful Handling of Missing Data ────────────────');

  const firebaseUid = `orbit_test_empty_${Date.now()}`;
  // Minimal user — no finance profile, no expenses, no goals
  const [user] = await db.insert(schema.users).values({
    firebaseUid,
    email: `${firebaseUid}@orbit-test.com`,
    name: 'Empty User',
  }).returning();

  try {
    const ctx = await ctxBuilder.buildDecisionContext(firebaseUid, 'Can I invest in mutual funds?');

    const fc = ctx.financial_context;

    // All financial fields must be null (not invented)
    assertNull('monthly_income',   fc.monthly_income);
    assertNull('monthly_expenses', fc.monthly_expenses);
    assertNull('monthly_budget',   fc.monthly_budget);
    assertNull('current_savings',  fc.current_savings);

    // Goals must be null
    if (ctx.goals !== null && ctx.goals?.length !== 0) {
      throw new Error('Expected null or empty goals for user with no data');
    }
    console.log('  ✓ goals: null/empty (correct for user with no goals)');

    // Data availability must all be false
    const da = ctx.data_availability;
    if (da.has_income || da.has_expense_records || da.has_goals) {
      throw new Error('Data availability flags should all be false for empty user');
    }
    console.log('  ✓ data_availability flags all false (correct)');

    console.log('  ✓ TEST 3 PASSED: Missing data handled gracefully with nulls');
  } finally {
    await cleanupUser(user.id);
  }
}

async function testUserIsolation() {
  console.log('\n─── TEST 4: User Data Isolation ──────────────────────────────');

  const uidA = `orbit_iso_a_${Date.now()}`;
  const uidB = `orbit_iso_b_${Date.now()}`;

  const userA = await seedTestUser(uidA, 'Isolation User A');
  const [userB] = await db.insert(schema.users).values({
    firebaseUid: uidB, email: `${uidB}@orbit-test.com`, name: 'Isolation User B'
  }).returning();

  // Seed data ONLY for User A
  await db.insert(schema.expenses).values({
    userId: userA.id,
    amount: '50000',
    category: 'Savings',
    description: 'User A exclusive deposit',
    transactionDate: new Date().toISOString().split('T')[0],
  });

  try {
    // Fetch context for User B — must NOT see User A's expense
    const ctxB = await ctxBuilder.buildDecisionContext(uidB, 'What is my financial situation?');

    const fc = ctxB.financial_context;

    // User B has no income configured and no expenses
    assertNull('User B monthly_income',   fc.monthly_income);
    assertNull('User B monthly_expenses', fc.monthly_expenses);

    if (ctxB.relevant_records !== null && ctxB.relevant_records?.length > 0) {
      throw new Error('SECURITY: User B retrieved User A\'s transaction records!');
    }
    console.log('  ✓ ISOLATION VERIFIED: User B has zero access to User A\'s data');

    console.log('  ✓ TEST 4 PASSED: User isolation is secure');
  } finally {
    await cleanupUser(userA.id);
    await cleanupUser(userB.id);
  }
}

async function testUnknownFirebaseUid() {
  console.log('\n─── TEST 5: Unknown Firebase UID Returns Empty Context ────────');

  const fakeUid = 'firebase_uid_that_does_not_exist_xyz';
  const ctx = await ctxBuilder.buildDecisionContext(fakeUid, 'Should I invest?');

  if (!ctx._notice) {
    throw new Error('Expected _notice field for unknown user');
  }
  console.log(`  ✓ _notice returned: "${ctx._notice}"`);

  const fc = ctx.financial_context;
  assertNull('monthly_income for unknown user',   fc.monthly_income);
  assertNull('monthly_expenses for unknown user', fc.monthly_expenses);

  console.log('  ✓ TEST 5 PASSED: Unknown user handled gracefully');
}

async function testFullPipeline() {
  console.log('\n─── TEST 6: Full Pipeline — DB → Decision Engine ─────────────');

  const firebaseUid = `orbit_pipeline_${Date.now()}`;
  const user = await seedTestUser(firebaseUid, 'Pipeline Test User');

  const today = new Date().toISOString().split('T')[0];
  await db.insert(schema.expenses).values([
    { userId: user.id, amount: '8000',  category: 'Food',      description: 'Groceries', transactionDate: today },
    { userId: user.id, amount: '3000',  category: 'Transport', description: 'Commute',   transactionDate: today },
  ]);
  await db.insert(schema.goals).values({
    userId: user.id, title: 'Emergency Fund',
    targetValue: '300000', currentValue: '200000', status: 'active',
  });

  try {
    // Step A: build DB context
    const decisionContext = await ctxBuilder.buildDecisionContext(
      firebaseUid,
      'Can I buy a laptop for ₹70,000?'
    );

    const fc = decisionContext.financial_context;
    console.log('  Context summary:');
    console.log(`    income:    ${fc.monthly_income}`);
    console.log(`    expenses:  ${fc.monthly_expenses}`);
    console.log(`    savings:   ${fc.current_savings}`);
    console.log(`    category:  ${decisionContext.decision_category}`);

    // Step B: map to engine format
    const engineCtx = {
      monthly_income:    fc.monthly_income,
      monthly_expenses:  fc.monthly_expenses,
      current_savings:   fc.current_savings,
      upcoming_expenses: null,
      financial_goals:   decisionContext.goals
                           ? decisionContext.goals.map(g => `${g.title} (${g.progress_pct}% done)`)
                           : [],
    };

    // Step C: run Decision Engine
    const result = await engine.decide({
      question: 'Can I buy a laptop for ₹70,000?',
      user_context: engineCtx,
    });

    // Validate output
    const REQUIRED = ['decision', 'reasoning', 'tradeoffs', 'risks', 'missing_information', 'next_step', 'confidence'];
    for (const key of REQUIRED) {
      if (!(key in result)) throw new Error(`Decision Engine output missing key: "${key}"`);
    }
    console.log('\n  Decision Engine Output:');
    console.log(`    decision:    ${result.decision}`);
    console.log(`    confidence:  ${result.confidence}`);
    console.log(`    next_step:   ${result.next_step}`);
    console.log(`    missing_info: ${result.missing_information.join(', ') || 'none'}`);

    console.log('\n  ✓ TEST 6 PASSED: Full pipeline produced a valid structured decision');
  } finally {
    await cleanupUser(user.id);
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(68));
  console.log('  ORBIT DECISION CONTEXT BUILDER — DB INTEGRATION TEST SUITE');
  console.log('═'.repeat(68));

  let passed = 0, failed = 0;

  const tests = [
    testCategoryDetection,
    testContextWithRealData,
    testContextMissingData,
    testUserIsolation,
    testUnknownFirebaseUid,
    testFullPipeline,
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.error(`\n  ✗ FAILED: ${err.message}`);
      console.error(err.stack?.split('\n').slice(1, 4).join('\n'));
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(68));
  console.log(`  RESULTS: ${passed} passed / ${failed} failed / ${tests.length} total`);
  console.log('═'.repeat(68) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
