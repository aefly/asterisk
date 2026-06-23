(function () {
    const $ = (id) => document.getElementById(id);
    const manifest = chrome.runtime.getManifest();

    // Options page: master toggle + per-PII-type toggles.
    // Reads PII types from Asterisk.PII.types (single source of truth in pii-detector.js).

    $("ast-power-icon").innerHTML = Asterisk.icons.get("power", { size: 18 });
    $("ast-lock-icon").innerHTML = Asterisk.icons.get("lock", { size: 14 });
    $("ast-version").textContent = "v" + manifest.version;
    $("ast-github-link").innerHTML =
        Asterisk.icons.get("github", { size: 16 }) + "<span>GitHub</span>";

    let settings = null;

    // Live-update when settings change from the popup or other tabs.
    // Update toggles in place rather than re-rendering, to preserve the CSS transition animation.
    Asterisk.storage.onChanged((s) => {
        settings = s;
        $("ast-types")
            .querySelectorAll("input")
            .forEach((input) => {
                input.checked = settings.piiTypes[input.dataset.type] !== false;
            });
        renderMaster();
    });

    function renderMaster() {
        const on = settings.enabled !== false;
        $("ast-master").checked = on;
        $("ast-master-sub").textContent = on
            ? "On — warn before sending"
            : "Off — no warnings shown";
        $("ast-types").classList.toggle("opacity-60", !on);
        $("ast-types")
            .querySelectorAll("input")
            .forEach((i) => {
                i.disabled = !on;
            });
    }

    function renderTypes() {
        const ul = $("ast-types");
        ul.innerHTML = "";
        for (const t of Asterisk.PII.types) {
            const li = document.createElement("li");
            li.className =
                "flex items-start justify-between rounded-xl bg-white border border-gray-200 px-4 py-3 gap-3";

            const left = document.createElement("div");
            left.className = "flex items-start gap-3 min-w-0";

            const iconWrap = document.createElement("span");
            iconWrap.className =
                "w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0";
            iconWrap.innerHTML = Asterisk.icons.get(t.icon, { size: 18 });

            const text = document.createElement("div");
            text.className = "leading-tight";
            const label = document.createElement("div");
            label.className = "text-sm font-medium text-gray-800";
            label.textContent = t.label;
            const desc = document.createElement("div");
            desc.className = "text-xs text-gray-500 mt-0.5";
            desc.textContent = t.description;
            text.appendChild(label);
            text.appendChild(desc);

            left.appendChild(iconWrap);
            left.appendChild(text);

            const labelEl = document.createElement("label");
            labelEl.className = "ast-switch";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "ast-switch-input";
            input.checked = settings.piiTypes[t.id] !== false;
            input.disabled = settings.enabled === false;
            input.dataset.type = t.id;
            input.setAttribute("aria-label", `Detect ${t.label}`);
            input.addEventListener("change", async () => {
                settings = await Asterisk.storage.saveSettings({
                    piiTypes: { [t.id]: input.checked },
                });
            });

            const track = document.createElement("span");
            track.className = "ast-switch-track";
            const thumb = document.createElement("span");
            thumb.className = "ast-switch-thumb";
            track.appendChild(thumb);

            labelEl.appendChild(input);
            labelEl.appendChild(track);

            li.appendChild(left);
            li.appendChild(labelEl);
            ul.appendChild(li);
        }
    }

    $("ast-master").addEventListener("change", async () => {
        settings = await Asterisk.storage.saveSettings({
            enabled: $("ast-master").checked,
        });
        renderMaster();
    });

    async function init() {
        settings = await Asterisk.storage.getSettings();
        renderTypes();
        renderMaster();
    }

    document.addEventListener("DOMContentLoaded", init);
})();
