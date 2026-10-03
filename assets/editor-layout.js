// Shared by every CodeMirror editor, including the drone and helicopter missions.
(() => {
    "use strict";
    window.CodeMirror.defineInitHook(editor => {
        const wrapper = editor.getWrapperElement();
        const alignScaledGutters = () => {
            if (!wrapper.isConnected || !editor.getOption("fixedGutter")) return;
            const width = Number.parseFloat(window.getComputedStyle(wrapper).width);
            const scale = wrapper.getBoundingClientRect().width / width;
            if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 0.001) return;
            const scroller = editor.getScrollerElement();
            const sizer = wrapper.querySelector(".CodeMirror-sizer");
            const gutters = wrapper.querySelector(".CodeMirror-gutters");
            if (!sizer || !gutters) return;
            // CM 5.65.2 mixes visual getBoundingClientRect distances with CSS px
            // for fixed gutters. Under CSS zoom/transform this moves the opaque
            // gutter over the code. Normalize the distance before positioning.
            const left = (scroller.getBoundingClientRect().left - sizer.getBoundingClientRect().left) / scale;
            gutters.style.left = `${left + gutters.offsetWidth}px`;
            wrapper.querySelectorAll(".CodeMirror-gutter-wrapper, .CodeMirror-gutter-background")
                .forEach(element => { element.style.left = `${left}px`; });
        };
        editor.on("update", alignScaledGutters);
        editor.on("scroll", alignScaledGutters);
        let pending = false;
        const scheduleRefresh = () => {
            if (pending) return;
            pending = true;
            // fromTextArea inserts the wrapper after the init hook; wait for layout.
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
                pending = false;
                if (wrapper.isConnected && wrapper.getBoundingClientRect().width > 0) {
                    editor.refresh();
                }
            }));
        };

        scheduleRefresh();
        window.addEventListener("load", scheduleRefresh, { once: true });
        window.addEventListener("pageshow", scheduleRefresh);
        window.addEventListener("resize", scheduleRefresh);
        window.visualViewport?.addEventListener("resize", scheduleRefresh);
        document.fonts?.ready.then(scheduleRefresh);
        document.fonts?.addEventListener("loadingdone", scheduleRefresh);

        if (window.ResizeObserver) {
            let previousSize = "";
            new window.ResizeObserver(() => {
                const rect = wrapper.getBoundingClientRect();
                const size = `${rect.width}:${rect.height}`;
                if (size === previousSize) return;
                previousSize = size;
                scheduleRefresh();
            }).observe(wrapper);
        }

        // Desktop zoom / moving between screens can change DPR without a new width.
        const watchResolution = () => {
            const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            const changed = () => {
                if (query.removeEventListener) query.removeEventListener("change", changed);
                else query.removeListener(changed);
                scheduleRefresh();
                watchResolution();
            };
            if (query.addEventListener) query.addEventListener("change", changed);
            else query.addListener(changed);
        };
        watchResolution();
    });
})();
