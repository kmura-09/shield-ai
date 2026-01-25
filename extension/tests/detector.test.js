const assert = require('assert');

const { detectPII } = require('../src/detector');

function findByType(detections, type) {
  return detections.filter(item => item.type === type);
}

function assertIncludesText(detections, expectedText) {
  assert.ok(
    detections.some(item => item.text === expectedText),
    `Expected to find "${expectedText}" in detections.`
  );
}

(() => {
  const text = '連絡先は test@example.com. までお願いします。';
  const detections = detectPII(text);
  assertIncludesText(findByType(detections, 'EMAIL'), 'test@example.com');
})();

(() => {
  const text = 'IP: 999.999.1.1, 公開IP: 192.168.0.1';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'IP_ADDRESS').length, 1);
  assertIncludesText(findByType(detections, 'IP_ADDRESS'), '192.168.0.1');
})();

(() => {
  const text = 'カード番号は 4539 1488 0343 6467 ですが 4539 1488 0343 6468 は無効。';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'CREDIT_CARD').length, 1);
  assertIncludesText(findByType(detections, 'CREDIT_CARD'), '4539 1488 0343 6467');
})();

(() => {
  // セキュリティ目的のため、チェックディジットに関係なく全て検出
  const text = 'マイナンバーは 1234-5678-9018、誤りは 1234-5678-9019。';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_MYNUMBER').length, 2);
  assertIncludesText(findByType(detections, 'JP_MYNUMBER'), '1234-5678-9018');
  assertIncludesText(findByType(detections, 'JP_MYNUMBER'), '1234-5678-9019');
})();

(() => {
  const text = '携帯は 090-1234-5678、固定は 03-1234-5678、誤りは 090-1234-567。';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_MOBILE').length, 1);
  assert.strictEqual(findByType(detections, 'JP_PHONE').length, 1);
})();

(() => {
  const text = '住所は東京都渋谷区道玄坂2丁目24番1号で、別件は大阪府大阪市北区梅田3-1-1。';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_ADDRESS').length, 2);
})();

(() => {
  const text = '口座番号: 1234567 は有効。口座番号 123456 は無効。';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_BANK_ACCOUNT').length, 1);
})();

// 口座番号（普通/当座付き）
(() => {
  const text = '口座番号： 普通 1234567';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_BANK_ACCOUNT').length, 1);
  assertIncludesText(findByType(detections, 'JP_BANK_ACCOUNT'), '1234567');
})();

// 会社名パターン
(() => {
  const text = '株式会社テクノボーイと有限会社サンプルと合同会社テストです。';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_COMPANY_PRE').length, 1);
  assert.strictEqual(findByType(detections, 'JP_COMPANY_YUGEN').length, 1);
  assert.strictEqual(findByType(detections, 'JP_COMPANY_GODO').length, 1);
})();

// 金額パターン
(() => {
  const text = '費用は¥10,000と5万円です。';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_CURRENCY').length, 1);
  assert.strictEqual(findByType(detections, 'JP_CURRENCY_KANJI').length, 1);
})();

// APIキー
(() => {
  const text = 'OpenAI key: sk-abcdefghij1234567890abcd';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'OPENAI_KEY').length, 1);
})();

// 郵便番号（〒付き）
(() => {
  const text = '〒100-0001 東京都千代田区';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_POSTAL_MARK').length, 1);
})();

// 敬称付き名前（除外リストのテスト）
(() => {
  const text = 'お客様へ。田中様、山田さん、鈴木氏にご連絡ください。';
  const detections = detectPII(text);
  const names = detections.filter(d => d.type.startsWith('JP_NAME_'));
  // お客様は除外されるべき
  assert.ok(!names.some(n => n.text === 'お客様'));
  // 田中様、山田さん、鈴木氏は検出されるべき
  assert.ok(names.some(n => n.text === '田中様'));
  assert.ok(names.some(n => n.text === '山田さん'));
  assert.ok(names.some(n => n.text === '鈴木氏'));
})();

// 挨拶・慣用表現（誤検知しないこと）
(() => {
  const greetings = [
    'お疲れ様です。本日もよろしくお願いします。',
    'ご苦労様でした。',
    'いつもお世話様です。',
    'お互い様ですね。',
    'おかげ様で順調です。',
    'お疲れさん！今日も頑張ったね。',
    'ご馳走様でした。美味しかったです。',
    'お待ち様でした。',
    'お陰様で元気にしております。',
    'ご愁傷様です。',
    // 表記ゆれ
    'おつかれ様です。',
    'お疲れさまです。',
    'おつかれさまです。',
    'オツカレ様でした。',
    'おせわ様です。',
    'ごくろう様です。',
    'ごちそう様でした。'
  ];
  for (const text of greetings) {
    const detections = detectPII(text);
    const names = detections.filter(d => d.type.startsWith('JP_NAME_'));
    assert.strictEqual(names.length, 0, `Greeting should not be detected as name: "${text}"`);
  }
})();

// 神仏・王族等の表現（誤検知しないこと）
(() => {
  const expressions = [
    '神様に祈りを捧げる。',
    '仏様のご加護がありますように。',
    'ご先祖様を大切に。',
    '王様と王妃様が来られた。',
    'お姫様みたいなドレス。',
    'お地蔵さんにお参りした。',
    'お稲荷さんの祠がある。'
  ];
  for (const text of expressions) {
    const detections = detectPII(text);
    const names = detections.filter(d => d.type.startsWith('JP_NAME_'));
    assert.strictEqual(names.length, 0, `Common expression should not be detected: "${text}"`);
  }
})();

// 役職・立場を表す敬称（誤検知しないこと）
(() => {
  const roleExpressions = [
    '担当者様にお伝えください。',
    '店員さんに聞いてみよう。',
    '運転手さん、駅までお願いします。',
    '社長様がお見えです。',
    '奥様によろしくお伝えください。',
    '旦那さんはお元気ですか。',
    '赤ちゃんが生まれました。',
    'お嬢さんは何歳ですか。'
  ];
  for (const text of roleExpressions) {
    const detections = detectPII(text);
    const names = detections.filter(d => d.type.startsWith('JP_NAME_'));
    assert.strictEqual(names.length, 0, `Role expression should not be detected: "${text}"`);
  }
})();

// 挨拶と実名が混在するケース（実名のみ検出されるべき）
(() => {
  const text = 'お疲れ様です。佐藤様、本日の会議についてご連絡します。';
  const detections = detectPII(text);
  const names = detections.filter(d => d.type.startsWith('JP_NAME_'));
  // お疲れ様は除外され、佐藤様のみ検出
  assert.strictEqual(names.length, 1, 'Only real name should be detected');
  assert.ok(names.some(n => n.text === '佐藤様'));
})();

// 複合テスト（実際のビジネスメール風）
(() => {
  const text = `株式会社テクノボーイ
田中様

お振込先：
銀行名：富士見銀行
口座番号： 普通 1234567

ご不明点は 03-1234-5678 または info@example.com までご連絡ください。`;
  const detections = detectPII(text);
  assert.ok(detections.length >= 5, `Expected at least 5 detections, got ${detections.length}`);
})();

// 辞書機能テスト
(() => {
  const text = 'プロジェクトXの担当は佐藤です。';
  const dictionary = [
    { value: 'プロジェクトX', label: 'プロジェクト名', category: 'projects' }
  ];
  const detections = detectPII(text, dictionary);
  assert.ok(detections.some(d => d.text === 'プロジェクトX'));
})();

console.log('detector tests passed');
