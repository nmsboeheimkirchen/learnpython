(() => {
    "use strict";

    const helperCode = 'def alarm_hacken(code):\n    print("ALARM_HACK|" + code)';
    const copyButton = document.getElementById("copy-alarm-helper");
    const copyStatus = document.getElementById("copy-alarm-status");

    async function writeToClipboard(text) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const fallback = document.createElement("textarea");
        fallback.value = text;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        const copied = document.execCommand?.("copy");
        fallback.remove();
        if (!copied) throw new Error("Kopieren nicht unterstützt");
    }

    async function copyAlarmHelper() {
        if (!copyButton || !copyStatus) return false;
        try {
            await writeToClipboard(helperCode);
            copyStatus.textContent = "Funktion kopiert – füge sie jetzt in deinen Code ein.";
            copyButton.textContent = "Kopiert ✓";
            return true;
        } catch (_error) {
            copyStatus.textContent = "Markiere den Code und kopiere ihn mit Strg/Cmd + C.";
            return false;
        }
    }

    copyButton?.addEventListener("click", copyAlarmHelper);

    window.PixelmuseumFinaleTools = Object.freeze({
        ALARM_HELPER: helperCode,
        copyAlarmHelper
    });
})();
