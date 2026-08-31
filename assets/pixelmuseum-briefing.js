(() => {
    "use strict";

    const briefing = window.PixelmuseumBriefingCore;
    if (!briefing) throw new Error("Der Pixelmuseum-Briefingkern fehlt.");

    const state = briefing.createState();
    const byId = id => document.getElementById(id);
    const nextButton = byId("next-level-btn");
    let completionShown = false;
    let completionTimer = null;

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
        byId("briefing-order-state").textContent = snapshot.starFragmentCollected
            ? "Kette vollständig"
            : (snapshot.keycardCollected ? "Karte ✓ → Fragment" : "Karte → Fragment");
        byId("briefing-card-label").innerHTML = snapshot.keycardCollected
            ? '<span aria-hidden="true">✓</span> Schlüsselkarte gesichert'
            : '<span aria-hidden="true">▣</span> Schlüsselkarte (-250, 60)';
        byId("briefing-fragment-label").innerHTML = snapshot.starFragmentCollected
            ? '<span aria-hidden="true">✓</span> Sternenfragment gesichert'
            : '<span aria-hidden="true">✦</span> Sternenfragment (-390, 45)';
        document.body.classList.toggle("museum-card-collected", snapshot.keycardCollected);
        document.body.classList.toggle("museum-fragment-collected", snapshot.starFragmentCollected);
        return snapshot;
    }

    function exactInventoryOutput(output, items) {
        const expected = "INVENTARLISTE: " + items.join(",");
        return String(output).split(/\r?\n/).some(line => line.trim() === expected);
    }

    function validationResult(output) {
        const snapshot = state.snapshot();
        const outputPassed = exactInventoryOutput(output, snapshot.collectedItems) &&
            snapshot.keycardCollected && snapshot.starFragmentCollected;
        const checks = [
            { label: "Schlüsselkarte mit suche_hier() gefunden", passed: snapshot.keycardCollected },
            { label: "Sternenfragment erst danach aufgenommen", passed: snapshot.starFragmentCollected },
            {
                label: "Fundreihenfolge Karte → Fragment eingehalten",
                passed: snapshot.collectionOrder.join("|") === `${briefing.KEYCARD_ITEM}|${briefing.STAR_FRAGMENT_ITEM}`
            },
            { label: "Inventarliste korrekt ausgegeben", passed: outputPassed }
        ];
        const passed = checks.every(check => check.passed);

        let message = "Suche zuerst die Schlüsselkarte und nimm genau den Rückgabewert in dein Inventar auf.";
        if (snapshot.lastSearchFailure === briefing.FAILURES.KEYCARD_REQUIRED) {
            message = "Das Sternenfragment bleibt gesperrt, bis die Schlüsselkarte im Inventar liegt.";
        } else if (snapshot.keycardCollected && !snapshot.starFragmentCollected) {
            message = "Die Schlüsselkarte stimmt. Finde jetzt das Sternenfragment mit suche_hier().";
        } else if (snapshot.starFragmentCollected && !outputPassed) {
            message = "Beide Gegenstände sind gefunden. Erzeuge jetzt die geforderte INVENTARLISTE-Zeile aus deiner Liste.";
        } else if (passed) {
            message = "Die Fundkette stimmt. Übernimm deinen Code ins Finale und entkomme durch das Portal – mit Alarmhack oder vor der Verriegelung.";
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
        completionTimer = window.setTimeout(() => {
            completionTimer = null;
            window.triggerSuccess?.(false, "Die Reihenfolge stimmt. Jetzt beginnt deine offene Mission.", {
                title: "BRIEFING GESCHAFFT",
                rewardCount: 3,
                celebration: "coins",
                closeLabel: "Zurück zum Editor",
                primaryHref: "pixelmuseum_finale.html",
                primaryLabel: "Zum Pixelmuseum",
                statusLabel: "BRIEFING GESCHAFFT!"
            });
        }, window.SUCCESS_POPUP_DELAY_MS ?? 4000);
    }

    function restoreCompleteState() {
        const inventory = [];
        const card = state.searchHere(briefing.KEYCARD, inventory);
        inventory.push(card);
        state.syncInventory(inventory);
        const fragment = state.searchHere(briefing.STAR_FRAGMENT, inventory);
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
        initialMessage: "Finde beide Gegenstände nach den Weltregeln und gib deine Inventarliste aus.",
        initialChecks: [
            "Schlüsselkarte mit suche_hier() finden",
            "Sternenfragment erst danach aufnehmen",
            "Fundreihenfolge einhalten",
            "Inventarliste ausgeben"
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
            if (completionTimer !== null) {
                window.clearTimeout(completionTimer);
                completionTimer = null;
            }
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
            if (snapshot.starFragmentCollected) return "Schlüsselkarte und Sternenfragment wurden in der richtigen Reihenfolge gesichert.";
            if (snapshot.keycardCollected) return "Schlüsselkarte gesichert. Das Sternenfragment ist jetzt freigegeben.";
            if (snapshot.lastSearchFailure === briefing.FAILURES.KEYCARD_REQUIRED) return "Das Sternenfragment reagiert erst, wenn die Schlüsselkarte im Inventar liegt.";
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
                ...validationResult(`INVENTARLISTE: ${briefing.KEYCARD_ITEM},${briefing.STAR_FRAGMENT_ITEM}`),
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
