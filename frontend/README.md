# 🎨 Gemini Chatbot Frontend

This directory contains the client-side user interface application for the Gemini AI Chatbot.

## 📁 File Structure

- **`index.html`**: Semantic HTML5 markup containing:
  - Header with model selector & live backend status pill
  - Hero section with quick-starter suggestions
  - Message stream area with avatar branding
  - Responsive floating input dock with auto-expanding textarea
- **`style.css`**: Design system featuring:
  - Curated obsidian & neon cyan/indigo dark theme
  - Glassmorphic panels (`backdrop-filter: blur(...)`)
  - Google Fonts (`Outfit` & `JetBrains Mono`)
  - Subtle floating ambient glow orbs and micro-animations
  - Fully responsive for mobile and desktop screens
- **`app.js`**: Core client interactions:
  - Real-time streaming response consumption via Server-Sent Events (SSE)
  - Markdown rendering (Marked.js)
  - Code syntax highlighting (Highlight.js) with "Copy Code" buttons
  - Conversation history maintenance
  - Automatic backend health status checking

## 🚀 Running the Frontend

You can run the frontend using any static file server:

```bash
# Using Python:
python -m http.server 3000

# Or using Node npx:
npx serve -l 3000
```

Or run both frontend and backend together from the root project directory via:
```bash
npm run dev
```
