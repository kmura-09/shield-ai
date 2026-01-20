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
  const text = 'マイナンバーは 1234-5678-9018、誤りは 1234-5678-9019。';
  const detections = detectPII(text);
  assert.strictEqual(findByType(detections, 'JP_MYNUMBER').length, 1);
  assertIncludesText(findByType(detections, 'JP_MYNUMBER'), '1234-5678-9018');
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

console.log('detector tests passed');
