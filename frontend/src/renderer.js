const API_BASE = 'http://127.0.0.1:8765';

// DOM Elements
const inputText = document.getElementById('inputText');
const checkBtn = document.getElementById('checkBtn');
const pasteBtn = document.getElementById('pasteBtn');
const useLLM = document.getElementById('useLLM');
const resultsSection = document.getElementById('resultsSection');
const noDetection = document.getElementById('noDetection');
const detectionList = document.getElementById('detectionList');
const processingInfo = document.getElementById('processingInfo');
const maskedText = document.getElementById('maskedText');
const copyMaskedBtn = document.getElementById('copyMaskedBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const toast = document.getElementById('toast');

let lastResult = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkServerStatus();
  setInterval(checkServerStatus, 5000);
});

// Event Listeners
checkBtn.addEventListener('click', handleCheck);
pasteBtn.addEventListener('click', handlePaste);
copyMaskedBtn.addEventListener('click', handleCopyMasked);

inputText.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    handleCheck();
  }
});

// Functions
async function checkServerStatus() {
  try {
    const res = await fetch(`${API_BASE}/`);
    const data = await res.json();

    statusDot.className = 'status-dot connected';
    statusText.textContent = data.llm_available ? 'LLM利用可能' : '接続済み';
  } catch (e) {
    statusDot.className = 'status-dot error';
    statusText.textContent = 'サーバー未接続';
  }
}

async function handleCheck() {
  const text = inputText.value.trim();

  if (!text) {
    showToast('テキストを入力してください');
    return;
  }

  checkBtn.classList.add('loading');
  checkBtn.disabled = true;
  resultsSection.style.display = 'none';
  noDetection.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        use_llm: useLLM.checked
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    lastResult = data;
    displayResults(data);

  } catch (e) {
    console.error('Detection error:', e);
    showToast('エラーが発生しました。サーバーを確認してください。');
  } finally {
    checkBtn.classList.remove('loading');
    checkBtn.disabled = false;
  }
}

function displayResults(data) {
  if (data.detection_count === 0) {
    noDetection.style.display = 'block';
    resultsSection.style.display = 'none';
    return;
  }

  noDetection.style.display = 'none';
  resultsSection.style.display = 'block';

  // Detection list
  detectionList.innerHTML = data.detections.map(d => `
    <div class="detection-item">
      <span class="icon">⚠️</span>
      <span class="type">${escapeHtml(d.label)}</span>
      <span class="value">${escapeHtml(d.text)}</span>
      <span class="position">位置: ${d.start}-${d.end}</span>
    </div>
  `).join('');

  // Processing info
  processingInfo.textContent = `${data.detection_count}件検出 / 処理時間: ${data.processing_time_ms.toFixed(1)}ms`;

  // Masked text with highlighted masks
  const highlighted = highlightMasks(data.masked_text);
  maskedText.innerHTML = highlighted;
}

function highlightMasks(text) {
  return escapeHtml(text).replace(
    /\[([^\]]+)\]/g,
    '<span class="mask">[$1]</span>'
  );
}

async function handlePaste() {
  try {
    if (window.electronAPI) {
      const text = await window.electronAPI.getFromClipboard();
      inputText.value = text;
    } else {
      const text = await navigator.clipboard.readText();
      inputText.value = text;
    }
    inputText.focus();
  } catch (e) {
    showToast('クリップボードの読み取りに失敗しました');
  }
}

async function handleCopyMasked() {
  if (!lastResult) return;

  try {
    if (window.electronAPI) {
      await window.electronAPI.copyToClipboard(lastResult.masked_text);
    } else {
      await navigator.clipboard.writeText(lastResult.masked_text);
    }
    showToast('コピーしました');
  } catch (e) {
    showToast('コピーに失敗しました');
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
