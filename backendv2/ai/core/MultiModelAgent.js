// Multi-Model Agent with LangGraph State Management
import { StateGraph, END } from "@langchain/langgraph";
import { BaseAgent } from "./BaseAgent.js";
import { AI_MODELS, AGENT_STATE_SCHEMA } from "../config/aiModels.js";

export class MultiModelAgent {
  constructor(modelStrategy, taskType = "extraction") {
    this.modelStrategy = modelStrategy;
    this.taskType = taskType;
    this.agents = modelStrategy.map((config) => new BaseAgent(config));

    // Build LangGraph
    this.graph = this.buildGraph();
    this.app = this.graph.compile();

    console.log(
      `🔄 Initialized MultiModelAgent with ${this.agents.length} models for ${taskType}`
    );
  }

  buildGraph() {
    const workflow = new StateGraph({
      channels: AGENT_STATE_SCHEMA,
    });

    // Define nodes
    workflow.addNode("extract_primary", (state) => this.extractPrimary(state));
    workflow.addNode("extract_fallback_1", (state) =>
      this.extractFallback1(state)
    );
    workflow.addNode("extract_fallback_2", (state) =>
      this.extractFallback2(state)
    );
    workflow.addNode("validate_result", (state) => this.validateResult(state));
    workflow.addNode("handle_failure", (state) => this.handleFailure(state));

    // Set entry point
    workflow.setEntryPoint("extract_primary");

    // Define edges with conditions
    workflow.addConditionalEdges(
      "extract_primary",
      (state) => this.routeAfterPrimary(state),
      {
        success: "validate_result",
        retry_fallback_1: "extract_fallback_1",
        failure: "handle_failure",
      }
    );

    workflow.addConditionalEdges(
      "extract_fallback_1",
      (state) => this.routeAfterFallback1(state),
      {
        success: "validate_result",
        retry_fallback_2: "extract_fallback_2",
        failure: "handle_failure",
      }
    );

    workflow.addConditionalEdges(
      "extract_fallback_2",
      (state) => this.routeAfterFallback2(state),
      {
        success: "validate_result",
        failure: "handle_failure",
      }
    );

    workflow.addEdge("validate_result", END);
    workflow.addEdge("handle_failure", END);

    return workflow;
  }

  // Node: Extract with Primary Model
  async extractPrimary(state) {
    console.log("🔄 Attempting extraction with PRIMARY model...");

    try {
      const agent = this.agents[0];
      const { prompt, images } = state;

      const response = await agent.invoke(prompt, images);
      const extracted = agent.parseJSON(response.content);

      const confidence = extracted?.confidence || 0;

      return {
        ...state,
        extractedData: extracted,
        extractionConfidence: confidence,
        extractionProvider: agent.provider,
        providersUsed: [...state.providersUsed, agent.provider],
        attempts: state.attempts + 1,
        currentStep: "primary_complete",
      };
    } catch (error) {
      console.error("❌ Primary model failed:", error.message);

      return {
        ...state,
        errors: [...state.errors, { step: "primary", error: error.message }],
        attempts: state.attempts + 1,
        currentStep: "primary_failed",
      };
    }
  }

  // Node: Extract with Fallback 1
  async extractFallback1(state) {
    console.log("🔄 Attempting extraction with FALLBACK 1 model...");

    try {
      const agent = this.agents[1];
      const { prompt, images } = state;

      const response = await agent.invoke(prompt, images);
      const extracted = agent.parseJSON(response.content);

      const confidence = extracted?.confidence || 0;

      return {
        ...state,
        extractedData: extracted,
        extractionConfidence: confidence,
        extractionProvider: agent.provider,
        providersUsed: [...state.providersUsed, agent.provider],
        attempts: state.attempts + 1,
        currentStep: "fallback1_complete",
      };
    } catch (error) {
      console.error("❌ Fallback 1 failed:", error.message);

      return {
        ...state,
        errors: [...state.errors, { step: "fallback1", error: error.message }],
        attempts: state.attempts + 1,
        currentStep: "fallback1_failed",
      };
    }
  }

  // Node: Extract with Fallback 2
  async extractFallback2(state) {
    console.log("🔄 Attempting extraction with FALLBACK 2 model...");

    try {
      const agent = this.agents[2];
      const { prompt, images } = state;

      const response = await agent.invoke(prompt, images);
      const extracted = agent.parseJSON(response.content);

      const confidence = extracted?.confidence || 0;

      return {
        ...state,
        extractedData: extracted,
        extractionConfidence: confidence,
        extractionProvider: agent.provider,
        providersUsed: [...state.providersUsed, agent.provider],
        attempts: state.attempts + 1,
        currentStep: "fallback2_complete",
      };
    } catch (error) {
      console.error("❌ Fallback 2 failed:", error.message);

      return {
        ...state,
        errors: [...state.errors, { step: "fallback2", error: error.message }],
        attempts: state.attempts + 1,
        currentStep: "fallback2_failed",
      };
    }
  }

  // Node: Validate Result
  async validateResult(state) {
    console.log("✅ Validating extraction result...");

    const { extractedData, extractionConfidence } = state;

    const isValid = extractedData && extractionConfidence >= 0.7;

    return {
      ...state,
      validationPassed: isValid,
      currentStep: "validation_complete",
    };
  }

  // Node: Handle Failure
  async handleFailure(state) {
    console.error("❌ All extraction attempts failed");

    return {
      ...state,
      extractedData: null,
      extractionConfidence: 0,
      validationPassed: false,
      currentStep: "failed",
    };
  }

  // Routing Logic
  routeAfterPrimary(state) {
    if (
      state.currentStep === "primary_complete" &&
      state.extractionConfidence >= 0.7
    ) {
      return "success";
    }

    if (this.agents.length > 1) {
      return "retry_fallback_1";
    }

    return "failure";
  }

  routeAfterFallback1(state) {
    if (
      state.currentStep === "fallback1_complete" &&
      state.extractionConfidence >= 0.7
    ) {
      return "success";
    }

    if (this.agents.length > 2) {
      return "retry_fallback_2";
    }

    return "failure";
  }

  routeAfterFallback2(state) {
    if (
      state.currentStep === "fallback2_complete" &&
      state.extractionConfidence >= 0.6
    ) {
      return "success";
    }

    return "failure";
  }

  // Execute the workflow
  async execute(prompt, images = [], options = {}) {
    const startTime = Date.now();

    const initialState = {
      ...AGENT_STATE_SCHEMA,
      prompt,
      images,
      options,
      startTime,
      attempts: 0,
      errors: [],
      providersUsed: [],
    };

    try {
      const result = await this.app.invoke(initialState);

      const processingTime = Date.now() - startTime;

      return {
        success: result.validationPassed,
        data: result.extractedData,
        confidence: result.extractionConfidence,
        provider: result.extractionProvider,
        metadata: {
          attempts: result.attempts,
          providersUsed: result.providersUsed,
          errors: result.errors,
          processingTime,
        },
      };
    } catch (error) {
      console.error("❌ Graph execution failed:", error);
      throw error;
    }
  }
}
