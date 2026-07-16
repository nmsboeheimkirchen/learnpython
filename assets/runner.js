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
    "link-m3-l3": "mission3_level3.html"
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

function clearProgress() {
    safeStorageRemoveItem(PROGRESS_STORAGE_KEY);
    safeStorageRemoveItem(COMPLETED_CODE_STORAGE_KEY);
    safeStorageRemoveItem(TEACHER_MODE_STORAGE_KEY);
}

function toggleNav() {
    const sb = document.getElementById('mySidebar');
    safeStorageSetItem('sidebarState', sb.classList.contains('active') ? 'closed' : 'open');
    const sidebar = document.getElementById("mySidebar");
    const mainContent = document.getElementById("main-content");
    const menuBtn = document.getElementById("menu-btn");
    
    if (sidebar.classList.contains("active")) {
        sidebar.classList.remove("active");
        mainContent.style.paddingLeft = "60px";
        menuBtn.innerHTML = "☰";
        menuBtn.classList.remove("inside-sidebar");
    } else {
        sidebar.classList.add("active");
        mainContent.style.paddingLeft = "280px";
        menuBtn.innerHTML = "✕";
        menuBtn.classList.add("inside-sidebar");
    }
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
    link.textContent = link.textContent.replace(/\s*🔒/g, "");
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
    const savedState = safeStorageGetItem('sidebarState');
    if (savedState === 'closed') { 
        document.getElementById('mySidebar').classList.remove('active'); 
        document.getElementById('main-content').style.paddingLeft = '60px'; 
        const btn = document.getElementById('menu-btn');
        btn.innerHTML = '☰';
        btn.classList.remove('inside-sidebar');
    }
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
    let currentPage = window.location.pathname.split("/").pop();
    if(currentPage === 'index.html' || currentPage === '') currentPage = 'mission1_level1.html';
    document.querySelectorAll('.sidebar a').forEach(link => {
        if(link.getAttribute('href') === currentPage && !link.id.includes('title')) {
            link.classList.add('active-link');
        } else {
            link.classList.remove('active-link');
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
    mission3_level3: { unlocks: [], finale: true }
};

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

    const restoreCode = () => restoreCompletedLevelCode(levelId);
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
            triggerSuccess(Boolean(outcome.finale));
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

function triggerSuccess(isFinale = false) {
    // Falls das Success-Overlay nicht existiert, bauen wir es dynamisch ins Dokument ein
    let overlay = document.getElementById("success-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "success-overlay";
        overlay.className = "success-overlay";
        
        let titleText = isFinale ? "MISSION ERFÜLLT" : "LEVEL GESCHAFFT";
        let subText = isFinale ? "Sehr starker Code, Agent!" : "Gut gemacht! Weiter geht's.";

                overlay.innerHTML = `
            <div class="success-badge">
                <div class="trophy">🏆</div>
                <h1>${titleText}</h1>
                <p>${subText}</p>
                <div class="btn-container"></div>
                <button class="close-overlay-btn" onclick="document.getElementById('success-overlay').style.display='none'" style="margin-top: 20px; background: transparent; color: #5f6368; border: none; cursor: pointer; text-decoration: underline; font-size: 14px;">Weiterspielen / Editor ansehen</button>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Wir clonen den nächsten-Level-Button von oben in unser Pop-up
        const nextBtnSource = document.getElementById("next-level-btn");
        if (nextBtnSource) {
            const btnClone = nextBtnSource.cloneNode(true);
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


