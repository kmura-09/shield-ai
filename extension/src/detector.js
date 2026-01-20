/**
 * ShieldAI - 機密情報検出エンジン (JavaScript版)
 */

// 検出パターン定義
const PATTERNS = {
  // メールアドレス
  EMAIL: {
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
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

  // 郵便番号（〒付きのみ高信頼度）
  JP_POSTAL_MARK: {
    pattern: /〒\d{3}-?\d{4}/g,
    label: '郵便番号',
    score: 0.95
  },
  // 郵便番号（〒なし - 低信頼度）
  JP_POSTAL: {
    pattern: /\d{3}-\d{4}/g,
    label: '郵便番号',
    score: 0.5
  },

  // 住所（都道府県+市区町村+番地など）
  JP_ADDRESS: {
    pattern: /(?:北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)\S{1,15}?(?:市|区|町|村)\S{1,30}?\d{1,4}\S{0,10}/g,
    label: '住所',
    score: 0.8
  },
  // 住所（市区から始まるパターン）
  JP_ADDRESS_CITY: {
    pattern: /(?:札幌|仙台|さいたま|千葉|横浜|川崎|相模原|新潟|静岡|浜松|名古屋|京都|大阪|堺|神戸|岡山|広島|北九州|福岡|熊本)市[ぁ-んァ-ヶー\u4e00-\u9faf]{1,10}区[ぁ-んァ-ヶー\u4e00-\u9faf]{1,20}[\d\-]+[\d号]?/g,
    label: '住所',
    score: 0.75
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

  // 銀行口座番号（口座番号 7桁）- extractDigits で番号部分のみ抽出
  JP_BANK_ACCOUNT: {
    pattern: /(?:口座番号|口座|口座No\.?|Account)\s*[:：]?\s*(?:普通|当座|貯蓄)?\s*(\d{7})/gi,
    label: '銀行口座',
    score: 0.95,
    extractGroup: 1
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

const VALIDATORS = {
  CREDIT_CARD: isValidCreditCard,
  IP_ADDRESS: isValidIpAddress,
  JP_BANK_ACCOUNT: isValidJpBankAccount,
  // JP_MYNUMBER: セキュリティ目的のため、チェックディジット検証なしで検出
  JP_PHONE: isValidJpPhone,
  JP_MOBILE: isValidJpMobile
};

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
      let matchedText = match[0];
      let startIndex = match.index;

      // extractGroup指定がある場合、キャプチャグループの位置を使用
      if (config.extractGroup && match[config.extractGroup]) {
        const groupText = match[config.extractGroup];
        const groupOffset = match[0].indexOf(groupText);
        matchedText = groupText;
        startIndex = match.index + groupOffset;
      }

      // 敬称の除外チェック
      if (type.startsWith('JP_NAME_') && HONORIFIC_DENY_LIST.has(matchedText)) {
        continue;
      }

      const validator = VALIDATORS[type];
      if (validator && !validator(matchedText)) {
        continue;
      }

      detections.push({
        type: type,
        text: matchedText,
        start: startIndex,
        end: startIndex + matchedText.length,
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

function isValidJpPhone(value) {
  const digits = normalizeDigits(value);
  if (!digits.startsWith('0')) return false;
  return digits.length === 10 || digits.length === 11;
}

function isValidJpMobile(value) {
  const digits = normalizeDigits(value);
  return digits.length === 11 && /^(070|080|090)/.test(digits);
}

function isValidCreditCard(value) {
  const digits = normalizeDigits(value);
  if (digits.length < 13 || digits.length > 19) return false;
  return luhnCheck(digits);
}

function luhnCheck(digits) {
  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (Number.isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function isValidIpAddress(value) {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
}

function isValidJpBankAccount(value) {
  const digits = normalizeDigits(value);
  return digits.length === 7;
}

function isValidMyNumber(value) {
  const digits = normalizeDigits(value);
  if (digits.length !== 12) return false;
  const body = digits.slice(0, 11).split('').map(Number);
  const checkDigit = Number(digits[11]);
  if (body.some(Number.isNaN) || Number.isNaN(checkDigit)) return false;
  return calculateMyNumberCheckDigit(body) === checkDigit;
}

function calculateMyNumberCheckDigit(bodyDigits) {
  let sum = 0;
  for (let i = 0; i < bodyDigits.length; i += 1) {
    const digit = bodyDigits[bodyDigits.length - 1 - i];
    const weight = 2 + (i % 6);
    sum += digit * weight;
  }
  const remainder = sum % 11;
  return (11 - remainder) % 11;
}

function normalizeDigits(value) {
  return value.replace(/\D/g, '');
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectPII, maskText, PATTERNS };
}
