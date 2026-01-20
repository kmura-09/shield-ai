/**
 * ShieldAI - 機密情報検出エンジン (JavaScript版)
 */

// 検出パターン定義
const PATTERNS = {
  // メールアドレス
  EMAIL: {
    pattern: /[\w.-]+@[\w.-]+\.\w+/g,
    label: 'メールアドレス',
    score: 1.0
  },

  // 電話番号（日本）
  JP_PHONE: {
    pattern: /0\d{1,4}-?\d{1,4}-?\d{4}/g,
    label: '電話番号',
    score: 0.7
  },
  JP_MOBILE: {
    pattern: /0[789]0-?\d{4}-?\d{4}/g,
    label: '電話番号',
    score: 0.85
  },

  // 郵便番号
  JP_POSTAL: {
    pattern: /〒?\d{3}-?\d{4}/g,
    label: '郵便番号',
    score: 0.9
  },

  // 金額
  JP_CURRENCY: {
    pattern: /[¥￥]\s?[\d,]+/g,
    label: '金額',
    score: 0.8
  },
  JP_CURRENCY_KANJI: {
    pattern: /\d[\d,]*\s?[万億兆]?円/g,
    label: '金額',
    score: 0.7
  },

  // 会社名パターン
  JP_COMPANY_PRE: {
    pattern: /株式会社[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}/g,
    label: '会社名',
    score: 0.75
  },
  JP_COMPANY_POST: {
    pattern: /[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}株式会社/g,
    label: '会社名',
    score: 0.75
  },
  JP_COMPANY_YUGEN: {
    pattern: /有限会社[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}/g,
    label: '会社名',
    score: 0.75
  },
  JP_COMPANY_GODO: {
    pattern: /合同会社[ァ-ヶー\u4e00-\u9fafA-Za-z0-9]{1,20}/g,
    label: '会社名',
    score: 0.75
  },

  // 敬称付き名前
  JP_NAME_SAMA: {
    pattern: /[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}様/g,
    label: '個人名',
    score: 0.6
  },
  JP_NAME_SAN: {
    pattern: /[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}さん/g,
    label: '個人名',
    score: 0.6
  },
  JP_NAME_SHI: {
    pattern: /[ぁ-んァ-ヶー\u4e00-\u9faf]{1,6}氏/g,
    label: '個人名',
    score: 0.6
  },

  // APIキー
  OPENAI_KEY: {
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    label: 'APIキー',
    score: 0.95
  },
  AWS_KEY: {
    pattern: /AKIA[0-9A-Z]{16}/g,
    label: 'APIキー',
    score: 0.95
  },

  // マイナンバー
  JP_MYNUMBER: {
    pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
    label: 'マイナンバー',
    score: 0.7
  },

  // クレジットカード
  CREDIT_CARD: {
    pattern: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/g,
    label: 'クレジットカード',
    score: 0.8
  },

  // IPアドレス
  IP_ADDRESS: {
    pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
    label: 'IPアドレス',
    score: 0.7
  }
};

// 敬称の除外リスト（一般名詞）
const HONORIFIC_DENY_LIST = new Set([
  'お客様', '皆様', '各位', '担当者様', '御担当者様', 'ご担当者様',
  '関係者様', '責任者様', '代表者様', '管理者様', '窓口様',
  '皆さん', '皆さま', 'みなさま', 'お客さん', 'お客さま'
]);

/**
 * テキストから機密情報を検出
 */
function detectPII(text, customDictionary = []) {
  const detections = [];

  // パターンベース検出
  for (const [type, config] of Object.entries(PATTERNS)) {
    const regex = new RegExp(config.pattern.source, config.pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];

      // 敬称の除外チェック
      if (type.startsWith('JP_NAME_') && HONORIFIC_DENY_LIST.has(matchedText)) {
        continue;
      }

      detections.push({
        type: type,
        text: matchedText,
        start: match.index,
        end: match.index + matchedText.length,
        score: config.score,
        label: config.label,
        method: 'pattern'
      });
    }
  }

  // 辞書ベース検出
  for (const entry of customDictionary) {
    const regex = new RegExp(escapeRegex(entry.value), 'g');
    let match;

    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: 'DICT_' + entry.category.toUpperCase(),
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        score: 0.95,
        label: entry.label,
        method: 'dictionary'
      });
    }
  }

  // 重複除去
  return removeOverlapping(detections);
}

/**
 * 重複する検出を除去（長いスパン優先）
 */
function removeOverlapping(detections) {
  if (detections.length === 0) return [];

  // 優先度でソート: 辞書 > 長いスパン > 高スコア
  const sorted = detections.sort((a, b) => {
    // 辞書優先
    const aDict = a.method === 'dictionary' ? 0 : 1;
    const bDict = b.method === 'dictionary' ? 0 : 1;
    if (aDict !== bDict) return aDict - bDict;

    // 長いスパン優先
    const aLen = a.end - a.start;
    const bLen = b.end - b.start;
    if (aLen !== bLen) return bLen - aLen;

    // 高スコア優先
    return b.score - a.score;
  });

  const result = [];
  for (const det of sorted) {
    const overlaps = result.some(accepted =>
      !(det.end <= accepted.start || det.start >= accepted.end)
    );
    if (!overlaps) {
      result.push(det);
    }
  }

  return result;
}

/**
 * 検出箇所をマスク
 */
function maskText(text, detections) {
  if (detections.length === 0) return text;

  // 位置でソート（後ろから置換）
  const sorted = [...detections].sort((a, b) => b.start - a.start);

  let result = text;
  for (const det of sorted) {
    result = result.slice(0, det.start) + `[${det.label}]` + result.slice(det.end);
  }

  return result;
}

/**
 * 正規表現のエスケープ
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectPII, maskText, PATTERNS };
}
