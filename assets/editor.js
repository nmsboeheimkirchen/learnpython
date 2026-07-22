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

    // Firefox kann das Gutter vor dem ersten stabilen Layout falsch vermessen.
    // Mehrere Refresh-Punkte halten Zeilennummern auch bei Zoom, Back/Forward und
    // spät verfügbaren Schriften deckungsgleich mit den Codezeilen.
    const refreshEditor = () => window.editor?.refresh?.();
    if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => window.requestAnimationFrame(refreshEditor));
    }
    window.addEventListener?.("load", refreshEditor, { once: true });
    window.addEventListener?.("pageshow", refreshEditor);
    document.fonts?.ready?.then?.(refreshEditor);

    if (typeof window.ResizeObserver === "function") {
        const wrapper = window.editor.getWrapperElement?.();
        if (wrapper) {
            let measuredWidth = wrapper.getBoundingClientRect().width;
            const resizeObserver = new window.ResizeObserver(entries => {
                const nextWidth = entries[0]?.contentRect?.width;
                if (!Number.isFinite(nextWidth) || nextWidth === measuredWidth) return;
                measuredWidth = nextWidth;
                refreshEditor();
            });
            resizeObserver.observe(wrapper);
        }
    }
})();
