// chatbot/config/vectorStore.js

// CORRECT import for latest LangChain
const { MemoryVectorStore } = require("@langchain/classic/vectorstores/memory");
const { Document } = require("@langchain/core/documents");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const embeddings = require("./embeddings");
const path = require("path");
const fs = require("fs").promises;

class VectorStoreManager {
  constructor() {
    this.vectorStore = null;
    this.isInitialized = false;
    this.storePath = path.join(__dirname, "../knowledge/vectorstore");
  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      console.log("🔄 Initializing vector store...");

      // Initialize embeddings
      await embeddings.initialize();

      // Always build new knowledge base (MemoryVectorStore doesn't persist)
      console.log("📦 Building knowledge base in memory...");
      await this.buildKnowledgeBase();

      this.isInitialized = true;
    } catch (error) {
      console.error("❌ Vector store initialization failed:", error);
      throw error;
    }
  }

  async buildKnowledgeBase() {
    const knowledgeDir = path.join(__dirname, "../knowledge");
    try {
      // Ensure knowledge directory exists
      await fs.mkdir(knowledgeDir, { recursive: true });
      const files = await fs.readdir(knowledgeDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      if (jsonFiles.length === 0) {
        console.warn("⚠️ No knowledge files found! Creating sample file...");
        await this.createSampleKnowledge();
        return this.buildKnowledgeBase(); // Retry
      }

      const documents = [];
      for (const file of jsonFiles) {
        const filePath = path.join(knowledgeDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);

        // Extract role from filename
        const role = file.replace("-guide.json", "").replace(".json", "");

        // Convert JSON to documents
        const docs = this.jsonToDocuments(data, role, file);
        documents.push(...docs);
      }

      console.log(`📝 Processing ${documents.length} documents...`);
      if (documents.length === 0) {
        throw new Error("No documents extracted from knowledge files");
      }

      // Split into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 150,
        separators: ["\n\n", "\n", ". ", " ", ""],
      });

      const splitDocs = await textSplitter.splitDocuments(documents);
      console.log(`✂️ Split into ${splitDocs.length} chunks`);
      console.log(`🔢 Generating ${splitDocs.length} embeddings...`);

      // Create vector store with MemoryVectorStore
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        splitDocs,
        embeddings
      );

      console.log(
        `✅ Knowledge base built: ${splitDocs.length} chunks indexed in memory`
      );
    } catch (error) {
      console.error("❌ Error building knowledge base:", error);
      throw error;
    }
  }

  jsonToDocuments(data, role, source) {
    const documents = [];

    const traverse = (obj, path = [], parentKey = "") => {
      if (typeof obj === "string" && obj.length > 20) {
        const contextPath = path.join(" > ");
        const content = parentKey ? `${parentKey}: ${obj}` : obj;
        documents.push(
          new Document({
            pageContent: content,
            metadata: {
              source,
              role,
              category: path[0] || "general",
              path: contextPath,
            },
          })
        );
      } else if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          if (typeof item === "object") {
            traverse(item, [...path], `Item ${idx + 1}`);
          } else if (typeof item === "string" && item.length > 20) {
            documents.push(
              new Document({
                pageContent: item,
                metadata: {
                  source,
                  role,
                  category: path[0] || "general",
                  path: path.join(" > "),
                },
              })
            );
          }
        });
      } else if (typeof obj === "object" && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          traverse(value, [...path, key], key);
        });
      }
    };

    traverse(data);
    return documents;
  }

  async search(query, role = null, k = 4) {
    if (!this.isInitialized) await this.initialize();
    try {
      // Get all results first
      const allResults = await this.vectorStore.similaritySearch(query, k * 3);

      // Filter by role if specified
      const filteredResults = role
        ? allResults.filter((doc) => doc.metadata.role === role)
        : allResults;

      // Return top k
      return filteredResults.slice(0, k);
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  async addDocuments(documents) {
    if (!this.isInitialized) await this.initialize();
    await this.vectorStore.addDocuments(documents);
  }

  async rebuild() {
    console.log("🔄 Rebuilding knowledge base...");
    this.isInitialized = false;
    this.vectorStore = null;
    await this.initialize();
  }

  async createSampleKnowledge() {
    const sampleData = {
      overview:
        "Welcome to our education loan platform. We help students secure loans for studying abroad.",
      loan_process: {
        description:
          "Our loan process is simple and fast. Complete your profile, upload documents, get matched with NBFCs, and receive approval within 7-14 days.",
        steps: [
          "Create your account",
          "Complete your profile with academic and financial details",
          "Upload required documents",
          "Get AI-matched with suitable NBFCs",
          "Review and apply to NBFCs",
          "Receive loan approval",
        ],
      },
      documents: {
        academic:
          "We need your 10th, 12th marksheets, and degree certificates to verify your academic background.",
        admission:
          "Admission letter from your university is required to process your loan application.",
        kyc: "Aadhaar, PAN, and Passport are mandatory for identity verification.",
        financial:
          "Bank statements and income proof help us assess your repayment capacity.",
      },
      faqs: [
        {
          question: "How long does approval take?",
          answer: "Typically 7-14 days after submitting complete documents.",
        },
        {
          question: "What is the interest rate?",
          answer:
            "Interest rates range from 9.5% to 15% depending on your profile and the NBFC.",
        },
      ],
    };

    const knowledgeDir = path.join(__dirname, "../knowledge");
    await fs.mkdir(knowledgeDir, { recursive: true });
    await fs.writeFile(
      path.join(knowledgeDir, "student-guide.json"),
      JSON.stringify(sampleData, null, 2)
    );
    console.log("✅ Sample knowledge file created");
  }
}

module.exports = new VectorStoreManager();
