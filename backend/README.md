# 🚀 Gemini Chatbot Backend

This directory contains the server-side API application powering the Gemini AI Chatbot.

## 📁 Architecture & File Overview

- **`server.js`**: Express.js REST API and Server-Sent Events (SSE) server.
  - Implements `GET /api/health` for monitoring server and API key status.
  - Implements `POST /api/chat` for standard Gemini completions.
  - Implements `POST /api/chat/stream` for real-time token streaming.
  - Integrates with the official `@google/genai` SDK.
- **`package.json`**: Backend dependencies (`@google/genai`, `express`, `cors`, `dotenv`).
- **`.env`**: Private configuration holding your `GEMINI_API_KEY` and `PORT`.
- **`.env.example`**: Example template for environment variables.

## 🔑 Setup & Configuration

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure your Gemini API Key**:
   - Get your free key at [Google AI Studio](https://aistudio.google.com/).
   - Edit the `.env` file:
     ```env
     GEMINI_API_KEY=AIzaSyYourActualKeyHere
     PORT=5000
     ```

3. **Start the Backend**:
   ```bash
   npm start
   ```
   Or for auto-reloading during development:
   ```bash
   npm run dev
   ```

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Checks server status and whether Gemini API key is configured |
| `POST` | `/api/chat` | Generates a response from Gemini LLM for a given message and history |
| `POST` | `/api/chat/stream` | Streams generated response tokens in real-time via SSE |
