/**
 * Integration Test: User-Specific RAG Pipeline
 * 
 * Verifies the 5 key RAG requirements:
 *   1. Relevant document retrieval (finds the matching document).
 *   2. Irrelevant document exclusion (filters out unrelated documents).
 *   3. Cross-user data isolation (never retrieves other users' files).
 *   4. Empty retrieval results (handles cases with no matching data gracefully).
 *   5. Low relevance scores (excludes matches below the similarity threshold).
 * 
 * Usage:
 *   node --env-file=.env scratch/test_rag_pipeline.js
 */

import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import GeminiProvider from '../ai/providers/GeminiProvider.js';
import RAGService from '../ai/context/RAGService.js';

const provider = new GeminiProvider();
const ragService = new RAGService(provider);

// Override provider.embed to return mock semantic embeddings for testing
provider.embed = async (text) => {
  let baseVector = Array.from({ length: 768 }, () => 0);
  const lower = text.toLowerCase();
  
  if (lower.includes('insurance') || lower.includes('policy') || lower.includes('afford')) {
    // Insurance direction
    for (let i = 0; i < 384; i++) baseVector[i] = 1.0;
  }
  if (lower.includes('dental') || lower.includes('user beta only')) {
    // Dental / User B direction
    for (let i = 384; i < 768; i++) baseVector[i] = 1.0;
  }
  if (lower.includes('weight') || lower.includes('logs')) {
    // Weight direction
    for (let i = 200; i < 500; i++) baseVector[i] = 1.0;
  }

  // Add stable string-based noise (10%)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  let seed = hash;
  const rand = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < 768; i++) {
    baseVector[i] += (rand() * 2 - 1) * 0.5;
  }

  // Normalize
  const magnitude = Math.sqrt(baseVector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    baseVector = baseVector.map(v => v / magnitude);
  }
  return baseVector;
};


// ── HELPERS ──────────────────────────────────────────────────────────────────


function assert(label, condition, info = '') {
  if (!condition) {
    throw new Error(`Assertion failed — ${label}${info ? `: ${info}` : ''}`);
  }
  console.log(`  ✓ ${label}`);
}

async function seedUser(firebaseUid, name) {
  const [user] = await db.insert(schema.users).values({
    firebaseUid,
    email: `${firebaseUid}@rag-test.com`,
    name,
  }).returning();
  return user;
}

async function seedDocumentAndIngest(userId, fileName, content) {
  const [doc] = await db.insert(schema.documents).values({
    userId,
    fileName,
    extractedText: content,
    category: 'Personal'
  }).returning();

  // Run the standard ingestion process to generate chunks and embeddings
  await ragService.ingestDocument(userId, doc.id, content);
  return doc;
}

async function cleanupUser(dbUserId) {
  // Cascading foreign keys will delete documentChunks when documents are deleted
  const userDocs = await db.select({ id: schema.documents.id }).from(schema.documents).where(eq(schema.documents.userId, dbUserId));
  const docIds = userDocs.map(d => d.id);
  if (docIds.length > 0) {
    await db.delete(schema.documentChunks).where(inArray(schema.documentChunks.documentId, docIds));
    await db.delete(schema.documents).where(inArray(schema.documents.id, docIds));
  }
  await db.delete(schema.users).where(eq(schema.users.id, dbUserId));
  console.log(`  [Cleanup] Removed test user ${dbUserId}`);
}

// ── TESTS ──────────────────────────────────────────────────────────────────────

async function runTestPlan() {
  console.log('\n' + '═'.repeat(68));
  console.log('  ORBIT USER-SPECIFIC RAG PIPELINE — INTEGRATION TEST SUITE');
  console.log('═'.repeat(68));

  // 1. Seed two test users
  const uidA = `rag_user_a_${Date.now()}`;
  const uidB = `rag_user_b_${Date.now()}`;

  const userA = await seedUser(uidA, 'User Alpha');
  const userB = await seedUser(uidB, 'User Beta');

  console.log(`  Seeded test User A (${userA.id}) and User B (${userB.id})`);

  // 2. Ingest documents for User A
  // Document 1: Insurance Plan details
  const docA1Text = "This contract details an premium health insurance plan with Orbit worth ₹50000 per year. It covers medical procedures, doctor consultations, and prescriptions.";
  await seedDocumentAndIngest(userA.id, 'insurance_contract.txt', docA1Text);

  // Document 2: Unrelated personal health log (weight tracker)
  const docA2Text = "Weekly weight tracking statistics: Jan 1 is 70kg, Jan 8 is 70.5kg, Jan 15 is 71kg, Jan 22 is 69.8kg. Target weight is 68kg.";
  await seedDocumentAndIngest(userA.id, 'weight_logs.txt', docA2Text);

  // 3. Ingest documents for User B
  // Document 1: Confidential insurance details for User B
  const docB1Text = "This is a confidential insurance policy document for User Beta only. The plan covers full dental care, ophthalmology, and accidental injuries.";
  await seedDocumentAndIngest(userB.id, 'user_b_insurance.txt', docB1Text);

  console.log('  Documents and vector embeddings successfully ingested.\n');

  let passed = 0, failed = 0;

  // ── TEST 1: Relevant document retrieval ──────────────────────────────────────
  try {
    console.log('─── TEST 1: Relevant Document Retrieval ───────────────────────');
    const results = await ragService.retrieveRelevantContext(userA.id, 'Can I afford this health insurance plan?', {
      threshold: 0.65,
      limit: 3
    });
    
    assert('Retrieved context array', Array.isArray(results));
    assert('Found exactly one relevant chunk', results.length === 1);
    assert('Chunk contains "insurance plan"', results[0].includes('insurance plan'));
    passed++;
  } catch (err) {
    console.error(`  ✗ TEST 1 FAILED: ${err.message}`);
    failed++;
  }

  // ── TEST 2: Irrelevant document exclusion ────────────────────────────────────
  try {
    console.log('\n─── TEST 2: Irrelevant Document Exclusion ─────────────────────');
    const results = await ragService.retrieveRelevantContext(userA.id, 'Can I afford this health insurance plan?', {
      threshold: 0.65,
      limit: 3
    });

    // Make sure the weight logs document is excluded since it is completely irrelevant to "insurance plan"
    const hasWeightLogs = results.some(chunk => chunk.includes('weight tracking'));
    assert('Irrelevant documents excluded', !hasWeightLogs);
    passed++;
  } catch (err) {
    console.error(`  ✗ TEST 2 FAILED: ${err.message}`);
    failed++;
  }

  // ── TEST 3: Cross-user data isolation ──────────────────────────────────────
  try {
    console.log('\n─── TEST 3: Cross-User Data Isolation ─────────────────────────');
    const results = await ragService.retrieveRelevantContext(userA.id, 'What does my dental care insurance plan cover?', {
      threshold: 0.60,
      limit: 3
    });

    // User A should NOT retrieve User B's dental care insurance document
    const hasUserBDental = results.some(chunk => chunk.includes('User Beta only') || chunk.includes('dental care'));
    assert('Dental care chunk (belonging to User B) not retrieved', !hasUserBDental);
    passed++;
  } catch (err) {
    console.error(`  ✗ TEST 3 FAILED: ${err.message}`);
    failed++;
  }

  // ── TEST 4: Empty retrieval results ──────────────────────────────────────────
  try {
    console.log('\n─── TEST 4: Empty Retrieval Results ───────────────────────────');
    const results = await ragService.retrieveRelevantContext(userA.id, 'What is the weather forecast for Paris today?', {
      threshold: 0.70,
      limit: 3
    });

    assert('No results found for unrelated query', Array.isArray(results) && results.length === 0);
    passed++;
  } catch (err) {
    console.error(`  ✗ TEST 4 FAILED: ${err.message}`);
    failed++;
  }

  // ── TEST 5: Low relevance scores ─────────────────────────────────────────────
  try {
    console.log('\n─── TEST 5: Low Relevance Scores Filtered Out ─────────────────');
    // Using a very high relevance threshold (0.95) should filter out the moderately similar insurance doc
    const results = await ragService.retrieveRelevantContext(userA.id, 'Can I afford this health insurance plan?', {
      threshold: 0.95,
      limit: 3
    });

    assert('Moderate matches excluded with strict threshold', Array.isArray(results) && results.length === 0);
    passed++;
  } catch (err) {
    console.error(`  ✗ TEST 5 FAILED: ${err.message}`);
    failed++;
  }

  // ── CLEANUP ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(68));
  await cleanupUser(userA.id);
  await cleanupUser(userB.id);

  console.log('\n' + '═'.repeat(68));
  console.log(`  RESULTS: ${passed} passed / ${failed} failed / ${passed + failed} total`);
  console.log('═'.repeat(68) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTestPlan().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
