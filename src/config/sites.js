(function () {
    self.Asterisk = self.Asterisk || {};

    // Supported AI chat sites. Selectors are tried in order, first match wins.
    // Site selectors are fragile: AI sites rebuild their DOM on SPA navigation,
    // so content.js uses a MutationObserver to re-find elements.
    //
    // enterToSend: true if pressing Enter sends the message.
    // Set false for composers where Enter inserts a newline (e.g. plain textarea),
    // otherwise the site's newline UX breaks.

    self.Asterisk.sites = [
        {
            // ChatGPT
            id: "chatgpt",
            name: "ChatGPT",
            hosts: ["chatgpt.com", "chat.openai.com"],
            enterToSend: true,
            composer: [
                'div#prompt-textarea[contenteditable="true"]',
                "textarea#prompt-textarea",
                'div[contenteditable="true"][role="textbox"]',
            ],
            sendButton: [
                'button[data-testid="send-button"]',
                'button[aria-label="Send prompt"]',
                'button[aria-label*="Send"]',
            ],
        },
        {
            // Claude
            id: "claude",
            name: "Claude",
            hosts: ["claude.ai"],
            enterToSend: true,
            composer: [
                'div.ProseMirror[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]',
            ],
            sendButton: [
                'button[aria-label="Send Message"]',
                'button[aria-label*="Send"]',
                'button[type="submit"]',
            ],
        },
        {
            // Gemini
            id: "gemini",
            name: "Gemini",
            hosts: ["gemini.google.com"],
            enterToSend: true,
            composer: [
                'rich-textarea div[contenteditable="true"]',
                'div[contenteditable="true"][aria-label*="Prompt"]',
                'div[contenteditable="true"]',
            ],
            sendButton: [
                'button[aria-label="Send message"]',
                'button[aria-label*="Send"]',
            ],
        },
        {
            // Copilot
            id: "copilot",
            name: "Copilot",
            hosts: ["copilot.microsoft.com"],
            enterToSend: true,
            composer: [
                "textarea#userInput",
                'textarea[data-testid="composer-input"]',
                'textarea[placeholder*="Copilot" i]',
                'div[contenteditable="true"]',
            ],
            sendButton: [
                'button[data-testid*="send" i]',
                'button[data-testid*="submit" i]',
                'button[aria-label*="Send" i]',
                'button[aria-label*="submit" i]',
            ],
        },
        {
            // Grok
            id: "grok",
            name: "Grok",
            hosts: ["grok.com"],
            enterToSend: true,
            composer: [
                'div.ProseMirror[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"]',
            ],
            sendButton: [
                'button[aria-label*="Send" i]',
                'button[aria-label*="Submit" i]',
                'button[data-testid*="send" i]',
                'button[type="submit"]',
            ],
        },
        {
            // Mistral
            id: "mistral",
            name: "Mistral",
            hosts: ["chat.mistral.ai"],
            enterToSend: true,
            composer: [
                "div.caret-brand-500",
                'div[class*="chat-input-card-module"] div[contenteditable="true"]',
                'div[contenteditable="true"]',
            ],
            sendButton: [
                'form button[type="submit"]',
                'button[aria-label*="Send" i]',
                'button[aria-label*="Submit" i]',
            ],
        },
        {
            // Perplexity
            id: "perplexity",
            name: "Perplexity",
            hosts: ["www.perplexity.ai", "perplexity.ai"],
            enterToSend: true,
            composer: [
                'div[data-lexical-editor="true"]',
                'div[contenteditable="true"]',
            ],
            sendButton: ['button[aria-label="Submit"]'],
        },
    ];

    self.Asterisk.getSiteByHost = function (host) {
        host = host || location.hostname;
        for (const site of self.Asterisk.sites) {
            if (site.hosts.some((h) => host === h || host.endsWith("." + h)))
                return site;
        }
        return null;
    };
})();
