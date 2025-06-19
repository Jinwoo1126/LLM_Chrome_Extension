// settings.js

document.addEventListener('DOMContentLoaded', () => {
  const apiTypeSelect = document.getElementById('api-type-select');
  const langSelect = document.getElementById('lang-select');
  const saveBtn = document.getElementById('save-settings');

  // Load saved settings
  chrome.storage.local.get(['apiType', 'lang'], (result) => {
    if (result.apiType) apiTypeSelect.value = result.apiType;
    if (result.lang) langSelect.value = result.lang;
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const apiType = apiTypeSelect.value;
    const lang = langSelect.value;
    chrome.storage.local.set({ apiType, lang }, () => {
      alert('설정이 저장되었습니다.');
    });
  });
});
