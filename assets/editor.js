(() => {
    const textarea = document.getElementById("python-editor");
    if (!textarea) {
        throw new Error("Python-Editor konnte nicht gefunden werden.");
    }
    if (!window.CodeMirror || typeof window.CodeMirror.fromTextArea !== "function") {
        throw new Error("CodeMirror konnte nicht geladen werden.");
    }

    window.editor = window.CodeMirror.fromTextArea(textarea, {
        mode: "python",
        theme: "monokai",
        lineNumbers: true,
        indentUnit: 4
    });
    window.editor.on("change", (_editor, change) => {
        // Restoration/template replacement is programmatic; typing, undo, paste
        // and IME edits need a loss warning until explicitly saved or executed.
        if (change.origin !== "setValue") window.AgentAccount?.editorChanged?.();
    });

    // Layout/zoom/font refresh is registered centrally in editor-layout.js.
})();
