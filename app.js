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

function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// new helper to show the initial bot prompt so we can remove it later
function showInitialPrompt() {
  const existing = document.getElementById("initial-prompt");
  if (existing) return;
  const initial = document.createElement("div");
  initial.id = "initial-prompt";
  initial.className = "message bot";
  initial.textContent = "Hey! what are you planning today?";
  chatBox.appendChild(initial);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// new: handler to start a new chat
newChatBtn?.addEventListener("click", () => {
  conversationHistory = [];
  chatBox.innerHTML = "";
  // display initial assistant message and focus input
  showInitialPrompt();
  userInput.value = "";
  userInput.focus();
});

function buildPayload(history) {
  const contents = [];
  if (SYSTEM_PROMPT) {
    contents.push({
      role: "user",  // Changed from system to user as Gemini doesn't support system role
      parts: [{ text: SYSTEM_PROMPT }]
    });
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

async function queryGemini(history) {
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

  const data = await response.json();
  const candidates = data.candidates || [];
  const parts = candidates[0]?.content?.parts || [];
  return parts.map(p => p.text).join("\n").trim() || "(no response)";
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
    showInitialPrompt();
    userInput.value = "";
    return;
  }

  appendMessage("user", text);
  conversationHistory.push({ sender: "user", text });
  userInput.value = "";

  const loading = document.createElement("div");
  loading.className = "message bot";
  loading.textContent = "Searching...";
  chatBox.appendChild(loading);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const reply = await queryGemini(conversationHistory);
    loading.textContent = reply;
    conversationHistory.push({ sender: "assistant", text: reply });
  } catch (err) {
    const errMsg = err?.message || 'Network or API error';
    loading.textContent = errMsg;
    conversationHistory.push({ sender: "assistant", text: errMsg });
  }
});