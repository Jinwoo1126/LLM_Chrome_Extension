# LLM Chrome Extension

A Chrome extension for chatting with Large Language Models (LLMs) through vLLM or Ollama APIs. This extension supports text selection, summarization, translation, and streaming responses.

## 🚀 Features

- **Multi-API Support**: Works with both vLLM and Ollama APIs
- **Text Selection**: Right-click to analyze selected text
- **Streaming Responses**: Real-time response streaming
- **Multiple UI Modes**: Popup window and side panel
- **Context Awareness**: Maintains conversation history
- **Text Processing**: Built-in summarization and translation
- **Markdown Support**: Rich text formatting with syntax highlighting

## 📁 Project Structure

```
LLM_Chrome_Extension/
├── src/                          # Source code modules
│   ├── constants/               # Application constants
│   │   └── app-constants.js     # Main constants file
│   ├── modules/                 # Core modules
│   │   ├── conversation-manager.js  # Conversation handling
│   │   ├── selection-manager.js     # Text selection management
│   │   ├── llm-manager.js          # LLM API communication
│   │   └── ui-manager.js           # UI management
│   ├── utils/                   # Utility functions
│   │   ├── chrome-utils.js      # Chrome API helpers
│   │   ├── dom-utils.js         # DOM manipulation
│   │   ├── general-utils.js     # General utilities
│   │   └── error-handler.js     # Error handling
│   └── llm-chat-app.js         # Main application class
├── background.js               # Background script
├── content.js                  # Content script
├── config.js                   # API configuration
├── popup.js                    # Main popup script
├── popup.html                  # Popup interface
├── sidepanel.html             # Side panel interface
├── styles.css                  # Styles
├── manifest.json              # Extension manifest
└── icons/                     # Extension icons
```

## 🏗️ Architecture

The extension follows a modular architecture with clear separation of concerns:

### Core Modules

1. **LLMChatApp** (`src/llm-chat-app.js`)
   - Main application orchestrator
   - Manages module initialization and communication
   - Handles global event coordination

2. **UIManager** (`src/modules/ui-manager.js`)
   - DOM manipulation and UI state management
   - Message rendering with markdown support
   - Input handling and validation

3. **ConversationManager** (`src/modules/conversation-manager.js`)
   - Conversation history management
   - Message persistence and retrieval
   - Export/import functionality

4. **SelectionManager** (`src/modules/selection-manager.js`)
   - Text selection detection and handling
   - Context menu integration
   - Selection-based actions (summarize, translate)

5. **LLMManager** (`src/modules/llm-manager.js`)
   - API communication with vLLM/Ollama
   - Streaming response handling
   - Model configuration management

### Utility Modules

1. **ChromeUtils** (`src/utils/chrome-utils.js`)
   - Chrome API wrappers with error handling
   - Storage operations
   - Tab and window management

2. **DOMUtils** (`src/utils/dom-utils.js`)
   - Safe DOM manipulation utilities
   - Element creation and modification
   - CSS class management

3. **GeneralUtils** (`src/utils/general-utils.js`)
   - Throttling and debouncing
   - Text processing utilities
   - Validation functions

4. **ErrorHandler** (`src/utils/error-handler.js`)
   - Global error handling
   - Error logging and reporting
   - Debug utilities

## 🔧 Installation

1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. Configure your API endpoint in the config.js file

## ⚙️ Configuration

Edit `config.js` to configure your API settings:

```javascript
const MODEL_CONFIG = {
  vllm: {
    endpoint: 'YOUR_VLLM_ENDPOINT',
    model: 'YOUR_MODEL_NAME',
    params: {
      temperature: 0.7,
      max_tokens: 8192,
      stream: true
    }
  },
  ollama: {
    endpoint: 'http://localhost:11434/api/chat',
    models: {
      gemma3: {
        name: 'Gemma 3',
        params: { stream: true }
      }
    }
  }
};
```

## 🎯 Usage

### Basic Chat
1. Click the extension icon to open the popup
2. Type your message and press Enter or click Send
3. View the streaming response from the LLM

### Text Selection Features
1. Select text on any webpage
2. Right-click to access context menu options:
   - **Open in New Window**: Chat about selected text in popup
   - **Open in Side Panel**: Chat in side panel
   - **Summarize**: Get a quick summary
   - **Translate**: Translate to Korean

### Side Panel Mode
1. Click the extension icon
2. Use "Open in Side Panel" for persistent chat interface
3. Continue conversations while browsing

## 🛠️ Development

### Code Style
- Use ES6+ features and modules
- Follow consistent naming conventions
- Add JSDoc comments for functions
- Implement proper error handling

### Adding New Features
1. Create appropriate modules in `src/modules/`
2. Add utilities to `src/utils/` if needed
3. Update constants in `src/constants/app-constants.js`
4. Register event listeners in `src/llm-chat-app.js`

### Error Handling
The extension includes comprehensive error handling:
- Global error catching
- Chrome API error handling
- User-friendly error messages
- Debug logging for development

## 🔍 Debugging

Access debug information:
```javascript
// In browser console
window.llmChatApp.getStatus()  // Get application status
window.llmChatApp.testConnection()  // Test API connection
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the existing code structure and conventions
4. Add appropriate error handling
5. Test thoroughly
6. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Support

For issues and feature requests, please create an issue in the repository.

---

**Note**: This extension requires a running vLLM or Ollama instance. Make sure your API endpoint is properly configured and accessible.
