// chatbot/config/vectorStore.js - OPTIMIZED
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
    this.knowledgeDir = path.join(__dirname, "../knowledge");
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log("🔄 Initializing vector store...");
      await embeddings.initialize();
      await this.buildKnowledgeBase();
      this.isInitialized = true;
    } catch (error) {
      console.error("❌ Vector store initialization failed:", error);
      throw error;
    }
  }

  async buildKnowledgeBase() {
    try {
      await fs.mkdir(this.knowledgeDir, { recursive: true });
      const files = await fs.readdir(this.knowledgeDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      if (jsonFiles.length === 0) {
        console.warn("⚠️ No knowledge files found!");
        return;
      }

      const documents = [];

      for (const file of jsonFiles) {
        const filePath = path.join(this.knowledgeDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        const role = file.replace("-guide.json", "").replace(".json", "");
        const docs = this.jsonToDocuments(data, role, file);
        documents.push(...docs);
      }

      console.log(`📝 Processing ${documents.length} documents...`);

      if (documents.length === 0) {
        throw new Error("No documents extracted from knowledge files");
      }

      // Optimized text splitting
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 600,
        chunkOverlap: 100,
        separators: ["\n\n", "\n", ". ", " ", ""],
      });

      const splitDocs = await textSplitter.splitDocuments(documents);
      console.log(`✂️ Split into ${splitDocs.length} chunks`);
      console.log(`🔢 Generating embeddings...`);

      this.vectorStore = await MemoryVectorStore.fromDocuments(
        splitDocs,
        embeddings
      );

      console.log(`✅ Vector store ready: ${splitDocs.length} chunks indexed`);
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
      // Search with higher k to allow filtering
      const allResults = await this.vectorStore.similaritySearchWithScore(
        query,
        k * 3
      );

      // Filter by role if specified
      let filteredResults = allResults;
      if (role) {
        filteredResults = allResults.filter(
          ([doc]) =>
            doc.metadata.role === role || doc.metadata.role === "general"
        );
      }

      // Return top k documents (without scores)
      return filteredResults.slice(0, k).map(([doc]) => doc);
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
}

module.exports = new VectorStoreManager();
