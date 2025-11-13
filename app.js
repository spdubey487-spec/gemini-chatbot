const API_KEY = window.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";
const SYSTEM_PROMPT = window.SYSTEM_PROMPT || "";

if (!API_KEY) alert("Missing API key! Please edit API_KEY.js first.");

const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
// added: reference to the New button
const newChatBtn = document.getElementById("new-chat");

let conversationHistory = [];

// Allow a mock streaming mode for local/testing environments.
// Enable by setting `window.MOCK_STREAM = true` or by adding `?mock=1` to the URL.
const MOCK_STREAM = window.MOCK_STREAM || new URLSearchParams(window.location.search).get("mock") === "1";

function appendMessage(sender, text, { asHTML = false } = {}) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  if (asHTML) {
    msg.innerHTML = text;
  } else {
    msg.textContent = text;
  }
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// new helper: simple, safe markdown -> HTML renderer (supports headings, bold, italics, hr, inline code)
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMarkdownToHtml(md) {
  // Escape first
  let s = escapeHtml(md);

  // Horizontal rule: line with only three or more * or - or _
  s = s.replace(/^\s*(\*{3,}|-{3,}|_{3,})\s*$/gm, "<hr>");

  // Headings: ###, ##, #
  s = s.replace(/^###\s+(.*)$/gm, "<h3>$1</h3>");
  s = s.replace(/^##\s+(.*)$/gm, "<h2>$1</h2>");
  s = s.replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");

  // Bold: **text**
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic: *text*
  s = s.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, "$1<em>$2</em>");

  // Inline code: `code`
  s = s.replace(/`([^`]+?)`/g, "<code>$1</code>");

  // Convert remaining newlines to <br>
  s = s.replace(/\n/g, "<br>");

  return s;
}

// new helper to show the initial bot prompt so we can remove it later
function showInitialPrompt({ simulateTyping = true } = {}) {
  const existing = document.getElementById("initial-prompt");
  if (existing) return;
  const initialText = "Hey! what are you planning today?";
  if (!simulateTyping) {
    const initial = document.createElement("div");
    initial.id = "initial-prompt";
    initial.className = "message bot";
    initial.innerHTML = renderMarkdownToHtml(initialText);
    chatBox.appendChild(initial);
    chatBox.scrollTop = chatBox.scrollHeight;
    return;
  }

  // simulate typing so it doesn't suddenly pop up
  const initial = document.createElement("div");
  initial.id = "initial-prompt";
  initial.className = "message bot";
  chatBox.appendChild(initial);
  chatBox.scrollTop = chatBox.scrollHeight;

  let idx = 0;
  const typingInterval = 35; // ms per char
  const timer = setInterval(() => {
    idx += 1;
    initial.innerHTML = renderMarkdownToHtml(initialText.slice(0, idx));
    chatBox.scrollTop = chatBox.scrollHeight;
    if (idx >= initialText.length) {
      clearInterval(timer);
    }
  }, typingInterval);
}

// new: handler to start a new chat
newChatBtn?.addEventListener("click", () => {
  // Save current chat before creating new one
  if (conversationHistory.length > 0) {
    chatHistory.saveChatToHistory(conversationHistory);
  }
  
  conversationHistory = [];
  chatHistory.createNewChat();
  chatBox.innerHTML = "";
  // display initial assistant message and focus input
  showInitialPrompt({ simulateTyping: true });
  userInput.value = "";
  userInput.focus();
});

// History button handler
const historyBtn = document.getElementById("history-btn");
const historyModal = document.getElementById("history-modal");
const historyClose = document.getElementById("history-close");

historyBtn?.addEventListener("click", () => {
  // Render history list
  const historyList = document.getElementById("history-list");
  const allChats = chatHistory.getAllChats();
  
  if (allChats.length === 0) {
    historyList.innerHTML = "<div class='history-empty'>No chat history yet.</div>";
  } else {
    historyList.innerHTML = allChats.map(chat => `
      <div class="history-item" data-chat-id="${chat.id}">
        <div class="history-item-preview">${escapeHtml(chat.preview)}</div>
        <div class="history-item-date">${new Date(chat.timestamp).toLocaleString()}</div>
      </div>
    `).join("");
    
    // Attach click handlers
    historyList.querySelectorAll(".history-item").forEach(item => {
      item.addEventListener("click", () => {
        const selectedChat = chatHistory.getChatById(item.dataset.chatId);
        if (!selectedChat) return;
        
        // Save current chat before switching
        if (conversationHistory.length > 0) {
          chatHistory.saveChatToHistory(conversationHistory);
        }
        
        // Load the selected chat
        conversationHistory = JSON.parse(JSON.stringify(selectedChat.messages));
        chatHistory.currentChatId = selectedChat.id;
        
        // Render messages
        chatBox.innerHTML = "";
        conversationHistory.forEach(msg => {
          appendMessage(msg.sender, msg.text, { asHTML: msg.sender === "bot" });
        });
        
        // Close history modal
        historyModal.classList.remove("active");
      });
    });
  }
  
  historyModal.classList.add("active");
});

historyClose?.addEventListener("click", () => {
  historyModal.classList.remove("active");
});

// Close modal on outside click
historyModal?.addEventListener("click", (e) => {
  if (e.target === historyModal) {
    historyModal.classList.remove("active");
  }
});

function buildPayload(history) {
  const contents = [];
  // Gemini's `parts` can be an array; for very long system prompts we split
  // the prompt into multiple `parts` entries so the API accepts the content.
  function chunkTextToParts(text, maxLen = 2000) {
    const parts = [];
    if (!text) return parts;
    let start = 0;
    while (start < text.length) {
      const chunk = text.slice(start, start + maxLen);
      parts.push({ text: chunk });
      start += maxLen;
    }
    return parts;
  }

  if (SYSTEM_PROMPT) {
    const parts = chunkTextToParts(SYSTEM_PROMPT, 2000);
    if (parts.length > 0) {
      contents.push({
        role: "user", // Kept as user because Gemini doesn't support system role
        parts
      });
    }
  }
  history.forEach(msg => {
    // Change this line to map 'assistant' to 'model'
    const role = msg.sender === "assistant" ? "model" : "user";
    contents.push({
      role,
      parts: [{ text: msg.text }]
    });
  });
  return { contents };
}

// Stream-capable query function. onUpdate is called with progressively accumulated text.
async function queryGemini(history, onUpdate = () => {}) {
  // If mock streaming is enabled, simulate incremental updates for UI testing.
  if (MOCK_STREAM) {
    const demo = "This is a simulated streaming response used for UI testing. It arrives in chunks so you can verify typing and scrolling behavior.";
    return new Promise((resolve) => {
      let idx = 0;
      const interval = 40;
      const timer = setInterval(() => {
        idx += Math.ceil(Math.random() * 6);
        const partial = demo.slice(0, idx);
        onUpdate(partial);
        if (idx >= demo.length) {
          clearInterval(timer);
          resolve(demo);
        }
      }, interval);
    });
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`;
  const payload = buildPayload(history);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error: ${errText}`);
  }

  // Try to stream the response body as text if available.
  if (!response.body) {
    // Fallback to full JSON read
    const data = await response.json();
    const candidates = data.candidates || [];
    const parts = candidates[0]?.content?.parts || [];
    const fullText = parts.map(p => p.text).join("\n").trim() || "(no response)";
    onUpdate(fullText);
    return fullText;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let accumulated = "";

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (value) {
      const chunkText = decoder.decode(value, { stream: true });
      // Try to extract any text content from chunkText.
      // Heuristic: the API may send partial JSON or plain text. We'll try to append any visible text.
      accumulated += chunkText;

      // Attempt to extract JSON fragments if API streams JSON lines (naive approach):
      // Look for "parts": [{"text":"..."}] in the accumulated buffer; fallback to raw text.
      try {
        // Attempt to find the last JSON object in the stream by finding the last '{' and trying to parse
        const lastBrace = accumulated.lastIndexOf("{");
        if (lastBrace !== -1) {
          const maybeJson = accumulated.slice(lastBrace);
          const parsed = JSON.parse(maybeJson);
          const candidates = parsed.candidates || [];
          const parts = candidates[0]?.content?.parts || [];
          const textSoFar = parts.map(p => p.text).join("\n");
          onUpdate(textSoFar);
        } else {
          // If not JSON, just stream raw text (useful if the API only streams plain text)
          onUpdate(accumulated);
        }
      } catch (e) {
        // If not valid JSON yet, try to pull any quoted "text" fragments using regex as a best-effort
        const matches = accumulated.match(/"text"\s*:\s*"([^"]*)"/g);
        if (matches) {
          const last = matches[matches.length - 1];
          const m = /"text"\s*:\s*"([^"]*)"/.exec(last);
          if (m) {
            const partial = m[1].replace(/\\"/g, '"');
            onUpdate(partial);
          } else {
            onUpdate(accumulated);
          }
        } else {
          // finally fallback to raw chunk append
          onUpdate(accumulated);
        }
      }
    }
    done = streamDone;
  }

  // After stream ends try to parse full JSON to get the definitive response
  try {
    const text = accumulated.trim();
    const fullJsonStart = text.indexOf("{");
    if (fullJsonStart !== -1) {
      const fullJson = JSON.parse(text.slice(fullJsonStart));
      const candidates = fullJson.candidates || [];
      const parts = candidates[0]?.content?.parts || [];
      const fullText = parts.map(p => p.text).join("\n").trim() || "(no response)";
      onUpdate(fullText);
      return fullText;
    }
  } catch (e) {
    // ignore parse errors, fallback to accumulated string
  }

  // fallback: return accumulated plain text
  const fallback = accumulated.trim() || "(no response)";
  onUpdate(fallback);
  return fallback;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Remove the initial prompt automatically when the user sends their first real message
  document.getElementById("initial-prompt")?.remove();

  // Reset conversation if user types "new chat"
  if (text.toLowerCase() === "new chat") {
    conversationHistory = [];
    chatBox.innerHTML = "";
    showInitialPrompt({ simulateTyping: true });
    userInput.value = "";
    return;
  }

  appendMessage("user", text);
  conversationHistory.push({ sender: "user", text });
  userInput.value = "";

  const loading = document.createElement("div");
  loading.className = "message bot";
  loading.dataset.streaming = "true";
  loading.innerHTML = renderMarkdownToHtml("Searching...");
  chatBox.appendChild(loading);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    // Stream updates into the loading element so the user sees the model "typing"
    let lastRendered = "";
    const reply = await queryGemini(conversationHistory, (partial) => {
      // Render partial with markdown support
      // Avoid re-rendering identical partials
      if (partial === lastRendered) return;
      lastRendered = partial;
      loading.innerHTML = renderMarkdownToHtml(partial);
      chatBox.scrollTop = chatBox.scrollHeight;
    });

    // Ensure final reply is set and conversation history updated
    loading.innerHTML = renderMarkdownToHtml(reply);
    conversationHistory.push({ sender: "assistant", text: reply });
    
    // Auto-save to history using the module
    chatHistory.saveChatToHistory(conversationHistory);
  } catch (err) {
    const errMsg = err?.message || 'Network or API error';
    loading.innerHTML = renderMarkdownToHtml(`**Error:** ${escapeHtml(errMsg)}`);
    conversationHistory.push({ sender: "assistant", text: errMsg });
    
    // Auto-save error to history using the module
    chatHistory.saveChatToHistory(conversationHistory);
  }
});