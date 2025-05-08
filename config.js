// API Configuration
const apiConfig = {
  defaultConfig: {
    apiBase: '...',
    model: '...',
    apiKey: 'EMPTY'
  },
  
  // Get the current configuration, with saved values if available
  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['model', 'apiKey'], function(result) {
        console.log('Loaded settings from storage:', result);
        resolve({
          apiBase: this.defaultConfig.apiBase,
          model: result.model || this.defaultConfig.model,
          apiKey: result.apiKey || this.defaultConfig.apiKey
        });
      }.bind(this));
    });
  },
  
  // Save configuration settings
  saveConfig(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, function() {
        console.log('Settings saved:', settings);
        resolve(true);
      });
    });
  }
};

// Export the configuration object
window.apiConfig = apiConfig;

const MODEL_CONFIG = {
  vllm: {
    endpoint: '...',
    model: '...',
    params: {
      temperature: 0.7,
      max_tokens: 1000,
      stream: true
    }
  },
  ollama: {
    endpoint: 'http://localhost:11434/api/chat',
    models: {
      gemma3: {
        name: 'Gemma 3',
        params: {
          stream: true
        }
      },
      llama4: {
        name: 'Llama 4',
        params: {
          stream: true
        }
      }
    }
  }
};