(() => {
    "use strict";

    const runtime = window.finalePrototype;
    const mission = window.FINALE_CONFIG;
    if (!runtime || !mission) {
        throw new Error("Der produktive Pixelmuseum-Pfad ist nicht vollständig geladen.");
    }

    const byId = id => document.getElementById(id);
    const nextButton = byId("next-level-btn");
    let completionShown = false;
    let completionTimer = null;

    function showNext(visible) {
        nextButton.hidden = false;
        nextButton.style.display = visible ? "inline-flex" : "none";
    }

    function cancelCompletion() {
        window.clearTimeout(completionTimer);
        completionTimer = null;
        completionShown = false;
    }

    function completeMission(result, meta = {}) {
        if (!result?.passed || completionShown) return;
        if (meta.dirty || runtime.isCodeDirty()) {
            mission.lastValidationPassed = false;
            document.body.classList.remove("validation-passed");
            byId("validation-title").textContent = "Geänderten Code erneut starten";
            byId("validation-message").textContent = "Der erfolgreiche Lauf gehört zur vorherigen Codefassung. Starte deinen aktuellen Code noch einmal.";
            return;
        }
        completionShown = true;
        showNext(true);
        window.saveCompletedLevelCode?.("pixelmuseum_finale", meta.code || runtime.editor.getValue());
        window.unlockLevel?.("link-helicopter-escape");

        completionTimer = window.setTimeout(() => {
            completionTimer = null;
            window.triggerSuccess?.(true, "Das Sternenfragment ist gesichert.", {
                title: "PIXELMUSEUM GESCHAFFT",
                rewardCount: 3,
                celebration: "coins",
                closeLabel: "Zurück zum Editor",
                primaryHref: "helikopter_flucht.html",
                primaryLabel: "Zur Flucht mit dem Helikopter",
                statusLabel: "PIXELMUSEUM GESCHAFFT!"
            });
        }, window.SUCCESS_POPUP_DELAY_MS ?? 4000);
    }

    const previousOnResult = mission.onResult;
    mission.onResult = (result, meta) => {
        previousOnResult?.(result, meta);
        completeMission(result, meta);
    };

    document.addEventListener("finale:running", event => {
        const isRunning = Boolean(event.detail?.running);
        if (isRunning) {
            cancelCompletion();
            showNext(false);
        }
    });
    document.addEventListener("finale:reset", () => {
        cancelCompletion();
        showNext(false);
    });

    showNext(false);

    const restored = window.getCompletedLevelCode?.("pixelmuseum_finale") !== null;
    if (restored) {
        showNext(true);
        byId("status-text").textContent = "Mission bereits geschafft";
    }

    window.PixelmuseumPath = Object.freeze({});
})();
