const COMPARISON_MODELS = [
  { id: 'claude-4.6-opus', name: 'Claude 4.6 Opus', limit: 1000000 },
  { id: 'claude-4.6-sonnet', name: 'Claude 4.6 Sonnet', limit: 1000000 },
  { id: 'claude-4.5-haiku', name: 'Claude 4.5 Haiku', limit: 1000000 },
  { id: 'gpt-5.4', name: 'GPT-5.4', limit: 1000000 },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', limit: 256000 },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', limit: 128000 },
  { id: 'gpt-5.3', name: 'GPT-5.3', limit: 400000 },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', limit: 1000000 },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', limit: 1000000 },
  { id: 'deepseek-r1', name: 'DeepSeek R1', limit: 128000 },
  { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', limit: 128000 },
  { id: 'deepseek-gray-scale', name: 'DeepSeek (Gray-scale)', limit: 1000000 }
];

let currentStats = {
  model: 'Unknown',
  inputTokens: 0,
  outputTokens: 0,
  inputMsgs: 0,
  outputMsgs: 0,
  contextLimit: 0,
  customLimit: false
};

let showWidget = true;
let selectedComparisons = new Set();

function formatNumber(num) {
  return num.toLocaleString();
}

function updateUI() {
  const total = currentStats.inputTokens + currentStats.outputTokens;
  const limit = currentStats.contextLimit || 0;

  // Header animation status
  const statInd = document.getElementById('status-indicator');
  if (total > 0) statInd.style.backgroundColor = 'var(--success)';
  else statInd.style.backgroundColor = 'var(--warning)';

  document.getElementById('model-name').textContent = currentStats.model !== 'Unknown' ? currentStats.model : 'Detecting Model...';

  const unknownConfigEl = document.getElementById('unknown-config');
  if (limit > 0) {
    document.getElementById('context-size').textContent = `${formatNumber(limit)} Context Limit`;
    unknownConfigEl.style.display = 'none';
  } else {
    document.getElementById('context-size').textContent = 'Unknown Context Limit';
    unknownConfigEl.style.display = 'block';
    const manModel = document.getElementById('manual-model-name');
    if (currentStats.model !== 'Unknown' && !manModel.value) {
      manModel.value = currentStats.model;
    }
  }

  const perc = limit > 0 ? (total / limit) * 100 : 0;
  const clampedPerc = Math.min(perc, 100);

  document.getElementById('tokens-used').textContent = `${formatNumber(total)} tokens`;
  document.getElementById('percentage').textContent = limit > 0 ? `${perc.toFixed(1)}%` : 'N/A';

  const fill = document.getElementById('main-fill');
  fill.style.width = `${clampedPerc}%`;

  let pColor = 'var(--success)';
  if (perc > 85) pColor = 'var(--danger)';
  else if (perc > 50) pColor = 'var(--warning)';
  fill.style.backgroundColor = pColor;

  document.getElementById('tokens-remaining').textContent = limit > 0 ? `${formatNumber(Math.max(0, limit - total))} remaining` : '';

  document.getElementById('user-tokens').textContent = formatNumber(currentStats.inputTokens);
  document.getElementById('user-msgs').textContent = `${currentStats.inputMsgs} msgs`;

  document.getElementById('model-tokens').textContent = formatNumber(currentStats.outputTokens);
  document.getElementById('model-msgs').textContent = `${currentStats.outputMsgs} msgs`;

  const totalMsgs = currentStats.inputMsgs + currentStats.outputMsgs;
  const avg = totalMsgs > 0 ? Math.round(total / totalMsgs) : 0;
  document.getElementById('avg-tokens').textContent = formatNumber(avg);

  const remainingTokens = Math.max(0, limit - total);
  const estLeft = avg > 0 ? Math.floor(remainingTokens / avg) : 0;
  document.getElementById('est-msgs').textContent = limit > 0 ? formatNumber(estLeft) : 'N/A';

  document.getElementById('widget-toggle').checked = showWidget;

  renderComparisons();
}

function initComparisonSelect() {
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  COMPARISON_MODELS.forEach(model => {
    const div = document.createElement('div');
    div.className = 'option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = model.id;
    input.id = `chk-${model.id}`;

    // load saved state if any
    chrome.storage.local.get(['selectedComparisons'], (res) => {
      if (res.selectedComparisons && res.selectedComparisons.includes(model.id)) {
        input.checked = true;
        selectedComparisons.add(model.id);
        renderComparisons();
      }
    });

    const label = document.createElement('label');
    label.htmlFor = `chk-${model.id}`;
    label.textContent = `${model.name} (${(model.limit / 1000)}K)`;
    label.style.cursor = 'pointer';

    div.onclick = (e) => {
      if (e.target !== input && e.target !== label) {
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change'));
      }
    };

    input.addEventListener('change', (e) => {
      if (e.target.checked) selectedComparisons.add(model.id);
      else selectedComparisons.delete(model.id);
      chrome.storage.local.set({ selectedComparisons: Array.from(selectedComparisons) });
      renderComparisons();
    });

    div.appendChild(input);
    div.appendChild(label);
    container.appendChild(div);
  });

  const trigger = document.getElementById('select-trigger');
  const customSelect = document.getElementById('custom-select');

  trigger.addEventListener('click', () => {
    customSelect.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!customSelect.contains(e.target)) {
      customSelect.classList.remove('open');
    }
  });
}

function renderComparisons() {
  const list = document.getElementById('comparisons-list');
  list.innerHTML = '';

  const total = currentStats.inputTokens + currentStats.outputTokens;

  selectedComparisons.forEach(id => {
    const model = COMPARISON_MODELS.find(m => m.id === id);
    if (!model) return;

    const perc = (total / model.limit) * 100;
    const clamped = Math.min(perc, 100);

    let color = 'var(--success)';
    if (perc > 85) color = 'var(--danger)';
    else if (perc > 50) color = 'var(--warning)';

    const card = document.createElement('div');
    card.className = 'comparison-card';

    card.innerHTML = `
      <div class="comparison-header">
        <span>${model.name}</span>
        <span>${perc.toFixed(1)}%</span>
      </div>
      <div class="comparison-bar-bg">
        <div class="comparison-bar-fill" style="width: ${clamped}%; background-color: ${color}"></div>
      </div>
    `;
    list.appendChild(card);
  });
}

document.getElementById('save-config').addEventListener('click', () => {
  const manModel = document.getElementById('manual-model-name').value.trim();
  const manLimit = parseInt(document.getElementById('manual-context-size').value.trim(), 10);

  if (manLimit > 0) {
    currentStats.contextLimit = manLimit;
    currentStats.customLimit = true;
    if (manModel) currentStats.model = manModel;

    chrome.storage.local.set({ tokenStats: currentStats }, () => {
      updateUI();
    });
  }
});

document.getElementById('widget-toggle').addEventListener('change', (e) => {
  const val = e.target.checked;
  chrome.storage.local.set({ showWidget: val });
});

chrome.storage.local.get(['tokenStats', 'showWidget'], (result) => {
  if (result.tokenStats) {
    currentStats = result.tokenStats;
  }
  if (result.showWidget !== undefined) {
    showWidget = result.showWidget;
  }
  initComparisonSelect();
  updateUI();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.tokenStats) {
    currentStats = changes.tokenStats.newValue;
    updateUI();
  }
  if (changes.showWidget) {
    showWidget = changes.showWidget.newValue;
    document.getElementById('widget-toggle').checked = showWidget;
  }
});
