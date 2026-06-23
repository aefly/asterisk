(function () {
    self.Asterisk = self.Asterisk || {};

    // Single source of truth for PII type ids, labels, icons, and descriptions.
    // Extend here, not in the UI files. The settings page reads this to render toggles.
    const TYPES = [
        {
            id: "email",
            label: "Email address",
            icon: "mail",
            description: "Email addresses in any common format",
            example: "name@company.com",
        },
        {
            id: "phone",
            label: "Phone number",
            icon: "phone",
            description: "US and international phone numbers",
            example: "(555) 867-5309",
        },
        {
            id: "creditCard",
            label: "Credit card number",
            icon: "card",
            description: "Card numbers validated with the Luhn checksum",
            example: "4111 1111 1111 1111",
        },
        {
            id: "ssn",
            label: "Social Security number",
            icon: "hash",
            description: "U.S. SSNs with area, group, and serial validated",
            example: "123-45-6789",
        },
        {
            id: "address",
            label: "Home address",
            icon: "home",
            description: "Street addresses: number, street name, suffix",
            example: "123 Main Street",
        },
        {
            id: "apiKey",
            label: "API key / secret token",
            icon: "key",
            description:
                "AWS, Google, GitHub, GitLab, Slack, Stripe, OpenAI, JWT, and labeled secrets",
            example: "sk-live-xxxxxxxx",
        },
        {
            id: "password",
            label: "Password in plaintext",
            icon: "lock",
            description: "Passwords assigned in text, like password: hunter2",
            example: "password: hunter2",
        },
    ];

    function onlyDigits(s) {
        return s.replace(/\D/g, "");
    }

    // Luhn checksum — validates credit card numbers to drastically cut false positives.
    function luhnValid(digitsStr) {
        const s = onlyDigits(digitsStr);
        if (s.length < 13 || s.length > 19) return false;
        let sum = 0,
            alt = false;
        for (let i = s.length - 1; i >= 0; i--) {
            let d = s.charCodeAt(i) - 48;
            if (alt) {
                d *= 2;
                if (d > 9) d -= 9;
            }
            sum += d;
            alt = !alt;
        }
        return sum % 10 === 0;
    }

    // SSN validation: reject invalid area/group/serial per SSA rules.
    function ssnValid(raw) {
        const s = onlyDigits(raw);
        if (s.length !== 9) return false;
        if (/^(\d)\1{8}$/.test(s)) return false; // all same digit
        const area = s.slice(0, 3);
        if (area === "000" || area === "666" || area[0] === "9") return false;
        if (s.slice(3, 5) === "00" || s.slice(5, 9) === "0000") return false;
        return true;
    }

    // Collect all regex matches with positions (for overlap dedup later).
    function collect(re, text) {
        const out = [];
        let m;
        while ((m = re.exec(text)) !== null) {
            out.push({
                start: m.index,
                end: m.index + m[0].length,
                value: m[0],
            });
            if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
        }
        return out;
    }

    const detectors = {
        email(text) {
            return collect(
                /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g,
                text,
            );
        },
        creditCard(text) {
            const found = collect(/(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g, text);
            return found.filter((f) => {
                const d = onlyDigits(f.value);
                return d.length >= 13 && d.length <= 19 && luhnValid(d);
            });
        },
        ssn(text) {
            const found = collect(
                /(?<!\d)\d{3}[- ]?\d{2}[- ]?\d{4}(?!\d)/g,
                text,
            );
            return found.filter((f) => ssnValid(f.value));
        },
        phone(text) {
            const found = collect(
                /(?<!\d)(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?!\d)/g,
                text,
            );
            return found.filter((f) => {
                const d = onlyDigits(f.value);
                return d.length >= 7 && d.length <= 15;
            });
        },
        address(text) {
            const re =
                /\b\d{1,6}\s+[A-Z][A-Za-z0-9'.-]*(?:\s+[A-Z][A-Za-z0-9'.-]*){0,4}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Way|Place|Pl\.?|Square|Sq\.?|Trail|Trl\.?|Parkway|Pkwy\.?|Circle|Cir\.?|Highway|Hwy\.?|Terrace|Ter\.?|Loop|Row|Run|Path)(?:\s+(?:Apt|Apartment|Suite|Ste|Unit|#)\.?\s*\w+)?\b/g;
            return collect(re, text);
        },
        // Known API key formats + labeled secrets (e.g. "api_key: xxxxx").
        apiKey(text) {
            const patterns = [
                /(?<![A-Z0-9])AKIA[0-9A-Z]{16}(?![A-Z0-9])/g, // AWS
                /(?<![A-Za-z0-9_])AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9_])/g, // Google
                /(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{36}(?![A-Za-z0-9_])/g, // GitHub
                /(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{82}(?![A-Za-z0-9_])/g, // GitHub fine-grained
                /(?<![A-Za-z0-9_])glpat-[A-Za-z0-9_-]{20}(?![A-Za-z0-9_])/g, // GitLab
                /(?<![A-Za-z0-9_-])xox[abp]-[0-9A-Za-z-]{10,}/g, // Slack
                /(?<![A-Za-z0-9_])(?:sk|rk)_live_[0-9a-zA-Z]{24,}(?![A-Za-z0-9_])/g, // Stripe
                /(?<![A-Za-z0-9_])sk-[A-Za-z0-9][A-Za-z0-9-]{19,}(?![A-Za-z0-9_-])/g, // OpenAI
                /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?![A-Za-z0-9_-])/g, // JWT
            ];
            let out = [];
            for (const re of patterns) out = out.concat(collect(re, text));
            // Labeled secrets: capture just the secret value, not the label prefix.
            const labeledRe =
                /(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret|bearer)\s*[:=]\s*["']?([A-Za-z0-9+/=_-]{16,})["']?/gi;
            let m;
            while ((m = labeledRe.exec(text)) !== null) {
                out.push({
                    start: m.index,
                    end: m.index + m[0].length,
                    value: m[1],
                });
                if (m.index === labeledRe.lastIndex) labeledRe.lastIndex++;
            }
            return out;
        },
        password(text) {
            const re =
                /\b(?:password|passwd|pwd|passphrase)\b\s*[:=]\s*["']?([^\s"']{4,})["']?/gi;
            const out = [];
            let m;
            while ((m = re.exec(text)) !== null) {
                out.push({
                    start: m.index,
                    end: m.index + m[0].length,
                    value: m[1],
                });
                if (m.index === re.lastIndex) re.lastIndex++;
            }
            return out;
        },
    };

    function overlaps(a, b) {
        return a.start < b.end && b.start < a.end;
    }

    // When multiple detectors match the same text range, keep the higher-priority one.
    // Order matters: creditCard > ssn > email > apiKey > password > phone > address.
    const PRIORITY = [
        "creditCard",
        "ssn",
        "email",
        "apiKey",
        "password",
        "phone",
        "address",
    ];

    function dedupe(byType) {
        const accepted = [];
        for (const type of PRIORITY) {
            for (const f of byType[type] || []) {
                if (accepted.some((a) => overlaps(f, a))) continue;
                accepted.push({
                    type,
                    start: f.start,
                    end: f.end,
                    value: f.value,
                });
            }
        }
        accepted.sort((a, b) => a.start - b.start);
        return accepted;
    }

    self.Asterisk.PII = {
        types: TYPES,
        // Scan text and return deduplicated findings, respecting per-type toggles.
        scan(text, enabledTypes) {
            if (!text || !text.trim()) return [];
            const enabled = enabledTypes || {};
            const byType = {};
            for (const t of TYPES) {
                if (enabled[t.id] === false) continue;
                byType[t.id] = detectors[t.id](text);
            }
            return dedupe(byType);
        },
        // Mask sensitive values for display in the warning dialog.
        mask(value) {
            const v = String(value || "");
            if (v.length <= 4) return "*".repeat(v.length);
            if (v.indexOf("@") !== -1) {
                const at = v.indexOf("@");
                const local = v.slice(0, at);
                const domain = v.slice(at + 1);
                const show = Math.max(1, Math.min(2, local.length - 2));
                return local.slice(0, show) + "***@" + domain;
            }
            return (
                v.slice(0, 2) +
                "*".repeat(Math.min(20, Math.max(3, v.length - 4))) +
                v.slice(-2)
            );
        },
        typeLabel(id) {
            const t = TYPES.find((x) => x.id === id);
            return t ? t.label : id;
        },
    };
})();
