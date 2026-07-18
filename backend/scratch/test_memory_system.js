/**
 * Integration Test: AI Memory System
 * 
 * Verifies memory detection, CRUD API operations, user-scoped isolation,
 * and integration with the Decision Engine.
 * 
 * Run with:
 *   node scratch/test_memory_system.js
 */

import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}`;

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function assert(label, condition) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${label}`);
  }
  console.log(`  ✓ ${label}`);
}

async function seedTestUser(firebaseUid, name) {
  // Check if exists
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.firebaseUid, firebaseUid));
  if (existing) return existing;

  const [user] = await db.insert(schema.users).values({
    firebaseUid,
    email: `${firebaseUid}@orbit-memory-test.com`,
    name,
    profileData: {
      finance: { income: 50000, spent: 20000 }
    }
  }).returning();
  return user;
}

async function main() {
  console.log('================================================================');
  console.log('             ORBIT AI MEMORY SYSTEM INTEGRATION TEST            ');
  console.log('================================================================');

  const userAUid = `test_user_a_${Date.now()}`;
  const userBUid = `test_user_b_${Date.now()}`;
  const tokenA = `token_a_${crypto.randomBytes(8).toString('hex')}`;
  const tokenB = `token_b_${crypto.randomBytes(8).toString('hex')}`;

  let userA, userB;

  try {
    // 1. Seed Users in DB
    userA = await seedTestUser(userAUid, 'User A');
    userB = await seedTestUser(userBUid, 'User B');
    console.log(`Seeded User A (${userA.id}) and User B (${userB.id}) in Neon.`);

    // 2. Inject sessions
    const sessionARes = await request('POST', '/api/auth/test-session', {
      firebaseUid: userAUid,
      sessionToken: tokenA,
      name: 'User A'
    });
    assert('Test session injected for User A', sessionARes.status === 200);

    const sessionBRes = await request('POST', '/api/auth/test-session', {
      firebaseUid: userBUid,
      sessionToken: tokenB,
      name: 'User B'
    });
    assert('Test session injected for User B', sessionBRes.status === 200);

    // 3. Test POST /api/memory (Create)
    console.log('\n--- TEST 1: Saving Memories (POST) ---');
    const saveRes = await request('POST', '/api/memory', {
      content: 'I prefer conservative financial decisions',
      memory_type: 'finance',
      importance: 3,
      source: 'user'
    }, tokenA);
    assert('Save memory for User A returned 200', saveRes.status === 200);
    assert('Save memory response indicates success', saveRes.body.success === true);
    assert('Memory content matches request', saveRes.body.memory.content === 'I prefer conservative financial decisions');
    const memoryId = saveRes.body.memory.id;

    // Test validation
    const invalidSaveRes = await request('POST', '/api/memory', { content: '' }, tokenA);
    assert('Empty memory content rejected with 400', invalidSaveRes.status === 400);

    // Test unauthenticated
    const unauthSaveRes = await request('POST', '/api/memory', { content: 'hello' });
    assert('Unauthenticated memory save rejected with 401', unauthSaveRes.status === 401);

    // 4. Test GET /api/memory (List & Isolation)
    console.log('\n--- TEST 2: Listing & Security Isolation (GET) ---');
    const listARes = await request('GET', '/api/memory', null, tokenA);
    assert('List User A memories returned 200', listARes.status === 200);
    assert('List User A contains exactly 1 memory', listARes.body.memories?.length === 1);
    assert('Memory content in list matches', listARes.body.memories[0].id === memoryId);

    const listBRes = await request('GET', '/api/memory', null, tokenB);
    assert('List User B memories returned 200', listBRes.status === 200);
    assert('List User B is empty (Strict isolation works!)', listBRes.body.memories?.length === 0);

    // 5. Test Memory Detection via /api/decision/analyze
    console.log('\n--- TEST 3: Memory Detection & Prompting ---');
    const detectRes = await request('POST', '/api/decision/analyze', {
      question: 'Remember that I am preparing for GATE exam.'
    }, tokenA);
    assert('Decision analysis request returned 200', detectRes.status === 200);
    assert('Analysis response contains proposed_memory', detectRes.body.proposed_memory !== undefined);
    assert('Proposed memory contains correct content', detectRes.body.proposed_memory.content.toLowerCase().includes('gate'));

    const noDetectRes = await request('POST', '/api/decision/analyze', {
      question: 'What is the weather today?'
    }, tokenA);
    assert('No proposed memory returned for casual question', noDetectRes.body.proposed_memory === undefined);

    // 6. Test DELETE /api/memory (Delete & Ownership check)
    console.log('\n--- TEST 4: Deleting Memories (DELETE) ---');
    // Try to delete A's memory using B's token
    const deleteBRes = await request('DELETE', `/api/memory/${memoryId}`, null, tokenB);
    assert('User B cannot delete User A\'s memory (returned 404/denied)', deleteBRes.status === 404);

    // Delete A's memory with A's token
    const deleteARes = await request('DELETE', `/api/memory/${memoryId}`, null, tokenA);
    assert('User A can delete their own memory (returned 200)', deleteARes.status === 200);

    // Verify it is gone
    const listAAfterDelete = await request('GET', '/api/memory', null, tokenA);
    assert('User A memory list is now empty', listAAfterDelete.body.memories?.length === 0);

    console.log('\n================================================================');
    console.log('             ALL INTEGRATION TESTS PASSED SUCCESSFULLY!          ');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
  } finally {
    // Clean up Neon DB
    console.log('\nCleaning up seeded users and memories...');
    try {
      if (userA || userB) {
        const uids = [];
        if (userA) uids.push(userA.id);
        if (userB) uids.push(userB.id);

        // Delete memories
        await db.delete(schema.aiMemories).where(inArray(schema.aiMemories.userId, uids));
        // Delete users
        await db.delete(schema.users).where(inArray(schema.users.id, uids));
        console.log('Seeded database records successfully cleaned.');
      }
    } catch (cleanErr) {
      console.error('Failed to clean up seeded database records:', cleanErr.message);
    }
  }
}

main();
