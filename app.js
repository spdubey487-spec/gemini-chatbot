const API_KEY = window.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

if (!API_KEY) alert("Missing API key! Please edit API_KEY.js first.");

const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");

let conversationHistory = [];

function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function buildPayload(history) {
  return {
    contents: history.map(msg => ({
      role: msg.sender,
      parts: [{ text: msg.text }]
    }))
  };
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

  // Reset conversation if user types "new chat"
  if (text.toLowerCase() === "new chat") {
    conversationHistory = [];
    chatBox.innerHTML = "";
    appendMessage("bot", "Hey! what are you planing today?");
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
    conversationHistory.push({ sender: "model", text: reply });
  } catch (err) {
    loading.textContent = 'Please connect to internet for this answer' ;
  }
});
