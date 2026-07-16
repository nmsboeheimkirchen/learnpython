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
})();
