// chatbot/agents/chatbotGraph.js
const { StateGraph, END, START } = require("@langchain/langgraph");
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const vectorStoreManager = require("../config/vectorStore");
const responseCache = require("./responseCache");
const { ROLE_PROMPTS, GUARDRAILS } = require("../config/chatbotConfig");

class RoleBasedChatbot {
  constructor() {
    this.llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      maxTokens: 800,
    });

    this.fastLLM = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      temperature: 0,
      maxTokens: 50,
    });

    this.isInitialized = false;
    this.graph = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log("🤖 Initializing chatbot graph...");
    this.initializeGraph();
    this.isInitialized = true;
    console.log("✅ Chatbot graph ready");
  }

  initializeGraph() {
    const workflow = new StateGraph({
      channels: {
        messages: { value: (x, y) => x.concat(y), default: () => [] },
        userRole: { value: (x, y) => y ?? x, default: () => null },
        context: { value: (x, y) => y ?? x, default: () => [] },
        intent: { value: (x, y) => y ?? x, default: () => null },
        requiresEscalation: { value: (x, y) => y ?? x, default: () => false },
        offTopic: { value: (x, y) => y ?? x, default: () => false },
        cached: { value: (x, y) => y ?? x, default: () => false },
      }
    });

    workflow.addNode("checkCache", this.checkCache.bind(this));
    workflow.addNode("guardRails", this.guardRails.bind(this));
    workflow.addNode("classifyIntent", this.classifyIntent.bind(this));
    workflow.addNode("retrieveContext", this.retrieveContext.bind(this));
    workflow.addNode("generateResponse", this.generateResponse.bind(this));

    workflow.addEdge(START, "checkCache");
    
    workflow.addConditionalEdges(
      "checkCache",
      (state) => state.cached ? "end" : "continue",
      {
        end: END,
        continue: "guardRails"
      }
    );

    workflow.addConditionalEdges(
      "guardRails",
      (state) => {
        if (state.offTopic) return "offTopic";
        if (state.requiresEscalation) return "escalate";
        return "continue";
      },
      {
        offTopic: END,
        escalate: END,
        continue: "classifyIntent"
      }
    );

    workflow.addEdge("classifyIntent", "retrieveContext");
    workflow.addEdge("retrieveContext", "generateResponse");
    workflow.addEdge("generateResponse", END);

    this.graph = workflow.compile();
  }

  async checkCache(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const cachedResponse = responseCache.get(lastMessage.content, state.userRole, null);

    if (cachedResponse) {
      return {
        ...state,
        cached: true,
        messages: [...state.messages, new AIMessage(cachedResponse)]
      };
    }

    return { ...state, cached: false };
  }

  async guardRails(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const content = lastMessage.content.toLowerCase();

    if (content.length < GUARDRAILS.minMessageLength) {
      return {
        ...state,
        offTopic: true,
        messages: [...state.messages, new AIMessage("Please provide a more detailed question.")]
      };
    }

    if (content.length > GUARDRAILS.maxMessageLength) {
      return {
        ...state,
        offTopic: true,
        messages: [...state.messages, new AIMessage("Your message is too long. Please break it down.")]
      };
    }

    const isOffTopic = GUARDRAILS.offTopicKeywords.some(keyword => content.includes(keyword));

    if (isOffTopic) {
      const roleConfig = ROLE_PROMPTS[state.userRole];
      return {
        ...state,
        offTopic: true,
        messages: [...state.messages, new AIMessage(roleConfig.offTopicResponse)]
      };
    }

    const requestsSensitiveInfo = GUARDRAILS.sensitivePatterns.some(pattern =>
      pattern.test(lastMessage.content)
    );

    if (requestsSensitiveInfo) {
      return {
        ...state,
        requiresEscalation: true,
        messages: [...state.messages, new AIMessage("I cannot share proprietary algorithms or internal scoring logic. I can help with the loan process, documents, and NBFC information. What would you like to know?")]
      };
    }

    return state;
  }

  async classifyIntent(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    
    const intentPrompt = `Classify this query into ONE category:

Query: "${lastMessage.content}"

Categories: loan_process, documents, nbfc_info, eligibility, timeline, fees, status, troubleshooting, general

Reply with ONLY the category name.`;

    try {
      const response = await this.fastLLM.invoke([new HumanMessage(intentPrompt)]);
      return {
        ...state,
        intent: response.content.trim().toLowerCase()
      };
    } catch (error) {
      console.error("Intent classification error:", error);
      return { ...state, intent: "general" };
    }
  }

  async retrieveContext(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    
    try {
      const docs = await vectorStoreManager.search(
        lastMessage.content,
        state.userRole,
        4
      );

      return {
        ...state,
        context: docs.map(doc => doc.pageContent)
      };
    } catch (error) {
      console.error("Context retrieval error:", error);
      return { ...state, context: [] };
    }
  }

  async generateResponse(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const roleConfig = ROLE_PROMPTS[state.userRole];

    const contextStr = state.context.length > 0
      ? `\n\nRelevant Information:\n${state.context.join('\n---\n')}`
      : '\n\n(Limited context available)';

    const prompt = `${roleConfig.system}

${contextStr}

User Question: ${lastMessage.content}

Provide a helpful response (max 150 words). Use bullet points for lists.

Response:`;

    try {
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      const aiResponse = response.content;

      responseCache.set(lastMessage.content, state.userRole, state.intent, aiResponse);

      return {
        ...state,
        messages: [...state.messages, new AIMessage(aiResponse)]
      };
    } catch (error) {
      console.error("Response generation error:", error);
      return {
        ...state,
        messages: [...state.messages, new AIMessage("I'm having trouble right now. Please try again in a moment.")]
      };
    }
  }

  async chat(message, userRole, conversationHistory = []) {
    try {
      if (!this.isInitialized) await this.initialize();

      const initialState = {
        messages: [
          ...conversationHistory.slice(-6),
          new HumanMessage(message)
        ],
        userRole,
        context: [],
        intent: null,
        requiresEscalation: false,
        offTopic: false,
        cached: false,
      };

      const result = await this.graph.invoke(initialState);
      const lastMessage = result.messages[result.messages.length - 1];
      
      return {
        response: lastMessage.content,
        intent: result.intent,
        requiresEscalation: result.requiresEscalation,
        fromCache: result.cached,
      };
    } catch (error) {
      console.error("Chatbot error:", error);
      return {
        response: "I encountered an error. Please try again or contact support.",
        error: true
      };
    }
  }

  getGreeting(role) {
    const roleConfig = ROLE_PROMPTS[role] || ROLE_PROMPTS.student;
    return roleConfig.greeting;
  }
}

module.exports = new RoleBasedChatbot();
