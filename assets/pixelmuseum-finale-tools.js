(() => {
    "use strict";

    const helperCode = 'def alarm_hacken(code):\n    print("ALARM_HACK|" + code)';
    const copyButton = document.getElementById("copy-alarm-helper");
    const copyStatus = document.getElementById("copy-alarm-status");
    const hintButton = document.getElementById("alarm-help-btn");
    const hintPanel = document.getElementById("alarm-help-panel");
    const hintLevelLabel = document.getElementById("alarm-help-level");
    const hintMessage = document.getElementById("alarm-help-message");
    const hints = Object.freeze([
        "code ist nur der Platzhalter! Du musst ein Passwort unter Anführungszeichen eingeben.",
        "Suche das Passwort im Quelltext der Seite!"
    ]);
    let hintLevel = 0;

    function requestAlarmHint() {
        if (!hintButton || !hintPanel || !hintLevelLabel || !hintMessage) return false;
        hintLevel = Math.min(hintLevel + 1, hints.length);
        hintPanel.hidden = false;
        hintLevelLabel.textContent = `Hinweis ${hintLevel} von ${hints.length}`;
        hintMessage.textContent = hints[hintLevel - 1];
        hintButton.textContent = hintLevel < hints.length ? "Nächsten Hinweis anfordern" : "Hinweise vollständig angezeigt";
        hintButton.disabled = hintLevel === hints.length;
        return true;
    }

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
    hintButton?.addEventListener("click", requestAlarmHint);

    window.PixelmuseumFinaleTools = Object.freeze({
        ALARM_HELPER: helperCode,
        copyAlarmHelper,
        requestAlarmHint
    });
})();
