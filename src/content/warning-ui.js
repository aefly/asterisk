(function () {
    self.Asterisk = self.Asterisk || {};

    // Warning dialog injected into the host page via Shadow DOM.
    // Scoped styles prevent leaking into or being affected by the host AI site's CSS.
    let hostEl = null;
    let shadow = null;
    let lastFocused = null;
    let actionHandler = null;

    function escapeHtml(s) {
        return String(s).replace(
            /[&<>"']/g,
            (c) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[c],
        );
    }

    function styles() {
        return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .ast-overlay {
        position: fixed; inset: 0; z-index: 2147483647;
        background: rgba(15, 23, 42, 0.55);
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        animation: ast-fade 120ms ease-out;
      }
      @keyframes ast-fade { from { opacity: 0 } to { opacity: 1 } }
      .ast-dialog {
        width: min(440px, calc(100vw - 32px));
        background: #ffffff; border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        padding: 20px 20px 16px;
        animation: ast-pop 140ms ease-out;
      }
      @keyframes ast-pop { from { transform: translateY(8px) scale(0.98); opacity: 0 } to { transform: none; opacity: 1 } }
      .ast-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
      .ast-icon {
        width: 34px; height: 34px; flex: 0 0 34px; border-radius: 10px;
        background: #fef3c7; color: #b45309;
        display: flex; align-items: center; justify-content: center; margin-top: 1px;
      }
      .ast-icon svg { width: 20px; height: 20px; }
      .ast-title { font-size: 15px; font-weight: 650; line-height: 1.25; }
      .ast-sub { font-size: 13px; color: #475569; margin: 0 0 12px; line-height: 1.45; }
      .ast-list { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow: auto; }
      .ast-item {
        display: flex; align-items: center; gap: 8px;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
        padding: 7px 10px; font-size: 12.5px;
      }
      .ast-badge {
        font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
        text-transform: uppercase; color: #b45309; background: #fef3c7;
        padding: 2px 7px; border-radius: 999px; white-space: nowrap;
      }
      .ast-value { color: #334155; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ast-actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; flex-wrap: wrap; }
      .ast-btn {
        font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
        border-radius: 10px; padding: 8px 14px; border: 1px solid transparent;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        min-height: 36px;
      }
      .ast-btn svg { width: 16px; height: 16px; flex-shrink: 0; }
      .ast-btn:focus-visible { outline: 2px solid #F17528; outline-offset: 2px; }
      .ast-btn-ghost { background: transparent; color: #475569; border-color: #e2e8f0; }
      .ast-btn-ghost:hover { background: #f1f5f9; }
      .ast-btn-edit { background: #F17528; color: #fff; }
      .ast-btn-edit:hover { background: #d9621a; }
      .ast-btn-primary { background: #0f172a; color: #fff; }
      .ast-btn-primary:hover { background: #1e293b; }
      .ast-more { margin-top: 10px; font-size: 12px; color: #475569; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      .ast-more p { margin: 0 0 8px; }
      .ast-link { background: none; border: none; color: #F17528; cursor: pointer; font: inherit; font-size: 12px; padding: 0; text-decoration: underline; }

      @media (prefers-color-scheme: dark) {
        .ast-overlay { background: rgba(1,4,9,0.75); color: #e6edf3; }
        .ast-dialog { background: #161b22; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
        .ast-icon { background: #2a1d04; color: #f0b429; }
        .ast-sub { color: #b1bac4; }
        .ast-item { background: #0d1117; border-color: #30363d; }
        .ast-badge { color: #f0b429; background: #2a1d04; }
        .ast-value { color: #d29922; }
        .ast-btn-ghost { color: #b1bac4; border-color: #30363d; }
        .ast-btn-ghost:hover { background: #21262d; }
        .ast-btn-edit { background: #F17528; color: #fff; }
        .ast-btn-edit:hover { background: #d9621a; }
        .ast-btn-primary { background: #e6edf3; color: #0d1117; }
        .ast-btn-primary:hover { background: #f0f6fc; }
        .ast-more { color: #b1bac4; border-top-color: #30363d; }
        .ast-link { color: #F17528; }
      }
    `;
    }

    function render(findings) {
        const items = findings
            .map(
                (f) => `
      <li class="ast-item">
        <span class="ast-badge">${escapeHtml(self.Asterisk.PII.typeLabel(f.type))}</span>
        <span class="ast-value">${escapeHtml(self.Asterisk.PII.mask(f.value))}</span>
      </li>
    `,
            )
            .join("");

        return `
      <div class="ast-overlay">
        <div class="ast-dialog" role="dialog" aria-modal="true" aria-labelledby="ast-title">
          <div class="ast-head">
            <div class="ast-icon">${self.Asterisk.icons.get("shield", { size: 20 })}</div>
            <div class="ast-title" id="ast-title">Heads up — this message may contain sensitive info</div>
          </div>
          <p class="ast-sub">Asterisk found ${findings.length} item${findings.length === 1 ? "" : "s"} that look like personal data. You can still send it — just make sure it's intentional.</p>
          <ul class="ast-list">${items}</ul>
          <div class="ast-actions">
            <button class="ast-btn ast-btn-ghost" data-act="learn">${self.Asterisk.icons.get("help", { size: 16 })}<span>Learn more</span></button>
            <button class="ast-btn ast-btn-edit" data-act="edit">${self.Asterisk.icons.get("edit", { size: 16 })}<span>Edit first</span></button>
            <button class="ast-btn ast-btn-primary" data-act="send">${self.Asterisk.icons.get("send", { size: 16 })}<span>Send anyway</span></button>
          </div>
          <div class="ast-more" hidden>
            <p><strong>What was found:</strong> Asterisk detected ${findings.map((f) => escapeHtml(self.Asterisk.PII.typeLabel(f.type).toLowerCase())).join(", ")} in your message. Sharing this with an AI chat means it could be stored, logged, or seen by others.</p>
            <p><strong>Edit first</strong> — Remove or replace the sensitive data, then send.</p>
            <p><strong>Send anyway</strong> — Send your message as-is. You're in control.</p>
            <p>Want to stop seeing warnings for certain types of data? Adjust what Asterisk watches for in settings.</p>
            <button class="ast-link" data-act="settings">Open Settings →</button>
          </div>
        </div>
      </div>
    `;
    }

    // Trap Tab/Escape inside the dialog for keyboard accessibility.
    function trapFocus(dialog) {
        const focusables = () =>
            Array.from(dialog.querySelectorAll("button")).filter(
                (el) => el.offsetParent !== null && !el.closest("[hidden]"),
            );
        dialog.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                if (actionHandler) actionHandler("edit");
                return;
            }
            if (e.key !== "Tab") return;
            const fs = focusables();
            if (!fs.length) return;
            const first = fs[0],
                last = fs[fs.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    self.Asterisk.warning = {
        show(findings, onAction) {
            this.dismiss();
            lastFocused = document.activeElement;
            hostEl = document.createElement("div");
            hostEl.id = "asterisk-warning-host";
            hostEl.style.all = "initial";
            shadow = hostEl.attachShadow({ mode: "closed" });

            actionHandler = (act) => {
                if (act === "learn") {
                    // Toggle the "Learn more" section inline.
                    const more = shadow.querySelector(".ast-more");
                    if (more) more.hidden = !more.hidden;
                    return;
                }
                this.dismiss();
                onAction(act);
            };

            const style = document.createElement("style");
            style.textContent = styles();
            const wrap = document.createElement("div");
            wrap.innerHTML = render(findings);
            shadow.appendChild(style);
            shadow.appendChild(wrap);

            shadow.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-act]");
                if (btn) {
                    e.stopPropagation();
                    if (actionHandler) actionHandler(btn.dataset.act);
                }
            });

            document.body.appendChild(hostEl);
            trapFocus(shadow.querySelector(".ast-dialog"));
            const editBtn = shadow.querySelector('[data-act="edit"]');
            if (editBtn) editBtn.focus();
        },
        dismiss() {
            if (hostEl && hostEl.parentNode)
                hostEl.parentNode.removeChild(hostEl);
            hostEl = null;
            shadow = null;
            actionHandler = null;
            if (lastFocused && lastFocused.focus) {
                try {
                    lastFocused.focus();
                } catch (e) {}
            }
            lastFocused = null;
        },
        isShowing() {
            return !!hostEl;
        },
    };
})();
