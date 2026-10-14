# ⚡ Gemini Pulse AI Chatbot (with Supabase Database)

A modern, production-grade conversational AI chatbot built with **Google Gemini LLM** and **Supabase PostgreSQL Database**, featuring a strictly separated **Frontend** and **Backend** folder structure.

---

## 📂 Project Architecture

```
eswar anti gravity/
│
├── backend/                       # 🟢 BACKEND SERVER (Node.js + Express)
│   ├── server.js                  # Express API, SSE streaming, Gemini SDK, Supabase client
│   ├── schema.sql                 # Supabase PostgreSQL database tables & policies
│   ├── package.json               # Backend dependencies (@google/genai, @supabase/supabase-js, express)
│   ├── .env                       # Backend environment configuration (GEMINI & SUPABASE keys)
│   ├── .env.example               # Backend template for environment variables
│   ├── .gitignore                 # Ignores node_modules and .env
│   └── README.md                  # Backend-specific documentation
│
├── frontend/                      # 🎨 FRONTEND CLIENT (HTML5, Modern CSS, JS)
│   ├── index.html                 # UI with chat history sidebar, model selector & prompt chips
│   ├── style.css                  # Obsidian dark theme, glassmorphism, responsive sidebar
│   ├── app.js                     # Streaming receiver, markdown parser, Supabase session manager
│   ├── .env                       # Frontend environment configuration (SUPABASE & BACKEND_URL)
│   ├── .env.example               # Frontend template for environment variables
│   └── README.md                  # Frontend-specific documentation
│
├── start-dev.js                   # Zero-dependency orchestrator to launch both servers simultaneously
├── package.json                   # Root workspace scripts
└── README.md                      # Main project documentation
```

---

## 🔐 Environment Variables (`.env`)

Environment files have been created in both `frontend/` and `backend/`.

### 1. `backend/.env`
Used by the Express server to call Gemini and execute Supabase queries:

| Variable | Description | Example |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSyD-your-key` |
| `PORT` | Express server port | `5000` |
| `SUPABASE_URL` | Your Supabase Project URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Public Anonymous Key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key *(optional, for admin access)* | `eyJhbGciOi...` |

### 2. `frontend/.env`
Used by the client UI (dynamically injected via `/env.js` without requiring build steps):

| Variable | Description | Example |
|---|---|---|
| `BACKEND_URL` | Base URL for the Express backend API | `http://localhost:5000` |
| `SUPABASE_URL` | Public Supabase project URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_ANON_KEY` | Public Supabase anonymous key | `eyJhbGciOi...` |

---

## 🗄️ Supabase Database Migration (Single Command)

You can run the migration and create all required tables in one step:

### Option A: Using the Automated Migration Command
Run this command from your terminal:
```bash
npm run db:migrate -- "YOUR_SUPABASE_DATABASE_PASSWORD"
```
*(Or add `DATABASE_URL` in `backend/.env` and simply run `npm run db:migrate`)*

### Option B: Using Supabase CLI
```bash
npx supabase db push
```
*(Uses the migration file located at [`supabase/migrations/20261014000000_create_chat_tables.sql`](file:///c:/Users/vemul/OneDrive/Desktop/eswar%20anti%20gravity/supabase/migrations/20261014000000_create_chat_tables.sql))*

### Option C: In Supabase Web Dashboard
1. Open your project's [SQL Editor](https://supabase.com/dashboard/project/_/sql/new).
2. Copy and paste the contents of [`backend/schema.sql`](file:///c:/Users/vemul/OneDrive/Desktop/eswar%20anti%20gravity/backend/schema.sql).
3. Click **Run**.

---

## 🚀 Quick Start Guide

### 1. Configure Keys
Add your keys into:
- [`backend/.env`](file:///c:/Users/vemul/OneDrive/Desktop/eswar%20anti%20gravity/backend/.env)
- [`frontend/.env`](file:///c:/Users/vemul/OneDrive/Desktop/eswar%20anti%20gravity/frontend/.env)

### 2. Launch Dev Server
From the root folder:
```bash
npm run dev
```

Open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## ✨ Features

- **Google GenAI Integration**: Official `@google/genai` SDK with model selection (Gemini 2.5 Flash, 2.0 Flash, 1.5 Flash, 1.5 Pro).
- **Supabase Cloud PostgreSQL**: Real-time persistence of conversation history and chat sessions.
- **Sidebar Chat History**: Load previous chats, switch sessions, delete past conversations.
- **Real-Time Streaming**: Low-latency token delivery via Server-Sent Events (SSE).
- **Dual Status Badges**: Displays live indicators for both Gemini connection and Supabase database.
- **Rich Markdown & Code**: Code blocks with language tags and 1-click **Copy Code** functionality.
