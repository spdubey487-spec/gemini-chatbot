/**
 * chat_history.js
 * Handles all chat history storage and retrieval logic.
 * Stores data in browser's localStorage under key "gemini_chat_histories"
 */

class ChatHistory {
  constructor() {
    this.storageKey = "gemini_chat_histories";
    this.allChatHistories = [];
    this.currentChatId = null;
  }

  /**
   * Load all chat histories from localStorage
   */
  loadChatHistories() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.allChatHistories = stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error("Error loading chat histories:", err);
      this.allChatHistories = [];
    }
  }

  /**
   * Save all chat histories to localStorage
   */
  saveChatHistories() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.allChatHistories));
    } catch (err) {
      console.error("Error saving chat histories:", err);
    }
  }

  /**
   * Generate a unique chat ID
   */
  generateChatId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Create a new chat session with a unique ID
   */
  createNewChat() {
    this.currentChatId = this.generateChatId();
  }

  /**
   * Save current conversation to history
   * @param {Array} messages - Array of message objects {sender, text}
   */
  saveChatToHistory(messages) {
    if (!messages || messages.length === 0) return;

    const existingIndex = this.allChatHistories.findIndex(
      c => c.id === this.currentChatId
    );

    const firstUserMsg = messages.find(m => m.sender === "user");
    const preview = firstUserMsg?.text?.slice(0, 100) || "Empty chat";

    const chatEntry = {
      id: this.currentChatId,
      timestamp: Date.now(),
      preview,
      messages: JSON.parse(JSON.stringify(messages)) // Deep copy
    };

    if (existingIndex !== -1) {
      // Update existing chat
      this.allChatHistories[existingIndex] = chatEntry;
    } else {
      // Add new chat to the front
      this.allChatHistories.unshift(chatEntry);
    }

    this.saveChatHistories();
  }

  /**
   * Get a chat by ID
   * @param {string} chatId - The chat ID to retrieve
   * @returns {Object|null} - Chat object or null if not found
   */
  getChatById(chatId) {
    return this.allChatHistories.find(c => c.id === chatId) || null;
  }

  /**
   * Get all chat histories
   * @returns {Array} - Array of all chat objects
   */
  getAllChats() {
    return this.allChatHistories;
  }

  /**
   * Delete a chat by ID
   * @param {string} chatId - The chat ID to delete
   */
  deleteChat(chatId) {
    const index = this.allChatHistories.findIndex(c => c.id === chatId);
    if (index !== -1) {
      this.allChatHistories.splice(index, 1);
      this.saveChatHistories();
      return true;
    }
    return false;
  }

  /**
   * Clear all chat histories
   */
  clearAllChats() {
    this.allChatHistories = [];
    this.saveChatHistories();
  }

  /**
   * Export all chat histories as JSON (for backup)
   * @returns {string} - JSON string of all chats
   */
  exportChatsAsJson() {
    return JSON.stringify(this.allChatHistories, null, 2);
  }

  /**
   * Import chat histories from JSON
   * @param {string} jsonString - JSON string to import
   * @returns {boolean} - true if successful, false otherwise
   */
  importChatsFromJson(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (Array.isArray(imported)) {
        this.allChatHistories = imported;
        this.saveChatHistories();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error importing chats:", err);
      return false;
    }
  }

  /**
   * Get storage info (size, count, etc.)
   * @returns {Object} - Storage statistics
   */
  getStorageInfo() {
    const jsonStr = JSON.stringify(this.allChatHistories);
    const sizeInBytes = new Blob([jsonStr]).size;
    return {
      chatCount: this.allChatHistories.length,
      sizeInBytes,
      sizeInKB: (sizeInBytes / 1024).toFixed(2),
      storageKey: this.storageKey
    };
  }
}

// Initialize and expose globally
const chatHistory = new ChatHistory();
chatHistory.loadChatHistories();
chatHistory.createNewChat();
