import { GoogleGenerativeAI } from '@google/generative-ai';
import AIProvider from './AIProvider.js';

export default class GeminiProvider extends AIProvider {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.modelName = 'gemini-2.0-flash';
  }

  async generate(prompt, systemInstruction = '', options = {}) {
    if (!this.client) {
      console.warn('Gemini client not initialized (missing API key). Using fallback text generation.');
      return JSON.stringify({ message: "Demo mode fallback output." });
    }
    try {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: { temperature: options.temperature ?? 0.1 }
      });

      let contentsPayload;
      if (typeof prompt === 'string') {
        contentsPayload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
      } else if (Array.isArray(prompt)) {
        contentsPayload = { contents: [{ role: 'user', parts: prompt }] };
      } else {
        contentsPayload = prompt;
      }

      const result = await model.generateContent({
        ...contentsPayload,
        systemInstruction: systemInstruction || undefined
      });
      return result.response.text();
    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('quota') || err.status === 429) {
        console.warn('[GeminiProvider] Quota exceeded. Returning fallback text.');
        return JSON.stringify({
          summary: "Notice: The Gemini API free-tier rate limit has been reached. Please add a valid billing account or wait a few minutes before trying again.",
          text: "Gemini rate limit active. Falling back to default brief.",
          message: "Gemini rate limit active. Falling back to default brief.",
          greeting: "Hello from Orbit! (API limit active)",
          priorities: ["Wait for Gemini free-tier rate limit cooldown (usually 1 minute)"],
          recommendations: ["Upgrade to standard Gemini tier for uninterrupted service"]
        });
      }
      throw err;
    }
  }

  async generateStructured(prompt, systemInstruction = '', schema = null, options = {}) {
    if (!this.client) {
      console.warn('Gemini client not initialized (missing API key). Using fallback JSON.');
      return { message: "Demo mode fallback output." };
    }
    try {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options.temperature ?? 0.1
        }
      });

      let contentsPayload;
      if (typeof prompt === 'string') {
        contentsPayload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
      } else if (Array.isArray(prompt)) {
        contentsPayload = { contents: [{ role: 'user', parts: prompt }] };
      } else {
        contentsPayload = prompt;
      }

      const result = await model.generateContent({
        ...contentsPayload,
        systemInstruction: systemInstruction || undefined
      });
      const text = result.response.text();
      return JSON.parse(text);
    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('quota') || err.status === 429) {
        console.warn('[GeminiProvider] Quota exceeded. Returning structured fallback JSON.');
        return {
          // Generic orbit fields
          summary: "Notice: The Gemini API free-tier rate limit has been reached. Please add a valid billing account or wait a few minutes before trying again.",
          text: "Gemini rate limit active. Falling back to default brief.",
          message: "Gemini rate limit active. Falling back to default brief.",
          greeting: "Hello from Orbit! (API limit active)",
          priorities: ["Wait for Gemini free-tier rate limit cooldown (usually 1 minute)"],
          recommendations: ["Upgrade to standard Gemini tier for uninterrupted service"],
          score: 50,
          reasons: ["Gemini API 429 limit active"],
          actions: ["Retry in 60 seconds"],
          goal_title: "Gemini API Cooldown",
          category: "Personal",
          milestones: [],
          habits: [],
          // Decision Engine schema fields (allows repair layer to fill these in)
          decision: null,
          reasoning: null,
          tradeoffs: [],
          risks: [],
          missing_information: [],
          next_step: null,
          confidence: null,
        };
      }
      throw err;
    }
  }

  async embed(text) {
    if (!this.client) {
      // Mock embedding vector for fallback
      return Array.from({ length: 768 }, () => Math.random());
    }
    try {
      const model = this.client.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err) {
      console.warn('text-embedding-004 failed, trying embedding-001 fallback:', err.message);
      try {
        // Returns a stable mock vector based on string hash so similarity remains roughly consistent
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = text.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Seeded Mulberry32 generator to get independent dimensions
        let seed = hash;
        const rand = () => {
          let t = seed += 0x6D2B79F5;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        // Distribute in [-1, 1] so orthogonal vectors have similarity close to 0
        return Array.from({ length: 768 }, () => rand() * 2 - 1);
      } catch (err2) {
        console.error('All Gemini embedding models failed. Returning mock fallback vector:', err2.message);
        // Fallback to random if even hash generator fails
        return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
      }
    }
  }

  async classify(text, categories) {
    const prompt = `Classify the following text into exactly one of these categories: ${categories.join(', ')}.
Text: "${text}"
Return ONLY the category name. No other text.`;
    const response = await this.generate(prompt);
    const cleaned = response.trim();
    // Validate returned category is in list, otherwise return first
    const matched = categories.find(c => cleaned.toUpperCase().includes(c.toUpperCase()));
    return matched || categories[0];
  }
}
