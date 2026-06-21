<p align="center">
  <img src="./.img/logo.png" alt="Logo" width="120" />
</p>

<h1 align="center">Asterisk</h1>

<p align="center"><strong>Warns you before sensitive details slip into AI conversations.</strong></p>

<p align="center">
    <img src="https://img.shields.io/github/package-json/v/aefly/asterisk?style=flat&logo=nodedotjs&logoColor=white&label=version&labelColor=green&color=green" alt="Package Version" />
    <img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4.svg?style=flat&logo=Tailwind-CSS&logoColor=white" alt="Tailwind CSS" />
</p>

---

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#install">Install</a> •
  <a href="#how-it-works">How it works</a> •
  <a href="#supported-platforms">Supported Platforms</a> •
  <a href="#development">Development</a> •
  <a href="#privacy">Privacy</a> •
  <a href="#license">License</a>
</p>

---

## Overview

A free, open-source privacy browser extension that warns you before you send
sensitive personal information to an AI chat. When you submit, it scans your
message right before it goes and shows a gentle, non-blocking warning if it spots
something sensitive.

Everything runs locally in your browser. There is no backend, no network calls,
and no data collection — your text never leaves the page you're typing on.

**Detected PII types:**

- **Email address**
- **Phone number** (US and international formats)
- **Credit card numbers** (Luhn checksum validated)
- **Social Security Numbers** (validated against area/group/serial rules)
- **Home address** (street number, name, and suffix)
- **API keys** (AWS, Google, GitHub, GitLab, Slack, Stripe, OpenAI, JWT, and
  labeled secrets like `api_key: ...`)
- **Passwords** (when labeled in text, e.g. `password: hunter2`)

## Install

> [!NOTE]
> We currently have no plans to publish this extension in the Chrome Web Store.
> To audit the code yourself, see [how it works](#how-it-works).

1. Download the latest [release](https://github.com/aefly/asterisk/releases/latest)
2. Open `chrome://extensions` in Chrome (or any Chromium browser)
3. Toggle **Developer mode** on (top-right)
4. Click **Load unpacked** and select this folder
5. Pin the Asterisk icon to your toolbar

## How it works

- A content script runs on the supported AI platforms. When you press Enter or
  click Send, it scans the composer text **right before** the message goes.
- If sensitive data is found, a small dialog appears with three options:
  **Send anyway**, **Edit first**, or **Learn more**.
- Detection is regex + heuristics only — no external services are called.
- The toolbar **popup** lists the supported platforms with on/off toggles and
  shows whether the current tab is protected ("Active on" / "Inactive on").
- The **settings page** (from the popup's Settings button, or the extension's options)
  lets you turn detection on/off per PII type.
- Changes in the popup or settings take effect immediately, no page refresh needed.

## Supported Platforms

- ChatGPT
- Claude
- Gemini
- Copilot
- Grok
- Mistral
- Perplexity

## Development

### Add a new AI platform

1. Add an entry to `self.Asterisk.sites` in `src/config/sites.js`:

    ```js
    {
      id: 'example',
      name: 'Example',
      hosts: ['example.com'],
      enterToSend: true,
      composer: ['textarea#prompt', 'div[contenteditable="true"]'],
      sendButton: ['button[aria-label*="Send"]', 'button[type="submit"]']
    }
    ```

2. Add the host(s) to both `content_scripts.matches` and `host_permissions` in `manifest.json`.
3. Add the platform id to the `DEFAULTS.sites` object in `src/lib/storage.js`.

**Field notes:**

- `enterToSend`: `true` if pressing Enter sends the message. Set `false` for composers
  where Enter inserts a newline. Currently `true` for all supported platforms.
- `composer` / `sendButton` are CSS selector arrays tried in order; the first
  match wins. These selectors are fragile — AI platforms rebuild their DOM on SPA
  navigation, so expect to update them when a platform changes. The content script
  uses a `MutationObserver` to re-find elements automatically.

### Wiring notes

- **No ES modules in content scripts.** Files are listed in order in `manifest.json`
  under `content_scripts.js` and share a `self.Asterisk` namespace. Load order matters:
  `sites → storage → pii-detector → warning-ui → content`.
- `storage.js` and `pii-detector.js` are reused in the popup/settings via
  `<script src>`, and in the service worker via `importScripts`. Keep them
  DOM-free and side-effect-free at load time so they work in every context.
- The warning UI is injected via **Shadow DOM** with scoped inline styles,
  so it can't leak into or be styled by the host AI platform.
- Settings are stored in `chrome.storage.local` only (not `sync`), so nothing is
  uploaded to any sync service.
- The content script always starts its listeners, even if the platform is disabled.
  `maybeIntercept()` checks the enabled state at runtime, so toggling a platform
  in the popup takes effect instantly without a page refresh.

### Styling

> [!WARNING]
> If you change Tailwind classes in the HTML or JS, you'll need to
> regenerate the CSS.

Popup and settings use Tailwind v4.3.1, vendored as a **generated** static CSS file
at `src/lib/tailwind.css` (loaded via a local `<link>` — no runtime CDN request,
which MV3 CSP would block anyway).

The CSS is compiled at dev time by the Tailwind CLI from `src/lib/tailwind.source.css`.
It's a JIT build, so only the classes actually used in the popup/settings HTML and
JS end up in the file (~12 KB).

**When you need to regenerate** — after adding or changing Tailwind classes in `popup.html`,
`popup.js`, `settings.html`, or `settings.js`:

```bash
npm install
npm run generate-css
```

JS-only edits that don't touch Tailwind classes never require regeneration. Never
edit `tailwind.css` by hand — edit the HTML/JS or `tailwind.source.css`,
then rerun the command.

The shared toggle switch lives in `src/lib/switch.css` and is linked by both the
popup and the settings page. Dark mode (browser/OS theme) is centralized in
`src/lib/theme.css`, which overrides the base color utilities under
`@media (prefers-color-scheme: dark)`.

## Privacy

Asterisk makes zero outbound network requests. All detection happens in the content
script on the page you're already viewing. Settings stay in `chrome.storage.local`.
No telemetry, no analytics, no accounts.

## License

This project is under the [MIT License](./LICENSE).
