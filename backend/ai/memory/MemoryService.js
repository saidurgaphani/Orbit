import { db } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import GeminiProvider from '../providers/GeminiProvider.js';

const MEMORY_DETECTION_SYSTEM_PROMPT = `You are Orbit's Memory Detection Engine.
Analyze the user's message/question. Determine if the user is sharing a significant, useful personal fact, goal, preference, constraint, plan, or habit that should be remembered to personalize future advice.

Do NOT remember:
1. Passwords, auth tokens, API keys, private credentials, or sensitive documents (e.g. Aadhaar/SSN numbers).
2. Unimportant, fleeting noise, greeting pleasantries (e.g., "hi", "how are you").
3. Direct questions to the assistant (e.g. "Can I buy a laptop?"). Only remember facts that the user is disclosing.

Return ONLY a JSON object with this exact structure:
{
  "worth_remembering": true,
  "content": "A clean, summarized, direct first-person statement to remember (e.g., 'I prefer conservative financial decisions' or 'I am preparing for GATE exam' or 'My goal is to save ₹300,000')",
  "memory_type": "finance | health | education | career | lifestyle | general",
  "importance": 1
}

If nothing is worth remembering, return:
{
  "worth_remembering": false,
  "content": "",
  "memory_type": "general",
  "importance": 1
}`;

export default class MemoryService {
  constructor(options = {}) {
    this.provider = options.provider ?? new GeminiProvider();
  }

  /**
   * Evaluates if a question contains user facts worth remembering.
   * 
   * @param {string} question - The user question or message.
   * @returns {Promise<object|null>} The proposed memory object, or null if nothing.
   */
  async detectAndExtractMemory(question) {
    if (!question || typeof question !== 'string' || !question.trim()) {
      return null;
    }

    try {
      const response = await this.provider.generateStructured(
        `User Message: "${question.trim()}"`,
        MEMORY_DETECTION_SYSTEM_PROMPT
      );

      if (response && response.worth_remembering && response.content?.trim()) {
        // Basic security check: verify it doesn't look like credentials or secrets
        const contentLower = response.content.toLowerCase();
        if (
          contentLower.includes('password') ||
          contentLower.includes('secret') ||
          contentLower.includes('token') ||
          contentLower.includes('api_key') ||
          contentLower.includes('apikey')
        ) {
          return null;
        }

        return {
          content: response.content.trim(),
          memory_type: response.memory_type || 'general',
          importance: response.importance || 1
        };
      }
    } catch (err) {
      console.warn('[MemoryService] Failed to run memory detection:', err.message);
    }

    return null;
  }

  /**
   * Retrieves user memories matching semantic relevance to the question.
   * 
   * @param {string} userId - The Neon user ID.
   * @param {string} question - The user question.
   * @returns {Promise<Array>} List of relevant memory strings.
   */
  async retrieveRelevantMemories(userId, question) {
    if (!userId) throw new Error('userId is required for memory retrieval');

    try {
      // 1. Fetch all memories for the user (guarantees isolation)
      const userMemories = await db.select()
        .from(schema.aiMemories)
        .where(eq(schema.aiMemories.userId, userId))
        .orderBy(desc(schema.aiMemories.createdAt));

      if (userMemories.length === 0) {
        return [];
      }

      // 2. Perform a lightweight relevance selection using LLM
      const memoriesListText = userMemories
        .map(m => `[ID: ${m.id}] Type: ${m.memoryType} - "${m.content}"`)
        .join('\n');

      const relevancePrompt = `You are Orbit's Memory Relevance Filter.
Given a list of user memories and a question, identify ONLY the user memories that are relevant to answering the question.
Question: "${question}"

User Memories:
${memoriesListText}

Return ONLY a JSON array containing the UUIDs of the relevant memories.
Example output format:
["uuid-1", "uuid-2"]

If no memories are relevant, return: []`;

      const response = await this.provider.generateStructured(
        relevancePrompt,
        'Return only a JSON array of memory IDs. No other text.'
      );

      const relevantIds = Array.isArray(response) ? response : [];
      
      // 3. Map IDs back to full memory content objects
      const matchingMemories = userMemories.filter(m => relevantIds.includes(m.id));
      return matchingMemories;
    } catch (err) {
      console.warn('[MemoryService] Relevance retrieval failed. Returning empty:', err.message);
      return [];
    }
  }

  /**
   * Adds a new approved memory for the user.
   */
  async addMemory(userId, memoryData) {
    if (!userId) throw new Error('userId is required');
    if (!memoryData?.content?.trim()) throw new Error('Memory content is required');

    const newRecord = {
      userId,
      content: memoryData.content.trim(),
      memoryType: memoryData.memory_type || 'general',
      importance: memoryData.importance || 1,
      source: memoryData.source || 'user'
    };

    const [inserted] = await db.insert(schema.aiMemories)
      .values(newRecord)
      .returning();

    return inserted;
  }

  /**
   * Deletes a memory for the user, verifying ownership.
   */
  async deleteMemory(userId, memoryId) {
    if (!userId) throw new Error('userId is required');
    if (!memoryId) throw new Error('memoryId is required');

    const [deleted] = await db.delete(schema.aiMemories)
      .where(and(
        eq(schema.aiMemories.id, memoryId),
        eq(schema.aiMemories.userId, userId)
      ))
      .returning();

    return !!deleted;
  }

  /**
   * Lists all memories belonging to the user.
   */
  async listMemories(userId) {
    if (!userId) throw new Error('userId is required');
    
    return db.select()
      .from(schema.aiMemories)
      .where(eq(schema.aiMemories.userId, userId))
      .orderBy(desc(schema.aiMemories.createdAt));
  }
}
