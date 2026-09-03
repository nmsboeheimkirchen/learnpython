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
    let completionPending = false;
    let completionTimer = null;
    let completionGeneration = 0;

    function showNext(visible) {
        nextButton.hidden = false;
        nextButton.style.display = visible ? "inline-flex" : "none";
    }

    function cancelCompletion() {
        completionGeneration += 1;
        window.clearTimeout(completionTimer);
        completionTimer = null;
        completionPending = false;
        completionShown = false;
    }

    async function completeMission(result, meta = {}) {
        if (!result?.passed || completionShown || completionPending) return;
        if (meta.dirty || runtime.isCodeDirty()) {
            mission.lastValidationPassed = false;
            document.body.classList.remove("validation-passed");
            byId("validation-title").textContent = "Geänderten Code erneut starten";
            byId("validation-message").textContent = "Der erfolgreiche Lauf gehört zur vorherigen Codefassung. Starte deinen aktuellen Code noch einmal.";
            return;
        }
        const operationGeneration = completionGeneration;
        completionPending = true;
        const saved = await window.completeLevelProgress?.(
            "pixelmuseum_finale",
            meta.code || runtime.editor.getValue(),
            ["link-helicopter-escape", "link-helicopter-level1"]
        );
        if (operationGeneration !== completionGeneration) return;
        completionPending = false;
        if (!saved) return;
        completionShown = true;
        showNext(true);
        window.applyUnlocks?.();

        completionTimer = window.setTimeout(() => {
            if (operationGeneration !== completionGeneration || !completionShown) return;
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
    mission.onResult = async (result, meta) => {
        await previousOnResult?.(result, meta);
        await completeMission(result, meta);
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
