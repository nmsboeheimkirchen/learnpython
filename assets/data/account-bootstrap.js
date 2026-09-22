(() => {
    "use strict";
    const config = window.AgentAccountConfig;
    const scriptURL = new URL(document.currentScript.src, location.href);
    const progressModuleURL = new URL("course-progress.js" + scriptURL.search, scriptURL).href;
    const isShell = document.documentElement.hasAttribute("data-account-shell");
    let shell = null;
    try {
        if (window.parent !== window && window.parent.location.origin === location.origin
            && window.parent.document.documentElement.hasAttribute("data-account-shell")
            && window.parent.document.getElementById("account-lesson")?.contentWindow === window) shell = window.parent;
    } catch (_) { /* Not our shell. */ }
    if (!isShell && !shell && config?.enabled && config.shell) {
        const target = new URL("app.html", location.href);
        target.searchParams.set("screen", location.pathname.split("/").pop() || "index.html");
        // Verification secrets remain fragments, never query parameters or logs.
        target.searchParams.set("screen", (location.pathname.split("/").pop() || "index.html") + location.search);
        target.hash = location.hash;
        // Runner scripts parsed before navigation commits must wait, not initialize a guest.
        window.AgentAccount = Object.freeze({ start: () => new Promise(() => {}) });
        location.replace(target.href);
        return;
    }
    const ui = shell?.document || document;
    if (shell) document.documentElement.classList.add("account-in-shell");
    let lifetime = new AbortController();
    // Small local vector set adapted from Lucide/Feather (assets/icons/LICENSE).
    // Matches the approved preview; no remote font/CDN.
    const paths = {
        expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
        collapse: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>',
        person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
        hidden: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.5 6.5A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.5-1.5"/>',
        progress: '<path d="M5 20v-5M12 20V9M19 20V3"/>',
        save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M9 12h12m-5-5 5 5-5 5"/>'
        ,classes: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>'
    };
    function icon(name, filled = false) {
        return `<svg viewBox="0 0 24 24" width="24" height="24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
    }
    function iconButton(element, name, label, filled = false) {
        element.innerHTML = icon(name, filled); element.setAttribute("aria-label", label); element.title = label;
    }
    const ready = document.readyState === "loading"
        ? new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true })) : Promise.resolve();
    // Fullscreen also works in guest-only builds; it neither reads nor writes learning data.
    ready.then(() => {
        if (shell) return;
        let actions = document.querySelector("[data-account-actions]");
        if (!actions) {
            actions = document.createElement("div"); actions.className = "account-toolbar";
            document.body.appendChild(actions);
        }
        const fullscreen = document.createElement("button"); fullscreen.type = "button";
        fullscreen.className = "account-fullscreen";
        const update = () => {
            iconButton(fullscreen, document.fullscreenElement ? "collapse" : "expand", document.fullscreenElement ? "Vollbild beenden" : "Vollbild");
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
    if (isShell) return;
    if (!config?.enabled) {
        ready.then(() => updateHomeTarget(null));
        return;
    }
    const pageLevel = location.pathname.split("/").pop().replace(/\.html$/, "");
    if (/^(?:mission[1-4]_level[1-4]|agent_training_level[1-3]|pico_level(?:[1-4]|2a)|pixelmuseum_(?:briefing|finale)|helikopter_flucht_level[12])$/.test(pageLevel)) {
        window.AgentCurrentLevel = ({ pico_level1: "pico_level1_navigation", pico_level4: "pico_level4_memory" })[pageLevel] || pageLevel;
    }
    const remote = window.AgentPyRemoteLearningData;
    const client = remote.createClient({ endpoint: config.endpoint });
    const domReady = document.readyState === "loading"
        ? new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true })) : Promise.resolve();
    document.documentElement.classList.add("account-blocked");
    let session = null;
    let controls = null;
    let invalidated = false;
    let checking = false;
    let panel, message, loginButton, logoutButton, retryButton, reloadButton, exportButton, saveButton;
    let intendedMission = null;
    let dirtyDraft = false;
    let leavingAccount = false;
    function hasUnconfirmed() {
        if (invalidated || leavingAccount) return false;
        return controls?.hasUnconfirmed() || (dirtyDraft && snapshotCode() !== window.AgentLearningData?.getAttemptedCode(window.AgentCurrentLevel));
    }
    let channel;
    try { channel = new BroadcastChannel("agentpy-account-v1"); } catch (_) { /* Focus check remains active. */ }
    function show(text) { if (message) message.textContent = text; }
    // Server-controlled rollout: no registration UI until explicitly enabled.
    function registrationEnabled() { return session?.registration?.enabled === true; }
    function recoveryEnabled() { return session?.recovery?.enabled === true; }
    function block(failure, erase = false) {
        document.documentElement.classList.add("account-blocked");
        show(failure.message);
        if (reloadButton) reloadButton.hidden = false;
        openMenu();
        loginButton?.classList.add("account-attention");
        if (erase) {
            invalidated = true;
            // A temporary focus/session check is not an identity change.
            document.documentElement.classList.add("account-invalidated");
            window.AgentLearningData?.dispose();
            window.editor?.setValue("");
            if (exportButton) exportButton.hidden = true;
            ui.querySelectorAll(".account-dialog").forEach(dialog => { dialog.close(); dialog.remove(); });
            panel?.querySelectorAll("[data-authenticated]").forEach(item => { item.hidden = true; });
            if (saveButton) saveButton.disabled = true;
        }
    }
    function snapshotCode() { return window.editor?.getValue?.() ?? document.getElementById("python-editor")?.value ?? ""; }
    function exportCode() {
        const blob = new Blob([snapshotCode()], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = "agentpy-code.py"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function announceChange() { channel?.postMessage({ type: "account-changed" }); }
    function button(label, action) {
        const element = ui.createElement("button");
        element.type = "button"; element.textContent = label;
        element.addEventListener("click", action); return element;
    }
    function reload() {
        if (hasUnconfirmed() && !window.confirm("Nicht bestätigte Änderungen oder unfertiger Code gehen beim Neuladen verloren. Hast du deinen Code gesichert?")) return;
        leavingAccount = true;
        window.location.reload();
    }
    function passwordVisibility(form, field = "password") {
        const input = form.querySelector(`input[name="${field}"]`);
        const label = field === "confirmation" ? "Wiederholung" : "Passwort";
        const wrap = ui.createElement("span"); wrap.className = "account-password";
        input.replaceWith(wrap); wrap.append(input);
        const toggle = button(label + " anzeigen", () => {
            const visible = input.type === "password";
            input.type = visible ? "text" : "password";
            iconButton(toggle, visible ? "hidden" : "eye", label + (visible ? " verbergen" : " anzeigen"));
            toggle.setAttribute("aria-pressed", String(visible));
        });
        toggle.className = "account-eye"; iconButton(toggle, "eye", label + " anzeigen");
        toggle.setAttribute("aria-pressed", "false"); wrap.append(toggle);
    }
    function clearPasswords(form) {
        for (const input of form.querySelectorAll('input[name=password],input[name=confirmation]')) {
            input.value = ""; input.type = "password";
            const toggle = input.closest('.account-password')?.querySelector('.account-eye');
            if (toggle) {
                iconButton(toggle, "eye", input.name === "confirmation" ? "Wiederholung anzeigen" : "Passwort anzeigen");
                toggle.setAttribute("aria-pressed", "false");
            }
        }
    }
    // Same simple policy as PHP: 8 Unicode characters; no composition rules.
    // Validate before sending, keep the link and both inputs for inline correction.
    function checkNewPassword(form) {
        const input = form.elements.password;
        if (Array.from(input.value).length >= 8 && new TextEncoder().encode(input.value).length <= 72 && !input.value.includes('\0')) {
            input.removeAttribute('aria-invalid'); return true;
        }
        form.querySelector('[role=alert]').textContent = (Array.from(input.value).length < 8
            ? 'Bitte mindestens 8 Zeichen verwenden.' : 'Das Passwort ist zu lang oder enthält ein ungültiges Zeichen. Bitte höchstens 72 UTF-8-Bytes verwenden.')
            + ' Du kannst die Eingabe hier korrigieren.';
        input.setAttribute('aria-invalid','true'); input.focus(); return false;
    }
    async function registrationRequest(action, body) {
        const current = await client.request("session");
        if (invalidated) throw remote.error("PROFILE_CHANGED");
        if (current.profile) throw remote.error("ALREADY_SIGNED_IN");
        return client.request(action, { body, csrfToken: current.csrfToken });
    }
    function registrationDialog(verificationToken = null) {
        if (!registrationEnabled()) {
            show("Neuanmeldung und E-Mail-Bestätigung sind noch nicht freigegeben. Bestehende Konten können sich anmelden.");
            return;
        }
        if (!verificationToken && controls?.hasUnconfirmed()) return;
        closeMenu();
        const dialog = ui.createElement("dialog"); dialog.className = "account-dialog";
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
            clearPasswords(dialog);
            verificationToken = null; dialog.remove();
            if (!ui.querySelector('dialog[open]')) loginButton.focus();
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
            const signedInVerification = phase === "verify" && Boolean(session?.profile);
            if (phase === "code") {
                fields.innerHTML = '<label>Klassencode<input name="code" required minlength="5" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>';
                intro.textContent = "Den Code bekommst du von deiner Lehrperson."; submit.textContent = "Klassencode prüfen";
            } else if (phase === "register") {
                intro.textContent = `Willkommen in ${className}! Lege dein Konto an.`;
                fields.innerHTML = '<label>Name<input name="name" autocomplete="name" required maxlength="100"></label><label>E-Mail-Adresse<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Passwort (mindestens 8 Zeichen)<input name="password" type="password" autocomplete="new-password" required></label><label>Passwort wiederholen<input name="confirmation" type="password" autocomplete="new-password" required></label>';
                passwordVisibility(form); passwordVisibility(form, "confirmation"); submit.textContent = "Konto anlegen";
            } else if (phase === "verify") {
                intro.hidden = signedInVerification;
                intro.textContent = signedInVerification ? "" : "Bestätige deine E-Mail-Adresse. Anschließend kannst du dich auf jedem Gerät anmelden.";
                submit.textContent = signedInVerification ? "Abmelden" : "E-Mail jetzt bestätigen";
                if (signedInVerification) {
                    form.querySelector('[role="alert"]').textContent = remote.error("ALREADY_SIGNED_IN").message;
                    cancel.textContent = "Abbrechen";
                }
            }
            cancel.addEventListener("click", () => { if (!busy) leaveRegistration(); });
            form.addEventListener("submit", async event => {
                event.preventDefault(); if (busy) return;
                if (phase === "register" && !checkNewPassword(form)) return;
                if (phase === "register" && form.elements.password.value !== form.elements.confirmation.value) {
                    form.querySelector('[role="alert"]').textContent = "Die Passwörter stimmen nicht überein. Bitte korrigiere die Wiederholung.";
                    form.elements.confirmation.focus(); return;
                }
                busy = true; submit.disabled = true; cancel.disabled = true;
                const alert = form.querySelector('[role="alert"]'); alert.textContent = "";
                try {
                    if (signedInVerification) {
                        const result = await logout(verificationToken);
                        alert.textContent = result?.message || remote.error("ALREADY_SIGNED_IN").message;
                    } else if (phase === "code") {
                        const result = await registrationRequest("check-invitation", { code: form.elements.code.value });
                        className = result.className; phase = "register"; render();
                    } else if (phase === "register") {
                        const password = form.elements.password.value;
                        const result = await registrationRequest("register", { name: form.elements.name.value, email: form.elements.email.value, password });
                        clearPasswords(form);
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
                    if (phase === "register") clearPasswords(form);
                } finally {
                    busy = false;
                    dialog.querySelectorAll('button').forEach(item => { item.disabled = false; });
                    if (form.isConnected) { submit.disabled = false; cancel.disabled = false; }
                }
            });
            fields.querySelector("input")?.focus();
        }
        render(); ui.body.appendChild(dialog); dialog.showModal();
    }
    async function loginDialog() {
        if (controls?.hasUnconfirmed()) { openMenu(); return; }
        if (hasUnconfirmed() && !window.confirm("Dein noch nicht gespeicherter Gastentwurf wird beim Anmelden nicht übernommen. Trotzdem anmelden?")) return;
        closeMenu();
        const dialog = ui.createElement("dialog");
        dialog.className = "account-dialog";
        dialog.setAttribute("aria-label", "Am Schulkonto anmelden");
        let registrationHint = registrationEnabled()
            ? '<p>Zur Neuanmeldung brauchst du einen Klassencode.</p><button class="account-register-link" type="button" data-register>Neuanmeldung</button>'
            : '<p>Derzeit ist nur die Anmeldung mit einem bestehenden Konto möglich. Neuanmeldung und Klassenbeitritt werden später freigeschaltet.</p>';
        if (recoveryEnabled()) registrationHint += '<button class="account-register-link" type="button" data-forgot>Passwort vergessen?</button>';
        dialog.innerHTML = '<form><h2>Am Schulkonto anmelden</h2><p>Gaststand und Kontostand bleiben getrennt. Es wird nichts automatisch übernommen.</p><label>E-Mail-Adresse<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><p role="alert"></p><button type="submit">Anmelden</button><button type="button" data-cancel>Abbrechen</button>' + registrationHint + '</form>';
        const form = dialog.querySelector("form");
        passwordVisibility(form);
        form.querySelector("[data-register]")?.addEventListener("click", () => { if (!busy) { dialog.close(); dialog.remove(); registrationDialog(); } });
        form.querySelector("[data-forgot]")?.addEventListener("click", () => { if (!busy) { dialog.close(); dialog.remove(); recoveryDialog(); } });
        const submit = form.querySelector('[type="submit"]');
        const cancel = form.querySelector("[data-cancel]");
        let busy = false;
        cancel.addEventListener("click", () => { intendedMission = null; dialog.close(); });
        dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); else intendedMission = null; });
        dialog.addEventListener("close", () => {
            form.elements.password.value = ""; form.elements.password.type = "password";
            dialog.remove(); if (!ui.querySelector('dialog[open]')) loginButton.focus();
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
                if (current.profile) { announceChange(); resumeAfterLogin(); return; }
                await client.request("login", { body: { email: form.elements.email.value, password }, csrfToken: current.csrfToken });
                window.AgentLearningData?.dispose(); announceChange(); resumeAfterLogin();
            } catch (failure) {
                const alert = form.querySelector('[role="alert"]');
                alert.textContent = failure.message;
                if (failure.code === "INVALID_CREDENTIALS") {
                    alert.textContent = "Anmeldung nicht möglich. Mögliche Ursachen:";
                    const list = ui.createElement('ul');
                    for (const text of ["Das Konto wurde noch nicht angelegt.", "Die E-Mail-Adresse wurde noch nicht bestätigt.", "Die E-Mail-Adresse oder das Passwort ist falsch."]) {
                        const item = ui.createElement('li'); item.textContent = text; list.append(item);
                    }
                    alert.append(list);
                }
            }
            finally { busy = false; submit.disabled = false; cancel.disabled = false; }
        });
        ui.body.appendChild(dialog); dialog.showModal();
    }
    function resumeAfterLogin() {
        leavingAccount = true;
        if (intendedMission) window.location.assign(intendedMission);
        else window.location.reload();
    }
    function recoveryDialog(token = null) {
        if (!recoveryEnabled()) { show("Passwort-Zurücksetzen ist noch nicht freigegeben."); return; }
        closeMenu();
        const dialog = ui.createElement("dialog"); dialog.className = "account-dialog";
        dialog.setAttribute("aria-label", token !== null ? "Neues Passwort festlegen" : "Passwort zurücksetzen");
        dialog.innerHTML = '<form><h2></h2><p data-intro></p><div data-fields></div><p role="alert"></p><button type="submit"></button><button type="button" data-cancel>Abbrechen</button></form>';
        const form=dialog.querySelector("form"), fields=form.querySelector('[data-fields]'), intro=form.querySelector('[data-intro]');
        const submit=form.querySelector('[type=submit]'), cancel=form.querySelector('[data-cancel]');
        form.querySelector('h2').textContent=token !== null ? "Neues Passwort festlegen" : "Passwort vergessen?";
        if (token !== null) {
            intro.textContent="Wähle mindestens 8 Zeichen. Dein Lernstand bleibt erhalten; alte Anmeldungen werden beendet.";
            fields.innerHTML='<label>Neues Passwort<input name="password" type="password" required autocomplete="new-password"></label><label>Passwort wiederholen<input name="confirmation" type="password" required autocomplete="new-password"></label>';
            passwordVisibility(form); passwordVisibility(form,"confirmation"); submit.textContent="Neues Passwort speichern";
        } else {
            intro.textContent="Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Link zum Festlegen eines neuen Passworts.";
            fields.innerHTML='<label>E-Mail-Adresse<input name="email" type="email" required maxlength="254" autocomplete="username"></label>';
            submit.textContent="Link anfordern";
        }
        let busy=false;
        cancel.addEventListener('click',()=>{if(!busy)dialog.close();});
        dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
        dialog.addEventListener('close',()=>{
            token=null; form.querySelectorAll('input').forEach(input=>{input.value="";}); dialog.remove();
            if(!ui.querySelector('dialog[open]'))loginButton.focus();
        });
        form.addEventListener('submit',async event=>{
            event.preventDefault(); if(busy)return;
            if(token !== null && !checkNewPassword(form)) return;
            if(token !== null && form.elements.password.value!==form.elements.confirmation.value){form.querySelector('[role=alert]').textContent="Die Passwörter stimmen nicht überein. Bitte hier korrigieren; der Link bleibt gültig.";form.elements.confirmation.focus();return;}
            busy=true; submit.disabled=true; cancel.disabled=true;
            const resetting=token!==null;
            const body=resetting ? {token,password:form.elements.password.value,confirmation:form.elements.confirmation.value} : {email:form.elements.email.value};
            try {
                const current=await client.request('session');
                if(invalidated)throw remote.error('PROFILE_CHANGED');
                const result=await client.request(resetting?'reset-password':'request-password-reset',{body,csrfToken:current.csrfToken});
                if(resetting){
                    token=null; leavingAccount=true; window.AgentLearningData?.dispose(); announceChange();
                    // A hash-only change on index.html does not restart the account
                    // runtime. Force a fresh document after session revocation.
                    location.replace('index.html?account-reset='+Date.now()+'#password-updated'); return;
                }
                fields.replaceChildren(); submit.hidden=true; cancel.textContent="Schließen";
                // MAIL-TRANSPORT-LIMIT: keep this notice in sync with queue/provider policy.
                intro.textContent=`Wenn die Adresse zu einem aktiven Konto gehört, kommt eine E-Mail. Öffne dein E-Mail-Programm (z. B. Outlook) und prüfe auch Spam. Bitte etwas Geduld: höchstens ${result.mailPolicy.perMinute} Konto-Mails pro Minute. Der Link gilt nach Versand eine Stunde.`;
                if(result.mailPolicy.dailyLimitReached) intro.textContent+=' Das Tageslimit ist erreicht; der Versand kann bis morgen dauern.';
                form.querySelector('[role=alert]').textContent="";
            } catch(failure){
                form.querySelector('[role=alert]').textContent=failure.message;
                if (resetting && ['INVALID_NEW_PASSWORD','PASSWORD_MISMATCH'].includes(failure.code)) {
                    form.querySelector('[role=alert]').textContent+=' Bitte hier korrigieren; du brauchst keine neue E-Mail.';
                    form.elements.password.focus();
                } else if (resetting) clearPasswords(form);
            }
            finally {
                delete body.password; delete body.confirmation; delete body.token;
                busy=false; submit.disabled=false; cancel.disabled=false;
            }
        });
        ui.body.append(dialog); dialog.showModal();
    }
    function closeMenu() {
        if (panel) panel.hidden = true;
        loginButton?.setAttribute("aria-expanded", "false");
    }
    function openMenu(focus = false) {
        if (panel) panel.hidden = false;
        loginButton?.setAttribute("aria-expanded", "true");
        if (focus) panel?.querySelector("button:not([hidden]):not(:disabled)")?.focus();
    }
    function simpleDialog(title, content) {
        closeMenu();
        const dialog = ui.createElement("dialog"); dialog.className = "account-dialog";
        dialog.setAttribute("aria-label", title);
        const heading = ui.createElement("h2"); heading.textContent = title;
        const close = button("Schließen", () => dialog.close()); close.className = "account-close";
        dialog.append(heading, content, close);
        dialog.addEventListener("close", () => { dialog.remove(); loginButton.focus(); });
        ui.body.append(dialog); dialog.showModal(); return dialog;
    }
    async function accountDialog() {
        const form = ui.createElement("form");
        form.className = 'account-profile-form';
        form.innerHTML = '<dl class="account-identity"><div><dt>E-Mail:</dt><dd data-email></dd></div><div><dt>Klasse:</dt><dd data-class></dd></div></dl><label>Anzeigename<input name="name" required maxlength="100" autocomplete="name"></label><button type="submit">Namen speichern</button><p role="status"></p><p class="account-muted">Die E-Mail-Adresse ist dein Anmeldename. Änderungen sind später möglich.</p>';
        if(recoveryEnabled()) form.append(button("Passwort zurücksetzen",()=>{const current=ui.querySelector('.account-dialog');current?.close();current?.remove();recoveryDialog();}));
        form.querySelector("[data-email]").textContent = session.profile.email;
        form.querySelector("[data-class]").textContent = session.profile.className;
        form.elements.name.value = session.profile.name;
        form.addEventListener("submit", async event => {
            event.preventDefault(); const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
            try {
                const result = await client.request("update-profile", { body: { name: form.elements.name.value }, csrfToken: session.csrfToken, profileId: session.profile.id });
                if (invalidated || result.profile?.id !== session.profile.id) throw remote.error("PROFILE_CHANGED");
                session.profile = result.profile;
                form.querySelector('[role="status"]').textContent = "Anzeigename gespeichert.";
                show(`${session.profile.name} · Klasse ${session.profile.className} · ${session.profile.email}`);
            } catch (failure) { form.querySelector('[role="status"]').textContent = failure.message; }
            finally { submit.disabled = false; }
        });
        simpleDialog("Kontoinfo bearbeiten", form);
    }
    async function progressDialog() {
        const content = ui.createElement("div"); content.textContent = "Fortschritt wird geladen …";
        simpleDialog("Fortschritt", content);
        try {
            const response = await client.request("state", { profileId: session.profile.id });
            if (invalidated || response.profile?.id !== session.profile.id) throw remote.error("PROFILE_CHANGED");
            const completed = response.state.data.completedCodes;
            const { calculateProgress } = await import(progressModuleURL);
            const progress = calculateProgress(completed);
            const title = ui.createElement("p"); title.className = "account-progress-number";
            title.textContent = progress.label;
            const list = ui.createElement("ul"); list.className = "account-progress-list";
            progress.rows.forEach(({label, sections}) => {
                const item = ui.createElement("li");
                const title = ui.createElement('strong'); title.textContent = label + ': ';
                item.append(title);
                sections.forEach(({code, completed, available}, index) => {
                    if(index) item.append(', ');
                    const status = ui.createElement('span');
                    status.className = completed ? 'account-progress-done' : 'account-progress-pending';
                    status.textContent = code + (completed ? ' ✓' : available ? ' · offen' : ' · folgt');
                    status.setAttribute('aria-label',code + (completed ? ': abgeschlossen' : available ? ': noch nicht abgeschlossen' : ': noch nicht im Kurs verfügbar'));
                    item.append(status);
                });
                list.append(item);
            });
            if (progress.optionalCompleted) {
                const item = ui.createElement("li");
                item.innerHTML = '<strong>Optional geschafft: </strong><span class="account-progress-done">02-3 ✓ (+5 Bonuspunkte)</span>'; list.append(item);
            }
            const note = ui.createElement("p"); note.className = "account-muted";
            note.textContent = "Erreichte Abschnitte, nicht die zeitliche Reihenfolge. Zwei Fluchtphasen fehlen noch im Kurs; dafür sind 5 % reserviert. Bonus ersetzt keine Pflichtaufgabe.";
            content.replaceChildren(title, list, note);
        } catch (failure) { content.textContent = failure.message; }
    }
    async function saveCode() {
        const levelId = window.AgentCurrentLevel;
        if (!levelId || invalidated) return;
        saveButton.disabled = true;
        try {
            const code = snapshotCode();
            const result = controls ? (await controls.saveDraft(levelId, code)).ok : await window.AgentLearningData?.recordAttempt(levelId, code);
            show(result ? (session?.profile ? "Entwurf zentral gespeichert. Nicht ausgeführt." : "Entwurf in diesem Browser gespeichert.") : "Entwurf nicht bestätigt. Bitte Code herunterladen oder erneut versuchen.");
        } finally { saveButton.disabled = false; }
    }
    function guestMission(target) {
        intendedMission = target;
        let choice = null;
        const content = ui.createElement("div");
        const note = ui.createElement("p");
        note.textContent = "Du startest im Gastmodus. Dein Code und Fortschritt werden nur in diesem Browser gespeichert, nicht auf anderen Geräten. Wenn du die Browserdaten löschst, geht dieser Stand verloren.";
        const proceed = button("OK – Mission starten", () => { choice = "guest"; dialog.close(); location.assign(target); });
        proceed.className = 'account-primary';
        const signin = button("Anmelden", () => { choice = "login"; dialog.close(); loginDialog(); }); signin.className = "account-register-link";
        content.append(note, proceed, signin);
        const dialog = simpleDialog("Im Gastmodus starten", content);
        dialog.addEventListener("close", () => { if (!choice) intendedMission = null; });
    }
    document.addEventListener("click", event => {
        const link = event.target.closest?.("a[href]");
        if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || session?.profile || !session) return;
        const target = new URL(link.href, location.href);
        const entry = /^(?:mission[1-4]_level[1-4]|agent_training_level[1-3]|pico_level(?:[1-4]|2a)|pixelmuseum_(?:briefing|finale)|helikopter_flucht_level[12])\.html$/.test(target.pathname.split("/").pop());
        if (target.origin === location.origin && target.pathname.split('/').pop()!=='missionen.html' && (link.matches(".mission-start-action,.escape-coming-action") || entry || (link.matches('[data-resume-action]') && target.pathname !== location.pathname))) {
            event.preventDefault(); event.stopImmediatePropagation(); guestMission(target.href);
        }
    }, true);
    async function logout(verificationToken = null) {
        if (hasUnconfirmed() && !window.confirm("Nicht bestätigte Änderungen oder ungespeicherter Code gehen beim Abmelden verloren. Code zuvor sichern. Trotzdem abmelden?")) return;
        logoutButton.disabled = true;
        try {
            await client.request("logout", { body: {}, csrfToken: session.csrfToken, profileId: session.profile.id });
            leavingAccount = true;
            window.AgentLearningData?.dispose(); announceChange();
            // Preserve the original link only in the fragment during this reload.
            // Bootstrap removes it immediately again; never store it or use a query.
            if (verificationToken) history.replaceState(null, "", location.pathname + location.search + '#verify=' + encodeURIComponent(verificationToken));
            window.location.reload();
        } catch (failure) { show(failure.message); return {message: failure.message}; }
        finally { logoutButton.disabled = false; }
    }
    async function mount() {
        await domReady;
        lifetime.abort(); lifetime = new AbortController();
        // A child document owns its account UI, but renders it in the persistent shell.
        ui.querySelectorAll("[data-account-owned]").forEach(node => node.remove());
        panel = ui.createElement("aside"); panel.className = "account-panel"; panel.setAttribute("aria-label", "Konto und Speicherung"); panel.hidden = true;
        panel.dataset.accountOwned = ""; panel.id = "account-menu";
        message = ui.createElement("p"); message.setAttribute("role", "status"); message.textContent = "Konto und Lernstand werden geprüft …";
        loginButton = button("Anmelden", () => {
            if (invalidated || document.documentElement.classList.contains("account-blocked") || session?.profile) {
                if (panel.hidden) openMenu(true); else closeMenu();
            } else loginDialog();
        });
        loginButton.dataset.accountOwned = ""; loginButton.className = "account-person";
        iconButton(loginButton, "person", "Anmelden"); loginButton.setAttribute("aria-controls", "account-menu");
        loginButton.setAttribute("aria-expanded", "false");
        logoutButton = button("Abmelden", () => logout());
        const progressButton = button("Fortschritt", progressDialog);
        const profileButton = button("Kontoinfo bearbeiten", accountDialog);
        const classesButton = button("Meine Klassen", () => { closeMenu(); location.assign('lehrer.html'); });
        classesButton.dataset.teacher = ''; classesButton.hidden = true;
        classesButton.insertAdjacentHTML('afterbegin',icon('classes'));
        saveButton = button("Code speichern", saveCode);
        saveButton.disabled = true;
        progressButton.dataset.authenticated = ""; profileButton.dataset.authenticated = "";
        for (const [item, symbol] of [[progressButton,"progress"],[profileButton,"person"],[saveButton,"save"],[logoutButton,"logout"]]) item.insertAdjacentHTML("afterbegin", icon(symbol));
        retryButton = button("Speichern erneut versuchen", async () => {
            retryButton.disabled = true;
            try {
                const result = await controls?.retry();
                if (result?.ok) window.applyUnlocks?.();
            } finally { retryButton.disabled = false; }
        });
        reloadButton = button("Seite neu laden", reload);
        exportButton = button("Code herunterladen (.py)", exportCode);
        for (const item of [logoutButton, progressButton, profileButton, retryButton, reloadButton, exportButton]) item.hidden = true;
        panel.append(classesButton, progressButton, profileButton, saveButton, logoutButton, message, retryButton, reloadButton, exportButton);
        ui.body.appendChild(panel);
        const headerActions = ui.querySelector("[data-account-actions], .account-toolbar");
        headerActions.appendChild(loginButton);
        if (shell) {
            // Moving focus between chrome and lesson is NOT returning to the app.
            // Hiding the lesson on that internal focus transition swallowed the
            // user's first click. Recheck only after the whole app lost focus.
            let leftApp = false;
            shell.addEventListener("blur", () => {
                setTimeout(() => { if (!ui.hasFocus()) leftApp = true; }, 0);
            }, { signal: lifetime.signal });
            shell.addEventListener("focus", () => {
                if (leftApp) { leftApp = false; checkIdentity(); }
            }, { signal: lifetime.signal });
            ui.addEventListener("visibilitychange", () => { if (!ui.hidden) checkIdentity(); }, { signal: lifetime.signal });
            shell.addEventListener("beforeunload", warnUnconfirmed, { signal: lifetime.signal });
        }
        for (const doc of new Set([ui, document])) {
            doc.addEventListener("click", event => { if (!event.target.closest?.(".account-panel,.account-person")) closeMenu(); }, { signal: lifetime.signal });
            doc.addEventListener("keydown", event => {
                if (event.key === "Escape" && !panel.hidden) { closeMenu(); loginButton.focus(); }
            }, { signal: lifetime.signal });
        }
    }
    const mounted = mount();
    function storageStatus(status) {
        show(status.message);
        retryButton.hidden = !["error"].includes(status.type) || [401, 403, 409].includes(status.error?.status);
        reloadButton.hidden = !["error", "conflict"].includes(status.type);
        loginButton.classList.toggle("account-attention", ["error", "conflict"].includes(status.type));
        if (["error", "conflict"].includes(status.type)) openMenu();
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
    if (!shell) window.addEventListener("focus", checkIdentity);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) checkIdentity(); });
    window.addEventListener("pageshow", async event => {
        if (event.persisted) { await mount(); renderIdentity(); checkIdentity(); }
    });
    window.addEventListener("pagehide", () => {
        document.documentElement.classList.add("account-blocked");
        lifetime.abort();
        ui.querySelectorAll(".account-dialog").forEach(dialog => { dialog.close(); dialog.remove(); });
        if (panel) panel.hidden = true;
        if (loginButton) loginButton.disabled = true;
    });
    function warnUnconfirmed(event) {
        if (hasUnconfirmed()) { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", warnUnconfirmed);
    // Defense in depth: no clicks/keyboard actions before readiness, even if CSS is unavailable.
    for (const type of ["click", "keydown", "submit"]) document.addEventListener(type, event => {
        if (!document.body.classList.contains("legal-page") && document.documentElement.classList.contains("account-blocked") && !event.target.closest?.(".account-panel, .account-dialog, .account-toolbar, [data-account-actions]")) {
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, true);
    function renderIdentity() {
        iconButton(loginButton, "person", session?.profile ? "Benutzermenü" : "Anmelden", Boolean(session?.profile));
        logoutButton.hidden = !session?.profile;
        panel.querySelectorAll("[data-authenticated]").forEach(item => { item.hidden = !session?.profile; });
        panel.querySelector('[data-teacher]').hidden = !session?.profile?.teacher;
        exportButton.hidden = !document.getElementById("python-editor");
        saveButton.disabled = !window.AgentCurrentLevel || invalidated;
    }
    let started = false;
    window.AgentAccount = Object.freeze({
        // Dedicated teacher page reuses the verified identity and anti-stale-tab guard.
        async teacherRequest(action, body) {
            if (invalidated || !session?.profile) throw remote.error('AUTH_REQUIRED');
            try {
                const result=await client.request(action,{body,csrfToken:session.csrfToken,profileId:session.profile.id});
                if (invalidated || result.profile?.id!==session.profile.id) throw remote.error('PROFILE_CHANGED');
                return result;
            } catch (failure) {
                if (['PROFILE_CHANGED','AUTH_REQUIRED','CSRF_MISMATCH'].includes(failure.code)) block(failure,true);
                throw failure;
            }
        },
        editorChanged() { dirtyDraft = true; },
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
                    renderIdentity();
                    if (invalidated) throw remote.error("PROFILE_CHANGED");
                    document.documentElement.classList.remove("account-blocked");
                    if (/^#verify=/.test(window.location.hash)) {
                        const token = window.location.hash.slice(8);
                        history.replaceState(null, "", window.location.pathname + window.location.search);
                        registrationDialog(token);
                    } else if (/^#reset=/.test(window.location.hash)) {
                        const token=location.hash.slice(7);
                        const clean=new URL(location.href); clean.hash=""; clean.searchParams.delete('account-reset');
                        history.replaceState(null,"",clean.pathname+clean.search);
                        recoveryDialog(token);
                    } else if(location.hash==="#password-updated") {
                        const clean=new URL(location.href); clean.hash=""; clean.searchParams.delete('account-reset');
                        history.replaceState(null,"",clean.pathname+clean.search);
                        const content=ui.createElement('div');
                        const note=ui.createElement('p'); note.textContent="Dein Passwort wurde geändert. Dein Lernstand bleibt erhalten. Melde dich jetzt mit dem neuen Passwort an.";
                        const signin=button('Zur Anmeldung',()=>{dialog.close();dialog.remove();loginDialog();});
                        signin.className='account-primary';
                        content.append(note,signin); const dialog=simpleDialog('Passwort geändert',content);
                    }
                    return true;
                } catch (failure) { block(failure); return false; }
            })();
        }
    });
    // Home page has no runner, but provides the same login/logout controls.
    if (!document.querySelector('script[src*="assets/runner.js"]') && document.currentScript?.hasAttribute("data-account-home")) {
        window.AgentLearningDataReady = window.AgentAccount.start().then(async ok => {
            if(ok) await updateHomeTarget(session);
            return ok;
        });
    }
    async function updateHomeTarget(identity) {
        const target = document.querySelector('[data-next-target]'), action = document.querySelector('[data-resume-action]');
        if (!target || !action) return;
        try {
            let data;
            if (identity?.profile) {
                const response = await client.request('state', {profileId: identity.profile.id});
                if (invalidated || response.profile?.id !== identity.profile.id) throw remote.error('PROFILE_CHANGED');
                data = response.state.data;
            } else {
                const result = window.AgentPyLocalLearningData.readHomeProgress();
                if (!result.ok) throw new Error('Browserstand nicht lesbar');
                data = result.value;
            }
            const {nextCourseTarget} = await import(progressModuleURL);
            const next = nextCourseTarget(data);
            const hasProgress = [data.completedCodes,data.attemptedCodes].some(map=>Object.values(map||{}).some(value=>typeof value==='string'));
            target.textContent = next.label; action.href = hasProgress ? 'missionen.html' : 'mission1_start.html';
            action.replaceChildren((hasProgress ? 'Setze fort' : 'Training starten') + ' ');
            const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden','true'); arrow.textContent='→'; action.append(arrow);
        } catch (_) {
            target.textContent = 'Lernstand nicht verfügbar';
            // A failed account read must never fall back to another person's guest state.
            action.href = '#missionen'; action.textContent = 'Mission auswählen →';
        }
    }
})();
