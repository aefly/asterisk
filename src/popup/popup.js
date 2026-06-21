(function () {
    const $ = (id) => document.getElementById(id);

    // Toolbar popup: master toggle, per-site toggles, and current-tab status.
    // State is lost when the popup closes — all persistence is via chrome.storage.

    $("ast-power-icon").innerHTML = Asterisk.icons.get("power", { size: 18 });
    $("ast-version").textContent =
        "Asterisk v" + chrome.runtime.getManifest().version;
    $("ast-settings-btn").innerHTML =
        Asterisk.icons.get("settings", { size: 16 }) + "<span>Settings</span>";

    let settings = null;
    let currentSiteId = null;

    function renderMaster() {
        const on = settings.enabled !== false;
        $("ast-master").checked = on;
        $("ast-master-sub").textContent = on
            ? "On — warn before sending"
            : "Off — no warnings shown";
        $("ast-sites-section").classList.toggle("opacity-60", !on);
        $("ast-sites")
            .querySelectorAll("input")
            .forEach((i) => {
                i.disabled = !on;
            });
    }

    function renderSites() {
        const ul = $("ast-sites");
        ul.innerHTML = "";
        for (const site of Asterisk.sites) {
            const li = document.createElement("li");
            li.className =
                "ast-site-row flex items-center justify-between rounded-xl bg-white border border-gray-200 px-3 py-2";

            const left = document.createElement("div");
            left.className = "flex items-center gap-2.5 min-w-0";

            const icon = document.createElement("span");
            icon.className = "text-gray-500";
            icon.innerHTML = Asterisk.icons.get("bot", { size: 18 });

            const name = document.createElement("span");
            name.className = "text-sm font-medium text-gray-800 truncate";
            name.textContent = site.name;

            left.appendChild(icon);
            left.appendChild(name);

            const label = document.createElement("label");
            label.className = "ast-switch";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "ast-switch-input";
            input.checked = settings.sites[site.id] !== false;
            input.dataset.site = site.id;
            input.addEventListener("change", async () => {
                settings = await Asterisk.storage.saveSettings({
                    sites: { [site.id]: input.checked },
                });
                renderStatus();
            });

            const track = document.createElement("span");
            track.className = "ast-switch-track";
            const thumb = document.createElement("span");
            thumb.className = "ast-switch-thumb";
            track.appendChild(thumb);

            label.appendChild(input);
            label.appendChild(track);

            li.appendChild(left);
            li.appendChild(label);
            ul.appendChild(li);
        }
    }

    // Show whether the current tab is on a supported AI chat and if protection is active.
    async function renderStatus() {
        const el = $("ast-status");
        let tab = null;
        try {
            [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
        } catch (e) {
            tab = null;
        }
        const url = tab && tab.url;
        let host = "";
        try {
            host = url ? new URL(url).hostname : "";
        } catch (e) {
            host = "";
        }
        const site = host ? Asterisk.getSiteByHost(host) : null;
        currentSiteId = site ? site.id : null;

        if (site) {
            const isOn =
                settings.enabled !== false && settings.sites[site.id] !== false;
            el.innerHTML = "";
            const dot = document.createElement("span");
            dot.className = isOn
                ? "inline-block w-2 h-2 rounded-full bg-green-500"
                : "inline-block w-2 h-2 rounded-full bg-gray-400";
            const txt = document.createElement("span");
            txt.innerHTML = isOn
                ? 'Active on <strong class="font-semibold text-gray-800"></strong>'
                : 'Inactive on <strong class="font-semibold text-gray-800"></strong>';
            txt.querySelector("strong").textContent = site.name;
            el.appendChild(dot);
            el.appendChild(txt);
        } else {
            el.innerHTML = "";
            const ic = document.createElement("span");
            ic.className = "text-gray-400";
            ic.innerHTML = Asterisk.icons.get("alert", { size: 16 });
            const txt = document.createElement("span");
            txt.textContent = "Open a supported AI chat to enable warnings.";
            el.appendChild(ic);
            el.appendChild(txt);
        }
    }

    $("ast-master").addEventListener("change", async () => {
        settings = await Asterisk.storage.saveSettings({
            enabled: $("ast-master").checked,
        });
        renderMaster();
        renderStatus();
    });

    $("ast-settings-btn").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });

    async function init() {
        settings = await Asterisk.storage.getSettings();
        renderMaster();
        renderSites();
        await renderStatus();
    }

    document.addEventListener("DOMContentLoaded", init);
})();
