# LLM Chrome Extension

Chrome extension for interacting with various LLM models through a convenient chat interface. Also supports Microsoft Edge.

## Features

- Chat interface with markdown support
- Code syntax highlighting
- Text selection support
- Multiple model support (vLLM and Ollama)
- Side panel support
- Cross-browser support (Chrome and Edge)

## Browser Support

The extension is compatible with both Google Chrome and Microsoft Edge browsers. The same design and functionality are maintained across both browsers.

### Chrome Installation
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension directory

### Edge Installation
1. Go to `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension directory

## Model Configuration

The extension supports multiple LLM backends through the `config.js` file. You can easily add or modify models by editing this file.

### Adding a New Model

#### 1. Adding a new Ollama model

To add a new Ollama model, add it to the `MODEL_CONFIG.ollama.models` object in `config.js`:

```javascript
const MODEL_CONFIG = {
  ollama: {
    endpoint: 'http://localhost:11434/api/chat',
    models: {
      // Existing models...
      newModel: {
        name: 'Your Model Name',  // Display name in the dropdown
        params: {
          stream: true,
          // Add any other Ollama-specific parameters
        }
      }
    }
  }
};
```

#### 2. Adding a new vLLM model

To add a new vLLM model, modify the `MODEL_CONFIG.vllm` object in `config.js`:

```javascript
const MODEL_CONFIG = {
  vllm: {
    endpoint: 'your-vllm-endpoint',
    model: 'your-model-name',
    params: {
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
      // Add any other OpenAI-compatible parameters
    }
  }
};
```

### Model Parameters

#### Ollama Parameters
- `stream`: Enable/disable streaming responses
- Add any other Ollama-specific parameters as needed

#### vLLM Parameters
- `temperature`: Controls randomness (0.0 to 1.0)
- `max_tokens`: Maximum number of tokens to generate
- `stream`: Enable/disable streaming responses
- Add any other OpenAI-compatible parameters as needed

## Usage

1. Select your preferred model from the dropdown menu
2. Type your message in the input field
3. Press Enter or click Send to get a response
4. Use the text selection feature to include selected text in your message

## Development

### Prerequisites
- Chrome or Edge browser
- Ollama server (for Ollama models)
- vLLM server (for vLLM models)

### Setup
1. Clone the repository
2. Load the extension in your preferred browser:
   - Chrome: Go to `chrome://extensions/`
   - Edge: Go to `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

### Configuration
Edit `config.js` to:
- Add new models
- Modify existing model parameters
- Change API endpoints
- Adjust streaming settings

## License

MIT 