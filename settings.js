// settings.js
import { getLocalizedMessage } from './src/constants/app-constants.js';
import { apiConfig } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const apiTypeSelect = document.getElementById('api-type-select');
  const langSelect = document.getElementById('lang-select');
  const saveBtn = document.getElementById('save-settings');
  let currentLanguage = 'ko';

  // Load current language setting
  async function loadCurrentLanguage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lang'], (result) => {
        currentLanguage = result.lang || 'ko';
        resolve(currentLanguage);
      });
    });
  }

  // Load saved settings
  chrome.storage.local.get(['apiType', 'lang'], (result) => {
    if (result.apiType) apiTypeSelect.value = result.apiType;
    if (result.lang) {
      langSelect.value = result.lang;
      currentLanguage = result.lang;
    }
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const apiType = apiTypeSelect.value;
    const lang = langSelect.value;
    
    // Update current language
    currentLanguage = lang;
    
    chrome.storage.local.set({ apiType, lang }, () => {
      const savedMessage = getLocalizedMessage('SETTINGS_SAVED', currentLanguage);
      alert(savedMessage);
    });
  });

  // Load initial language setting
  await loadCurrentLanguage();
});
