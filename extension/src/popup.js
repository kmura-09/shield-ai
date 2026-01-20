/**
 * ShieldAI - ポップアップUI
 */

// DOM要素
const inputText = document.getElementById('inputText');
const checkBtn = document.getElementById('checkBtn');
const results = document.getElementById('results');
const noResults = document.getElementById('noResults');
const resultCount = document.getElementById('resultCount');
const detectionList = document.getElementById('detectionList');
const maskedText = document.getElementById('maskedText');
const copyBtn = document.getElementById('copyBtn');

// 辞書関連
const dictValue = document.getElementById('dictValue');
const dictCategory = document.getElementById('dictCategory');
const addDictBtn = document.getElementById('addDictBtn');
const dictList = document.getElementById('dictList');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

// タブ
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// 状態
let currentMaskedText = '';
let dictionary = [];

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  await loadDictionary();
  renderDictionary();
});

// タブ切り替え
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
  });
});

// チェック実行
checkBtn.addEventListener('click', () => {
  const text = inputText.value.trim();
  if (!text) return;

  const detections = detectPII(text, dictionary);

  if (detections.length === 0) {
    results.style.display = 'none';
    noResults.style.display = 'block';
    return;
  }

  noResults.style.display = 'none';
  results.style.display = 'block';

  resultCount.textContent = `${detections.length}件検出`;

  detectionList.innerHTML = detections.map(d => `
    <div class="detection-item">
      <span class="label">${d.label}</span>
      <span class="value">${escapeHtml(d.text)}</span>
    </div>
  `).join('');

  currentMaskedText = maskText(text, detections);
  maskedText.textContent = currentMaskedText;
});

// コピー
copyBtn.addEventListener('click', async () => {
  if (!currentMaskedText) return;

  try {
    await navigator.clipboard.writeText(currentMaskedText);
    copyBtn.textContent = 'コピーしました!';
    setTimeout(() => {
      copyBtn.textContent = 'コピー';
    }, 1500);
  } catch (e) {
    console.error('Copy failed:', e);
  }
});

// 辞書追加
addDictBtn.addEventListener('click', async () => {
  const value = dictValue.value.trim();
  if (!value) return;

  const category = dictCategory.value;
  const labels = {
    companies: '会社名',
    persons: '個人名',
    projects: 'プロジェクト名',
    custom: '機密情報'
  };

  // 重複チェック
  if (dictionary.some(e => e.value === value)) {
    alert('既に登録されています');
    return;
  }

  dictionary.push({
    value: value,
    label: labels[category],
    category: category
  });

  await saveDictionary();
  renderDictionary();
  dictValue.value = '';
});

// 辞書削除
async function deleteEntry(value) {
  dictionary = dictionary.filter(e => e.value !== value);
  await saveDictionary();
  renderDictionary();
}

// 辞書表示
function renderDictionary() {
  if (dictionary.length === 0) {
    dictList.innerHTML = '<p class="empty-message">登録された単語はありません</p>';
    return;
  }

  dictList.innerHTML = dictionary.map(entry => `
    <div class="dict-item">
      <div class="info">
        <span class="value">${escapeHtml(entry.value)}</span>
        <span class="category">${entry.label}</span>
      </div>
      <button class="delete-btn" data-value="${escapeHtml(entry.value)}">削除</button>
    </div>
  `).join('');

  // 削除ボタンイベント
  dictList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteEntry(btn.dataset.value);
    });
  });
}

// 辞書保存
async function saveDictionary() {
  await chrome.storage.local.set({ dictionary: dictionary });
}

// 辞書読み込み
async function loadDictionary() {
  const result = await chrome.storage.local.get(['dictionary']);
  dictionary = result.dictionary || [];
}

// エクスポート
exportBtn.addEventListener('click', () => {
  const data = JSON.stringify({ entries: dictionary }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'shieldai-dictionary.json';
  a.click();

  URL.revokeObjectURL(url);
});

// インポート
importBtn.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.entries && Array.isArray(data.entries)) {
      dictionary = data.entries;
      await saveDictionary();
      renderDictionary();
      alert(`${dictionary.length}件インポートしました`);
    }
  } catch (err) {
    alert('インポートに失敗しました');
  }

  importFile.value = '';
});

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
