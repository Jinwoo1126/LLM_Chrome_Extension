# LLM Chrome Extension

Chrome extension that allows you to chat with various LLM models directly from your browser.

## Features

- Chat with vLLM and Ollama models
- Select text from web pages and ask questions about it
- Include page information in your queries
- Markdown support with syntax highlighting
- Real-time streaming responses

## Setup

### vLLM Setup

1. Set up your vLLM server with the desired models
2. Update the `defaultApiConfig` in `popup.js` with your vLLM server URL

### Ollama Setup

1. Install Ollama from [ollama.ai](https://ollama.ai)

2. Pull the required models:
```bash
ollama pull llama4
ollama pull gemma3
```

3. Start Ollama server with CORS enabled for Chrome extension:
```bash
OLLAMA_ORIGINS="chrome-extension://*" ollama serve
```

4. The extension will automatically connect to Ollama at `http://localhost:11434`

## Usage

1. Click the extension icon to open the chat interface
2. Select your preferred API (vLLM or Ollama) and model from the dropdown
3. Type your message or select text from the webpage
4. Click "Send" to get a response

## Development

1. Clone this repository
2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory
3. Make changes and reload the extension to see updates

## License

MIT 