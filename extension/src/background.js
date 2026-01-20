/**
 * ShieldAI - Background Service Worker
 */

// コンテキストメニュー作成
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'shieldai-check',
    title: '機密情報をチェック',
    contexts: ['selection']
  });
});

// コンテキストメニュークリック
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'shieldai-check' && info.selectionText) {
    // ポップアップを開いて選択テキストを渡す
    chrome.storage.local.set({ selectedText: info.selectionText });
    chrome.action.openPopup();
  }
});
