(() => {
    "use strict";

    const briefing = window.PixelmuseumBriefingCore;
    if (!briefing) throw new Error("Der Pixelmuseum-Briefingkern fehlt.");

    const state = briefing.createState();
    const byId = id => document.getElementById(id);
    const nextButton = byId("next-level-btn");
    let completionShown = false;

    function renderInventory(items) {
        const inventory = byId("briefing-inventory");
        inventory.replaceChildren();
        (items.length ? items : ["leer"]).forEach(item => {
            const chip = document.createElement("span");
            chip.textContent = item;
            inventory.appendChild(chip);
        });
    }

    function renderState() {
        const snapshot = state.snapshot();
        renderInventory(snapshot.collectedItems);
        byId("briefing-order-state").textContent = snapshot.testFragmentCollected
            ? "Kette vollständig"
            : (snapshot.accessCardCollected ? "Karte ✓ → Fragment" : "Karte → Fragment");
        byId("briefing-card-label").innerHTML = snapshot.accessCardCollected
            ? '<span aria-hidden="true">✓</span> Zugangskarte gesichert'
            : '<span aria-hidden="true">▣</span> Zugangskarte (−230, 70)';
        byId("briefing-fragment-label").innerHTML = snapshot.testFragmentCollected
            ? '<span aria-hidden="true">✓</span> Testfragment gesichert'
            : '<span aria-hidden="true">✦</span> Testfragment (−70, −75)';
        document.body.classList.toggle("museum-card-collected", snapshot.accessCardCollected);
        document.body.classList.toggle("museum-fragment-collected", snapshot.testFragmentCollected);
        return snapshot;
    }

    function exactInventoryOutput(output, items) {
        const expected = "BRIEFING-INVENTAR: " + items.join(",");
        return String(output).split(/\r?\n/).some(line => line.trim() === expected);
    }

    function validationResult(output) {
        const snapshot = state.snapshot();
        const outputPassed = exactInventoryOutput(output, snapshot.collectedItems) &&
            snapshot.accessCardCollected && snapshot.testFragmentCollected;
        const checks = [
            { label: "Zugangskarte durch echte Suche aufgenommen", passed: snapshot.accessCardCollected },
            { label: "Testfragment erst danach aufgenommen", passed: snapshot.testFragmentCollected },
            {
                label: "Fundreihenfolge Karte → Fragment eingehalten",
                passed: snapshot.collectionOrder.join("|") === `${briefing.ACCESS_CARD_ITEM}|${briefing.TEST_FRAGMENT_ITEM}`
            },
            { label: "Echtes Briefing-Inventar korrekt ausgegeben", passed: outputPassed }
        ];
        const passed = checks.every(check => check.passed);

        let message = "Suche zuerst die Zugangskarte und nimm genau den gefundenen Wert in dein Inventar auf.";
        if (snapshot.lastSearchFailure === briefing.FAILURES.ACCESS_CARD_REQUIRED) {
            message = "Das Testfragment bleibt gesperrt, bis die echte Zugangskarte im Inventar liegt.";
        } else if (snapshot.lastSearchFailure === briefing.FAILURES.PENDING_EXPIRED) {
            message = "Der Fund wurde nicht aufgenommen, bevor die Drohne den Fundort verlassen hat.";
        } else if (snapshot.accessCardCollected && !snapshot.testFragmentCollected) {
            message = "Die Zugangskarte stimmt. Sichere jetzt das Testfragment mit einer zweiten echten Suche.";
        } else if (snapshot.testFragmentCollected && !outputPassed) {
            message = "Beide Funde sind echt. Erzeuge jetzt die geforderte BRIEFING-INVENTAR-Zeile aus deiner Liste.";
        } else if (passed) {
            message = "Die Fundkette stimmt. Im Finale entscheidest du selbst zwischen Alarmhack und schneller Flucht.";
        }

        return {
            passed,
            levelComplete: passed,
            title: passed ? "Briefing abgeschlossen" : "Inventarkette weiterbauen",
            message,
            status: passed ? "Bereit fürs Pixelmuseum" : "Fundkette prüfen",
            statusState: passed ? "success" : "warning",
            checks
        };
    }

    function showNext(visible) {
        nextButton.hidden = false;
        nextButton.style.display = visible ? "inline-flex" : "none";
    }

    function onResult(result) {
        showNext(Boolean(result.passed));
        const stageMessage = byId("briefing-stage-message");
        stageMessage.textContent = result.passed ? "BRIEFING BEREIT" : "";
        if (!result.passed || result.restored || completionShown) return;

        completionShown = true;
        window.triggerSuccess?.(false, "Die echte Fundkette sitzt. Jetzt beginnt deine offene Mission.", {
            title: "BRIEFING GESCHAFFT",
            rewardCount: 3,
            celebration: "coins",
            closeLabel: "Zurück zum Editor",
            primaryHref: "pixelmuseum_finale.html",
            primaryLabel: "Zum Pixelmuseum",
            statusLabel: "BRIEFING GESCHAFFT!"
        });
    }

    function restoreCompleteState() {
        const inventory = [];
        const card = state.searchHere(briefing.ACCESS_CARD, inventory);
        inventory.push(card);
        state.syncInventory(inventory);
        const fragment = state.searchHere(briefing.TEST_FRAGMENT, inventory);
        inventory.push(fragment);
        state.syncInventory(inventory);
        renderState();
    }

    window.DRONE_MISSION_CONFIG = {
        levelId: "pixelmuseum_briefing",
        targetId: "museum-briefing-turtle",
        runningLabel: "Drohne durchsucht den Archiv-Vorraum",
        runLabel: "Briefing testen",
        readyLabel: "Bereit zum Planen",
        resetLabel: "↺ Briefing-Code laden",
        resetOutput: "Der Archiv-Vorraum wartet auf deine Drohne.",
        initialMessage: "Finde beide Gegenstände in der richtigen Reihenfolge und gib dein echtes Inventar aus.",
        initialChecks: [
            "Zugangskarte durch echte Suche aufnehmen",
            "Testfragment erst danach aufnehmen",
            "Fundreihenfolge einhalten",
            "Echtes Briefing-Inventar ausgeben"
        ],
        defaultCode: byId("python-editor").value,
        unlocks: ["link-museum-finale"],
        droneApi: {
            suche_hier(context) {
                const item = state.searchHere(context, context.getGlobal("inventar"));
                renderState();
                return item;
            }
        },
        resetHud() {
            state.reset();
            completionShown = false;
            showNext(false);
            byId("briefing-stage-message").textContent = "";
            renderState();
        },
        syncPythonState(context) {
            const collected = state.syncInventory(context.getGlobal("inventar"));
            renderState();
            return collected ? { inventoryChanged: true } : null;
        },
        onTurtleFrame(point) {
            state.recordFrame(point);
            renderState();
            return null;
        },
        getRunNotice() {
            const snapshot = state.snapshot();
            if (snapshot.testFragmentCollected) return "Zugangskarte und Testfragment wurden in der richtigen Reihenfolge gesichert.";
            if (snapshot.accessCardCollected) return "Zugangskarte gesichert. Das Testfragment ist jetzt freigegeben.";
            if (snapshot.lastSearchFailure === briefing.FAILURES.ACCESS_CARD_REQUIRED) return "Das Testfragment reagiert erst auf eine echte Zugangskarte.";
            if (snapshot.searchAttempted) return "An dieser Stelle wurde kein freigegebener Fund aufgenommen.";
            return "Programm beendet – die Drohne hat noch keinen Gegenstand untersucht.";
        },
        validate(_code, output) {
            return validationResult(output);
        },
        onResult,
        restoreCompletedState: restoreCompleteState,
        getRestoredResult() {
            return {
                ...validationResult(`BRIEFING-INVENTAR: ${briefing.ACCESS_CARD_ITEM},${briefing.TEST_FRAGMENT_ITEM}`),
                restored: true,
                message: "Dein erfolgreiches Briefing wurde wiederhergestellt. Du kannst direkt ins Pixelmuseum weitergehen."
            };
        },
        getState: () => state.snapshot()
    };

    window.PixelmuseumBriefingPath = Object.freeze({
        getState: () => state.snapshot()
    });
})();
