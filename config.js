// API Configuration
const apiConfig = {
  defaultConfig: {
    apiType: 'ollama', // 'vllm' or 'ollama'
    apiBase: '...',
    model: 'gemma3',
    apiKey: 'EMPTY'
  },
  
  // Get the current configuration, with saved values if available
  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiType', 'model', 'apiKey'], function(result) {
        console.log('Loaded settings from storage:', result);
        const apiType = result.apiType || this.defaultConfig.apiType;
        const model = result.model || this.defaultConfig.model;
        
        let config = {
          apiType: apiType,
          model: model,
          apiKey: result.apiKey || this.defaultConfig.apiKey
        };

        // Add API-specific configuration
        if (apiType === 'vllm') {
          config.apiBase = MODEL_CONFIG.vllm.endpoint;
          config.endpoint = MODEL_CONFIG.vllm.endpoint;
          config.params = MODEL_CONFIG.vllm.params;
        } else if (apiType === 'ollama') {
          config.apiBase = MODEL_CONFIG.ollama.endpoint;
          config.endpoint = MODEL_CONFIG.ollama.endpoint;
          config.params = MODEL_CONFIG.ollama.models[model]?.params || {};
        }

        console.log('Final config:', config);
        resolve(config);
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
  },

  // Get available models for the current API type
  getAvailableModels(apiType) {
    if (apiType === 'vllm') {
      return [MODEL_CONFIG.vllm.model];
    } else if (apiType === 'ollama') {
      return Object.entries(MODEL_CONFIG.ollama.models).map(([key, value]) => ({
        id: key,
        name: value.name
      }));
    }
    return [];
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
      max_tokens: 8192,
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
