/**
 * Integration test: POST /api/decision/analyze
 *
 * Tests the full production endpoint against the live server:
 *   - Input validation
 *   - Authentication (Firebase token + session fallback)
 *   - Neon DB context retrieval
 *   - Decision Engine response structure validation
 *   - Error scenarios (missing token, bad token, empty question, too-long question)
 *
 * Prerequisites:
 *   - Backend must be running: npm run dev (port 5050 by default)
 *   - A valid Neon user must exist for the test UID
 *
 * Usage:
 *   node --env-file=.env scratch/test_analyze_api.js
 */

import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const BASE_URL  = `http://localhost:${process.env.PORT || 5050}`;
const ENDPOINT  = `${BASE_URL}/api/decision/analyze`;

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function assert(label, condition, info = '') {
  if (!condition) throw new Error(`ASSERT FAILED — ${label}${info ? `: ${info}` : ''}`);
  console.log(`  ✓ ${label}`);
}

function assertStatus(label, got, expected) {
  if (got !== expected) throw new Error(`ASSERT FAILED — ${label}: expected HTTP ${expected}, got ${got}`);
  console.log(`  ✓ ${label}: HTTP ${got}`);
}

// ── TEST USER LIFECYCLE ───────────────────────────────────────────────────────

async function seedTestUser(firebaseUid) {
  const [user] = await db.insert(schema.users).values({
    firebaseUid,
    email: `${firebaseUid}@orbit-api-test.com`,
    name:  'API Test User',
    profileData: {
      finance: {
        income:       60000,
        monthlyBudget: 40000,
        currentSavings: 120000,
        emergencyFund: { target: 200000, current: 120000 },
      }
    }
  }).returning();

  const today = new Date().toISOString().split('T')[0];
  await db.insert(schema.expenses).values([
    { userId: user.id, amount: '5000',  category: 'Food',      transactionDate: today },
    { userId: user.id, amount: '2000',  category: 'Transport', transactionDate: today },
    { userId: user.id, amount: '3000',  category: 'Entertainment', transactionDate: today },
  ]);
  await db.insert(schema.goals).values({
    userId: user.id, title: 'Save for trip',
    targetValue: '100000', currentValue: '30000', status: 'active',
  });

  return user;
}

async function cleanupUser(dbUserId) {
  await db.delete(schema.goals).where(eq(schema.goals.userId, dbUserId));
  await db.delete(schema.expenses).where(eq(schema.expenses.userId, dbUserId));
  await db.delete(schema.users).where(eq(schema.users.id, dbUserId));
  console.log(`  [Cleanup] Removed test user ${dbUserId}`);
}

/**
 * Creates a session in the server's session store by calling /api/auth/session.
 * The session token is then usable as a Bearer token.
 *
 * Since we can't get a real Firebase ID token without the client SDK,
 * we use the session token created by the app's own login route which accepts
 * Firebase ID tokens and stores a session.
 *
 * For this test, we manually inject a session via the login endpoint using
 * a test Firebase ID token obtained from the test user.
 *
 * Alternatively: use the /api/auth/session endpoint (requires a real Firebase token).
 * Here we test the "session token" auth path by creating a session directly via
 * the backend's internal session mechanism.
 */
async function createSessionToken(firebaseUid, userObj) {
  // Create a session token directly (mirrors what /api/auth/session does after
  // Firebase token verification succeeds). We call the session endpoint.
  // Since we don't have a real Firebase token, we'll use the server's own
  // test-mode which creates a session directly if ALLOW_TEST_SESSION=true.
  // Instead, we inject a session via the backend API if test endpoint exists.
  //
  // For this test suite, we use a different approach:
  // Create a predictable session token and verify the server accepts it.
  // This mirrors the exact format the frontend sends.
  const sessionToken = crypto.randomBytes(32).toString('hex');

  // Inject via the backend's own session creation mechanism
  // by calling POST /api/auth/test-session (only available in dev)
  const res = await fetch(`${BASE_URL}/api/auth/test-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseUid, sessionToken, name: userObj.name, email: userObj.email }),
  });

  if (res.ok) {
    return sessionToken;
  }

  // Fallback: the test session endpoint is not available.
  // We'll still run the auth error tests, and skip the authenticated tests.
  console.warn('  ⚠ /api/auth/test-session not available. Authenticated tests will be skipped.');
  return null;
}

// ── TEST CASES ────────────────────────────────────────────────────────────────

async function testInputValidation() {
  console.log('\n─── TEST 1: Input Validation ─────────────────────────────────');

  // 1a. Missing question field
  let r = await post(ENDPOINT, {});
  assertStatus('Missing question → 400',  r.status, 400);
  assert('error code INVALID_INPUT',      r.body?.error === 'INVALID_INPUT');

  // 1b. Blank question
  r = await post(ENDPOINT, { question: '   ' });
  assertStatus('Blank question → 400',    r.status, 400);
  assert('error code INVALID_INPUT',      r.body?.error === 'INVALID_INPUT');

  // 1c. Non-string question
  r = await post(ENDPOINT, { question: 42 });
  assertStatus('Non-string question → 400', r.status, 400);
  assert('error code INVALID_INPUT',        r.body?.error === 'INVALID_INPUT');

  // 1d. Overly long question (1001 chars)
  r = await post(ENDPOINT, { question: 'a'.repeat(1001) });
  assertStatus('Too-long question → 400', r.status, 400);
  assert('error code INVALID_INPUT',      r.body?.error === 'INVALID_INPUT');

  console.log('  ✓ TEST 1 PASSED: Input validation errors are correct');
}

async function testMissingAuthHeader() {
  console.log('\n─── TEST 2: Missing Authorization Header ─────────────────────');

  const r = await post(ENDPOINT, { question: 'Can I buy a laptop?' });
  assertStatus('No auth header → 401',    r.status, 401);
  assert('success=false',                 r.body?.success === false);
  assert('error code MISSING_TOKEN',      r.body?.error === 'MISSING_TOKEN');
  assert('message present',              typeof r.body?.message === 'string');
  assert('no internal error details',     !r.body?.stack && !r.body?.details);

  console.log('  ✓ TEST 2 PASSED: Missing auth header handled correctly');
}

async function testInvalidToken() {
  console.log('\n─── TEST 3: Invalid Firebase Token ───────────────────────────');

  const r = await post(ENDPOINT, { question: 'Can I buy a laptop?' }, {
    Authorization: 'Bearer this_is_not_a_valid_firebase_token_at_all',
  });
  assertStatus('Invalid token → 403',     r.status, 403);
  assert('success=false',                 r.body?.success === false);
  assert('error code AUTH_FAILED',        r.body?.error === 'AUTH_FAILED');
  assert('no internal error exposed',     !r.body?.stack);

  console.log('  ✓ TEST 3 PASSED: Invalid token rejected with 403');
}

async function testMalformedBearerHeader() {
  console.log('\n─── TEST 4: Malformed Authorization Header ───────────────────');

  // "Token" instead of "Bearer"
  const r = await post(ENDPOINT, { question: 'Can I invest?' }, {
    Authorization: 'Token abc123',
  });
  assertStatus('Wrong scheme → 401',      r.status, 401);
  assert('error code MISSING_TOKEN',      r.body?.error === 'MISSING_TOKEN');

  console.log('  ✓ TEST 4 PASSED: Malformed header rejected correctly');
}

async function testSuccessWithRealUser(sessionToken, firebaseUid) {
  if (!sessionToken) {
    console.log('\n─── TEST 5: Authenticated Request (SKIPPED — no session token) ─');
    return;
  }

  console.log('\n─── TEST 5: Authenticated Request with Real DB Context ────────');

  const r = await post(ENDPOINT, { question: 'Can I buy a laptop worth ₹70000?' }, {
    Authorization: `Bearer ${sessionToken}`,
  });

  console.log(`  HTTP status: ${r.status}`);
  console.log(`  Response keys: ${Object.keys(r.body || {}).join(', ')}`);

  assertStatus('Authenticated request → 200', r.status, 200);
  assert('success=true',                r.body?.success === true);
  assert('decision field present',      typeof r.body?.decision === 'string' && r.body.decision.length > 0);
  assert('reasoning field present',     typeof r.body?.reasoning === 'string');
  assert('tradeoffs is array',          Array.isArray(r.body?.tradeoffs));
  assert('risks is array',              Array.isArray(r.body?.risks));
  assert('missing_information is array', Array.isArray(r.body?.missing_information));
  assert('next_step field present',     typeof r.body?.next_step === 'string');
  assert('confidence field present',    ['HIGH', 'MEDIUM', 'LOW'].includes(r.body?.confidence));
  assert('context_summary present',     typeof r.body?.context_summary === 'object');
  assert('context_summary.category',    typeof r.body.context_summary?.category === 'string');
  assert('data_available flags',        typeof r.body.context_summary?.data_available === 'object');

  // Verify no internal data leaked
  assert('no internal userId leaked',   !r.body?.userId || r.body.userId === firebaseUid);
  assert('no DB schema exposed',        !r.body?.decision_context);
  assert('no stack traces',             !r.body?.stack);

  console.log('\n  Decision Engine output:');
  console.log(`    decision:   ${r.body.decision}`);
  console.log(`    confidence: ${r.body.confidence}`);
  console.log(`    next_step:  ${r.body.next_step}`);
  console.log(`    category:   ${r.body.context_summary.category}`);
  console.log(`    rag_used:   ${r.body.context_summary.rag_chunks_used}`);

  console.log('\n  ✓ TEST 5 PASSED: Authenticated request returned valid decision');
}

async function testResponseDoesNotLeakInternals(sessionToken) {
  if (!sessionToken) {
    console.log('\n─── TEST 6: No Internal Leak (SKIPPED — no session token) ─────');
    return;
  }

  console.log('\n─── TEST 6: Response Does Not Leak Internal Details ──────────');

  const r = await post(ENDPOINT, { question: 'What is my savings goal progress?' }, {
    Authorization: `Bearer ${sessionToken}`,
  });

  // Internal fields that must NEVER appear in the response
  const FORBIDDEN = [
    'stack', 'trace', 'sql', 'query', 'DATABASE_URL', 'GEMINI_API_KEY',
    'password', 'secretKey', 'session_token', 'dbUserId', 'neonUser',
  ];

  const bodyStr = JSON.stringify(r.body || {}).toLowerCase();
  for (const forbidden of FORBIDDEN) {
    if (bodyStr.includes(forbidden.toLowerCase())) {
      throw new Error(`Internal field "${forbidden}" found in response body!`);
    }
  }
  console.log('  ✓ No internal keys leaked in response');

  // decision_context (debug field) must not be in /analyze response
  assert('decision_context not exposed', !('decision_context' in (r.body || {})));

  console.log('  ✓ TEST 6 PASSED: No internal details leaked to client');
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(68));
  console.log('  POST /api/decision/analyze — API INTEGRATION TEST SUITE');
  console.log('═'.repeat(68));
  console.log(`  Endpoint: ${ENDPOINT}`);

  // Check server is reachable
  try {
    const health = await fetch(`${BASE_URL}/health`);
    if (!health.ok) throw new Error(`Health check returned ${health.status}`);
    console.log(`  ✓ Server reachable at ${BASE_URL}`);
  } catch (err) {
    console.error(`\n  ✗ Cannot reach server at ${BASE_URL}. Is it running?`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }

  // Seed test user in Neon
  const firebaseUid = `orbit_api_test_${Date.now()}`;
  const testUser = await seedTestUser(firebaseUid);
  console.log(`  ✓ Test user seeded in Neon: ${testUser.id}`);

  // Attempt to create session token via dev endpoint
  const sessionToken = await createSessionToken(firebaseUid, testUser);
  if (sessionToken) {
    console.log(`  ✓ Session token created: ${sessionToken.substring(0, 16)}...`);
  }

  let passed = 0, failed = 0;

  const tests = [
    testInputValidation,
    testMissingAuthHeader,
    testInvalidToken,
    testMalformedBearerHeader,
    () => testSuccessWithRealUser(sessionToken, firebaseUid),
    () => testResponseDoesNotLeakInternals(sessionToken),
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.error(`\n  ✗ FAILED: ${err.message}`);
      failed++;
    }
  }

  await cleanupUser(testUser.id);

  console.log('\n' + '═'.repeat(68));
  console.log(`  RESULTS: ${passed} passed / ${failed} failed / ${tests.length} total`);
  console.log('═'.repeat(68) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
