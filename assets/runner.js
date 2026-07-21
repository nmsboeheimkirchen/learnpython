// --- SIDEBAR & PROGRESS LOGIC ---

const PROGRESS_STORAGE_KEY = "unlockedLevels_v2";
const COMPLETED_CODE_STORAGE_KEY = "completedLevelCode_v1";
const TEACHER_MODE_STORAGE_KEY = "cheatMode";
const DEFAULT_UNLOCKED_LEVELS = Object.freeze(["link-level1"]);
const LEVEL_ROUTES = Object.freeze({
    "link-level1": "mission1_level1.html",
    "link-level2": "mission1_level2.html",
    "link-level3": "mission1_level3.html",
    "link-level4": "mission1_level4.html",
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
    "link-agent-training-l3": "agent_training_level3.html"
});

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
    const savedCode = getCompletedLevelCode(levelId);
    if (
        savedCode === null ||
        !window.editor ||
        typeof window.editor.setValue !== "function"
    ) {
        return false;
    }

    window.editor.setValue(savedCode);
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

    const previousCode = getCompletedLevelCode(inheritance.from);
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
    if(window.location.hash === '#l') {
        document.querySelectorAll('.next-level-btn').forEach(btn => btn.style.display = 'block');
    }

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

function analyzeCalledFunctionForMethod(statements, methodName, minimumCalls = 1) {
    const blocks = pythonFunctionBlocks(statements);
    const isInsideFunction = statementIndex => blocks.some(block =>
        statementIndex > block.startIndex && statementIndex < block.endIndex
    );
    const hasDirectMethodCall = statements.some((statement, index) =>
        !isInsideFunction(index) && statementContains(statement, [".", methodName, "("])
    );
    if (hasDirectMethodCall) return false;

    return blocks.some(block => {
        const containsMethod = block.body.some(statement =>
            statementContains(statement, [".", methodName, "("])
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
    mission1_level3({ statements }) {
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["agent_name", "=", "input", "("])), message: "Speichere input(...) in der Variable agent_name." }
        ]);
    },
    mission1_level4({ statements, output }) {
        const hasWelcomePrint = statements.some(statement =>
            statementStartsWith(statement, ["print", "("]) &&
            statementContains(statement, [",", "agent_name"])
        );
        return firstFailedRequirement([
            { passed: hasWelcomePrint, message: "Gib den festen Text und agent_name gemeinsam mit einem Komma in print(...) aus." },
            { passed: output.toLowerCase().includes("willkommen im system"), message: "Die Ausgabe muss ‚Willkommen im System‘ enthalten." }
        ]);
    },
    mission2_level1({ statements, output }) {
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["kabel", "=", stringToken("rot")])), message: "Setze kabel auf den Text ‚rot‘." },
            { passed: Boolean(findStatement(statements, ["if", "kabel", "==", stringToken("rot"), ":"])), message: "Prüfe mit if, ob kabel gleich ‚rot‘ ist." },
            { passed: output.includes("Entschärft!"), message: "Gib im richtigen if-Zweig ‚Entschärft!‘ aus." }
        ]);
    },
    mission2_level2({ statements, output }) {
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["kabel", "=", stringToken("blau")])), message: "Setze kabel für diesen Test auf ‚blau‘." },
            { passed: Boolean(findStatement(statements, ["if", "kabel", "==", stringToken("rot"), ":"])), message: "Behalte die Prüfung auf das rote Kabel bei." },
            { passed: Boolean(findStatement(statements, ["else", ":"])), message: "Ergänze einen else-Zweig." },
            { passed: output.includes("KABUMM"), message: "Gib im else-Zweig ‚KABUMM!‘ aus." }
        ]);
    },
    mission2_level3({ statements, output }) {
        return firstFailedRequirement([
            { passed: Boolean(findStatement(statements, ["kabel", "=", "input", "("])), message: "Lies die Kabelwahl mit input(...) in kabel ein." },
            { passed: Boolean(findStatement(statements, ["if", "kabel", "==", stringToken("rot"), ":"])), message: "Prüfe zuerst das rote Kabel mit if." },
            { passed: Boolean(findStatement(statements, ["elif", "kabel", "==", stringToken("blau"), ":"])), message: "Prüfe das blaue Kabel mit elif." },
            { passed: Boolean(findStatement(statements, ["else", ":"])), message: "Fange alle übrigen Kabel mit else ab." },
            { passed: output.includes("Entschärft!"), message: "Teste das Programm mit der Eingabe rot, bis ‚Entschärft!‘ erscheint." }
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
        const printsRealPosition = statements.some(statement =>
            statementStartsWith(statement, ["print", "("]) &&
            statementContains(statement, [".", "position", "("])
        );
        const result = firstFailedRequirement([
            { passed: printsRealPosition, message: "Gib die echte Agentenposition mit print(...position()) aus." }
        ]);
        return { ...result, evidence: { printsRealPosition } };
    },
    agent_training_level2({ statements }) {
        const movementFunction = analyzeCalledFunctionForMethod(statements, "goto", 2);
        const markerFunction = analyzeCalledFunctionForMethod(statements, "dot", 2);
        const result = firstFailedRequirement([
            {
                passed: movementFunction,
                message: "Bewege den Agenten in einer eigenen, mindestens zweimal aufgerufenen Funktion mit goto(...)."
            },
            {
                passed: markerFunction,
                message: "Setze den Punkt in einer eigenen, mindestens zweimal aufgerufenen Funktion mit dot(...)."
            }
        ]);
        return { ...result, evidence: { movementFunction, markerFunction } };
    },
    agent_training_level3({ statements }) {
        const searchStatement = findStatement(statements, [
            "fund", "=", "agent", ".", "suche_hier", "(", ")"
        ]);
        const printStatement = statements.find(statement =>
            statementStartsWith(statement, ["print", "("]) &&
            statementContains(statement, ["fund"])
        );
        const ifPattern = ["if", "fund", "==", stringToken("Datenchip"), ":"];
        const ifStatement = findStatement(statements, ifPattern);
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
        const result = firstFailedRequirement([
            {
                passed: searchAssignment,
                message: "Speichere das echte Ergebnis von agent.suche_hier() in fund."
            },
            {
                passed: printsFund,
                message: "Gib fund nach der Suche mit print(\"Gefunden:\", fund) aus."
            },
            {
                passed: guardedAppend,
                message: "Prüfe fund mit if und hänge eingerückt genau fund an inventar an."
            }
        ]);
        return { ...result, evidence: { searchAssignment, printsFund, guardedAppend } };
    }
};

const LEVEL_OUTCOMES = {
    mission1_level1: { unlocks: ["link-level2"] },
    mission1_level2: { unlocks: ["link-level3"] },
    mission1_level3: { unlocks: ["link-level4"] },
    mission1_level4: { unlocks: ["link-m2-title", "link-m2-l1"], finale: true },
    mission2_level1: { unlocks: ["link-m2-l2"] },
    mission2_level2: { unlocks: ["link-m2-l3"] },
    mission2_level3: { unlocks: ["link-m3-title", "link-m3-l1"], finale: true },
    mission3_level1: { unlocks: ["link-m3-l2"] },
    mission3_level2: { unlocks: ["link-m3-l3"] },
    mission3_level3: { unlocks: ["link-m4-title", "link-m4-l1"], finale: true },
    mission4_level1: { unlocks: ["link-m4-l2"], successMessage: "Scan abgeschlossen: 6 Zeichen erkannt!" },
    mission4_level2: { unlocks: ["link-m4-l3"], successMessage: "Matrix gelesen: Jeder Buchstabe hat eine Zahl!" },
    mission4_level3: {
        unlocks: ["link-agent-training-title", "link-agent-training-l1"],
        finale: true,
        successMessage: "Nachricht verschlüsselt! Die Agentensteuerung ist freigeschaltet."
    },
    agent_training_level1: {
        unlocks: ["link-agent-training-l2"],
        successMessage: "Signalpunkt erfasst und markiert."
    },
    agent_training_level2: {
        unlocks: ["link-agent-training-l3"],
        successMessage: "Eigene Agentenbefehle funktionieren."
    },
    agent_training_level3: { unlocks: [], successMessage: "Datenchip echt gefunden und gesichert." }
};

const LEVEL_CODE_INHERITANCE = Object.freeze({
    mission4_level2: Object.freeze({ from: "mission4_level1" }),
    mission4_level3: Object.freeze({
        from: "mission4_level2",
        prepare: addMission4FinaleBonuses
    })
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

    const restoreCode = () => restoreLevelCode(levelId);
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", restoreCode, { once: true });
    } else {
        restoreCode();
    }

    runButton.addEventListener("click", () => {
        runit((code, output) => {
            const result = validateLevelSolution(levelId, code, output);
            if (!result.passed) {
                showLevelFeedback(result.message);
                return;
            }

            saveCompletedLevelCode(levelId, code);
            outcome.unlocks.forEach(unlockLevel);
            triggerSuccess(Boolean(outcome.finale), outcome.successMessage);
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
        
        // Zeige den Prompt an, falls vorhanden
        if (promptMsg) {
            appendConsoleText(outDiv, promptMsg);
            currentOutput += promptMsg;
        }

        // Erstelle eine Eingabe-Zeile am Ende der Konsole
        const inputSpan = document.createElement("span");
        inputSpan.contentEditable = "true";
        inputSpan.style.borderBottom = "1px solid #34a853";
        inputSpan.style.outline = "none";
        inputSpan.style.minWidth = "20px";
        inputSpan.style.display = "inline-block";
        outDiv.appendChild(inputSpan);
        inputSpan.focus();

        outDiv.scrollTop = outDiv.scrollHeight;

        // Warte auf Enter
        inputSpan.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                const v = inputSpan.innerText;
                // Damit der Cursor verschwindet und die Eingabe zum Text wird
                inputSpan.contentEditable = "false";
                inputSpan.style.borderBottom = "none";
                appendConsoleText(outDiv, "\n");
                currentOutput += v + "\n";
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
            if(levelTestFunction) {
                // Warte kurz, damit die finale Print-Ausgabe erst noch gelesen werden kann
                setTimeout(() => {
                    levelTestFunction(code, currentOutput);
                }, 1000); // 1 Sekunde Verzögerung
            }
        }, function(err) {
            appendConsoleError(outDiv, err);
        });
    } catch(e) {
        appendConsoleError(outDiv, e);
    }
}

function triggerSuccess(isFinale = false, successMessage = "") {
    // Ein modaler Drawer läge sonst in der Browser-Top-Layer über der Belohnung.
    setNavOpen(false, false);

    // Falls das Success-Overlay nicht existiert, bauen wir es dynamisch ins Dokument ein
    let overlay = document.getElementById("success-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "success-overlay";
        overlay.className = "success-overlay";
        
        let titleText = isFinale ? "MISSION ERFÜLLT" : "LEVEL GESCHAFFT";
        let subText = successMessage || (isFinale ? "Sehr starker Code, Agent!" : "Gut gemacht! Weiter geht's.");

                overlay.innerHTML = `
            <div class="success-badge">
                <div class="trophy">🏆</div>
                <h1>${titleText}</h1>
                <p>${subText}</p>
                <div class="btn-container"></div>
                <button class="close-overlay-btn" onclick="document.getElementById('success-overlay').style.display='none'">Weiterspielen / Editor ansehen</button>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Wir clonen den nächsten-Level-Button von oben in unser Pop-up
        const nextBtnSource = document.getElementById("next-level-btn");
        if (nextBtnSource) {
            const btnClone = nextBtnSource.cloneNode(true);
            btnClone.removeAttribute("id");
            btnClone.style.display = "inline-block";
            btnClone.className = "success-btn";
            overlay.querySelector(".btn-container").appendChild(btnClone);
        }
    }
    
    // UI Updates
    document.getElementById("status-text").innerHTML = "✅ <b>MISSION ERFÜLLT!</b>";
    document.getElementById("status-text").style.color = "#34a853";
    const fill = document.getElementById("progress-fill");
    if(fill) fill.style.width = "100%";
    const nextBtnTop = document.getElementById("next-level-btn");
    if(nextBtnTop) nextBtnTop.style.display = "block"; // Auch den kleinen Button oben zeigen

    // Zeige fettes Overlay
    overlay.style.display = "flex";

    // --- CONFETTI (Nur beim Finale) ---
    if (isFinale) {
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


