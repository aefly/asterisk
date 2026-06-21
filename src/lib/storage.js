(function () {
    self.Asterisk = self.Asterisk || {};

    // Uses chrome.storage.local (not .sync) so no data is uploaded to Google's servers.
    const AREA = chrome.storage.local;

    const DEFAULTS = {
        enabled: true,
        piiTypes: {
            email: true,
            phone: true,
            creditCard: true,
            ssn: true,
            address: true,
            apiKey: true,
            password: true,
        },
        sites: {
            chatgpt: true,
            claude: true,
            gemini: true,
            copilot: true,
            grok: true,
            mistral: true,
            perplexity: true,
        },
    };

    // Merge stored settings over defaults so new options appear enabled on upgrade.
    function withDefaults(stored) {
        return {
            enabled:
                stored && stored.enabled !== undefined
                    ? stored.enabled
                    : DEFAULTS.enabled,
            piiTypes: Object.assign(
                {},
                DEFAULTS.piiTypes,
                (stored && stored.piiTypes) || {},
            ),
            sites: Object.assign(
                {},
                DEFAULTS.sites,
                (stored && stored.sites) || {},
            ),
        };
    }

    self.Asterisk.storage = {
        async getSettings() {
            const { settings } = await AREA.get("settings");
            return withDefaults(settings);
        },
        // Merge a partial update into current settings and persist.
        async saveSettings(partial) {
            const current = await this.getSettings();
            const next = {
                enabled:
                    partial.enabled !== undefined
                        ? partial.enabled
                        : current.enabled,
                piiTypes: Object.assign(
                    {},
                    current.piiTypes,
                    partial.piiTypes || {},
                ),
                sites: Object.assign({}, current.sites, partial.sites || {}),
            };
            await AREA.set({ settings: next });
            return next;
        },
        // Listen for live setting changes (e.g. from popup/settings UI).
        onChanged(cb) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === "local" && changes.settings)
                    cb(withDefaults(changes.settings.newValue));
            });
        },
    };
})();
