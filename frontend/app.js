/**
 * Gemini AI Assistant - Frontend Client Application
 * Features:
 * - Reads config dynamically from frontend/.env (via window.__ENV or /api/config)
 * - Real-time streaming responses from Express backend
 * - Supabase PostgreSQL chat session persistence & history navigation
 * - Markdown parsing (Marked) & Syntax highlighting (Highlight.js)
 * - Server & Database health monitoring
 */

// Configuration loaded from frontend/.env (via /env.js) with fallback
const ENV = window.__ENV || {};
const BACKEND_BASE_URL = (ENV.BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');

// Application State
const state = {
  currentSessionId: null,
  sessions: [],
  messages: [],
  isGenerating: false,
  selectedModel: 'gemini-3.5-flash',
  backendOnline: false,
  apiKeyConfigured: false,
  supabaseConfigured: false,
  supabaseUrl: ENV.SUPABASE_URL || '',
  supabaseAnonKey: ENV.SUPABASE_ANON_KEY || ''
};

// DOM Elements
const chatViewport = document.getElementById('chat-viewport');
const messagesList = document.getElementById('messages-list');
const welcomeHero = document.getElementById('welcome-hero');
const typingIndicator = document.getElementById('typing-indicator');
const scrollAnchor = document.getElementById('scroll-anchor');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const charCounter = document.getElementById('char-counter');
const modelSelect = document.getElementById('model-select');
const clearChatBtn = document.getElementById('clear-chat-btn');
const backendStatusPill = document.getElementById('backend-status');
const backendStatusText = document.getElementById('backend-status-text');
const promptGrid = document.getElementById('prompt-grid');
const sessionList = document.getElementById('session-list');
const sessionListEmpty = document.getElementById('session-list-empty');
const newChatBtn = document.getElementById('new-chat-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const chatSidebar = document.getElementById('chat-sidebar');
const dbStatusBadge = document.getElementById('db-status-badge');
const supabaseStatusText = document.getElementById('supabase-status-text');

// Configure Marked.js markdown parser
if (window.marked) {
  marked.setOptions({
    breaks: true,
    gfm: true
  });
}

/**
 * Initialize application listeners, load configs & sessions
 */
async function init() {
  setupEventListeners();
  await checkHealthAndConfig();
  await loadSessions();
  setInterval(checkHealthAndConfig, 10000); // Poll health every 10s
}

/**
 * Attach Event Listeners
 */
function setupEventListeners() {
  // Model dropdown change
  modelSelect.addEventListener('change', (e) => {
    state.selectedModel = e.target.value;
  });

  // Textarea input & auto-resize
  userInput.addEventListener('input', handleTextareaInput);

  // Keydown listener for Enter (send) vs Shift+Enter (newline)
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!state.isGenerating && userInput.value.trim().length > 0) {
        sendMessage(userInput.value.trim());
      }
    }
  });

  // Form submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.isGenerating && userInput.value.trim().length > 0) {
      sendMessage(userInput.value.trim());
    }
  });

  // Prompt suggestion cards
  if (promptGrid) {
    promptGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.prompt-card');
      if (card && !state.isGenerating) {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          sendMessage(prompt);
        }
      }
    });
  }

  // Clear / Reset current chat
  clearChatBtn.addEventListener('click', startNewChat);

  // New Chat button in sidebar
  newChatBtn.addEventListener('click', startNewChat);

  // Toggle Sidebar
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 820) {
        chatSidebar.classList.toggle('mobile-open');
      } else {
        chatSidebar.classList.toggle('collapsed');
      }
    });
  }
}

/**
 * Auto-resize textarea
 */
function handleTextareaInput() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 180) + 'px';
  charCounter.textContent = `${userInput.value.length} / 4000`;
}

/**
 * Check backend health & fetch database configuration
 */
async function checkHealthAndConfig() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const data = await res.json();
      state.backendOnline = true;
      state.apiKeyConfigured = Boolean(data.apiKeyConfigured);
      state.supabaseConfigured = Boolean(data.supabaseConfigured);

      // Update Gemini Backend status pill
      backendStatusPill.className = 'status-pill';
      if (state.apiKeyConfigured) {
        backendStatusPill.classList.add('online');
        backendStatusText.textContent = 'Gemini Ready';
        backendStatusPill.title = 'Backend online & Gemini API Key active';
      } else {
        backendStatusPill.classList.add('needs-key');
        backendStatusText.textContent = 'Key Required';
        backendStatusPill.title = 'Backend online, but GEMINI_API_KEY is not set in backend/.env';
      }

      // Update Supabase DB status badges
      if (state.supabaseConfigured) {
        dbStatusBadge.className = 'db-badge synced';
        dbStatusBadge.textContent = 'Connected';
        supabaseStatusText.textContent = 'PostgreSQL Active';
      } else {
        dbStatusBadge.className = 'db-badge pending';
        dbStatusBadge.textContent = 'Setup Needed';
        supabaseStatusText.textContent = 'Add SUPABASE_URL in .env';
      }
    } else {
      setBackendOffline();
    }
  } catch (err) {
    setBackendOffline();
  }
}

function setBackendOffline() {
  state.backendOnline = false;
  backendStatusPill.className = 'status-pill offline';
  backendStatusText.textContent = 'Backend Offline';
  backendStatusPill.title = `Unable to reach Express backend at ${BACKEND_BASE_URL}`;

  dbStatusBadge.className = 'db-badge';
  dbStatusBadge.textContent = 'Offline';
  supabaseStatusText.textContent = 'Server unreachable';
}

/**
 * Load Sessions from Supabase (via backend)
 */
async function loadSessions() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/sessions`);
    if (!res.ok) return;

    const data = await res.json();
    state.sessions = data.sessions || [];
    renderSessionList();
  } catch (err) {
    console.warn('Unable to load chat sessions:', err);
  }
}

/**
 * Render Session List in Sidebar
 */
function renderSessionList() {
  sessionList.innerHTML = '';

  if (!state.sessions || state.sessions.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'session-list-empty';
    emptyDiv.textContent = state.supabaseConfigured ? 'No saved chats yet.' : 'Configure Supabase in .env';
    sessionList.appendChild(emptyDiv);
    return;
  }

  state.sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = 'session-item';
    if (session.id === state.currentSessionId) {
      item.classList.add('active');
    }

    const titleWrap = document.createElement('div');
    titleWrap.className = 'session-title-wrap';
    titleWrap.textContent = session.title || 'Untitled Chat';
    titleWrap.title = session.title || 'Untitled Chat';

    const delBtn = document.createElement('button');
    delBtn.className = 'session-del-btn';
    delBtn.title = 'Delete chat session';
    delBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;

    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });

    item.addEventListener('click', () => {
      if (session.id !== state.currentSessionId) {
        selectSession(session.id);
      }
      if (window.innerWidth <= 820) {
        chatSidebar.classList.remove('mobile-open');
      }
    });

    item.appendChild(titleWrap);
    item.appendChild(delBtn);
    sessionList.appendChild(item);
  });
}

/**
 * Select & Load an Existing Session
 */
async function selectSession(sessionId) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/sessions/${sessionId}`);
    if (!res.ok) throw new Error('Failed to load session');

    const data = await res.json();
    state.currentSessionId = sessionId;
    state.messages = (data.messages || []).map(m => ({ role: m.role, content: m.content }));

    // Update UI
    welcomeHero.classList.add('hidden');
    messagesList.innerHTML = '';

    state.messages.forEach(msg => {
      if (msg.role === 'user') {
        appendUserMessage(msg.content);
      } else {
        const botObj = appendBotMessageContainer();
        updateBotMessage(botObj, msg.content);
        finalizeBotMessage(botObj);
      }
    });

    renderSessionList();
    scrollToBottom();
  } catch (err) {
    console.error('Error selecting session:', err);
  }
}

/**
 * Delete a Session from Supabase
 */
async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this chat session?')) return;

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/sessions/${sessionId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      state.sessions = state.sessions.filter(s => s.id !== sessionId);
      if (state.currentSessionId === sessionId) {
        startNewChat();
      } else {
        renderSessionList();
      }
    }
  } catch (err) {
    console.error('Error deleting session:', err);
  }
}

/**
 * Start a fresh New Chat
 */
function startNewChat() {
  state.currentSessionId = null;
  state.messages = [];
  messagesList.innerHTML = '';
  welcomeHero.classList.remove('hidden');
  userInput.value = '';
  handleTextareaInput();
  renderSessionList();
  userInput.focus();
}

/**
 * Scroll viewport smoothly to latest message
 */
function scrollToBottom() {
  scrollAnchor.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Send Message & Handle Streaming from Backend
 */
async function sendMessage(text) {
  if (state.isGenerating || !text.trim()) return;

  // Hide welcome hero on first message
  welcomeHero.classList.add('hidden');

  // Append user message
  appendUserMessage(text);
  state.messages.push({ role: 'user', content: text });

  // Reset input field
  userInput.value = '';
  handleTextareaInput();
  setGenerating(true);

  // Prepare Bot Message element
  const botMessageObj = appendBotMessageContainer();
  scrollToBottom();

  let accumulatedResponse = '';

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.messages.slice(0, -1),
        model: state.selectedModel,
        sessionId: state.currentSessionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.substring(6).trim();
          if (dataStr === '[DONE]') {
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.sessionId && !state.currentSessionId) {
              state.currentSessionId = parsed.sessionId;
              loadSessions(); // Refresh sidebar with new session title
            }
            if (parsed.text) {
              accumulatedResponse += parsed.text;
              updateBotMessage(botMessageObj, accumulatedResponse);
              scrollToBottom();
            } else if (parsed.error) {
              accumulatedResponse += `\n\n> ❌ **Error:** ${parsed.error}`;
              updateBotMessage(botMessageObj, accumulatedResponse);
            }
          } catch (e) {
            // Ignore parse errors on partial frames
          }
        }
      }
    }

    if (!accumulatedResponse.trim()) {
      accumulatedResponse = 'I received an empty response. Please verify your prompt or API key.';
      updateBotMessage(botMessageObj, accumulatedResponse);
    }

    state.messages.push({ role: 'model', content: accumulatedResponse });
    finalizeBotMessage(botMessageObj);
    loadSessions(); // Update timestamps / session title in sidebar
  } catch (error) {
    console.error('Streaming request failed, trying fallback:', error);
    try {
      const fallbackRes = await fetch(`${BACKEND_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: state.messages.slice(0, -1),
          model: state.selectedModel,
          sessionId: state.currentSessionId
        })
      });

      if (!fallbackRes.ok) throw new Error(`Server returned error ${fallbackRes.status}`);

      const data = await fallbackRes.json();
      if (data.sessionId && !state.currentSessionId) {
        state.currentSessionId = data.sessionId;
        loadSessions();
      }
      accumulatedResponse = data.reply || 'No response from model.';
      updateBotMessage(botMessageObj, accumulatedResponse);
      state.messages.push({ role: 'model', content: accumulatedResponse });
      finalizeBotMessage(botMessageObj);
      loadSessions();
    } catch (fallbackError) {
      accumulatedResponse = `### ⚠️ Connection Notice\n\nUnable to reach the Gemini backend server at \`${BACKEND_BASE_URL}\`.\n\n**To start the server:**\n\`\`\`bash\nnpm run dev\n\`\`\`\n\n*Error details: ${fallbackError.message}*`;
      updateBotMessage(botMessageObj, accumulatedResponse);
      finalizeBotMessage(botMessageObj);
    }
  } finally {
    setGenerating(false);
    scrollToBottom();
  }
}

/**
 * Toggle generation state
 */
function setGenerating(isGenerating) {
  state.isGenerating = isGenerating;
  sendBtn.disabled = isGenerating;
  userInput.disabled = isGenerating;

  if (isGenerating) {
    typingIndicator.classList.remove('hidden');
  } else {
    typingIndicator.classList.add('hidden');
    userInput.focus();
  }
}

/**
 * Append user message element
 */
function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'message-row user';

  const avatar = document.createElement('div');
  avatar.className = 'avatar user-avatar';
  avatar.textContent = 'You';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;

  const footer = document.createElement('div');
  footer.className = 'message-footer';
  footer.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(footer);

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesList.appendChild(row);
}

/**
 * Append empty bot message container for incremental updates
 */
function appendBotMessageContainer() {
  const row = document.createElement('div');
  row.className = 'message-row bot';

  const avatar = document.createElement('div');
  avatar.className = 'avatar bot-avatar';
  avatar.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="url(#sparkGradient)"/>
    </svg>
  `;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const markdownContent = document.createElement('div');
  markdownContent.className = 'markdown-body';
  markdownContent.innerHTML = '<em>Thinking...</em>';

  bubble.appendChild(markdownContent);
  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesList.appendChild(row);

  return { row, bubble, markdownContent };
}

/**
 * Update bot message with markdown
 */
function updateBotMessage(botObj, rawMarkdown) {
  if (window.marked) {
    botObj.markdownContent.innerHTML = marked.parse(rawMarkdown);
  } else {
    botObj.markdownContent.textContent = rawMarkdown;
  }
}

/**
 * Finalize bot message (syntax highlighting & copy buttons)
 */
function finalizeBotMessage(botObj) {
  // Code block syntax styling & 1-click copy
  const codeBlocks = botObj.markdownContent.querySelectorAll('pre code');
  codeBlocks.forEach((block) => {
    if (window.hljs) {
      hljs.highlightElement(block);
    }

    const pre = block.parentElement;
    if (!pre.parentElement.classList.contains('code-block-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-header';

      const langClass = Array.from(block.classList).find(c => c.startsWith('language-'));
      const langName = langClass ? langClass.replace('language-', '') : 'code';

      header.innerHTML = `
        <span class="lang-tag">${langName}</span>
        <button class="copy-code-btn" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      `;

      const copyBtn = header.querySelector('.copy-code-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(block.textContent).then(() => {
          const span = copyBtn.querySelector('span');
          span.textContent = 'Copied!';
          setTimeout(() => { span.textContent = 'Copy'; }, 2000);
        });
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    }
  });

  // Message action footer
  const footer = document.createElement('div');
  footer.className = 'message-footer';
  footer.innerHTML = `
    <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    <button class="copy-msg-btn" type="button" title="Copy response">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy</span>
    </button>
  `;

  const copyMsgBtn = footer.querySelector('.copy-msg-btn');
  copyMsgBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(botObj.markdownContent.innerText).then(() => {
      const span = copyMsgBtn.querySelector('span');
      span.textContent = 'Copied!';
      setTimeout(() => { span.textContent = 'Copy'; }, 2000);
    });
  });

  botObj.bubble.appendChild(footer);
}

// Start application
document.addEventListener('DOMContentLoaded', init);
