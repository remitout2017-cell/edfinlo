// chatbot/agents/chatbotGraph.js - COMPLETE & VERIFIED
const { StateGraph, END, START } = require("@langchain/langgraph");
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const vectorStoreManager = require("../config/vectorStore");
const responseCache = require("./responseCache");
const { ROLE_PROMPTS, GUARDRAILS } = require("../config/chatbotConfig");
const { getUserContext } = require("../utils/userDataFetcher");

class RoleBasedChatbot {
  constructor() {
    // Primary LLM for response generation
    this.llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile", // ✅ Best for quality
      temperature: 0.7,
      maxTokens: 500,
    });

    // Fast LLM for intent classification
    this.fastLLM = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant", // ✅ Fast for classification
      temperature: 0.3,
      maxTokens: 50,
    });

    this.isInitialized = false;
    this.graph = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    console.log("🤖 Initializing enhanced chatbot graph...");
    await this.initializeGraph();
    // ✅ Initialize vector store on startup
    await vectorStoreManager.initialize();
    this.isInitialized = true;
    console.log("✅ Chatbot ready: Graph + VectorStore + UserContext");
  }

  async initializeGraph() {
    const workflow = new StateGraph({
      channels: {
        messages: { value: (x, y) => x.concat(y), default: () => [] },
        userRole: { value: (x, y) => y ?? x, default: () => null },
        userId: { value: (x, y) => y ?? x, default: () => null },
        userContext: { value: (x, y) => y ?? x, default: () => null },
        vectorContext: { value: (x, y) => y ?? x, default: () => [] },
        intent: { value: (x, y) => y ?? x, default: () => null },
        requiresEscalation: { value: (x, y) => y ?? x, default: () => false },
        offTopic: { value: (x, y) => y ?? x, default: () => false },
        cached: { value: (x, y) => y ?? x, default: () => false },
        enhancedQuery: { value: (x, y) => y ?? x, default: () => null },
      },
    });

    // ✅ Define all nodes
    workflow.addNode("fetchUserContext", this.fetchUserContext.bind(this));
    workflow.addNode("checkCache", this.checkCache.bind(this));
    workflow.addNode("guardRails", this.guardRails.bind(this));
    workflow.addNode("classifyIntent", this.classifyIntent.bind(this));
    workflow.addNode("enhanceQuery", this.enhanceQuery.bind(this));
    workflow.addNode("retrieveContext", this.retrieveContext.bind(this));
    workflow.addNode("generateResponse", this.generateResponse.bind(this));

    // ✅ Define workflow edges
    workflow.addEdge(START, "fetchUserContext");
    workflow.addEdge("fetchUserContext", "checkCache");

    workflow.addConditionalEdges(
      "checkCache",
      (state) => (state.cached ? "end" : "continue"),
      { end: END, continue: "guardRails" }
    );

    workflow.addConditionalEdges(
      "guardRails",
      (state) => {
        if (state.offTopic) return "offTopic";
        if (state.requiresEscalation) return "escalate";
        return "continue";
      },
      { offTopic: END, escalate: END, continue: "classifyIntent" }
    );

    workflow.addEdge("classifyIntent", "enhanceQuery");
    workflow.addEdge("enhanceQuery", "retrieveContext");
    workflow.addEdge("retrieveContext", "generateResponse");
    workflow.addEdge("generateResponse", END);

    this.graph = workflow.compile();
  }

  // ========================================================================
  // NODE 1: Fetch Real User Data
  // ========================================================================
  async fetchUserContext(state) {
    if (!state.userId) {
      return { ...state, userContext: null };
    }

    try {
      const userContext = await getUserContext(state.userId);
      if (userContext) {
        console.log(
          `📊 User: ${userContext.name} | Progress: ${userContext.completion.percentage}%`
        );
      }
      return { ...state, userContext };
    } catch (error) {
      console.error("❌ Error fetching user context:", error.message);
      return { ...state, userContext: null };
    }
  }

  // ========================================================================
  // NODE 2: Check Cache
  // ========================================================================
  async checkCache(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const cachedResponse = responseCache.get(
      lastMessage.content,
      state.userRole,
      state.intent
    );

    if (cachedResponse) {
      console.log("💾 Cache HIT");
      return {
        ...state,
        cached: true,
        messages: [...state.messages, new AIMessage(cachedResponse)],
      };
    }

    return { ...state, cached: false };
  }

  // ========================================================================
  // NODE 3: Guard Rails
  // ========================================================================
  async guardRails(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const content = lastMessage.content.toLowerCase();

    // Check message length
    if (content.length < GUARDRAILS.minMessageLength) {
      return {
        ...state,
        offTopic: true,
        messages: [
          ...state.messages,
          new AIMessage("Could you provide a bit more detail? 🤔"),
        ],
      };
    }

    if (content.length > GUARDRAILS.maxMessageLength) {
      return {
        ...state,
        offTopic: true,
        messages: [
          ...state.messages,
          new AIMessage(
            "That's quite long! Can you break it into smaller questions?"
          ),
        ],
      };
    }

    // Check for off-topic keywords
    const isOffTopic = GUARDRAILS.offTopicKeywords.some((keyword) =>
      content.includes(keyword)
    );

    if (isOffTopic) {
      const roleConfig = ROLE_PROMPTS[state.userRole] || ROLE_PROMPTS.student;
      return {
        ...state,
        offTopic: true,
        messages: [
          ...state.messages,
          new AIMessage(roleConfig.offTopicResponse),
        ],
      };
    }

    // Check for sensitive information requests
    const requestsSensitiveInfo = GUARDRAILS.sensitivePatterns.some((pattern) =>
      pattern.test(lastMessage.content)
    );

    if (requestsSensitiveInfo) {
      return {
        ...state,
        requiresEscalation: true,
        messages: [
          ...state.messages,
          new AIMessage(
            "I can't share proprietary algorithms or scoring details. But I'm happy to explain our loan process, documents, or NBFC information! 😊"
          ),
        ],
      };
    }

    return state;
  }

  // ========================================================================
  // NODE 4: Classify Intent
  // ========================================================================
  async classifyIntent(state) {
    const lastMessage = state.messages[state.messages.length - 1];

    const intentPrompt = `Classify this query into ONE category. Reply ONLY with the category name.

Query: "${lastMessage.content}"

Categories:
- loan_status
- documents
- eligibility
- loan_process
- nbfc_info
- timeline
- fees
- troubleshooting
- profile_completion
- general

Category:`;

    try {
      const response = await this.fastLLM.invoke([
        new HumanMessage(intentPrompt),
      ]);
      const intent = response.content
        .trim()
        .toLowerCase()
        .replace(/[^a-z_]/g, "");
      console.log(`🎯 Intent: ${intent}`);
      return { ...state, intent };
    } catch (error) {
      console.error("❌ Intent classification failed:", error.message);
      return { ...state, intent: "general" };
    }
  }

  // ========================================================================
  // NODE 5: Enhance Query with User Context
  // ========================================================================
  async enhanceQuery(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    let enhancedQuery = lastMessage.content;

    // ✅ Add contextual clues for better vector search
    if (state.userContext && state.userRole === "student") {
      const ctx = state.userContext;
      const contextClues = [];

      // Add missing items as context
      if (
        state.intent === "profile_completion" ||
        state.intent === "loan_status"
      ) {
        if (ctx.completion.missing.length > 0) {
          contextClues.push(...ctx.completion.missing);
        }
      }

      // Add document-specific context
      if (state.intent === "documents") {
        if (!ctx.academics.hasClass10) contextClues.push("10th marksheet");
        if (!ctx.academics.hasClass12) contextClues.push("12th marksheet");
        if (!ctx.admission.hasAdmission) contextClues.push("admission letter");
      }

      if (contextClues.length > 0) {
        enhancedQuery += " " + contextClues.join(" ");
      }
    }

    console.log(`🔍 Enhanced: "${enhancedQuery.substring(0, 80)}..."`);
    return { ...state, enhancedQuery };
  }

  // ========================================================================
  // NODE 6: Retrieve Vector Context
  // ========================================================================
  async retrieveContext(state) {
    const query =
      state.enhancedQuery || state.messages[state.messages.length - 1].content;

    try {
      const docs = await vectorStoreManager.search(query, state.userRole, 5);

      const vectorContext = docs.map((doc) => ({
        content: doc.pageContent,
        source: doc.metadata.source,
        category: doc.metadata.category,
      }));

      console.log(`📚 Retrieved ${vectorContext.length} knowledge chunks`);
      return { ...state, vectorContext };
    } catch (error) {
      console.error("❌ Vector retrieval failed:", error.message);
      return { ...state, vectorContext: [] };
    }
  }

  // ========================================================================
  // NODE 7: Generate Personalized Response
  // ========================================================================
  async generateResponse(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const roleConfig = ROLE_PROMPTS[state.userRole] || ROLE_PROMPTS.student;

    // ✅ Build user-specific context
    let userContextStr = "";
    if (state.userContext && state.userRole === "student") {
      const ctx = state.userContext;

      userContextStr = `\n\n=== STUDENT PROFILE ===
Name: ${ctx.name}
KYC: ${ctx.kycVerified ? "✅ Verified" : "❌ Not verified"}
Completion: ${ctx.completion.percentage}%
${
  ctx.completion.missing.length > 0
    ? `Missing: ${ctx.completion.missing.join(", ")}`
    : "✅ All requirements complete!"
}
${
  ctx.hasEducationPlan
    ? `Target: ${ctx.educationPlan.degreeType} in ${ctx.educationPlan.country}`
    : "No education plan"
}
${
  ctx.admission.hasAdmission
    ? `Admission: ${ctx.admission.admissionDetails.university}, ${ctx.admission.admissionDetails.country}`
    : "No admission yet"
}
Co-borrowers: ${ctx.coBorrowers.total} (${ctx.coBorrowers.verified} verified)
Loan Applications: ${ctx.loanRequests.pending} pending, ${
        ctx.loanRequests.approved
      } approved`;
    }

    // ✅ Build knowledge base context
    const vectorContextStr =
      state.vectorContext.length > 0
        ? `\n\n=== KNOWLEDGE BASE ===\n${state.vectorContext
            .map((doc, i) => `[${i + 1}] ${doc.content}`)
            .join("\n\n")}`
        : "";

    // ✅ Construct final prompt
    const prompt = `${roleConfig.system}
${userContextStr}
${
  vectorContextStr ||
  "\n(Limited knowledge available - provide general guidance)"
}

User's Question: "${lastMessage.content}"

CRITICAL INSTRUCTIONS:
- Use REAL user data when answering - be specific!
- If user is missing something, tell them exactly what
- Keep response under 150 words unless explaining complex topics
- Be warm, conversational, and helpful
- Don't just repeat knowledge base if you have their actual data

Your Response:`;

    try {
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      const aiResponse = response.content;

      // ✅ Cache the response
      responseCache.set(
        lastMessage.content,
        state.userRole,
        state.intent,
        aiResponse
      );

      console.log(`✅ Response generated (${aiResponse.length} chars)`);

      return {
        ...state,
        messages: [...state.messages, new AIMessage(aiResponse)],
      };
    } catch (error) {
      console.error("❌ Response generation failed:", error.message);
      return {
        ...state,
        messages: [
          ...state.messages,
          new AIMessage(
            "Sorry, I'm having trouble right now. Try again in a moment! 🔄"
          ),
        ],
      };
    }
  }

  // ========================================================================
  // PUBLIC API: Chat Method
  // ========================================================================
  async chat(message, userRole, userId, conversationHistory = []) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const initialState = {
        messages: [...conversationHistory.slice(-6), new HumanMessage(message)],
        userRole,
        userId,
        userContext: null,
        vectorContext: [],
        intent: null,
        requiresEscalation: false,
        offTopic: false,
        cached: false,
        enhancedQuery: null,
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
      console.error("❌ Chatbot error:", error);
      return {
        response: "Oops! Something went wrong. Please try again! 😅",
        error: true,
      };
    }
  }

  // ========================================================================
  // PUBLIC API: Get Greeting
  // ========================================================================
  getGreeting(role, userName = null) {
    const roleConfig = ROLE_PROMPTS[role] || ROLE_PROMPTS.student;
    let greeting = roleConfig.greeting;

    if (userName && greeting.includes("{name}")) {
      greeting = greeting.replace("{name}", userName);
    } else if (userName) {
      greeting = greeting.replace("there", userName);
      greeting = greeting.replace("Hi!", `Hi ${userName}!`);
      greeting = greeting.replace("Hello!", `Hello ${userName}!`);
    } else {
      greeting = greeting.replace("{name}", "there");
    }

    return greeting;
  }
}

module.exports = new RoleBasedChatbot();
