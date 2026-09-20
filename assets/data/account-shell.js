(() => {
    "use strict";
    const frame = document.getElementById("account-lesson");
    const base = new URL(".", location.href);
    // Only public, local course documents. Never turn the shell into a URL proxy.
    function localScreen(value) {
        let target;
        try { target = new URL(value || "index.html", base); } catch (_) { return "index.html"; }
        const file = target.pathname.slice(base.pathname.length);
        if (target.origin !== base.origin || target.username || target.password || !target.pathname.startsWith(base.pathname)
            || !/^[a-z0-9_-]+\.html$/i.test(file) || file.toLowerCase() === "app.html") return "index.html";
        return file + target.search + target.hash;
    }
    function screenFromAddress() {
        return localScreen(new URL(location.href).searchParams.get("screen")) + location.hash;
    }
    // The browser's joint session history includes iframe navigations. Replace (do not
    // push) the outer address on load: one Back step remains one lesson navigation.
    frame.addEventListener("load", () => {
        try {
            const child = frame.contentWindow;
            const screen = localScreen(child.location.href);
            const target = new URL("app.html", base);
            const [path, hash] = screen.split("#");
            target.searchParams.set("screen", path);
            if (hash && !hash.startsWith("verify=")) target.hash = hash;
            history.replaceState(null, "", target);
            document.title = child.document.title || "AGENT PY";
        } catch (_) { /* Browser blocks reading an external target; never trust it. */ }
    });
    window.addEventListener("popstate", () => {
        // Joint history restores the child automatically, including its BFCache.
        // Its pageshow handler rechecks identity before enabling the lesson.
    });
    frame.src = screenFromAddress();
})();
