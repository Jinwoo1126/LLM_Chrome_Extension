// API Configuration
const MODEL_CONFIG = {
  vllm: {
    endpoint: 'http://localhost:8000/v1/chat/completions',
    models: {
      gemma3: {
        name: 'Gemma 3 (vLLM)',
        params: {
          temperature: 0.7,
          max_tokens: 8192,
          stream: true
        }
      },
      llama4: {
        name: 'Llama 4 (vLLM)',
        params: {
          temperature: 0.7,
          max_tokens: 8192,
          stream: true
        }
      }
      // 필요시 vllm에서 지원하는 다른 모델도 여기에 추가
    }
  },
  ollama: {
    endpoint: 'http://localhost:11434/api/chat',
    models: {
      gemma3: {
        name: 'Gemma 3 (Ollama)',
        params: {
          stream: true
        }
      },
      llama4: {
        name: 'Llama 4 (Ollama)',
        params: {
          stream: true
        }
      }
    }
  }
};

export const apiConfig = {
  defaultConfig: {
    apiType: 'ollama', // 'vllm' or 'ollama'
    apiBase: '',
    model: 'gemma3',
    apiKey: 'EMPTY'
  },

  // 항상 코드의 defaultConfig만 사용 (storage 무시)
  async getConfig() {
    const apiType = this.defaultConfig.apiType;
    const model = this.defaultConfig.model;
    const apiKey = this.defaultConfig.apiKey;
    let endpoint = '';
    let params = {};
    
    if (apiType === 'vllm') {
      endpoint = MODEL_CONFIG.vllm.endpoint;
      params = MODEL_CONFIG.vllm.models[model]?.params || {};
    } else if (apiType === 'ollama') {
      endpoint = MODEL_CONFIG.ollama.endpoint;
      params = MODEL_CONFIG.ollama.models[model]?.params || {};
    }
    
    return Promise.resolve({
      apiType,
      model,
      apiKey,
      endpoint,
      params
    });
  },

  // storage에 저장
  saveConfig(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, function() {
        resolve(true);
      });
    });
  },

  // 코드에서 관리하는 모델 목록 반환
  getAvailableModels(apiType) {
    if (apiType === 'vllm') {
      return Object.entries(MODEL_CONFIG.vllm.models).map(([key, value]) => ({
        id: key,
        name: value.name
      }));
    } else if (apiType === 'ollama') {
      return Object.entries(MODEL_CONFIG.ollama.models).map(([key, value]) => ({
        id: key,
        name: value.name
      }));
    }
    return [];
  }
};

// For backward compatibility
window.apiConfig = apiConfig;
