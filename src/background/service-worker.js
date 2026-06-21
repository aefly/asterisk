// MV3 service worker. Ephemeral — never store state in variables.
importScripts("../lib/storage.js");

// Initialize default settings on first install.
chrome.runtime.onInstalled.addListener(async () => {
    const settings = await self.Asterisk.storage.getSettings();
    await chrome.storage.local.set({ settings });
});

// Open the settings page when the warning dialog's "Learn more" link is clicked.
chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "OPEN_SETTINGS") {
        chrome.runtime.openOptionsPage().catch((err) => {
            console.error("Asterisk: openOptionsPage failed", err);
        });
    }
    return false;
});
