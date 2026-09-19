(() => {
    "use strict";
    const ready = document.readyState === "loading"
        ? new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true })) : Promise.resolve();
    // Fullscreen also works in guest-only builds; it neither reads nor writes learning data.
    ready.then(() => {
        let actions = document.querySelector("[data-account-actions]");
        if (!actions) {
            actions = document.createElement("div"); actions.className = "account-toolbar";
            document.body.appendChild(actions);
        }
        const fullscreen = document.createElement("button"); fullscreen.type = "button";
        fullscreen.className = "account-fullscreen";
        const update = () => {
            fullscreen.textContent = document.fullscreenElement ? "Vollbild beenden" : "Vollbild";
            fullscreen.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
        };
        update(); actions.appendChild(fullscreen);
        fullscreen.addEventListener("click", async () => {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
                else window.alert("Vollbild wird hier nicht unterstützt. Am Laptop kannst du F11 versuchen.");
            } catch (_) { window.alert("Vollbild ist in diesem Browser gerade nicht möglich. Am Laptop kannst du F11 versuchen."); }
        });
        document.addEventListener("fullscreenchange", update);
    });
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
    function passwordVisibility(form) {
        const input = form.querySelector('input[name="password"]');
        const toggle = button("Passwort anzeigen", () => {
            const visible = input.type === "password";
            input.type = visible ? "text" : "password";
            toggle.textContent = visible ? "Passwort verbergen" : "Passwort anzeigen";
            toggle.setAttribute("aria-pressed", String(visible));
        });
        toggle.setAttribute("aria-pressed", "false"); input.closest("label").after(toggle);
    }
    async function registrationRequest(action, body) {
        const current = await client.request("session");
        if (invalidated) throw remote.error("PROFILE_CHANGED");
        if (current.profile) throw remote.error("ALREADY_SIGNED_IN");
        return client.request(action, { body, csrfToken: current.csrfToken });
    }
    function registrationDialog(verificationToken = null) {
        if (controls?.hasUnconfirmed()) return;
        const dialog = document.createElement("dialog"); dialog.className = "account-dialog";
        dialog.setAttribute("aria-label", verificationToken ? "E-Mail bestätigen" : "Neuanmeldung");
        let busy = false, phase = verificationToken ? "verify" : "code", className = "";
        async function leaveRegistration(openLogin = false) {
            busy = true;
            dialog.querySelectorAll('button').forEach(item => { item.disabled = true; });
            // Finish session/CSRF requests BEFORE login can rotate the session cookie.
            // A fire-and-forget request in the close event can race the subsequent login.
            try { await registrationRequest("cancel-registration", {}); } catch (_) { /* Grant expires too. */ }
            busy = false; dialog.close();
            if (openLogin) loginDialog();
        }
        dialog.addEventListener("cancel", event => {
            event.preventDefault(); if (!busy) leaveRegistration();
        });
        dialog.addEventListener("close", () => {
            dialog.querySelectorAll('input[name="password"]').forEach(input => { input.value = ""; input.type = "password"; });
            verificationToken = null; dialog.remove();
            if (!document.querySelector('dialog[open]')) loginButton.focus();
            if (!session?.profile) show("Gastmodus · nur in diesem Browser gespeichert.");
        });
        function render() {
            const heading = phase === "code" ? "Gib deinen Klassencode ein" : phase === "register" ? "Willkommen" : phase === "verify" ? "E-Mail bestätigen" : "Prüfe dein Postfach";
            dialog.innerHTML = '<form><h2></h2><p data-intro></p><div data-fields></div><p role="alert"></p><button type="submit"></button><button type="button" data-cancel>Abbrechen · Gastmodus</button></form>';
            const form = dialog.querySelector("form"); form.querySelector("h2").textContent = heading;
            const intro = form.querySelector("[data-intro]");
            const fields = form.querySelector("[data-fields]");
            const submit = form.querySelector('[type="submit"]');
            const cancel = form.querySelector("[data-cancel]");
            if (phase === "code") {
                fields.innerHTML = '<label>Klassencode<input name="code" required minlength="5" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>';
                intro.textContent = "Den Code bekommst du von deiner Lehrperson."; submit.textContent = "Klassencode prüfen";
            } else if (phase === "register") {
                intro.textContent = `Willkommen in ${className}! Lege dein Konto an.`;
                fields.innerHTML = '<label>Name<input name="name" autocomplete="name" required maxlength="100"></label><label>E-Mail-Adresse<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Passwort (mindestens 8 Zeichen)<input name="password" type="password" autocomplete="new-password" required></label>';
                passwordVisibility(form); submit.textContent = "Konto anlegen";
            } else if (phase === "verify") {
                intro.textContent = "Bestätige deine E-Mail-Adresse. Anschließend kannst du dich auf jedem Gerät anmelden.";
                submit.textContent = "E-Mail jetzt bestätigen";
            }
            cancel.addEventListener("click", () => { if (!busy) leaveRegistration(); });
            form.addEventListener("submit", async event => {
                event.preventDefault(); if (busy) return;
                busy = true; submit.disabled = true; cancel.disabled = true;
                const alert = form.querySelector('[role="alert"]'); alert.textContent = "";
                try {
                    if (phase === "code") {
                        const result = await registrationRequest("check-invitation", { code: form.elements.code.value });
                        className = result.className; phase = "register"; render();
                    } else if (phase === "register") {
                        const password = form.elements.password.value;
                        const result = await registrationRequest("register", { name: form.elements.name.value, email: form.elements.email.value, password });
                        form.elements.password.value = "";
                        phase = "sent"; render();
                        // MAIL-TRANSPORT-LIMIT: derive the notice from the worker's server policy.
                        // Hosting/SMTP changes must update policy, queue and tests together.
                        const note = dialog.querySelector("[data-intro]");
                        note.textContent = `Wenn deine Adresse noch kein Konto hat, senden wir dir eine Bestätigungs-E-Mail. Öffne dein E-Mail-Programm, zum Beispiel Outlook, und klicke auf den Bestätigungslink. Wenn sich gerade deine ganze Klasse anmeldet, hab bitte etwas Geduld: Wir verschicken höchstens ${result.mailPolicy.perMinute} Bestätigungsmails pro Minute. Schau auch im Spam-Ordner nach. Wenn keine E-Mail ankommt, frage deine Lehrperson.`;
                        if (result.mailPolicy.dailyLimitReached) note.textContent += " Das Tageslimit ist gerade erreicht. Deine Anmeldung bleibt vorgemerkt; der Versand kann bis morgen dauern.";
                        dialog.querySelector('[type="submit"]').hidden = true;
                        dialog.querySelector("[data-cancel]").textContent = "Weiter im Gastmodus";
                    } else if (phase === "verify") {
                        await registrationRequest("verify-email", { token: verificationToken });
                        verificationToken = null; phase = "verified";
                        intro.textContent = "Deine E-Mail-Adresse ist bestätigt. Du kannst dich jetzt anmelden.";
                        submit.textContent = "Zur Anmeldung"; cancel.textContent = "Weiter im Gastmodus";
                    } else if (phase === "verified") { await leaveRegistration(true); }
                } catch (failure) {
                    alert.textContent = failure.message;
                    if (failure.attemptsLeft) alert.textContent += ` Noch ${failure.attemptsLeft} Versuche.`;
                    if (failure.retryAfter) alert.textContent += ` Wartezeit: ${Math.ceil(failure.retryAfter / 60)} Minute(n).`;
                    if (phase === "register") { form.elements.password.value = ""; form.elements.password.type = "password"; }
                } finally {
                    busy = false;
                    dialog.querySelectorAll('button').forEach(item => { item.disabled = false; });
                    if (form.isConnected) { submit.disabled = false; cancel.disabled = false; }
                }
            });
            fields.querySelector("input")?.focus();
        }
        render(); document.body.appendChild(dialog); dialog.showModal();
    }
    async function loginDialog() {
        if (controls?.hasUnconfirmed()) return;
        const dialog = document.createElement("dialog");
        dialog.className = "account-dialog";
        dialog.setAttribute("aria-label", "Am Schulkonto anmelden");
        dialog.innerHTML = '<form><h2>Am Schulkonto anmelden</h2><p>Gaststand und Kontostand bleiben getrennt. Es wird nichts automatisch übernommen.</p><label>E-Mail-Adresse<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><p role="alert"></p><button type="submit">Anmelden</button><button type="button" data-cancel>Abbrechen</button><p>Zur Neuanmeldung brauchst du einen Klassencode.</p><button class="account-register-link" type="button" data-register>Neuanmeldung</button><p>Passwort vergessen? Wende dich vorerst an deine Lehrperson.</p></form>';
        const form = dialog.querySelector("form");
        passwordVisibility(form);
        form.querySelector("[data-register]").addEventListener("click", () => { if (!busy) { dialog.close(); registrationDialog(); } });
        const submit = form.querySelector('[type="submit"]');
        const cancel = form.querySelector("[data-cancel]");
        let busy = false;
        cancel.addEventListener("click", () => dialog.close());
        dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
        dialog.addEventListener("close", () => {
            form.elements.password.value = ""; form.elements.password.type = "password";
            dialog.remove(); if (!document.querySelector('dialog[open]')) loginButton.focus();
        });
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
        const headerActions = document.querySelector("[data-account-actions]");
        if (headerActions) headerActions.appendChild(loginButton);
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
                    if (/^#verify=/.test(window.location.hash)) {
                        const token = window.location.hash.slice(8);
                        history.replaceState(null, "", window.location.pathname + window.location.search);
                        registrationDialog(token);
                    }
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
