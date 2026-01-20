/**
 * ShieldAI - Content Script for ChatGPT/Claude
 * 入力フィールドを監視して機密情報を警告
 */

// 検出パターン（detector.jsと同じ）
const PATTERNS = {
  EMAIL: { pattern: /[\w.-]+@[\w.-]+\.\w+/g, label: 'メールアドレス' },
  JP_PHONE: { pattern: /0\d{1,4}-?\d{1,4}-?\d{4}/g, label: '電話番号' },
  JP_CURRENCY: { pattern: /[¥￥]\s?[\d,]+/g, label: '金額' },
  JP_COMPANY_PRE: { pattern: /株式会社[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}/g, label: '会社名' },
  JP_NAME_SAMA: { pattern: /[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}様/g, label: '個人名' },
  JP_NAME_SAN: { pattern: /[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}さん/g, label: '個人名' },
  OPENAI_KEY: { pattern: /sk-[a-zA-Z0-9]{20,}/g, label: 'APIキー' },
  CREDIT_CARD: { pattern: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/g, label: 'クレジットカード' }
};

const HONORIFIC_DENY_LIST = new Set([
  'お客様', '皆様', '各位', '担当者様', '皆さん', 'お客さん'
]);

let warningElement = null;
let lastCheckedText = '';

/**
 * 簡易検出
 */
function quickDetect(text) {
  const detections = [];

  for (const [type, config] of Object.entries(PATTERNS)) {
    const regex = new RegExp(config.pattern.source, config.pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (type.startsWith('JP_NAME_') && HONORIFIC_DENY_LIST.has(match[0])) {
        continue;
      }
      detections.push({ type, text: match[0], label: config.label });
    }
  }

  return detections;
}

/**
 * 警告バナーを表示
 */
function showWarning(detections) {
  if (warningElement) {
    warningElement.remove();
  }

  warningElement = document.createElement('div');
  warningElement.id = 'shieldai-warning';
  warningElement.innerHTML = `
    <div class="shieldai-warning-content">
      <span class="shieldai-icon">⚠️</span>
      <span class="shieldai-message">機密情報を検出: ${detections.map(d => d.label).join(', ')}</span>
      <button class="shieldai-close">×</button>
    </div>
  `;

  document.body.appendChild(warningElement);

  warningElement.querySelector('.shieldai-close').addEventListener('click', () => {
    warningElement.remove();
    warningElement = null;
  });

  // 5秒後に自動で消す
  setTimeout(() => {
    if (warningElement) {
      warningElement.remove();
      warningElement = null;
    }
  }, 5000);
}

/**
 * 警告を非表示
 */
function hideWarning() {
  if (warningElement) {
    warningElement.remove();
    warningElement = null;
  }
}

/**
 * 入力監視
 */
function watchInput() {
  document.addEventListener('input', (e) => {
    const target = e.target;

    // テキストエリアまたはcontenteditable
    if (target.tagName === 'TEXTAREA' ||
        target.getAttribute('contenteditable') === 'true' ||
        target.closest('[contenteditable="true"]')) {

      const text = target.value || target.textContent || '';

      // 変更がなければスキップ
      if (text === lastCheckedText) return;
      lastCheckedText = text;

      // 短いテキストはスキップ
      if (text.length < 5) {
        hideWarning();
        return;
      }

      const detections = quickDetect(text);

      if (detections.length > 0) {
        showWarning(detections);
      } else {
        hideWarning();
      }
    }
  }, true);
}

// 初期化
watchInput();
console.log('ShieldAI: Content script loaded');
