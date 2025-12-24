chatbot/
├── knowledge/ # Your company knowledge base
│ ├── company-info.json # Business overview, USP
│ ├── student-guide.json # Student-specific FAQs
│ ├── consultant-guide.json # Consultant-specific info
│ ├── nbfc-guide.json # NBFC-specific info
│ ├── loan-process.json # Application workflow
│ ├── documents-guide.json # Document requirements & why
│ └── nbfc-public.json # Public NBFC info (no secrets)
├── agents/
│ ├── chatbotGraph.js # LangGraph orchestrator
│ ├── intentClassifier.js # Route by user role & intent
│ ├── ragRetriever.js # Vector search + retrieval
│ └── responseGenerator.js # Role-aware response builder
├── config/
│ ├── vectorStore.js # Vector DB setup
│ └── chatbotConfig.js # System prompts per role
├── models/
│ └── ChatHistory.js # MongoDB conversation storage
├── controllers/
│ └── chatbot.controller.js # API endpoints
└── routes/
└── chatbot.routes.js # Chat routes
