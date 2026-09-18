(() => {
    "use strict";
    const config = window.AgentAccountConfig;
    if (!config?.enabled) return;
    const remote = window.AgentPyRemoteLearningData;
    const client = remote.createClient({ endpoint: config.endpoint });
    const domReady = document.readyState === "loading"
        ? new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true })) : Promise.resolve();
    document.documentElement.classList.add("account-blocked");
    let session = null;
    let controls = null;
    let invalidated = false;
    let checking = false;
    let panel, message, loginButton, logoutButton, retryButton, reloadButton, exportButton;
    let channel;
    try { channel = new BroadcastChannel("agentpy-account-v1"); } catch (_) { /* Focus check remains active. */ }
    function show(text) { if (message) message.textContent = text; }
    function block(failure, erase = false) {
        document.documentElement.classList.add("account-blocked");
        show(failure.message);
        if (reloadButton) reloadButton.hidden = false;
        if (erase) {
            invalidated = true;
            window.AgentLearningData?.dispose();
            window.editor?.setValue("");
            if (exportButton) exportButton.hidden = true;
        }
    }
    function snapshotCode() { return window.editor?.getValue?.() ?? document.getElementById("python-editor")?.value ?? ""; }
    function exportCode() {
        const blob = new Blob([snapshotCode()], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = "agentpy-code.txt"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function announceChange() { channel?.postMessage({ type: "account-changed" }); }
    function button(label, action) {
        const element = document.createElement("button");
        element.type = "button"; element.textContent = label;
        element.addEventListener("click", action); return element;
    }
    function reload() {
        if (controls?.hasUnconfirmed() && !window.confirm("Nicht bestätigte Änderungen oder unfertiger Code gehen beim Neuladen verloren. Hast du deinen Code gesichert?")) return;
        window.location.reload();
    }
    async function loginDialog() {
        if (controls?.hasUnconfirmed()) return;
        const dialog = document.createElement("dialog");
        dialog.className = "account-dialog";
        dialog.setAttribute("aria-label", "Am Schulkonto anmelden");
        dialog.innerHTML = '<form><h2>Am Schulkonto anmelden</h2><p>Gaststand und Kontostand bleiben getrennt. Es wird nichts automatisch übernommen.</p><label>E-Mail-Adresse<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><p role="alert"></p><button type="submit">Anmelden</button><button type="button" data-cancel>Abbrechen</button><p>Du brauchst ein eingerichtetes Pilotkonto. Bei vergessenem Passwort wende dich vorerst an deine Lehrperson.</p></form>';
        const form = dialog.querySelector("form");
        const submit = form.querySelector('[type="submit"]');
        const cancel = form.querySelector("[data-cancel]");
        let busy = false;
        cancel.addEventListener("click", () => dialog.close());
        dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
        dialog.addEventListener("close", () => { dialog.remove(); loginButton.focus(); });
        form.addEventListener("submit", async event => {
            event.preventDefault(); if (busy) return;
            busy = true; submit.disabled = true; cancel.disabled = true;
            const password = form.elements.password.value;
            form.elements.password.value = "";
            try {
                // Refresh the CSRF token without silently replacing any loaded profile.
                const current = await client.request("session");
                if (invalidated) throw remote.error("PROFILE_CHANGED");
                if (current.profile) { announceChange(); window.location.reload(); return; }
                await client.request("login", { body: { email: form.elements.email.value, password }, csrfToken: current.csrfToken });
                window.AgentLearningData?.dispose(); announceChange(); window.location.reload();
            } catch (failure) { form.querySelector('[role="alert"]').textContent = failure.message; }
            finally { busy = false; submit.disabled = false; cancel.disabled = false; }
        });
        document.body.appendChild(dialog); dialog.showModal();
    }
    async function logout() {
        if (controls?.hasUnconfirmed() && !window.confirm("Nicht zentral bestätigte Änderungen gehen beim Abmelden verloren. Code zuvor sichern. Trotzdem abmelden?")) return;
        logoutButton.disabled = true;
        try {
            await client.request("logout", { body: {}, csrfToken: session.csrfToken, profileId: session.profile.id });
            window.AgentLearningData?.dispose(); announceChange(); window.location.reload();
        } catch (failure) { show(failure.message); }
        finally { logoutButton.disabled = false; }
    }
    async function mount() {
        await domReady;
        panel = document.createElement("aside"); panel.className = "account-panel"; panel.setAttribute("aria-label", "Konto und Speicherung");
        message = document.createElement("p"); message.setAttribute("role", "status"); message.textContent = "Konto und Lernstand werden geprüft …";
        loginButton = button("Anmelden", loginDialog);
        logoutButton = button("Abmelden", logout);
        retryButton = button("Speichern erneut versuchen", async () => {
            retryButton.disabled = true;
            try {
                const result = await controls?.retry();
                if (result?.ok) window.applyUnlocks?.();
            } finally { retryButton.disabled = false; }
        });
        reloadButton = button("Seite neu laden", reload);
        exportButton = button("Code sichern", exportCode);
        for (const item of [loginButton, logoutButton, retryButton, reloadButton, exportButton]) item.hidden = true;
        panel.append(message, loginButton, logoutButton, retryButton, reloadButton, exportButton);
        document.body.appendChild(panel);
    }
    const mounted = mount();
    function storageStatus(status) {
        show(status.message);
        retryButton.hidden = !["error"].includes(status.type) || [401, 403, 409].includes(status.error?.status);
        reloadButton.hidden = !["error", "conflict"].includes(status.type);
        if (["PROFILE_CHANGED", "AUTH_REQUIRED", "CSRF_MISMATCH"].includes(status.error?.code)) {
            // A changed account must not display the previous person's editor.
            block(status.error, status.error.code === "PROFILE_CHANGED");
        }
    }
    async function checkIdentity() {
        if (!session || invalidated || checking) return;
        checking = true;
        document.documentElement.classList.add("account-blocked");
        try {
            const current = await client.request("session");
            if (invalidated) return;
            if (current.profile?.id !== session.profile?.id || current.csrfToken !== session.csrfToken) {
                block(remote.error("PROFILE_CHANGED"), true); return;
            }
            document.documentElement.classList.remove("account-blocked");
        } catch (failure) { block(failure); }
        finally { checking = false; }
    }
    channel?.addEventListener("message", event => {
        if (event.data?.type === "account-changed") block(remote.error("PROFILE_CHANGED"), true);
    });
    window.addEventListener("focus", checkIdentity);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) checkIdentity(); });
    window.addEventListener("pageshow", event => { if (event.persisted) checkIdentity(); });
    window.addEventListener("pagehide", () => document.documentElement.classList.add("account-blocked"));
    window.addEventListener("beforeunload", event => {
        if (controls?.hasUnconfirmed()) { event.preventDefault(); event.returnValue = ""; }
    });
    // Defense in depth: no clicks/keyboard actions before readiness, even if CSS is unavailable.
    for (const type of ["click", "keydown", "submit"]) document.addEventListener(type, event => {
        if (document.documentElement.classList.contains("account-blocked") && !event.target.closest?.(".account-panel, .account-dialog")) {
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, true);
    let started = false;
    window.AgentAccount = Object.freeze({
        start({ createGuest, attach } = {}) {
            if (started) throw new Error("Account bootstrap already started");
            started = true;
            return (async () => {
                await mounted;
                try {
                    session = await client.request("session");
                    if (invalidated) throw remote.error("PROFILE_CHANGED");
                    if (!session || typeof session.csrfToken !== "string" || !Object.hasOwn(session, "profile")) throw remote.error("INVALID_RESPONSE");
                    if (session.profile === null) {
                        if (createGuest) attach(createGuest());
                        loginButton.hidden = false;
                        show("Gastmodus · nur in diesem Browser gespeichert.");
                    } else {
                        if (typeof session.profile.id !== "string" || typeof session.profile.email !== "string") throw remote.error("INVALID_RESPONSE");
                        if (attach) {
                            const response = await client.request("state", { profileId: session.profile.id });
                            if (invalidated) throw remote.error("PROFILE_CHANGED");
                            if (response.profile?.id !== session.profile.id) throw remote.error("PROFILE_CHANGED");
                            const stores = remote.createRemoteLearningStores({ client, profile: session.profile, csrfToken: session.csrfToken, initialState: response.state, saveMode: config.saveMode });
                            controls = stores.controls;
                            const learningData = window.AgentLearningDataCore.createLearningSession({ context: { kind: "authenticated", profileId: session.profile.id }, ...stores });
                            // Device settings in logged-in mode stay ephemeral; do not open the guest store.
                            let teacher = window.location.hash === "#l";
                            const deviceSettings = Object.freeze({ isTeacherMode: () => teacher, enableTeacherMode: () => (teacher = true), clear: () => { teacher = false; return true; } });
                            attach({ learningData, deviceSettings });
                            controls.subscribe(storageStatus);
                        }
                        logoutButton.hidden = false;
                        const identity = session.profile.name && session.profile.className
                            ? `${session.profile.name} · Klasse ${session.profile.className} · ${session.profile.email}` : session.profile.email;
                        show(`${identity} · ${config.saveMode === "completion-only" ? "Nur erfolgreiche Abschlüsse werden zentral gesichert." : "Ausgeführter Code und Abschlüsse werden zentral gesichert."}`);
                    }
                    exportButton.hidden = !document.getElementById("python-editor");
                    if (invalidated) throw remote.error("PROFILE_CHANGED");
                    document.documentElement.classList.remove("account-blocked");
                    return true;
                } catch (failure) { block(failure); return false; }
            })();
        }
    });
    // Home page has no runner, but provides the same login/logout controls.
    if (!document.querySelector('script[src*="assets/runner.js"]') && document.currentScript?.hasAttribute("data-account-home")) {
        window.AgentLearningDataReady = window.AgentAccount.start();
    }
})();
