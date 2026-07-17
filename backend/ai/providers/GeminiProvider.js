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
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: { temperature: options.temperature ?? 0.1 }
    });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction || undefined
    });
    return result.response.text();
  }

  async generateStructured(prompt, systemInstruction = '', schema = null, options = {}) {
    if (!this.client) {
      console.warn('Gemini client not initialized (missing API key). Using fallback JSON.');
      return { message: "Demo mode fallback output." };
    }
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: options.temperature ?? 0.1
      }
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction || undefined
    });
    const text = result.response.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('Gemini structured response parsing failed:', text);
      throw new Error(`Invalid JSON response: ${err.message}`);
    }
  }

  async embed(text) {
    if (!this.client) {
      // Mock embedding vector for fallback
      return Array.from({ length: 768 }, () => Math.random());
    }
    const model = this.client.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
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
