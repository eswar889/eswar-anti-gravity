require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Default Gemini Model (high availability and performance)
const DEFAULT_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

app.use(cors());
app.use(express.json());

// Initialize Gemini Client helper
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

// Initialize Supabase Client helper
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-id') || supabaseKey === 'your_supabase_anon_key_here') {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

// Fallback message when API key is not configured
const MISSING_KEY_MESSAGE = `### ⚠️ Gemini API Key Required

To enable live conversation with Google's Gemini models:

1. Obtain a free API key from **[Google AI Studio](https://aistudio.google.com/)**.
2. Open the file **\`backend/.env\`** in your editor.
3. Add your key:
   \`\`\`env
   GEMINI_API_KEY=your_actual_key
   \`\`\`
4. Restart the dev server (\`npm run dev\`).`;

/**
 * Health Check Endpoint
 */
app.get('/api/health', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const hasGeminiKey = Boolean(apiKey && apiKey !== 'your_gemini_api_key_here');
  const supabase = getSupabaseClient();
  let tablesReady = false;

  if (supabase) {
    try {
      const { error } = await supabase.from('chat_sessions').select('id').limit(1);
      tablesReady = !error;
    } catch (e) {
      tablesReady = false;
    }
  }

  res.json({
    status: 'healthy',
    service: 'gemini-chatbot-backend',
    apiKeyConfigured: hasGeminiKey,
    supabaseConfigured: Boolean(supabase),
    supabaseTablesReady: tablesReady,
    timestamp: new Date().toISOString()
  });
});

/**
 * Public Config Endpoint
 */
app.get('/api/config', (req, res) => {
  const supabase = getSupabaseClient();
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseConfigured: Boolean(supabase)
  });
});

/**
 * Supabase Helper: Persist Message
 */
async function saveMessageToSupabase(sessionId, role, content) {
  const supabase = getSupabaseClient();
  if (!supabase || !sessionId) return null;

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{ session_id: sessionId, role, content }])
      .select()
      .single();

    if (error) {
      return null;
    }

    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Supabase Helper: Ensure or Create Session
 */
async function ensureSession(sessionId, initialPrompt, model) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    if (sessionId) {
      const { data } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .single();
      if (data) return data.id;
    }

    const title = initialPrompt ? initialPrompt.slice(0, 36) + (initialPrompt.length > 36 ? '...' : '') : 'New Chat';
    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert([{ title, model }])
      .select('id')
      .single();

    if (error) {
      return null;
    }
    return newSession?.id || null;
  } catch (err) {
    return null;
  }
}

/**
 * Sessions Endpoints
 */
app.get('/api/sessions', async (req, res) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.json({ sessions: [], supabaseConfigured: false, tablesReady: false });
  }

  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, model, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      return res.json({ sessions: [], supabaseConfigured: true, tablesReady: false, notice: 'Run backend/schema.sql in Supabase SQL editor' });
    }
    res.json({ sessions: data || [], supabaseConfigured: true, tablesReady: true });
  } catch (err) {
    res.json({ sessions: [], supabaseConfigured: true, tablesReady: false });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(400).json({ error: 'Supabase is not configured' });
  }

  try {
    const { id } = req.params;
    const { data: session, error: sessionErr } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionErr) throw sessionErr;

    const { data: messages, error: msgErr } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (msgErr) throw msgErr;

    res.json({ session, messages: messages || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session', details: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(400).json({ error: 'Supabase is not configured' });
  }

  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session', details: err.message });
  }
});

/**
 * Format chat history for @google/genai
 */
function formatHistory(history = []) {
  return history
    .filter(msg => msg.role && msg.content)
    .map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
}

/**
 * Helper to generate content with fallback
 */
async function generateWithFallback(ai, targetModel, contents) {
  const modelsToTry = [targetModel, ...FALLBACK_MODELS.filter(m => m !== targetModel)];
  let lastError = null;

  for (const m of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: m,
        contents: contents,
        config: {
          systemInstruction: 'You are a smart, friendly, and helpful AI assistant powered by Google Gemini. Use clear markdown formatting, code blocks with languages specified, and concise explanations.'
        }
      });
      return { response, activeModel: m };
    } catch (err) {
      lastError = err;
      console.warn(`Model ${m} failed (${err.message}). Trying fallback...`);
    }
  }
  throw lastError;
}

/**
 * Standard Chat Completion Endpoint
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], model = DEFAULT_MODEL, sessionId = null } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const activeSessionId = await ensureSession(sessionId, message, model);
    if (activeSessionId) {
      await saveMessageToSupabase(activeSessionId, 'user', message.trim());
    }

    const ai = getGeminiClient();

    if (!ai) {
      if (activeSessionId) {
        await saveMessageToSupabase(activeSessionId, 'model', MISSING_KEY_MESSAGE);
      }
      return res.json({
        reply: MISSING_KEY_MESSAGE,
        model: model,
        sessionId: activeSessionId,
        requiresKey: true
      });
    }

    const formattedHistory = formatHistory(history);
    const contents = [
      ...formattedHistory,
      { role: 'user', parts: [{ text: message.trim() }] }
    ];

    const { response, activeModel } = await generateWithFallback(ai, model, contents);
    const replyText = response.text || 'No response generated.';

    if (activeSessionId) {
      await saveMessageToSupabase(activeSessionId, 'model', replyText);
    }

    res.json({
      reply: replyText,
      model: activeModel,
      sessionId: activeSessionId,
      requiresKey: false
    });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      error: 'Failed to generate response from Gemini LLM',
      details: error?.message || 'Unknown error'
    });
  }
});

/**
 * Streaming Chat Endpoint (Server-Sent Events)
 */
app.post('/api/chat/stream', async (req, res) => {
  const { message, history = [], model = DEFAULT_MODEL, sessionId = null } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const activeSessionId = await ensureSession(sessionId, message, model);
  if (activeSessionId) {
    await saveMessageToSupabase(activeSessionId, 'user', message.trim());
    res.write(`data: ${JSON.stringify({ sessionId: activeSessionId })}\n\n`);
  }

  const ai = getGeminiClient();

  if (!ai) {
    if (activeSessionId) {
      await saveMessageToSupabase(activeSessionId, 'model', MISSING_KEY_MESSAGE);
    }
    res.write(`data: ${JSON.stringify({ text: MISSING_KEY_MESSAGE, requiresKey: true, sessionId: activeSessionId })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  try {
    const formattedHistory = formatHistory(history);
    const contents = [
      ...formattedHistory,
      { role: 'user', parts: [{ text: message.trim() }] }
    ];

    let stream;
    try {
      stream = await ai.models.generateContentStream({
        model: model,
        contents: contents,
        config: {
          systemInstruction: 'You are a smart, friendly, and helpful AI assistant powered by Google Gemini. Use clear markdown formatting, code blocks with languages specified, and concise explanations.'
        }
      });
    } catch (e) {
      console.warn(`Streaming with ${model} failed, falling back to ${DEFAULT_MODEL}...`);
      stream = await ai.models.generateContentStream({
        model: DEFAULT_MODEL,
        contents: contents,
        config: {
          systemInstruction: 'You are a smart, friendly, and helpful AI assistant powered by Google Gemini.'
        }
      });
    }

    let fullReply = '';
    for await (const chunk of stream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullReply += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    if (activeSessionId && fullReply) {
      await saveMessageToSupabase(activeSessionId, 'model', fullReply);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Gemini Stream Error:', error);
    res.write(`data: ${JSON.stringify({ error: error?.message || 'Streaming error' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// Start Express Server
app.listen(PORT, () => {
  const supabase = getSupabaseClient();
  console.log(`======================================================`);
  console.log(`🤖 Gemini Chatbot Backend running on port ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Supabase Connected: ${Boolean(supabase) ? 'YES' : 'NO'}`);
  console.log(`======================================================`);
});
