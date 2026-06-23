(function () {
    self.Asterisk = self.Asterisk || {};

    // Orchestrator: intercepts send actions, runs PII detection, shows warning.
    // Runs on supported AI chat sites (declared in manifest.json content_scripts).

    const state = {
        site: null,
        settings: null,
        composer: null,
        sendButton: null,
        allowNext: false, // one-shot bypass: lets "Send anyway" re-trigger send without re-intercepting
        observing: false,
    };

    function readComposerText(el) {
        if (!el) return "";
        let text;
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT")
            text = el.value || "";
        else text = el.innerText || el.textContent || "";
        // Strip zero-width characters that rich-text editors (Lexical, ProseMirror)
        // insert between text nodes — they break regex matching.
        return text.replace(/[\u200b\u200c\u200d\ufeff]/g, "");
    }

    function isEnabledForCurrentSite() {
        if (!state.settings || state.settings.enabled === false) return false;
        if (!state.site) return false;
        if (state.settings.sites[state.site.id] === false) return false;
        return true;
    }

    function scanComposer() {
        if (!state.composer || !state.composer.isConnected) refresh();
        const text = readComposerText(state.composer);
        if (!text || !text.trim()) return [];
        return self.Asterisk.PII.scan(text, state.settings.piiTypes);
    }

    // Re-trigger the original send after the user clicks "Send anyway".
    // Sets allowNext so the interceptors let this one through.
    // Does NOT call refresh() — uses the sendButton that was active when the
    // warning was triggered, to avoid replacing it with a disabled/wrong button.
    function proceedSend() {
        state.allowNext = true;
        if (state.sendButton && state.sendButton.isConnected) {
            state.sendButton.click();
        } else if (state.composer && state.composer.isConnected) {
            state.composer.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Enter",
                    code: "Enter",
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        }
        setTimeout(() => {
            state.allowNext = false;
        }, 500);
    }

    function handleWarning(findings) {
        self.Asterisk.warning.show(findings, (act) => {
            if (act === "send") proceedSend();
            else if (act === "edit") {
                if (state.composer) state.composer.focus();
            } else if (act === "settings") {
                try {
                    chrome.runtime.sendMessage({ type: "OPEN_SETTINGS" });
                } catch (e) {}
            }
        });
    }

    // Returns true if the send was intercepted (PII found + warning shown).
    function maybeIntercept() {
        if (state.allowNext) return false;
        if (self.Asterisk.warning.isShowing()) return false;
        if (!isEnabledForCurrentSite()) return false;
        const findings = scanComposer();
        if (!findings.length) return false;
        handleWarning(findings);
        return true;
    }

    function isInside(el, target) {
        return !!el && !!target && (el === target || el.contains(target));
    }

    // Check if a button is near the composer (within the same container or a
    // nearby sibling). Prevents intercepting unrelated "Submit feedback" etc.
    function isNearComposer(el) {
        if (!el || !state.composer) return false;
        // Walk up the button's ancestors looking for the composer or a shared parent.
        let node = el;
        for (let i = 0; i < 10 && node; i++) {
            if (node === state.composer || node.contains(state.composer))
                return true;
            node = node.parentElement;
        }
        return false;
    }

    // Fallback: catch send buttons we couldn't find via selectors (e.g. buttons
    // that only appear after the user types, like Perplexity's submit button).
    function looksLikeSendButton(el) {
        if (!el || el.tagName !== "BUTTON") return false;
        const label = (el.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("submit") || label.includes("send")) return true;
        const testId = (el.getAttribute("data-testid") || "").toLowerCase();
        if (testId.includes("send") || testId.includes("submit")) return true;
        return false;
    }

    // All listeners are on document (capture phase), not on the composer element.
    // Capture flows window -> document -> target, so these fire BEFORE any
    // element-level handlers the host site registered (e.g. Claude's ProseMirror).
    function onDocumentKeydown(e) {
        if (!state.site || !state.site.enterToSend) return;
        if (e.key !== "Enter") return;
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.isComposing) return;
        if (!isInside(state.composer, e.target)) return;
        if (maybeIntercept()) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }

    // Single click handler — no pointerdown. Simpler, avoids double-fire issues.
    function onDocumentClick(e) {
        if (state.allowNext) return; // "Send anyway" bypass
        // Check known send button first.
        if (state.sendButton && isInside(state.sendButton, e.target)) {
            if (maybeIntercept()) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            return;
        }
        // Fallback: dynamically-created send buttons (e.g. Perplexity).
        // Only fire if we don't already have a valid sendButton, the button
        // looks like a send button, AND it's near the composer.
        if (!state.sendButton || !state.sendButton.isConnected) {
            const btn = e.target.closest("button");
            if (btn && looksLikeSendButton(btn) && isNearComposer(btn)) {
                state.sendButton = btn;
                if (maybeIntercept()) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }
        }
    }

    function onSubmit(e) {
        // Only intercept forms near the composer — never unrelated forms
        // (feedback widgets, login modals, etc.) elsewhere on the page.
        if (!isNearComposer(e.target)) return;
        if (maybeIntercept()) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }

    // Find an element by selectors. When multiple match, prefer the one that
    // contains (or is) the currently focused element — handles SPAs with
    // multiple composers (e.g. Perplexity home + follow-up).
    function findEl(selectors) {
        const focused = document.activeElement;
        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            if (!els.length) continue;
            if (els.length === 1) return els[0];
            // Multiple matches: prefer the one containing focus.
            for (const el of els) {
                if (el === focused || el.contains(focused)) return el;
            }
            return els[0]; // fallback to first
        }
        return null;
    }

    // Re-find composer and send button. Called on init and on every DOM mutation
    // (AI sites rebuild their DOM on SPA navigation).
    function refresh() {
        if (!state.site) return;
        const composer = findEl(state.site.composer);
        if (composer && composer.isConnected) state.composer = composer;
        // While the warning dialog is open, keep the sendButton snapshot taken
        // at intercept time — refresh() running during the warning would otherwise
        // replace it with a disabled/re-rendered button and break "Send anyway".
        if (self.Asterisk.warning && self.Asterisk.warning.isShowing()) return;
        const btn = findEl(state.site.sendButton);
        if (btn && btn.isConnected) state.sendButton = btn;
        else if (state.sendButton && !state.sendButton.isConnected) {
            state.sendButton = null;
        }
    }

    // Coalesce rapid DOM mutations into one refresh per frame. AI sites fire
    // many mutations during SPA navigation/typing; running querySelectorAll for
    // every selector on every mutation is wasteful.
    let refreshRaf = 0;
    function scheduleRefresh() {
        if (refreshRaf) return;
        refreshRaf = requestAnimationFrame(() => {
            refreshRaf = 0;
            refresh();
        });
    }

    function startObserver() {
        if (state.observing) return;
        state.observing = true;
        const obs = new MutationObserver(scheduleRefresh);
        const root = document.body || document.documentElement;
        obs.observe(root, { childList: true, subtree: true });
        document.addEventListener("keydown", onDocumentKeydown, true);
        document.addEventListener("click", onDocumentClick, true);
        document.addEventListener("submit", onSubmit, true);
    }

    async function init() {
        state.settings = await self.Asterisk.storage.getSettings();
        state.site = self.Asterisk.getSiteByHost(location.hostname);
        // Live-update when settings change from the popup/settings UI — no page refresh needed.
        self.Asterisk.storage.onChanged((s) => {
            state.settings = s;
        });
        refresh();
        startObserver();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
