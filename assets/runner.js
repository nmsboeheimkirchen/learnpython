// --- SIDEBAR & PROGRESS LOGIC ---

const PROGRESS_STORAGE_KEY = "unlockedLevels_v2";
const COMPLETED_CODE_STORAGE_KEY = "completedLevelCode_v1";
const TEACHER_MODE_STORAGE_KEY = "cheatMode";
const SUCCESS_POPUP_DELAY_MS = 2000;
const DEFAULT_UNLOCKED_LEVELS = Object.freeze(["link-level1"]);
const LEVEL_ROUTES = Object.freeze({
    "link-level1": "mission1_level1.html",
    "link-level2": "mission1_level2.html",
    "link-level3": "mission1_level3.html",
    "link-m2-title": "mission2_start.html",
    "link-m2-l1": "mission2_level1.html",
    "link-m2-l2": "mission2_level2.html",
    "link-m2-l3": "mission2_level3.html",
    "link-m3-title": "mission3_start.html",
    "link-m3-l1": "mission3_level1.html",
    "link-m3-l2": "mission3_level2.html",
    "link-m3-l3": "mission3_level3.html",
    "link-m4-title": "mission4_start.html",
    "link-m4-l1": "mission4_level1.html",
    "link-m4-l2": "mission4_level2.html",
    "link-m4-l3": "mission4_level3.html",
    "link-agent-training-title": "agent_training_start.html",
    "link-agent-training-l1": "agent_training_level1.html",
    "link-agent-training-l2": "agent_training_level2.html",
    "link-agent-training-l3": "agent_training_level3.html",
    "link-project-choice": "projektwahl.html",
    "link-pico-title": "pico_level1.html",
    "link-pico-l1": "pico_level1.html",
    "link-pico-l2": "pico_level2.html",
    "link-pico-l2a": "pico_level2a.html",
    "link-pico-l3": "pico_level3.html",
    "link-pico-l4": "pico_level4.html",
    "link-museum-title": "pixelmuseum_briefing.html",
    "link-museum-briefing": "pixelmuseum_briefing.html",
    "link-museum-finale": "pixelmuseum_finale.html",
    "link-helicopter-escape": "helikopter_flucht-b.html"
});

function canonicalPageHref(href) {
    return href === "helikopter_flucht.html"
        ? LEVEL_ROUTES["link-helicopter-escape"]
        : href;
}

function safeStorageGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (_error) {
        return null;
    }
}

function safeStorageSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (_error) {
        return false;
    }
}

function safeStorageRemoveItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (_error) {
        return false;
    }
}

function normalizeUnlockedLevels(value) {
    const candidates = Array.isArray(value) ? value : [];
    const normalized = [...new Set(candidates.filter(levelId =>
        typeof levelId === "string" &&
        Object.prototype.hasOwnProperty.call(LEVEL_ROUTES, levelId)
    ))];

    if (!normalized.includes("link-level1")) {
        normalized.unshift("link-level1");
    }
    return normalized;
}

function readUnlockedLevels() {
    const storedValue = safeStorageGetItem(PROGRESS_STORAGE_KEY);
    if (!storedValue) {
        return [...DEFAULT_UNLOCKED_LEVELS];
    }

    try {
        const parsedValue = JSON.parse(storedValue);
        const normalized = normalizeUnlockedLevels(parsedValue);
        if (JSON.stringify(parsedValue) !== JSON.stringify(normalized)) {
            safeStorageSetItem(PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
        }
        return normalized;
    } catch (_error) {
        safeStorageRemoveItem(PROGRESS_STORAGE_KEY);
        return [...DEFAULT_UNLOCKED_LEVELS];
    }
}

function normalizeCompletedLevelCode(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const normalized = {};
    Object.entries(value).forEach(([levelId, code]) => {
        if (
            Object.prototype.hasOwnProperty.call(LEVEL_OUTCOMES, levelId) &&
            typeof code === "string"
        ) {
            normalized[levelId] = code;
        }
    });
    return normalized;
}

function readCompletedLevelCode() {
    const storedValue = safeStorageGetItem(COMPLETED_CODE_STORAGE_KEY);
    if (!storedValue) {
        return {};
    }

    try {
        const parsedValue = JSON.parse(storedValue);
        const normalized = normalizeCompletedLevelCode(parsedValue);
        if (JSON.stringify(parsedValue) !== JSON.stringify(normalized)) {
            safeStorageSetItem(COMPLETED_CODE_STORAGE_KEY, JSON.stringify(normalized));
        }
        return normalized;
    } catch (_error) {
        safeStorageRemoveItem(COMPLETED_CODE_STORAGE_KEY);
        return {};
    }
}

function saveCompletedLevelCode(levelId, code) {
    if (
        !Object.prototype.hasOwnProperty.call(LEVEL_OUTCOMES, levelId) ||
        typeof code !== "string"
    ) {
        return false;
    }

    const completedCode = readCompletedLevelCode();
    completedCode[levelId] = code;
    return safeStorageSetItem(COMPLETED_CODE_STORAGE_KEY, JSON.stringify(completedCode));
}

function getCompletedLevelCode(levelId) {
    const completedCode = readCompletedLevelCode();
    return Object.prototype.hasOwnProperty.call(completedCode, levelId)
        ? completedCode[levelId]
        : null;
}

function restoreCompletedLevelCode(levelId) {
    const savedCode = levelId === "mission1_level3"
        ? (getCompletedLevelCode("mission1_level4") ?? getCompletedLevelCode(levelId))
        : getCompletedLevelCode(levelId);
    if (
        savedCode === null ||
        !window.editor ||
        typeof window.editor.setValue !== "function"
    ) {
        return false;
    }

    let migratedCode = /^agent_training_level[123]$/.test(levelId)
        ? savedCode.replace(/\bagent\b/g, "drohne")
        : savedCode;
    if (levelId === "mission1_level3") {
        migratedCode = migratedCode
            .replace(/\bagent_name\b/g, "name")
            .replace(/Gib deinen Namen ein:\s*/g, "Wie heißt du? ")
            .replace(/Name:\s*/g, "Wie heißt du? ");
        if (!/print\s*\(\s*["']Willkommen im System,?["']\s*,\s*name\s*\)/.test(migratedCode)) {
            migratedCode = migratedCode.replace(/\s+$/, "") + '\nprint("Willkommen im System,", name)';
        }
    }
    if (migratedCode !== savedCode) saveCompletedLevelCode(levelId, migratedCode);
    window.editor.setValue(migratedCode);
    return true;
}

function addMission4FinaleBonuses(source) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");

    if (!lines.some(line => /^\s*geheimtext\s*=/.test(line))) {
        const messageLine = lines.findIndex(line => /^\s*nachricht\s*=/.test(line));
        const insertAt = messageLine >= 0 ? messageLine + 1 : 0;
        lines.splice(insertAt, 0, 'geheimtext = ""  # Startbonus');
    }

    if (!lines.some(line => /^\s*print\s*\(\s*geheimtext\s*\)/.test(line))) {
        let insertAt = lines.length;
        while (insertAt > 0 && lines[insertAt - 1] === "") {
            insertAt -= 1;
        }
        lines.splice(insertAt, 0, "", "print(geheimtext)  # Startbonus");
    }

    return lines.join("\n");
}

function buildInheritedLevelCode(levelId) {
    const inheritance = LEVEL_CODE_INHERITANCE[levelId];
    if (!inheritance) {
        return null;
    }

    const sourceLevels = Array.isArray(inheritance.from)
        ? inheritance.from
        : [inheritance.from];
    const previousCode = sourceLevels
        .map(getCompletedLevelCode)
        .find(code => code !== null) ?? null;
    if (previousCode === null) {
        return null;
    }

    return typeof inheritance.prepare === "function"
        ? inheritance.prepare(previousCode)
        : previousCode;
}

function restoreLevelCode(levelId) {
    if (restoreCompletedLevelCode(levelId)) {
        return true;
    }

    const inheritedCode = buildInheritedLevelCode(levelId);
    if (
        inheritedCode === null ||
        !window.editor ||
        typeof window.editor.setValue !== "function"
    ) {
        return false;
    }

    window.editor.setValue(inheritedCode);
    return true;
}

function clearProgress() {
    safeStorageRemoveItem(PROGRESS_STORAGE_KEY);
    safeStorageRemoveItem(COMPLETED_CODE_STORAGE_KEY);
    safeStorageRemoveItem(TEACHER_MODE_STORAGE_KEY);
    safeStorageRemoveItem("pixelmuseumHelp_v1");
    safeStorageRemoveItem("sidebarState");
}

function setNavOpen(open, returnFocus = true) {
    const sidebar = document.getElementById("mySidebar");
    const menuButton = document.getElementById("menu-btn");
    if (!sidebar || !menuButton) return false;

    if (open) {
        if (!sidebar.open && typeof sidebar.showModal === "function") sidebar.showModal();
        document.body.classList.add("navigation-open");
        menuButton.setAttribute("aria-expanded", "true");
        menuButton.setAttribute("aria-label", "Lernpfad schließen");
        document.getElementById("navigation-close-btn")?.focus();
        return true;
    }

    if (sidebar.open && typeof sidebar.close === "function") sidebar.close();
    document.body.classList.remove("navigation-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Lernpfad öffnen");
    if (returnFocus) menuButton.focus();
    return true;
}

function toggleNav() {
    const sidebar = document.getElementById("mySidebar");
    return setNavOpen(!sidebar?.open);
}

function unlockLevel(levelId) {
    if (!Object.prototype.hasOwnProperty.call(LEVEL_ROUTES, levelId)) {
        return false;
    }

    const unlockedLevels = readUnlockedLevels();
    if (!unlockedLevels.includes(levelId)) {
        unlockedLevels.push(levelId);
        safeStorageSetItem(PROGRESS_STORAGE_KEY, JSON.stringify(unlockedLevels));
    }
    applyUnlocks();
    return true;
}

function unlockLink(levelId) {
    const link = document.getElementById(levelId);
    if (!link) {
        return;
    }

    link.classList.remove("locked");
    const lockBadge = link.querySelector?.(".nav-lock");
    if (lockBadge && typeof lockBadge.remove === "function") lockBadge.remove();
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
    link.href = LEVEL_ROUTES[levelId];
}

function applyUnlocks() {
    if (window.location.hash === "#reset") {
        clearProgress();
        if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } else {
            window.location.hash = "";
        }
    }

    const unlockedLevels = readUnlockedLevels();
    const completedLevelCode = readCompletedLevelCode();
    let restoredUnlock = false;
    Object.keys(completedLevelCode).forEach(levelId => {
        const outcome = LEVEL_OUTCOMES[levelId];
        outcome?.unlocks?.forEach(unlockId => {
            if (!unlockedLevels.includes(unlockId)) {
                unlockedLevels.push(unlockId);
                restoredUnlock = true;
            }
        });
    });
    if (restoredUnlock) {
        safeStorageSetItem(PROGRESS_STORAGE_KEY, JSON.stringify(unlockedLevels));
    }

    if (window.location.hash === "#l") {
        safeStorageSetItem(TEACHER_MODE_STORAGE_KEY, "true");
    }

    const levelsToUnlock = safeStorageGetItem(TEACHER_MODE_STORAGE_KEY) === "true"
        ? Object.keys(LEVEL_ROUTES)
        : unlockedLevels;
    levelsToUnlock.forEach(unlockLink);

    // Update listeners for newly unlocked links
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.removeEventListener('click', preventLockedClick); // remove old listener
        if (link.classList.contains('locked')) {
            link.addEventListener('click', preventLockedClick);
        }
    });
}

function preventLockedClick(e) {
    e.preventDefault();
}

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById("mySidebar");
    const menuButton = document.getElementById("menu-btn");
    const closeButton = document.getElementById("navigation-close-btn");
    menuButton?.addEventListener("click", toggleNav);
    closeButton?.addEventListener("click", () => setNavOpen(false));
    sidebar?.addEventListener("cancel", event => {
        event.preventDefault();
        setNavOpen(false);
    });
    sidebar?.addEventListener("click", event => {
        if (event.target === sidebar) setNavOpen(false);
    });

    document.querySelectorAll(".tooltip, .block-tooltip").forEach(element => {
        if (!element.hasAttribute("tabindex")) element.tabIndex = 0;
    });

    applyUnlocks();
    const nextLevelButton = document.getElementById("next-level-btn");
    const nextLevelHref = nextLevelButton?.getAttribute?.("href");
    if (nextLevelHref) nextLevelButton.href = canonicalPageHref(nextLevelHref);
    if(window.location.hash === '#l') {
        document.querySelectorAll('.next-level-btn').forEach(btn => btn.style.display = 'block');
    }

    document.querySelectorAll("[data-skip-unlocks]").forEach(link => {
        link.addEventListener("click", () => {
            link.dataset.skipUnlocks
                .split(/\s+/)
                .filter(Boolean)
                .forEach(unlockLevel);
        });
    });

    const resetButton = document.getElementById("reset-progress-btn");
    if (resetButton) {
        resetButton.addEventListener("click", () => {
            const confirmed = typeof window.confirm !== "function" || window.confirm(
                "Möchtest du deinen gesamten Lernfortschritt wirklich zurücksetzen?"
            );
            if (!confirmed) {
                return;
            }

            clearProgress();
            window.location.href = "mission1_start.html";
        });
    }
    
    // Auto-highlight active link based on current page
    const currentPage = window.location.pathname.split("/").pop();
    document.querySelectorAll('.sidebar a').forEach(link => {
        if(link.getAttribute('href') === currentPage) {
            link.classList.add('active-link');
            link.setAttribute("aria-current", "page");
        } else {
            link.classList.remove('active-link');
            link.removeAttribute("aria-current");
        }
    });
});


// Globale Hilfsfunktionen für Skulpt und UI
let currentOutput = "";

function appendConsoleText(outDiv, text) {
    outDiv.appendChild(document.createTextNode(String(text)));
}

function appendConsoleError(outDiv, error) {
    appendConsoleText(outDiv, "\n");
    const errorSpan = document.createElement("span");
    errorSpan.style.color = "#ea4335";
    errorSpan.textContent = "FEHLER: " + String(error);
    outDiv.appendChild(errorSpan);
    outDiv.scrollTop = outDiv.scrollHeight;
}

function tokenizePython(source) {
    const tokens = [];
    let index = 0;
    let line = 1;
    let column = 0;

    while (index < source.length) {
        const char = source[index];

        if (char === "\r") {
            index += 1;
            continue;
        }
        if (char === "\n") {
            index += 1;
            line += 1;
            column = 0;
            continue;
        }
        if (char === " " || char === "\t") {
            index += 1;
            column += char === "\t" ? 4 : 1;
            continue;
        }
        if (char === "#") {
            while (index < source.length && source[index] !== "\n") {
                index += 1;
                column += 1;
            }
            continue;
        }

        const tokenLine = line;
        const tokenColumn = column;

        if (char === "\"" || char === "'") {
            const quote = char;
            const triple = source.slice(index, index + 3) === quote.repeat(3);
            const delimiterLength = triple ? 3 : 1;
            let value = "";
            index += delimiterLength;
            column += delimiterLength;

            while (index < source.length) {
                if (source.slice(index, index + delimiterLength) === quote.repeat(delimiterLength)) {
                    index += delimiterLength;
                    column += delimiterLength;
                    break;
                }

                const stringChar = source[index];
                if (stringChar === "\\" && index + 1 < source.length) {
                    value += source[index + 1];
                    index += 2;
                    column += 2;
                    continue;
                }
                if (stringChar === "\n") {
                    value += "\n";
                    index += 1;
                    line += 1;
                    column = 0;
                    if (!triple) break;
                    continue;
                }

                value += stringChar;
                index += 1;
                column += 1;
            }

            tokens.push({ type: "string", value, line: tokenLine, column: tokenColumn });
            continue;
        }

        if (/[A-Za-z_]/.test(char)) {
            let value = char;
            index += 1;
            column += 1;
            while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) {
                value += source[index];
                index += 1;
                column += 1;
            }
            tokens.push({ type: "name", value, line: tokenLine, column: tokenColumn });
            continue;
        }

        if (/[0-9]/.test(char)) {
            let value = char;
            index += 1;
            column += 1;
            while (index < source.length && /[0-9.]/.test(source[index])) {
                value += source[index];
                index += 1;
                column += 1;
            }
            tokens.push({ type: "number", value, line: tokenLine, column: tokenColumn });
            continue;
        }

        const doubleOperator = source.slice(index, index + 2);
        if (["==", "!=", "<=", ">="].includes(doubleOperator)) {
            tokens.push({ type: "operator", value: doubleOperator, line: tokenLine, column: tokenColumn });
            index += 2;
            column += 2;
            continue;
        }

        tokens.push({ type: "operator", value: char, line: tokenLine, column: tokenColumn });
        index += 1;
        column += 1;
    }

    return tokens;
}

function pythonStatements(source) {
    const statementsByLine = new Map();
    tokenizePython(source).forEach((token) => {
        if (!statementsByLine.has(token.line)) statementsByLine.set(token.line, []);
        statementsByLine.get(token.line).push(token);
    });

    return [...statementsByLine.entries()].map(([statementLine, tokens]) => ({
        line: statementLine,
        indent: tokens[0].column,
        tokens
    }));
}

function tokenMatches(token, expected) {
    if (!token) return false;
    if (typeof expected === "string") return token.value === expected;
    return (!expected.type || token.type === expected.type) &&
        (!Object.prototype.hasOwnProperty.call(expected, "value") || token.value === expected.value);
}

function statementStartsWith(statement, pattern) {
    return pattern.every((expected, index) => tokenMatches(statement.tokens[index], expected));
}

function statementContains(statement, pattern) {
    for (let start = 0; start <= statement.tokens.length - pattern.length; start += 1) {
        if (pattern.every((expected, offset) => tokenMatches(statement.tokens[start + offset], expected))) {
            return true;
        }
    }
    return false;
}

function findStatement(statements, pattern) {
    return statements.find((statement) => statementStartsWith(statement, pattern));
}

function hasNestedStatement(statements, parentPattern, childPattern) {
    const parentIndex = statements.findIndex((statement) => statementStartsWith(statement, parentPattern));
    if (parentIndex < 0) return false;

    const parentIndent = statements[parentIndex].indent;
    for (let index = parentIndex + 1; index < statements.length; index += 1) {
        const statement = statements[index];
        if (statement.indent <= parentIndent) return false;
        if (statementStartsWith(statement, childPattern)) return true;
    }
    return false;
}

function pythonFunctionBlocks(statements) {
    const blocks = [];
    statements.forEach((statement, index) => {
        if (!statementStartsWith(statement, ["def"]) || statement.tokens[1]?.type !== "name") return;
        let endIndex = statements.length;
        for (let cursor = index + 1; cursor < statements.length; cursor += 1) {
            if (statements[cursor].indent <= statement.indent) {
                endIndex = cursor;
                break;
            }
        }
        blocks.push({
            name: statement.tokens[1].value,
            startIndex: index,
            endIndex,
            statement,
            body: statements.slice(index + 1, endIndex)
        });
    });
    return blocks;
}

function analyzeCalledFunctionForMethod(statements, receiverName, methodName, minimumCalls = 1) {
    const blocks = pythonFunctionBlocks(statements);
    const isInsideFunction = statementIndex => blocks.some(block =>
        statementIndex > block.startIndex && statementIndex < block.endIndex
    );
    const hasDirectMethodCall = statements.some((statement, index) =>
        !isInsideFunction(index) && statementStartsWith(statement, [receiverName, ".", methodName, "("])
    );
    if (hasDirectMethodCall) return false;

    return blocks.some(block => {
        const containsMethod = block.body.some(statement =>
            statementContains(statement, [receiverName, ".", methodName, "("])
        );
        const callCount = statements.filter((statement, index) =>
            !isInsideFunction(index) && statementStartsWith(statement, [block.name, "("])
        ).length;
        return containsMethod && callCount >= minimumCalls;
    });
}

function firstFailedRequirement(requirements) {
    const failed = requirements.find((requirement) => !requirement.passed);
    return failed || { passed: true, message: "" };
}

function stringToken(value) {
    return { type: "string", value };
}

function numberToken(value) {
    return { type: "number", value: String(value) };
}

function outputMatchesLines(output, expectedLines) {
    const actualLines = output
        .trim()
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    return actualLines.length === expectedLines.length &&
        actualLines.every((line, index) => line === expectedLines[index]);
}

const LEVEL_VALIDATORS = {
    mission1_level1({ output }) {
        return firstFailedRequirement([
            { passed: output.toLowerCase().includes("verbindung wird hergestellt"), message: "Gib mit print() den Text ‚Verbindung wird hergestellt...‘ aus." }
        ]);
    },
    mission1_level2({ statements, output }) {
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["import", "time"])), message: "Lade zuerst das Modul mit import time." },
            { passed: statements.some((statement) => statementContains(statement, ["time", ".", "sleep", "("])), message: "Rufe time.sleep(...) für die Pause auf." },
            { passed: output.toLowerCase().includes("verbindung wird hergestellt"), message: "Gib zusätzlich ‚Verbindung wird hergestellt...‘ aus." }
        ]);
    },
    mission1_level3({ statements, output }) {
        const nameInput = findStatement(statements, ["name", "=", "input", "("]);
        const asksForName = nameInput?.tokens.some(token =>
            token.type === "string" && token.value.trim() === "Wie heißt du?"
        );
        const hasWelcomePrint = statements.some(statement =>
            statementStartsWith(statement, ["print", "("]) &&
            statementContains(statement, [",", "name"])
        );
        return firstFailedRequirement([
            { passed: Boolean(nameInput), message: "Speichere input(...) in der Variable name." },
            { passed: asksForName, message: "Stelle in input(...) die Frage ‚Wie heißt du?‘." },
            { passed: hasWelcomePrint, message: "Gib den festen Text und name gemeinsam mit einem Komma in print(...) aus." },
            { passed: output.toLowerCase().includes("willkommen im system"), message: "Die Ausgabe muss ‚Willkommen im System‘ enthalten." }
        ]);
    },
    mission1_level4({ statements, output }) {
        return LEVEL_VALIDATORS.mission1_level3({ statements, output });
    },
    mission2_level1({ statements, output }) {
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["kabel", "=", stringToken("rot")])), message: "Setze kabel auf den Text ‚rot‘." },
            { passed: Boolean(findStatement(statements, ["if", "kabel", "==", stringToken("rot"), ":"])), message: "Prüfe mit if, ob kabel gleich ‚rot‘ ist." },
            { passed: output.includes("Entschärft!"), message: "Gib im richtigen if-Zweig ‚Entschärft!‘ aus." }
        ]);
    },
    mission2_level2({ statements, output }) {
        const cableAssignment = findStatement(statements, ["kabel", "="]);
        const cableColor = cableAssignment?.tokens[2]?.type === "string"
            ? cableAssignment.tokens[2].value.trim()
            : "";
        return firstFailedRequirement([
            { passed: Boolean(cableColor) && cableColor !== "rot", message: "Setze kabel auf eine beliebige Farbe außer ‚rot‘." },
            { passed: Boolean(findStatement(statements, ["if", "kabel", "==", stringToken("rot"), ":"])), message: "Behalte die Prüfung auf das rote Kabel bei." },
            { passed: Boolean(findStatement(statements, ["else", ":"])), message: "Ergänze einen else-Zweig." },
            { passed: output.includes("KABUMM"), message: "Gib im else-Zweig ‚KABUMM!‘ aus." }
        ]);
    },
    mission2_level3({ statements, output }) {
        const blueBranch = ["elif", "kabel", "==", stringToken("blau"), ":"];
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["kabel", "=", "input", "("])), message: "Lies die Kabelwahl mit input(...) in kabel ein." },
            { passed: Boolean(findStatement(statements, ["if", "kabel", "==", stringToken("rot"), ":"])), message: "Prüfe zuerst das rote Kabel mit if." },
            { passed: Boolean(findStatement(statements, blueBranch)), message: "Prüfe das blaue Kabel mit elif." },
            { passed: hasNestedStatement(statements, blueBranch, ["print", "(", stringToken("Nichts passiert."), ")"]), message: "Gib im blauen elif-Zweig ‚Nichts passiert.‘ aus." },
            { passed: Boolean(findStatement(statements, ["else", ":"])), message: "Fange alle übrigen Kabel mit else ab." },
            { passed: output.includes("Nichts passiert."), message: "Teste das Programm mit der Eingabe blau, bis ‚Nichts passiert.‘ erscheint." }
        ]);
    },
    mission3_level1({ statements }) {
        const whilePattern = ["while", "tipp", "!=", stringToken("123"), ":"];
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["tipp", "=", stringToken("")])), message: "Initialisiere tipp mit einem leeren Text." },
            { passed: Boolean(findStatement(statements, whilePattern)), message: "Wiederhole mit while, solange tipp nicht ‚123‘ ist." },
            { passed: hasNestedStatement(statements, whilePattern, ["tipp", "=", "input", "("]), message: "Die neue Eingabe für tipp muss eingerückt in der while-Schleife stehen." }
        ]);
    },
    mission3_level2({ statements, output }) {
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["tipp", "=", "int", "(", "input", "("])), message: "Wandle die Eingabe mit int(input(...)) in eine Zahl um." },
            { passed: Boolean(findStatement(statements, ["if", "tipp", "<", numberToken(50), ":"])), message: "Prüfe mit if, ob tipp kleiner als 50 ist." },
            { passed: Boolean(findStatement(statements, ["elif", "tipp", ">", numberToken(50), ":"])), message: "Prüfe mit elif, ob tipp größer als 50 ist." },
            { passed: output.includes("Zu niedrig!") || output.includes("Zu hoch!"), message: "Teste mit einer Zahl unter oder über 50 und gib den passenden Hinweis aus." }
        ]);
    },
    mission3_level3({ statements, output }) {
        const whilePattern = ["while", "tipp", "!=", "geheim", ":"];
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["import", "random"])), message: "Lade das Modul random." },
            { passed: Boolean(findStatement(statements, ["geheim", "=", "random", ".", "randint", "(", numberToken(1), ",", numberToken(100), ")"])), message: "Erzeuge geheim mit random.randint(1, 100)." },
            { passed: Boolean(findStatement(statements, ["tipp", "=", numberToken(0)])), message: "Initialisiere tipp mit 0." },
            { passed: Boolean(findStatement(statements, whilePattern)), message: "Wiederhole, solange tipp und geheim verschieden sind." },
            { passed: hasNestedStatement(statements, whilePattern, ["tipp", "=", "int", "(", "input", "("]), message: "Lies den Zahlentipp eingerückt in der while-Schleife ein." },
            { passed: hasNestedStatement(statements, whilePattern, ["if", "tipp", "<", "geheim", ":"]), message: "Prüfe innerhalb der Schleife, ob der Tipp zu niedrig ist." },
            { passed: hasNestedStatement(statements, whilePattern, ["elif", "tipp", ">", "geheim", ":"]), message: "Prüfe innerhalb der Schleife, ob der Tipp zu hoch ist." },
            { passed: output.includes("Knack!"), message: "Gib nach dem richtigen Tipp ‚Knack!‘ aus." }
        ]);
    },
    mission4_level1({ statements, output }) {
        const forPattern = ["for", "buchstabe", "in", "nachricht", ":"];
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["nachricht", "=", stringToken("GEHEIM")])), message: "Setze nachricht auf den Text ‚GEHEIM‘." },
            { passed: Boolean(findStatement(statements, forPattern)), message: "Durchlaufe nachricht mit for buchstabe in nachricht:." },
            { passed: hasNestedStatement(statements, forPattern, ["print", "(", "buchstabe", ")"]), message: "Gib buchstabe eingerückt innerhalb der for-Schleife aus." },
            { passed: outputMatchesLines(output, ["G", "E", "H", "E", "I", "M"]), message: "Die Ausgabe muss jeden Buchstaben von GEHEIM in einer eigenen Zeile zeigen." }
        ]);
    },
    mission4_level2({ statements, output }) {
        const forPattern = ["for", "buchstabe", "in", "nachricht", ":"];
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["nachricht", "=", stringToken("GEHEIM")])), message: "Behalte nachricht mit dem Text ‚GEHEIM‘ bei." },
            { passed: Boolean(findStatement(statements, forPattern)), message: "Behalte die for-Schleife über nachricht bei." },
            { passed: hasNestedStatement(statements, forPattern, ["print", "(", "ord", "(", "buchstabe", ")", ")"]), message: "Gib eingerückt mit ord(buchstabe) den Zahlenwert aus." },
            { passed: outputMatchesLines(output, ["71", "69", "72", "69", "73", "77"]), message: "Die Ausgabe muss die sechs Zahlenwerte von GEHEIM zeigen." }
        ]);
    },
    mission4_level3({ statements, output }) {
        const forPattern = ["for", "buchstabe", "in", "nachricht", ":"];
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["nachricht", "=", stringToken("GEHEIM")])), message: "Behalte nachricht mit dem Text ‚GEHEIM‘ bei." },
            { passed: Boolean(findStatement(statements, ["geheimtext", "=", stringToken("")])), message: "Starte geheimtext als leeren Text." },
            { passed: Boolean(findStatement(statements, forPattern)), message: "Behalte die for-Schleife über nachricht bei." },
            { passed: hasNestedStatement(statements, forPattern, ["zahl", "=", "ord", "(", "buchstabe", ")", "+", numberToken(3)]), message: "Setze zahl eingerückt auf ord(buchstabe) + 3." },
            { passed: hasNestedStatement(statements, forPattern, ["geheimtext", "=", "geheimtext", "+", "chr", "(", "zahl", ")"]), message: "Hänge eingerückt mit chr(zahl) das neue Zeichen an geheimtext an." },
            { passed: Boolean(findStatement(statements, ["print", "(", "geheimtext", ")"])), message: "Gib geheimtext nach der Schleife aus." },
            { passed: outputMatchesLines(output, ["JHKHLP"]), message: "Der fertige Caesar-Code muss JHKHLP ergeben." }
        ]);
    },
    agent_training_level1({ statements }) {
        const topLevelStatements = statements.filter(statement => statement.indent === 0);
        const commandIndex = (methodName, startIndex = 0) => topLevelStatements.findIndex(
            (statement, index) => index >= startIndex &&
                statementStartsWith(statement, ["drohne", ".", methodName, "("])
        );
        const penDownIndex = commandIndex("pendown");
        const gotoIndex = commandIndex("goto", penDownIndex + 1);
        const penUpIndex = commandIndex("penup", gotoIndex + 1);
        const usesTrailControls = penDownIndex >= 0 && gotoIndex > penDownIndex && penUpIndex > gotoIndex;
        const printsRealPosition = topLevelStatements.some(statement =>
            statementStartsWith(statement, ["print", "("]) &&
            statementContains(statement, ["drohne", ".", "position", "("])
        );
        const result = firstFailedRequirement([
            {
                passed: usesTrailControls,
                message: "Schalte vor goto() mit pendown() die Spur ein und danach mit penup() wieder aus."
            },
            { passed: printsRealPosition, message: "Gib die aktuelle Drohnenposition mit print(...position()) aus." }
        ]);
        return { ...result, evidence: { printsRealPosition, usesTrailControls } };
    },
    agent_training_level2({ statements }) {
        const movementFunction = analyzeCalledFunctionForMethod(statements, "drohne", "goto", 2);
        const markerFunction = analyzeCalledFunctionForMethod(statements, "drohne", "dot", 2);
        const result = firstFailedRequirement([
            {
                passed: movementFunction,
                message: "Bewege die Drohne in einer eigenen, mindestens zweimal aufgerufenen Funktion mit goto(...)."
            },
            {
                passed: markerFunction,
                message: "Setze den Punkt in einer eigenen, mindestens zweimal aufgerufenen Funktion mit dot(...)."
            }
        ]);
        return { ...result, evidence: { movementFunction, markerFunction } };
    },
    agent_training_level3({ statements }) {
        const searchStatement = statements.find(statement =>
            statement.indent === 0 &&
            statementStartsWith(statement, [
                "fund", "=", "drohne", ".", "suche_hier", "(", ")"
            ])
        );
        const printStatement = statements.find(statement =>
            statement.indent === 0 &&
            statementStartsWith(statement, ["print", "("]) &&
            statementContains(statement, ["fund"])
        );
        const ifPattern = ["if", "fund", "==", stringToken("Datenchip"), ":"];
        const anyIfStatement = findStatement(statements, ifPattern);
        const ifStatement = statements.find(statement =>
            statement.indent === 0 && statementStartsWith(statement, ifPattern)
        );
        const hasFundGuard = Boolean(anyIfStatement);
        const searchAssignment = Boolean(searchStatement);
        const printsFund = Boolean(
            printStatement && searchStatement && printStatement.line > searchStatement.line
        );
        const guardedAppend = Boolean(
            ifStatement && printStatement && ifStatement.line > printStatement.line &&
            hasNestedStatement(
                statements,
                ifPattern,
                ["inventar", ".", "append", "(", "fund", ")"]
            )
        );
        const directAppendStatement = statements.find(statement =>
            statement.indent === 0 &&
            statementStartsWith(statement, ["inventar", ".", "append", "(", "fund", ")"])
        );
        const directAppend = Boolean(
            directAppendStatement && printStatement && directAppendStatement.line > printStatement.line
        );
        const result = firstFailedRequirement([
            {
                passed: searchAssignment,
                message: "Speichere das Ergebnis von drohne.suche_hier() in fund."
            },
            {
                passed: printsFund,
                message: "Gib fund nach der Suche mit print(fund) aus."
            },
            {
                passed: guardedAppend || directAppend,
                message: "Hänge genau fund mit inventar.append(fund) an inventar an."
            }
        ]);
        return {
            ...result,
            evidence: {
                searchAssignment,
                printsFund,
                guardedAppend,
                directAppend,
                hasFundGuard
            }
        };
    }
};

const LEVEL_OUTCOMES = {
    mission1_level1: { unlocks: ["link-level2"] },
    mission1_level2: { unlocks: ["link-level3"] },
    mission1_level3: { unlocks: ["link-m2-title", "link-m2-l1"], finale: true },
    mission1_level4: { unlocks: ["link-m2-title", "link-m2-l1"], finale: true },
    mission2_level1: { unlocks: ["link-m2-l2"] },
    mission2_level2: { unlocks: ["link-m2-l3", "link-m3-title", "link-m3-l1"] },
    mission2_level3: { unlocks: ["link-m3-title", "link-m3-l1"], finale: true },
    mission3_level1: { unlocks: ["link-m3-l2"] },
    mission3_level2: { unlocks: ["link-m3-l3"] },
    mission3_level3: { unlocks: ["link-m4-title", "link-m4-l1"], finale: true },
    mission4_level1: { unlocks: ["link-m4-l2"], successMessage: "Scan abgeschlossen: 6 Zeichen erkannt!" },
    mission4_level2: { unlocks: ["link-m4-l3"], successMessage: "Matrix gelesen: Jeder Buchstabe hat eine Zahl!" },
    mission4_level3: {
        unlocks: ["link-agent-training-title", "link-agent-training-l1"],
        finale: true,
        successMessage: "Nachricht verschlüsselt! Die Drohnensteuerung ist freigeschaltet."
    },
    agent_training_level1: {
        unlocks: ["link-agent-training-l2"],
        successMessage: "Signalpunkt erfasst und markiert."
    },
    agent_training_level2: {
        unlocks: ["link-agent-training-l3"],
        successMessage: "Eigene Drohnenfunktionen funktionieren."
    },
    agent_training_level3: {
        unlocks: [
            "link-project-choice",
            "link-pico-title",
            "link-pico-l1",
            "link-museum-title",
            "link-museum-briefing"
        ],
        successMessage: "Dein Datenchip stammt aus einer Suche und liegt nachweislich im Inventar."
    },
    pico_level1_navigation: {
        unlocks: ["link-pico-l2"],
        successMessage: "Die Energiezelle ist erreicht."
    },
    pico_level2: {
        unlocks: ["link-pico-l2a", "link-pico-l3"],
        successMessage: "Die echte Energiezelle wurde gefunden und geladen."
    },
    pico_level2a: {
        unlocks: ["link-pico-l3"],
        successMessage: "Der TRANSPONDER meldet den echten Ladezustand."
    },
    pico_level3: {
        unlocks: ["link-pico-l4"],
        successMessage: "Das Rettungssignal wurde an der Funkbase bestätigt."
    },
    pico_level4_memory: {
        unlocks: ["link-helicopter-escape"],
        successMessage: "PICO hat gesendet und danach sein Memory gelöscht."
    },
    pixelmuseum_briefing: {
        unlocks: ["link-museum-finale"],
        successMessage: "Das Briefing ist abgeschlossen. Das Pixelmuseum ist bereit."
    },
    pixelmuseum_finale: {
        unlocks: ["link-helicopter-escape"],
        successMessage: "Das Sternenfragment ist gesichert und die Flucht aus dem Museum gelungen."
    }
};

const LEVEL_CODE_INHERITANCE = Object.freeze({
    mission4_level2: Object.freeze({ from: "mission4_level1" }),
    mission4_level3: Object.freeze({
        from: "mission4_level2",
        prepare: addMission4FinaleBonuses
    }),
    pico_level2: Object.freeze({ from: "pico_level1_navigation" }),
    pico_level2a: Object.freeze({ from: "pico_level2" }),
    pico_level3: Object.freeze({ from: Object.freeze(["pico_level2a", "pico_level2"]) }),
    pico_level4_memory: Object.freeze({ from: "pico_level3" })
});

function validateLevelSolution(levelId, code, output) {
    const validator = LEVEL_VALIDATORS[levelId];
    if (!validator) return { passed: false, message: "Für dieses Level fehlt die Prüfregel." };
    return validator({ statements: pythonStatements(code), output });
}

function showLevelFeedback(message) {
    const statusText = document.getElementById("status-text");
    if (!statusText) return;
    statusText.textContent = "Noch nicht: " + message;
    statusText.style.color = "#ea4335";
}

function setupLevel(levelId) {
    const runButton = document.getElementById("run-btn");
    const outcome = LEVEL_OUTCOMES[levelId];
    if (!runButton || !outcome) return;
    let successPopupTimeout = null;

    const restoreCode = () => restoreLevelCode(levelId);
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", restoreCode, { once: true });
    } else {
        restoreCode();
    }

    runButton.addEventListener("click", () => {
        if (runButton.disabled || successPopupTimeout !== null) return;
        runit((code, output) => {
            const result = validateLevelSolution(levelId, code, output);
            if (!result.passed) {
                showLevelFeedback(result.message);
                return;
            }

            saveCompletedLevelCode(levelId, code);
            outcome.unlocks.forEach(unlockLevel);
            runButton.disabled = true;
            const statusText = document.getElementById("status-text");
            if (statusText) {
                statusText.textContent = "✓ Geschafft – lies kurz dein Ergebnis.";
                statusText.style.color = "#7df2a9";
            }
            successPopupTimeout = setTimeout(() => {
                successPopupTimeout = null;
                runButton.disabled = false;
                triggerSuccess(Boolean(outcome.finale), outcome.successMessage);
            }, SUCCESS_POPUP_DELAY_MS);
        });
    });
}

function builtinRead(x) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) {
        throw "File not found: '" + x + "'";
    }
    return Sk.builtinFiles["files"][x];
}

function outf(text) {
    const outDiv = document.getElementById("console-output");
    appendConsoleText(outDiv, text);
    currentOutput += text;
    // Automatisch nach unten scrollen
    outDiv.scrollTop = outDiv.scrollHeight;
}

// Eine Custom-Input-Funktion, die auf Enter im Konsolen-Feld wartet
function customInput(promptMsg) {
    return new Promise((resolve) => {
        const outDiv = document.getElementById("console-output");
        const runButton = document.getElementById("run-btn");
        
        // Zeige den Prompt an, falls vorhanden
        if (promptMsg) {
            appendConsoleText(outDiv, promptMsg);
            currentOutput += promptMsg;
        }

        // Eine echte Eingabe verhindert Mehrdeutigkeiten und zeigt den blinkenden Cursor zuverlässig.
        const inputWrapper = document.createElement("span");
        inputWrapper.className = "console-input-wrap";

        const inputHint = document.createElement("span");
        inputHint.className = "console-enter-hint";
        inputHint.id = "console-enter-hint";
        inputHint.textContent = "Hier eingeben · Enter drücken ↵";
        inputHint.setAttribute("role", "status");

        const inputField = document.createElement("input");
        inputField.className = "console-input";
        inputField.type = "text";
        inputField.autocomplete = "off";
        inputField.spellcheck = false;
        inputField.setAttribute("aria-label", "Eingabe; mit Enter bestätigen");
        inputField.setAttribute("aria-describedby", inputHint.id);

        inputWrapper.appendChild(inputHint);
        inputWrapper.appendChild(inputField);
        outDiv.appendChild(inputWrapper);
        if (runButton) {
            runButton.disabled = true;
            runButton.setAttribute("aria-describedby", inputHint.id);
        }
        inputField.focus();

        outDiv.scrollTop = outDiv.scrollHeight;

        // Warte auf Enter
        inputField.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                const v = inputField.value;
                inputWrapper.remove();
                appendConsoleText(outDiv, v + "\n");
                currentOutput += v + "\n";
                if (runButton) {
                    runButton.disabled = false;
                    runButton.removeAttribute("aria-describedby");
                }
                resolve(v);
            }
        });
    });
}

function runit(levelTestFunction) {
    const code = window.editor.getValue();
    const outDiv = document.getElementById("console-output");
    outDiv.textContent = "";
    currentOutput = "";

    // Skulpt konfigurieren
    Sk.pre = "console-output";
    Sk.configure({
        output: outf,
        read: builtinRead,
        inputfunTakesPrompt: true,
        inputfun: customInput
    });

    try {
        let myPromise = Sk.misceval.asyncToPromise(function() {
            return Sk.importMainWithBody("<stdin>", false, code, true);
        });

        myPromise.then(function(mod) {
            // Erfolg: Prüfe Level
            if(levelTestFunction) levelTestFunction(code, currentOutput);
        }, function(err) {
            appendConsoleError(outDiv, err);
        });
    } catch(e) {
        appendConsoleError(outDiv, e);
    }
}

function trainingAwardSvg(symbol) {
    if (symbol === "graduation-cap") {
        return `
            <svg viewBox="0 0 160 120" role="img" aria-label="Absolventenhut">
                <path class="award-glow" d="M14 43 80 13l66 30-66 30Z"></path>
                <path d="M35 57v29c19 17 71 17 90 0V57L80 77Z"></path>
                <path d="M144 45v37"></path>
                <circle cx="144" cy="89" r="7"></circle>
            </svg>`;
    }
    if (symbol === "diploma") {
        return `
            <svg viewBox="0 0 220 150" role="img" aria-label="Abschlussrolle mit Siegel">
                <path class="diploma-shadow" d="M41 29h134c-9 17-9 75 0 92H41c12-20 12-72 0-92Z"></path>
                <path class="diploma-paper" d="M43 24h132c-10 20-10 75 0 95H43c13-21 13-74 0-95Z"></path>
                <path class="diploma-curl diploma-curl-left" d="M43 24c21 0 21 95 0 95-25 0-25-95 0-95Z"></path>
                <path class="diploma-curl diploma-curl-right" d="M175 24c-18 0-18 95 0 95 23 0 23-95 0-95Z"></path>
                <path class="diploma-fold" d="M43 37c10 0 10 69 0 69M175 37c-9 0-9 69 0 69"></path>
                <path class="diploma-title-line" d="M76 47h66"></path>
                <path class="diploma-copy-line" d="M72 64h75M76 78h45"></path>
                <path class="diploma-ribbon diploma-ribbon-left" d="m122 101-10 37 20-12 12 18 7-39Z"></path>
                <path class="diploma-ribbon diploma-ribbon-right" d="m153 102 8 38 13-16 19 10-14-39Z"></path>
                <circle class="diploma-seal-edge" cx="151" cy="99" r="27"></circle>
                <circle class="diploma-seal" cx="151" cy="99" r="20"></circle>
                <path class="diploma-seal-mark" d="m151 87 3.8 7.7 8.5 1.2-6.1 6 1.4 8.5-7.6-4-7.6 4 1.4-8.5-6.1-6 8.5-1.2Z"></path>
            </svg>`;
    }
    return '<div class="trophy" aria-hidden="true">🏆</div>';
}

function successCoinsMarkup(rewardCount) {
    const count = Math.max(0, Math.min(12, Number.parseInt(rewardCount, 10) || 0));
    if (!count) return "";
    const label = count === 1 ? "1 Goldmünze" : `${count} Goldmünzen`;
    const coins = Array.from({ length: count }, (_entry, index) => `
        <span class="success-coin" style="--coin-index:${index}" aria-hidden="true">
            <span>★</span>
        </span>`).join("");
    return `<div class="success-coins" data-reward-count="${count}" role="img" aria-label="${label}">${coins}</div>`;
}

let successCelebrationTimeouts = [];
let trainingFireworksInstance = null;

function cancelSuccessCelebration() {
    successCelebrationTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    successCelebrationTimeouts = [];
    if (trainingFireworksInstance && typeof trainingFireworksInstance.stop === "function") {
        trainingFireworksInstance.stop(true);
    }
    trainingFireworksInstance = null;
    document.getElementById("training-fireworks")?.remove();
}

function triggerTrainingFireworks() {
    cancelSuccessCelebration();
    const overlay = document.getElementById("success-overlay");
    const prefersReducedMotion = typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const FireworksConstructor = window.Fireworks?.default || window.Fireworks?.Fireworks;
    if (!overlay || prefersReducedMotion || typeof FireworksConstructor !== "function") return;

    const layer = document.createElement("div");
    layer.id = "training-fireworks";
    layer.className = "training-fireworks";
    layer.setAttribute("aria-hidden", "true");
    overlay.appendChild(layer);

    trainingFireworksInstance = new FireworksConstructor(layer, {
        autoresize: true,
        acceleration: 1.028,
        brightness: { min: 72, max: 94 },
        boundaries: { x: 70, y: 125, debug: false },
        decay: { min: 0.008, max: 0.014 },
        delay: { min: 44, max: 70 },
        explosion: 9,
        flickering: 68,
        friction: 0.96,
        gravity: 1.12,
        hue: { min: 184, max: 196 },
        intensity: 18,
        lineStyle: "round",
        lineWidth: {
            explosion: { min: 1.5, max: 3.4 },
            trace: { min: 1.4, max: 2.7 }
        },
        mouse: { click: false, move: false, max: 0 },
        opacity: 0.16,
        particles: 68,
        rocketsPoint: { min: 8, max: 92 },
        sound: { enabled: false },
        traceLength: 8,
        traceSpeed: 3.6
    });

    const launchSalvo = (delay, count, hueMin, hueMax, pointMin, pointMax) => {
        const timeoutId = setTimeout(() => {
            if (!trainingFireworksInstance || !layer.isConnected) return;
            trainingFireworksInstance.updateOptions({
                hue: { min: hueMin, max: hueMax },
                rocketsPoint: { min: pointMin, max: pointMax }
            });
            trainingFireworksInstance.launch(count);
        }, delay);
        successCelebrationTimeouts.push(timeoutId);
    };

    launchSalvo(100, 2, 184, 196, 7, 31);
    launchSalvo(850, 2, 298, 320, 69, 93);
    launchSalvo(1600, 2, 42, 54, 9, 91);
    launchSalvo(2350, 2, 184, 320, 6, 94);

    successCelebrationTimeouts.push(setTimeout(() => {
        if (trainingFireworksInstance && typeof trainingFireworksInstance.stop === "function") {
            trainingFireworksInstance.stop(true);
        }
        trainingFireworksInstance = null;
        layer.remove();
    }, 6800));
}

function triggerSuccess(isFinale = false, successMessage = "", options = {}) {
    // Ein modaler Drawer läge sonst in der Browser-Top-Layer über der Belohnung.
    setNavOpen(false, false);

    // Falls das Success-Overlay nicht existiert, bauen wir es dynamisch ins Dokument ein
    let overlay = document.getElementById("success-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "success-overlay";
        overlay.className = "success-overlay";
        overlay.setAttribute?.("role", "dialog");
        overlay.setAttribute?.("aria-modal", "true");
        overlay.setAttribute?.("aria-labelledby", "success-overlay-title");

        const titleText = options.title || (isFinale ? "MISSION ERFÜLLT" : "LEVEL GESCHAFFT");
        const subText = successMessage || (isFinale ? "Sehr starker Code!" : "Gut gemacht! Weiter geht's.");
        const symbol = ["graduation-cap", "diploma"].includes(options.symbol)
            ? options.symbol
            : "trophy";
        const closeLabel = options.closeLabel || "Weiterspielen / Editor ansehen";
        const rewardCount = Math.max(0, Number.parseInt(options.rewardCount, 10) || 0);
        const completionClass = options.className === "training-completion"
            ? " training-completion"
            : "";

        overlay.innerHTML = `
            <div class="success-badge${completionClass}" data-reward-count="${rewardCount}">
                ${rewardCount
                    ? successCoinsMarkup(rewardCount)
                    : `<div class="success-symbol" data-success-symbol="${symbol}" aria-hidden="true">${trainingAwardSvg(symbol)}</div>`}
                <h1 id="success-overlay-title">${titleText}</h1>
                <p>${subText}</p>
                <div class="btn-container"></div>
                <button class="close-overlay-btn" type="button">${closeLabel}</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Wir clonen den nächsten-Level-Button von oben in unser Pop-up
        const nextBtnSource = document.getElementById("next-level-btn");
        if (options.primaryHref) {
            const primaryLink = document.createElement("a");
            primaryLink.href = canonicalPageHref(options.primaryHref);
            primaryLink.className = "success-btn";
            primaryLink.textContent = options.primaryLabel || "Weiter";
            overlay.querySelector(".btn-container").appendChild(primaryLink);
        } else if (nextBtnSource) {
            const btnClone = nextBtnSource.cloneNode(true);
            btnClone.removeAttribute("id");
            btnClone.style.display = "inline-block";
            btnClone.className = "success-btn";
            overlay.querySelector(".btn-container").appendChild(btnClone);
        }

        const closeButton = overlay.querySelector(".close-overlay-btn");
        const closeOverlay = () => {
            overlay.style.display = "none";
            cancelSuccessCelebration();
            if (window.editor && typeof window.editor.focus === "function") {
                window.editor.focus();
            } else {
                document.getElementById("python-editor")?.focus?.();
            }
        };
        closeButton?.addEventListener?.("click", closeOverlay);
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && overlay.style.display !== "none") closeOverlay();
        });
    }

    // UI Updates
    const status = document.getElementById("status-text");
    if (status) {
        status.textContent = "✓ " + (options.statusLabel || (isFinale ? "MISSION ERFÜLLT!" : "LEVEL GESCHAFFT!"));
        status.style.color = "#34a853";
    }
    const fill = document.getElementById("progress-fill");
    if(fill) fill.style.width = "100%";
    const nextBtnTop = document.getElementById("next-level-btn");
    if(nextBtnTop) {
        const nextHref = nextBtnTop.getAttribute?.("href");
        if (nextHref) nextBtnTop.href = canonicalPageHref(nextHref);
        nextBtnTop.style.display = "block"; // Auch den kleinen Button oben zeigen
    }

    // Zeige fettes Overlay
    overlay.style.display = "flex";
    overlay.querySelector(".success-btn, .close-overlay-btn")?.focus?.();

    if (options.celebration === "fireworks") {
        triggerTrainingFireworks();
    } else if (isFinale && options.celebration !== "none" && typeof confetti === "function") {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 2000 });

        var defaults = { spread: 360, ticks: 50, gravity: 0, decay: 0.94, startVelocity: 30, colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8'], zIndex: 2000 };
        function shootStars() {
            confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ['star'] });
            confetti({ ...defaults, particleCount: 10, scalar: 0.75, shapes: ['circle'] });
        }
        setTimeout(shootStars, 250);
        setTimeout(shootStars, 400);

        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;
        var interval = setInterval(function() {
            var timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) { return clearInterval(interval); }
            var particleCount = 50 * (timeLeft / duration);
            confetti({ particleCount: particleCount, startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000, origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 } });
            confetti({ particleCount: particleCount, startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000, origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 } });
        }, 250);
    }
}

// Fügt Lehrer-Cheat-Buttons ein, wenn ein #l am Ende der URL steht
document.addEventListener("DOMContentLoaded", function() {
    if (window.location.hash.toLowerCase() === "#l") {
        document.querySelectorAll(".test-btn").forEach(btn => {
            btn.style.display = "block";
        });
        
        // Fügt zu allen Level-Links automatisch das #l hinzu, damit man im Lehrer-Modus bleibt
        document.querySelectorAll(".next-level-btn").forEach(btn => {
            const currentOnclick = btn.getAttribute("onclick");
            if (currentOnclick && currentOnclick.includes("window.location.href=")) {
                const newOnclick = currentOnclick.replace("'", "#l'"); // e.g. 'level2.html' -> 'level2.html#l'
                // Fallback falls doppelte anführungszeichen verwendet wurden
                const finalOnclick = newOnclick.replace('"', '#l"');
                btn.setAttribute("onclick", currentOnclick.replace(/href='([^']+)'/, "href='$1#l'").replace(/href="([^"]+)"/, 'href="$1#l"'));
            }
        });
    }
});


