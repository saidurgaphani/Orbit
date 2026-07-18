import { db } from '../../db/index.js';
import { documentChunks, users } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export default class RAGService {
  constructor(aiProvider) {
    this.provider = aiProvider;
  }

  /**
   * Chunks text into smaller pieces with overlap using sliding window.
   * @param {string} text - The input text.
   * @param {number} size - Chunk size in characters.
   * @param {number} overlap - Overlap in characters.
   * @returns {string[]} Chunks of text.
   */
  chunkText(text, size = 1000, overlap = 200) {
    if (!text) return [];
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      chunks.push(text.slice(start, end));
      start += size - overlap;
    }
    
    return chunks;
  }

  /**
   * Chunks a document and stores embeddings in Neon DB.
   * @param {string} userId - The Firebase UID of the user.
   * @param {string} docId - The document's UUID.
   * @param {string} text - The extracted text content.
   */
  async ingestDocument(userId, docId, text) {
    if (!text || !userId || !docId) return;
    try {
      console.log(`[RAGService] Ingesting document ${docId} for user ${userId}...`);
      const chunks = this.chunkText(text);
      console.log(`[RAGService] Generated ${chunks.length} chunks.`);

      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i];
        console.log(`[RAGService] Embedding chunk ${i+1}/${chunks.length}...`);
        const vector = await this.provider.embed(chunkContent);

        await db.insert(documentChunks).values({
          documentId: docId,
          userId: userId,
          chunkIndex: i,
          content: chunkContent,
          embedding: vector
        });
      }
      console.log(`[RAGService] Document ${docId} ingestion complete.`);
    } catch (err) {
      console.error('[RAGService] Document ingestion failed:', err);
    }
  }

  /**
   * Retrieves relevant chunks matching the query using pgvector cosine distance.
   * @param {string} userId - The Firebase UID.
   * @param {string} queryText - The query string.
   * @param {number} limit - Maximum number of chunks to return.
   * @returns {Promise<string>} Concentated text chunks.
   */
  async retrieveRelevantChunks(userId, queryText, limit = 5) {
    if (!queryText || !userId) return '';
    try {
      console.log(`[RAGService] Retrieving chunks for user query: "${queryText}"`);

      // Resolve DB UUID if userId is a Firebase UID
      let dbUserId = userId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!isUuid) {
        const userRows = await db.select({ id: users.id }).from(users).where(eq(users.firebaseUid, userId));
        if (userRows && userRows.length > 0) {
          dbUserId = userRows[0].id;
        } else {
          console.warn(`[RAGService] Could not resolve DB UUID for Firebase UID: ${userId}`);
          return '';
        }
      }

      const queryVector = await this.provider.embed(queryText);
      const vectorString = JSON.stringify(queryVector);

      const results = await db.select({
        content: documentChunks.content
      })
      .from(documentChunks)
      .where(eq(documentChunks.userId, dbUserId))
      .orderBy(sql`${documentChunks.embedding} <=> ${vectorString}::vector`)
      .limit(limit);

      if (!results || results.length === 0) {
        console.log('[RAGService] No relevant chunks found.');
        return '';
      }

      console.log(`[RAGService] Found ${results.length} relevant chunks.`);
      return results.map(r => r.content).join('\n---\n');
    } catch (err) {
      console.error('[RAGService] Chunk retrieval failed:', err);
      return '';
    }
  }

  /**
   * Production RAG Pipeline: Retrieves relevant chunks matching the question with a similarity threshold.
   * Returns only chunks belonging to the authenticated user that pass the relevance filter.
   * 
   * @param {string} userId - Firebase UID or DB UUID.
   * @param {string} question - User question to match against chunks.
   * @param {object} [options] - Options (threshold, limit).
   * @returns {Promise<string[]>} List of retrieved text chunks.
   */
  async retrieveRelevantContext(userId, question, options = {}) {
    if (!question || !userId) return [];
    const threshold = options.threshold !== undefined ? options.threshold : 0.70;
    const limit = options.limit || 3;

    try {
      console.log(`[RAGService] retrieveRelevantContext for user: ${userId}, question: "${question}"`);

      // Resolve DB UUID if userId is a Firebase UID
      let dbUserId = userId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!isUuid) {
        const userRows = await db.select({ id: users.id }).from(users).where(eq(users.firebaseUid, userId));
        if (userRows && userRows.length > 0) {
          dbUserId = userRows[0].id;
        } else {
          console.warn(`[RAGService] Could not resolve DB UUID for Firebase UID: ${userId}`);
          return [];
        }
      }

      const queryVector = await this.provider.embed(question);
      const vectorString = JSON.stringify(queryVector);

      const similaritySql = sql`1 - (${documentChunks.embedding} <=> ${vectorString}::vector)`;
      const results = await db.select({
        content: documentChunks.content,
        similarity: similaritySql
      })
      .from(documentChunks)
      .where(and(
        eq(documentChunks.userId, dbUserId),
        sql`1 - (${documentChunks.embedding} <=> ${vectorString}::vector) >= ${threshold}`
      ))
      .orderBy(sql`${documentChunks.embedding} <=> ${vectorString}::vector`)
      .limit(limit);

      if (!results || results.length === 0) {
        console.log(`[RAGService] No chunks met the similarity threshold of ${threshold}.`);
        return [];
      }

      console.log(`[RAGService] Found ${results.length} chunks meeting threshold ${threshold}.`);
      return results.map(r => r.content);
    } catch (err) {
      console.error('[RAGService] retrieveRelevantContext failed:', err);
      return [];
    }
  }
}

