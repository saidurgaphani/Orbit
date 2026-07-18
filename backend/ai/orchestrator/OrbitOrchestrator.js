import GeminiProvider from '../providers/GeminiProvider.js';
import IntentClassifier from '../intent/IntentClassifier.js';
import ContextBuilder from '../context/ContextBuilder.js';
import OutputValidator from '../validators/OutputValidator.js';
import SQLContextService from '../context/SQLContextService.js';
import RAGService from '../context/RAGService.js';
import ToolRegistry from '../tools/ToolRegistry.js';

export default class OrbitOrchestrator {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    this.provider = new GeminiProvider(apiKey);
    this.classifier = new IntentClassifier(this.provider);
    this.sqlContextService = new SQLContextService();
    this.ragService = new RAGService(this.provider);
    this.tools = new ToolRegistry();

    // Register basic demo tools
    this.registerDefaultTools();
  }

  registerDefaultTools() {
    // Demo weather tool
    this.tools.register('weather', ['weather', 'forecast', 'rain', 'temperature'], async (userId, params) => {
      console.log(`[ToolRegistry] Running weather tool for user ${userId}`);
      return {
        temperature: "24°C",
        condition: "Mostly Cloudy",
        humidity: "65%",
        alert: "No active weather alerts."
      };
    });

    // Demo health syncer tool
    this.tools.register('fit_sync', ['sync fit', 'sync health', 'google fit data'], async (userId, params) => {
      console.log(`[ToolRegistry] Running fit_sync tool for user ${userId}`);
      return {
        status: "success",
        syncedRecords: 42,
        lastSyncTime: new Date().toISOString()
      };
    });
  }

  /**
   * Main entrypoint for processing copilot queries.
   * @param {object} reqPayload - The request payload containing { context, question, systemPrompt, files }.
   * @param {string} [userId] - The authenticated Firebase user ID.
   * @returns {Promise<object>} The validated structured JSON response.
   */
  async handleRequest(reqPayload, userId = null) {
    const { context: clientContext, question, systemPrompt } = reqPayload;

    console.log(`[Orchestrator] Running intent detection for query: "${question.substring(0, 60)}..."`);
    
    // Determine context hint based on systemPrompt keywords to aid intent classification
    let contextHint = '';
    if (systemPrompt.toLowerCase().includes('scam')) contextHint = 'scam';
    else if (systemPrompt.toLowerCase().includes('afford') || systemPrompt.toLowerCase().includes('finance')) contextHint = 'finance';
    else if (systemPrompt.toLowerCase().includes('health') || systemPrompt.toLowerCase().includes('sleep')) contextHint = 'health';
    else if (systemPrompt.toLowerCase().includes('goal') || systemPrompt.toLowerCase().includes('habit')) contextHint = 'goal';
    else if (systemPrompt.toLowerCase().includes('brief') || systemPrompt.toLowerCase().includes('priority')) contextHint = 'brief';

    const classification = await this.classifier.classify(question, contextHint);
    const { intent, required_sources, requires_rag } = classification;
    console.log(`[Orchestrator] Classified intent: ${intent} (Confidence: ${classification.confidence})`);

    // 1. Load SQL Context dynamically if userId is present
    let sqlContext = {};
    if (userId) {
      console.log(`[Orchestrator] Fetching dynamic SQL context for user ${userId} with sources: ${required_sources.join(', ')}`);
      sqlContext = await this.sqlContextService.getContext(userId, required_sources, { query: question });
    }

    // 2. Load RAG Context if document query and userId is present
    let ragContext = '';
    if (requires_rag && userId) {
      console.log(`[Orchestrator] Performing pgvector RAG similarity retrieval for user ${userId}...`);
      ragContext = await this.ragService.retrieveRelevantChunks(userId, question);
    }

    // 3. Match and execute external tools
    let toolContext = null;
    const matchedTool = this.tools.match(question);
    if (matchedTool && userId) {
      console.log(`[Orchestrator] Matched external tool: "${matchedTool}". Executing...`);
      try {
        toolContext = await this.tools.execute(matchedTool, userId);
      } catch (err) {
        console.error(`[Orchestrator] Tool execution failed:`, err);
      }
    }

    // 4. Merge contexts
    const finalContext = {
      ...clientContext,
      ...sqlContext,
      ...(ragContext ? { documentSnippets: ragContext } : {}),
      ...(toolContext ? { toolOutputs: toolContext } : {})
    };

    const promptText = `
Context Data:
${JSON.stringify(finalContext, null, 2)}

User Question:
${question}

System Instruction:
${systemPrompt}

IMPORTANT: Return ONLY a raw JSON object. Do NOT wrap in markdown code blocks (\`\`\`json). Do NOT add any conversational text before or after the JSON. Follow the output schema exactly.
`;

    console.log(`[Orchestrator] Sending request to Gemini with instruction...`);
    let rawResponse = await this.provider.generate(promptText, "You are the Orbit reasoning core. Return only a JSON object. No markdown. No backticks.");

    let parsedJSON;
    try {
      let cleanText = rawResponse.trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
      else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
      if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
      parsedJSON = JSON.parse(cleanText.trim());
    } catch (parseError) {
      console.error('[Orchestrator] Initial JSON parsing failed:', parseError);
      parsedJSON = await this.provider.generateStructured(promptText, "You are the Orbit reasoning core. Return only a JSON object.");
    }

    console.log(`[Orchestrator] Validating structured output for intent: ${intent}...`);
    let validation = OutputValidator.validate(intent, parsedJSON);
    if (!validation.valid) {
      console.warn(`[Orchestrator] Validation failed: ${validation.errors.join(', ')}. Triggering one-time repair retry...`);
      const repairPrompt = `
Your previous response failed validation with these errors:
${validation.errors.map(e => `- ${e}`).join('\n')}

Previous output:
${JSON.stringify(parsedJSON, null, 2)}

Please correct the JSON and return it.
`;
      try {
        parsedJSON = await this.provider.generateStructured(repairPrompt, "You are the Orbit reasoning core. Return only a JSON object matching the required schema.");
        validation = OutputValidator.validate(intent, parsedJSON);
        if (!validation.valid) {
          console.error('[Orchestrator] Repair validation failed. Gracefully returning last output.');
        } else {
          console.log('[Orchestrator] Output successfully repaired and validated!');
        }
      } catch (retryError) {
        console.error('[Orchestrator] Repair retry failed:', retryError.message);
      }
    } else {
      console.log('[Orchestrator] Output successfully validated!');
    }

    return parsedJSON;
  }
}
