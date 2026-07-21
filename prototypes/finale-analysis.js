(() => {
    "use strict";

    function pythonName(value) {
        if (typeof value === "string") return value;
        if (typeof value?.v === "string") return value.v;
        if (typeof value?.$jsstr === "function") return value.$jsstr();
        return value == null ? "" : String(value);
    }

    function stripCommentsAndStrings(source) {
        const characters = [...String(source)];
        let index = 0;

        while (index < characters.length) {
            const character = characters[index];
            if (character === "#") {
                while (index < characters.length && characters[index] !== "\n") {
                    characters[index] = " ";
                    index += 1;
                }
                continue;
            }

            if (character !== "'" && character !== '"') {
                index += 1;
                continue;
            }

            const quote = character;
            const triple = characters[index + 1] === quote && characters[index + 2] === quote;
            const quoteLength = triple ? 3 : 1;
            for (let offset = 0; offset < quoteLength; offset += 1) characters[index + offset] = " ";
            index += quoteLength;

            while (index < characters.length) {
                if (characters[index] === "\\") {
                    characters[index] = " ";
                    if (index + 1 < characters.length && characters[index + 1] !== "\n") {
                        characters[index + 1] = " ";
                    }
                    index += 2;
                    continue;
                }

                const closesString = triple
                    ? characters[index] === quote && characters[index + 1] === quote && characters[index + 2] === quote
                    : characters[index] === quote;
                if (closesString) {
                    for (let offset = 0; offset < quoteLength; offset += 1) characters[index + offset] = " ";
                    index += quoteLength;
                    break;
                }

                if (characters[index] !== "\n") characters[index] = " ";
                index += 1;
            }
        }

        return characters.join("");
    }

    function fallbackAnalysis(source) {
        const sanitized = stripCommentsAndStrings(source);
        const statusLiteral = String(source).match(/\bstatus\s*=\s*\{([^{}]*)\}/)?.[1] ?? "";
        const statusKeys = [...statusLiteral.matchAll(/["']([^"']+)["']\s*:/g)].map(match => match[1]).sort();
        const functionNames = [...sanitized.matchAll(/^\s*def\s+([A-Za-z_]\w*)\s*\(/gm)].map(match => match[1]);
        const withoutDefinitionHeaders = sanitized.replace(
            /^(\s*def\s+)([A-Za-z_]\w*)(\s*\()/gm,
            (_match, prefix, name, suffix) => prefix + " ".repeat(name.length) + suffix
        );
        const calledFunctionNames = functionNames.filter(name => (
            new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(").test(withoutDefinitionHeaders)
        ));

        return {
            syntaxValid: true,
            hasIf: /^\s*if\b[^\n]*:/m.test(sanitized),
            importsTurtle: /^\s*(?:import\s+[^\n#]*\bturtle\b|from\s+turtle\s+import\b)/m.test(sanitized),
            usesTurtleMovement: /\.\s*(?:goto|forward|backward|setpos|setposition)\s*\(/.test(sanitized),
            functionNames,
            calledFunctionNames,
            topLevelCalledFunctionNames: calledFunctionNames,
            hasExactStatusDictionary: statusKeys.length === 2 && statusKeys[0] === "DROHNE" && statusKeys[1] === "TRANSPONDER"
        };
    }

    function astAnalysis(source) {
        const parsed = window.Sk.parse("<finale-validation>", source);
        const root = window.Sk.astFromParse(parsed.cst, "<finale-validation>", parsed.flags);
        const functionNames = new Set();
        const calledFunctionNames = new Set();
        const topLevelCalledFunctionNames = new Set();
        let hasIf = false;
        let importsTurtle = false;
        let usesTurtleMovement = false;
        let hasExactStatusDictionary = false;

        function stringLiteral(node) {
            if (!node) return null;
            if (node._astname === "Str" || node._astname === "Constant") {
                return pythonName(node.s ?? node.value);
            }
            return null;
        }

        function checkStatusAssignment(node) {
            if (node._astname !== "Assign" || node.targets?.length !== 1) return;
            const target = node.targets[0];
            if (target?._astname !== "Name" || pythonName(target.id) !== "status") return;
            const value = node.value;
            if (value?._astname !== "Dict" || value.keys?.length !== 2) return;
            const keys = value.keys.map(stringLiteral).filter(key => key !== null).sort();
            hasExactStatusDictionary = keys.length === 2 && keys[0] === "DROHNE" && keys[1] === "TRANSPONDER";
        }

        function visit(node, functionDepth = 0) {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) {
                node.forEach(child => visit(child, functionDepth));
                return;
            }

            const type = node._astname;
            if (!type) return;
            if (type === "If") hasIf = true;
            checkStatusAssignment(node);

            if (type === "Import") {
                importsTurtle ||= node.names?.some(alias => pythonName(alias.name) === "turtle");
            } else if (type === "ImportFrom") {
                importsTurtle ||= pythonName(node.module) === "turtle";
            }

            let childFunctionDepth = functionDepth;
            if (type === "FunctionDef" || type === "AsyncFunctionDef") {
                functionNames.add(pythonName(node.name));
                childFunctionDepth += 1;
            }

            if (type === "Call") {
                const called = node.func;
                if (called?._astname === "Name") {
                    const name = pythonName(called.id);
                    calledFunctionNames.add(name);
                    if (functionDepth === 0) topLevelCalledFunctionNames.add(name);
                } else if (called?._astname === "Attribute") {
                    const attribute = pythonName(called.attr);
                    if (["goto", "forward", "backward", "setpos", "setposition"].includes(attribute)) {
                        usesTurtleMovement = true;
                    }
                }
            }

            const fields = node._fields || [];
            for (let index = 0; index < fields.length; index += 2) {
                const fieldName = fields[index];
                const getter = fields[index + 1];
                const child = node[fieldName] ?? (typeof getter === "function" ? getter(node) : undefined);
                visit(child, childFunctionDepth);
            }
        }

        visit(root);
        return {
            syntaxValid: true,
            hasIf,
            importsTurtle,
            usesTurtleMovement,
            functionNames: [...functionNames],
            calledFunctionNames: [...calledFunctionNames],
            topLevelCalledFunctionNames: [...topLevelCalledFunctionNames],
            hasExactStatusDictionary
        };
    }

    function analyze(source) {
        if (window.Sk?.parse && window.Sk?.astFromParse) {
            try {
                return astAnalysis(String(source));
            } catch (_error) {
                return { ...fallbackAnalysis(source), syntaxValid: false };
            }
        }
        return fallbackAnalysis(source);
    }

    window.FinalePythonAnalysis = { analyze };
})();
