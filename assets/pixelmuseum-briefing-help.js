(() => {
    "use strict";

    const helpCore = window.PixelmuseumHelpCore;
    const runtime = window.DroneMissionRuntime;
    if (!helpCore || !runtime) {
        throw new Error("Die Zentralenhilfe für das Pixelmuseum-Briefing ist nicht vollständig geladen.");
    }

    const learningData = window.AgentLearningData;
    if (!learningData) {
        throw new Error("Die Lernstands-Speicherung für die Pixelmuseum-Hilfe fehlt.");
    }

    const byId = id => document.getElementById(id);
    const helpButton = byId("museum-help-btn");
    const helpCount = byId("museum-help-count");
    const helpPanel = byId("museum-help-panel");
    const helpTitle = byId("museum-help-title");
    const helpMessage = byId("museum-help-message");
    const helpLevel = byId("museum-help-level");
    const helpDetail = byId("museum-help-detail");
    let helpProgress = loadHelpProgress();

    function loadHelpProgress() {
        return helpCore.normalizeProgress(learningData.getFeatureProgress("pixelmuseum"));
    }

    function countLabel(count) {
        return `Zentrale kontaktiert: ${count}-mal`;
    }

    function renderHelpCount() {
        helpCount.textContent = countLabel(helpProgress.count);
        helpCount.dataset.helpCount = String(helpProgress.count);
    }

    function inventoryOutputPassed(inventory) {
        if (document.body.classList.contains("mission-passed")) return true;
        const expected = "INVENTARLISTE: " + inventory.join(",");
        return runtime.getOutput().split(/\r?\n/).some(line => line.trim() === expected);
    }

    function currentHelpContext() {
        const state = runtime.getState() || {};
        const inventory = Array.isArray(state.collectedItems) ? [...state.collectedItems] : [];
        return {
            stage: "briefing",
            running: runtime.isRunning(),
            hasRun: runtime.hasRun() || document.body.classList.contains("mission-passed"),
            dirty: runtime.isCodeDirty(),
            lastError: runtime.getLastError(),
            runtimeInventory: inventory,
            pendingItem: state.pendingItem,
            searchFound: Boolean(state.searchFound),
            lastSearchFailure: state.lastSearchFailure,
            artifactBeforeKeycard: state.lastSearchFailure === "KEYCARD_REQUIRED",
            artifactSecured: Boolean(state.starFragmentCollected),
            inventoryOutputPassed: inventoryOutputPassed(inventory)
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

    async function requestHelp() {
        const issue = helpCore.resolveIssue(currentHelpContext());
        const result = helpCore.reveal(helpProgress, issue.id);
        helpProgress = result.progress;
        if (result.counted) await learningData.setFeatureProgress("pixelmuseum", helpProgress);
        renderHelpCount();
        renderHelp({ ...result, issue: result.issue || issue });
    }

    helpButton.addEventListener("click", requestHelp);
    document.addEventListener("drone:running", event => {
        const isRunning = Boolean(event.detail?.running);
        helpButton.disabled = isRunning;
        if (isRunning) hideHelpPanel();
    });
    document.addEventListener("drone:codechange", event => {
        if (event.detail?.dirty) hideHelpPanel();
    });
    document.addEventListener("drone:reset", hideHelpPanel);

    renderHelpCount();

    window.PixelmuseumBriefingHelp = Object.freeze({
        getHelpContext: currentHelpContext,
        getHelpProgress: () => helpCore.normalizeProgress(helpProgress),
        requestHelp
    });
})();
