# 🤖 Ask Any Website

> Transform any website into an intelligent, conversational AI assistant using Retrieval-Augmented Generation

An AI-powered chatbot that automatically indexes website content and provides accurate, contextual answers to user questions [web:163]. Built with **Next.js 15**, **Pinecone vector database**, **Mistral AI**, and **LangChain.js** [conversation_history:1].

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Pinecone](https://img.shields.io/badge/Pinecone-Vector%20DB-00C9A7)](https://www.pinecone.io/)
[![Mistral AI](https://img.shields.io/badge/Mistral-AI-orange)](https://mistral.ai/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Demo](#-demo)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Installation](#-installation--setup)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Tech Stack](#-tech-stack)
- [How It Works](#-how-it-works)
- [Key Components](#-key-components)
- [Deployment](#-deployment)
- [Performance](#-performance)
- [Troubleshooting](#-troubleshooting)
- [Future Enhancements](#-future-enhancements)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## ✨ Features

### Core Functionality
- **🌐 Universal Website Indexing** – Automatically crawl and index any publicly accessible website
- **🔍 Semantic Search** – Pinecone vector database enables contextually relevant retrieval
- **🏢 Multi-Tenant Architecture** – Namespace isolation ensures data separation per website
- **⚡ Real-Time Chat** – Instant AI-powered responses using Mistral AI's large language models
- **💾 Persistent Chat History** – Redis-backed conversation storage for session continuity
- **🔄 Background Processing** – Non-blocking website indexing with progress tracking
- **📊 Embedding Generation** – Mistral AI embeddings (1024 dimensions) for high-quality vector representations

### Technical Features
- **⚙️ Production-Ready** – Built with Next.js 15 App Router and TypeScript 5.0
- **🎯 RAG Pipeline** – Retrieval-Augmented Generation for factually grounded responses
- **🔐 Secure** – Environment-based secrets management and API key protection
- **📱 Responsive Design** – Mobile-first UI with Tailwind CSS
- **🚀 Edge-Optimized** – Serverless deployment ready for Vercel

---

## 🎬 Demo

### Quick Start Example

```bash
# 1. Enter a website URL
https://docs.python.org/3/

# 2. Wait for indexing (automated background process)
⏳ Indexing in progress... 45% complete

# 3. Start asking questions
User: "What is a list comprehension in Python?"
AI: "A list comprehension is a concise way to create lists..."
```

# 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                       User Interface                        │
│              (Next.js 15 + React Components)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Routes (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Index Website│  │     Chat     │  │    Status    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│  Web Crawler │ │  Redis   │ │  Pinecone   │
│   (Cheerio)  │ │ (Cache)  │ │ (Vectors)   │
└──────┬───────┘ └──────────┘ └──────┬──────┘
       │                              │
       ▼                              ▼
┌──────────────────────────────────────────┐
│         LangChain.js (RAG Pipeline)      │
│  ┌────────┐  ┌─────────┐  ┌───────────┐  │
│  │Chunking│→ │Embed    │→ │Vector     │  │
│  │        │  │(Mistral)│  │Storage    │  │
│  └────────┘  └─────────┘  └───────────┘  │
└──────────────────────────────────────────┘
                      │
                      ▼
          ┌────────────────────┐
          │   Mistral AI LLM   │
          │  (Response Gen)    │
          └────────────────────┘
```

### Data Flow
**Indexing Phase** : `URL → Crawler → Text Extraction → Chunking → Embedding → Pinecone Storage`

**Query Phase**: `User Question → Embedding → Similarity Search → Context Retrieval → LLM → Response
`

### 📂 Project Structure

```
ask-any-website/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with metadata
│   │   ├── not-found.tsx           # Custom 404 error page
│   │   ├── page.tsx                # Landing page/chat interface
│   │   └── api/                    # API routes (if applicable)
│   │       ├── chat/
│   │       ├── index/
│   │       └── status/
│   ├── components/
│   │   ├── ChatInput.tsx           # User message input field
│   │   ├── ChatWrapper.tsx         # Main chat container
│   │   ├── Message.tsx             # Individual message bubble
│   │   ├── Messages.tsx            # Message list with auto-scroll
│   │   └── Providers.tsx           # React Context providers
│   ├── lib/
│   │   ├── background-crawler.ts   # Recursive website crawler
│   │   ├── context-retrieval.ts    # RAG retrieval logic
│   │   ├── crawler.ts              # Core scraping utilities
│   │   ├── pinecone-client.ts      # Pinecone initialization
│   │   ├── quick-index.ts          # Fast indexing for small sites
│   │   ├── redis.ts                # Redis client setup
│   │   └── utils.ts                # Helper functions
│   ├── middleware.ts               # Request/response middleware
│   └── styles/                     # Global styles (if any)
├── public/                         # Static assets
├── .env                            # Environment variables (gitignored)
├── .env.example                    # Environment template
├── .gitignore
├── components.json                 # shadcn/ui configuration
├── eslint.config.mjs              # ESLint rules
├── next.config.ts                  # Next.js configuration
├── package.json                    # Dependencies
├── postcss.config.mjs             # PostCSS plugins
├── tailwind.config.ts             # Tailwind CSS config
├── tsconfig.json                  # TypeScript configuration
└── README.md                       # This file
```

### Pinecone Initialize 
```
# Index Configuration
Dimensions: 1024 (Mistral embeddings)
Metric: cosine
Cloud: AWS or GCP
Pods: 1 (for starter)
```

### Crawler Settings
Edit lib/crawler.ts to customize:
```
export const CRAWLER_CONFIG = {
  maxPages: 100,           // Maximum pages to crawl
  maxDepth: 3,             // Maximum link depth
  timeout: 30000,          // Request timeout (ms)
  respectRobotsTxt: true,  // Honor robots.txt
  userAgent: 'AskAnyWebsite-Bot/1.0'
};
```

### Chunking Strategy
Modify lib/context-retrieval.ts

```
export const CHUNK_CONFIG = {
  chunkSize: 1000,         // Characters per chunk
  chunkOverlap: 200,       // Overlap between chunks
  separator: '\n\n'        // Split on paragraphs
};
```
## 🔌 API Documentation

### POST 
#### 1. api/index
Index a new website.

Request Body:
```
{
  "url": "https://example.com",
  "options": {
    "maxPages": 50,
    "maxDepth": 2
  }
}
```
Response:
```
{
  "success": true,
  "jobId": "index_abc123",
  "message": "Indexing started"
}

```

#### 2. api/chat
Send a chat message.

Request Body:
```
{
  "message": "What is this about?",
  "websiteUrl": "https://example.com",
  "sessionId": "user-session-123"
}
```
Response:
```
{
  "response": "This website is about...",
  "sources": [
    {
      "url": "https://example.com/page1",
      "title": "Introduction",
      "score": 0.92
    }
  ]
}
```

#### 3. GET /api/status/:jobId

Check indexing status.

Response:
```
{
  "jobId": "index_abc123",
  "status": "in_progress",
  "progress": 45,
  "pagesIndexed": 23,
  "totalPages": 51
}
```

## 🛠️ Tech Stack
```
| Category      | Technology     | Purpose                                 |
| ------------- | -------------- | ----------------------------------------|
| Frontend      | Next.js 15     | React framework with App Router         |
| Language      | TypeScript 5.0 | Type-safe development                   |
| UI            | Tailwind CSS   | Utility-first styling                   |
| Components    | shadcn/ui      | Accessible UI components                |
| AI/LLM        | Mistral AI     | Large language model for responses      |
| Embeddings    | Mistral Embed  | 1024-dim vector embeddings              |
| Vector DB     | Pinecone       | Scalable similarity search              |
| Caching       | Redis/Upstash  | Session and chat history                |
| RAG Framework | LangChain.js   | Retrieval-augmented generation pipeline |
| Web Scraping  | Cheerio        | HTML parsing and text extraction        |
| Deployment    | Vercel         | Serverless hosting                      |
```

## 🚀 How It Works

### Indexing Pipeline:
```
1. User submits URL
   ↓
2. Crawler fetches HTML pages recursively
   ↓
3. Text extraction (clean HTML, remove scripts/styles)
   ↓
4. Text chunking (1000 chars, 200 overlap)
   ↓
5. Generate embeddings via Mistral API
   ↓
6. Upsert vectors to Pinecone (namespace = domain)
   ↓
7. Store metadata (URL, title, timestamp)
```

### Query Pipeline:
```
1. User sends question
   ↓
2. Embed question using Mistral
   ↓
3. Pinecone similarity search (top 5 matches)
   ↓
4. Retrieve chunk text and metadata
   ↓
5. Construct prompt with context
   ↓
6. Mistral generates grounded response
   ↓
7. Stream response to UI
```

## 🔑 Key Components
### 1. Background-crawler.ts
```
Recursively crawls websites with depth and breadth limits.
Features:
Respects robots.txt directives
Handles pagination and dynamic URLs
Error handling for failed requests
Progress tracking via Redis
```
### 2. Context-retrieval.ts
```
Implements the RAG retrieval logic.
Features:
Embeds user queries
Performs similarity search in Pinecone
Ranks results by relevance score
Returns top-k chunks with metadata
```

### 3. pinecone-client.ts
```
Manages Pinecone vector database operations [conversation_history:1].
Features:
Namespace isolation per website
Batch upsert for efficiency
Query filtering by metadata
Connection pooling
```

### 4. redis.ts
```
Handles session and cache management [conversation_history:1].
Features:
Chat history storage (TTL: 7 days)
Rate limiting per user
Indexing job status tracking
Session persistence
```
