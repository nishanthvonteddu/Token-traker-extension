chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['showWidget'], (result) => {
    if (result.showWidget === undefined) {
      chrome.storage.local.set({ showWidget: true });
    }
  });
});
