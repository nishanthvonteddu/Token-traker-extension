// Interceptor injected by manifest.json running in MAIN world
let conversationId = location.pathname;
let showWidget = true;

let stats = {
  model: 'Unknown',
  inputTokens: 0,
  outputTokens: 0,
  inputMsgs: 0,
  outputMsgs: 0,
  contextLimit: 0,
  customLimit: false
};

setInterval(() => {
  if (location.pathname !== conversationId) {
    conversationId = location.pathname;
    resetStats();
  }
}, 1000);

function loadStats() {
  chrome.storage.local.get(['tokenStats', 'showWidget'], (res) => {
    if (res.tokenStats) stats = res.tokenStats;
    if (res.showWidget !== undefined) showWidget = res.showWidget;
    updateWidget();
  });
}

function resetStats() {
  stats = {
    model: 'Unknown',
    inputTokens: 0,
    outputTokens: 0,
    inputMsgs: 0,
    outputMsgs: 0,
    contextLimit: stats.contextLimit,
    customLimit: stats.customLimit
  };
  saveStats();
  updateWidget();
}

function saveStats() {
  chrome.storage.local.set({ tokenStats: stats });
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== 'TOKEN_TRACKER_DATA') return;
  const { model, inputTokens, outputTokens } = event.data.payload;

  let updated = false;

  if (model && stats.model !== model) {
    stats.model = model;
    updated = true;
  }

  // Set fallback model if nothing has explicitly been parsed yet
  if (stats.model === 'Unknown' || stats.model === null) {
    const host = window.location.hostname;
    if (host.includes('gemini.google.com')) stats.model = 'gemini-3.1-pro';
    else if (host.includes('chatgpt.com')) stats.model = 'gpt-5.3'; // general default
    else if (host.includes('claude.ai')) stats.model = 'claude-4.6-sonnet';
    else if (host.includes('deepseek.com')) stats.model = 'deepseek-chat';

    if (stats.model !== 'Unknown' && stats.model !== null) updated = true;
  }

  if (inputTokens > 0) {
    stats.inputTokens += inputTokens;
    if (inputTokens > 1) stats.inputMsgs += 1;
    updated = true;
  }

  if (outputTokens > 0) {
    stats.outputTokens += outputTokens;
    if (outputTokens > 1) stats.outputMsgs += 1;
    updated = true;
  }

  if (updated) {
    if (stats.model && !stats.customLimit) {
      const known = getKnownLimit(stats.model);
      if (known) stats.contextLimit = known;
    }
    saveStats();
    updateWidget();
  }
});

const KNOWN_MODELS = {
  "gpt-5.4-nano": 128000,
  "gpt-5.4-mini": 256000,
  "gpt-5.4": 1000000,
  "gpt-5.3": 200000,
  "gpt-5": 512000,
  "gpt-4.5": 256000,
  "gpt-4o": 128000,
  "claude-4.6-opus": 1000000,
  "claude-4.6-sonnet": 1000000,
  "claude-4.5-haiku": 1000000,
  "claude-4-opus": 512000,
  "claude-4-sonnet": 200000,
  "gemini-3.1-pro": 1000000,
  "gemini-3-flash": 1000000,
  "gemini-2.0-pro": 2000000,
  "deepseek-chat": 128000,
  "deepseek-v3.2": 128000,
  "deepseek-v3": 128000,
  "deepseek-r1": 128000,
  "deepseek-gray-scale": 1000000,
  "deepseek-grayscale": 1000000
};

function getKnownLimit(modelName) {
  if (!modelName) return 0;
  // Break detected model name into alphanumeric words
  const detectedTokens = modelName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');

  let bestMatchLimit = 0;
  let maxTokensMatched = 0;

  for (const [key, limit] of Object.entries(KNOWN_MODELS)) {
    // Break known model key into words
    const keyTokens = key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');

    // Check if ALL words from our database key exist ANYWHERE in the detected string
    const isMatch = keyTokens.every(token => detectedTokens.includes(token));

    // Choose the match that has the most specific token constraints
    if (isMatch && keyTokens.length > maxTokensMatched) {
      bestMatchLimit = limit;
      maxTokensMatched = keyTokens.length;
    }
  }

  return bestMatchLimit;
}

let widgetEl;

function createWidget() {
  widgetEl = document.createElement('div');
  widgetEl.id = 'token-tracker-widget';

  const closeBtn = document.createElement('div');
  closeBtn.id = 'tt-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => {
    chrome.storage.local.set({ showWidget: false });
    showWidget = false;
    updateWidget();
  };

  const title = document.createElement('div');
  title.id = 'tt-title';
  title.style.cursor = 'grab';
  title.title = "Drag to move";

  let isDragging = false;
  let dragStartX, dragStartY;
  let initialLeft, initialTop;

  title.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = widgetEl.getBoundingClientRect();
    
    // Switch from right/bottom anchored to left/top anchored for smooth dragging
    widgetEl.style.right = 'auto';
    widgetEl.style.bottom = 'auto';
    widgetEl.style.left = rect.left + 'px';
    widgetEl.style.top = rect.top + 'px';
    
    initialLeft = rect.left;
    initialTop = rect.top;
    
    title.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    widgetEl.style.left = (initialLeft + dx) + 'px';
    widgetEl.style.top = (initialTop + dy) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      title.style.cursor = 'grab';
    }
  });

  const progressContainer = document.createElement('div');
  progressContainer.id = 'tt-progress-bg';

  const progressBar = document.createElement('div');
  progressBar.id = 'tt-progress-fill';

  const percentage = document.createElement('div');
  percentage.id = 'tt-perc';

  progressContainer.appendChild(progressBar);

  widgetEl.appendChild(closeBtn);
  widgetEl.appendChild(title);
  widgetEl.appendChild(progressContainer);
  widgetEl.appendChild(percentage);

  document.body.appendChild(widgetEl);
}

function updateWidget() {
  if (!widgetEl) createWidget();

  if (!showWidget) {
    widgetEl.style.display = 'none';
    return;
  }
  widgetEl.style.display = 'block';

  const total = stats.inputTokens + stats.outputTokens;
  const limit = stats.contextLimit || 0;
  let perc = 0;
  if (limit > 0) {
    perc = (total / limit) * 100;
  }

  widgetEl.querySelector('#tt-title').textContent = stats.model;
  widgetEl.querySelector('#tt-perc').textContent = limit > 0 ? `${perc.toFixed(1)}%` : `${total} tokens`;

  const fill = widgetEl.querySelector('#tt-progress-fill');
  fill.style.width = `${Math.min(perc, 100)}%`;

  let color = '#10b981';
  if (perc > 85) color = '#ef4444';
  else if (perc > 50) color = '#f59e0b';
  fill.style.backgroundColor = color;
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.showWidget) {
    showWidget = changes.showWidget.newValue;
    updateWidget();
  }
  if (changes.tokenStats) {
    const oldOutputTokens = stats.outputTokens;
    const oldInputTokens = stats.inputTokens;
    stats = changes.tokenStats.newValue;
    // if updated from another tab or popup, keep in sync
    updateWidget();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadStats);
} else {
  loadStats();
}
