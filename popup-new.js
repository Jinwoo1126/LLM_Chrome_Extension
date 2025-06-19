// Import modules
import { LLMChatApp } from './src/llm-chat-app.js';

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
  console.log('LLM Chat Extension loading...');
  
  try {
    // Create and initialize the main application
    const app = new LLMChatApp();
    await app.initialize();
    
    // Make app globally accessible for debugging
    window.llmChatApp = app;
    
    console.log('LLM Chat Extension loaded successfully');
  } catch (error) {
    console.error('Failed to initialize LLM Chat Extension:', error);
    alert('Failed to load the extension. Please refresh the page.');
  }
});
