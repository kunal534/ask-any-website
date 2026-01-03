# 🚀 Next.js RAG Chatbot (Mistral AI)  

A **Retrieval-Augmented Generation (RAG) Chatbot** built with **Next.js**, **LangChain.js**, **Redis**, and **Mistral AI**.  
This chatbot enhances responses by retrieving relevant contextual data before generating answers.  


Publication link : [Publication](https://app.readytensor.ai/publications/ciphor-bot-rag-based-web-chat-with-llama-and-redis-retention-ElCDzXvDFNMs)
---

## 📂 Project Structure  

```plaintext
📁 Chat_bot
│-- 📂 src
│   ├── 📂 app
│   │   ├── 📂 [...url]     # Dynamic route for chat sessions
│   │   ├── 📂 api          # API routes
│   │   ├── 📜 layout.tsx
│   │   ├── 📜 page.tsx
│   ├── 📂 components       # Reusable React components
│   ├── 📂 lib              # Utility functions (RAG, Redis)
│   ├── 📂 styles           # Styling (CSS, Tailwind, etc.)
│-- .gitignore
│-- package.json
│-- next.config.js
│-- README.md

```
## ⚙️ Installation & Setup  

### 1️⃣ Clone the repository  

``` sh
git clone https://github.com/kunal534/Chat_bot.git 
cd YOUR_REPO
```

### 2️⃣ Install dependencies  
```sh
npm install
```

### 3️⃣ Set up environment variables  
Create a `.env.local` file and add:  
```env
MISTRAL_API_KEY=your_mistral_api_key
REDIS_URL=your_redis_url
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

### 4️⃣ Run the development server  
```sh
npm run dev
```
Your chatbot should now be running at **http://localhost:3000** 🎉  

---

## 🛠️ Tech Stack  

- **Frontend:** Next.js, React  
- **Backend:** Next.js API routes  
- **AI Model:** Mistral AI for response generation
- **Database:** Redis for caching and session management
- **Retrieval Layer:** LangChain.js (RAG pipeline)

---

## 🔧 Features  

✅ Supports RAG-based responses  
✅ Stores chat history in Redis  
✅ Handles multi-session conversations  
✅ Supports dynamic URL-based contexts  
✅ Easy to deploy on Vercel or Railway  

---

## 🚀 Deployment  

### Deploy to Vercel  
```sh
vercel
```

## Future Scope

### Document Content Restriction Handling:

```Currently, the chatbot cannot process files where content extraction is blocked due to:
Digital Rights Management (DRM)
Content Security Policy (CSP)
Other access-control restrictions
In such cases, the RAG pipeline cannot generate embeddings from the content, which limits contextual accuracy.
```

### Potential Enhancements:
```
Integrating OCR-based content extraction for protected documents (where legally permissible)
Expanding parsers to handle non-standard file formats with embedded restrictions
Support for proxy retrieval through secure, authenticated sessions
```
