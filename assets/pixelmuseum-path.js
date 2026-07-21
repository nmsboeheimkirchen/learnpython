(() => {
    "use strict";

    const helpCore = window.PixelmuseumHelpCore;
    const runtime = window.finalePrototype;
    const mission = window.FINALE_CONFIG;
    if (!helpCore || !runtime || !mission) {
        throw new Error("Der produktive Pixelmuseum-Pfad ist nicht vollständig geladen.");
    }

    const STORAGE_KEY = "pixelmuseumHelp_v1";
    const byId = id => document.getElementById(id);
    const helpButton = byId("museum-help-btn");
    const helpCount = byId("museum-help-count");
    const helpPanel = byId("museum-help-panel");
    const helpTitle = byId("museum-help-title");
    const helpMessage = byId("museum-help-message");
    const helpLevel = byId("museum-help-level");
    const helpDetail = byId("museum-help-detail");
    const nextButton = byId("next-level-btn");
    let helpProgress = loadHelpProgress();
    let completionShown = false;
    let completionTimer = null;

    function safeStorageGet() {
        try {
            return window.localStorage?.getItem(STORAGE_KEY) ?? null;
        } catch (_error) {
            return null;
        }
    }

    function safeStorageSet(progress) {
        try {
            window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch (_error) {
            // Die Mission bleibt auch bei blockierter Browserspeicherung vollständig spielbar.
        }
    }

    function loadHelpProgress() {
        return helpCore.normalizeProgress(safeStorageGet());
    }

    function countLabel(count) {
        return `Zentrale kontaktiert: ${count}-mal`;
    }

    function renderHelpCount() {
        helpCount.textContent = countLabel(helpProgress.count);
        helpCount.dataset.helpCount = String(helpProgress.count);
    }

    function currentHelpContext() {
        return {
            running: runtime.isRunning(),
            hasRun: runtime.hasRun(),
            dirty: runtime.isCodeDirty(),
            lastError: runtime.getLastError(),
            runtimeInventory: Array.isArray(mission.runtimeInventory) ? [...mission.runtimeInventory] : [],
            lastSearchFailure: mission.lastSearchFailure,
            artifactBeforeKeycard: Boolean(
                mission.artifactSearchAttempted && !mission.runtimeInventory?.includes("Schlüsselkarte")
            ),
            artifactSecured: Boolean(mission.artifactSecured),
            lastHackFailure: mission.lastHackFailure,
            hackRequested: Boolean(mission.hackRequested),
            hackCompleted: Boolean(mission.hackCompleted),
            alarmDisabled: Boolean(mission.alarmDisabled),
            alarmFailed: Boolean(mission.alarmFailed),
            portalReached: Boolean(mission.portalReached),
            portalOpen: Boolean(mission.portalOpen),
            portalTrapped: Boolean(mission.portalTrapped),
            escaped: Boolean(mission.escaped),
            exitUnlocked: Boolean(mission.exitUnlocked),
            inventoryOutputPassed: Boolean(mission.inventoryOutputPassed)
        };
    }

    function hideHelpPanel() {
        helpPanel.hidden = true;
        helpButton.setAttribute("aria-expanded", "false");
    }

    function renderHelp(result) {
        const { issue, level, hint } = result;
        if (!issue) return;
        helpPanel.hidden = false;
        helpPanel.dataset.helpIssue = issue.id;
        helpButton.setAttribute("aria-expanded", "true");
        helpTitle.textContent = issue.title;
        helpMessage.textContent = hint;
        helpLevel.textContent = issue.countable ? `Hilfe ${level} von ${helpCore.MAX_HELP_LEVEL}` : "Systemhinweis";
        const detail = issue.detail?.trim?.() || "";
        helpDetail.hidden = !detail;
        helpDetail.textContent = detail;
    }

    function requestHelp() {
        const issue = helpCore.resolveIssue(currentHelpContext());
        const result = helpCore.reveal(helpProgress, issue.id);
        helpProgress = result.progress;
        if (result.counted) safeStorageSet(helpProgress);
        renderHelpCount();
        renderHelp({ ...result, issue: result.issue || issue });
    }

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
        helpButton.disabled = true;
        window.saveCompletedLevelCode?.("pixelmuseum_finale", meta.code || runtime.editor.getValue());
        window.unlockLevel?.("link-helicopter-escape");

        const helpSummary = countLabel(helpProgress.count);
        completionTimer = window.setTimeout(() => {
            completionTimer = null;
            window.triggerSuccess?.(true, `Das Sternenfragment ist gesichert. ${helpSummary}.`, {
                title: "PIXELMUSEUM GESCHAFFT",
                rewardCount: 3,
                celebration: "coins",
                closeLabel: "Zurück zum Editor",
                primaryHref: "helikopter_flucht-b.html",
                primaryLabel: "Zur Flucht mit dem Helikopter",
                statusLabel: "PIXELMUSEUM GESCHAFFT!"
            });
        }, 1000);
    }

    const previousOnResult = mission.onResult;
    mission.onResult = (result, meta) => {
        previousOnResult?.(result, meta);
        completeMission(result, meta);
    };

    helpButton.addEventListener("click", requestHelp);
    document.addEventListener("finale:running", event => {
        const isRunning = Boolean(event.detail?.running);
        helpButton.disabled = isRunning || Boolean(mission.lastValidationPassed);
        if (isRunning) {
            cancelCompletion();
            showNext(false);
            hideHelpPanel();
        }
    });
    document.addEventListener("finale:codechange", event => {
        if (event.detail?.dirty) hideHelpPanel();
    });
    document.addEventListener("finale:reset", () => {
        cancelCompletion();
        showNext(false);
        helpButton.disabled = false;
        hideHelpPanel();
    });

    renderHelpCount();
    showNext(false);

    const restored = window.restoreCompletedLevelCode?.("pixelmuseum_finale");
    if (restored) {
        showNext(true);
        byId("status-text").textContent = "Mission bereits geschafft";
    }

    window.PixelmuseumPath = Object.freeze({
        getHelpContext: currentHelpContext,
        getHelpProgress: () => helpCore.normalizeProgress(helpProgress),
        requestHelp
    });
})();
