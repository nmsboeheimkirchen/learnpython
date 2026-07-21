window.AgentNavigation = (() => {
    "use strict";

    const missions = Object.freeze([
        {
            number: "01",
            title: "Mission 1: System Access",
            titleId: "link-m1-title",
            href: "mission1_start.html",
            description: "Erste Befehle senden, Werte speichern und den Agentennamen ins System bringen.",
            levels: [
                { id: "link-level1", href: "mission1_level1.html", label: "Ping senden" },
                { id: "link-level2", label: "Pause simulieren" },
                { id: "link-level3", label: "Identifikation" },
                { id: "link-level4", label: "Der finale Hack" }
            ]
        },
        {
            number: "02",
            title: "Mission 2: Bombe entschärfen",
            titleId: "link-m2-title",
            description: "Mit if, elif und else die richtige Entscheidung treffen.",
            levels: [
                { id: "link-m2-l1", label: "Die If-Weiche" },
                { id: "link-m2-l2", label: "Falsches Kabel" },
                { id: "link-m2-l3", label: "Rotes Kabel" }
            ]
        },
        {
            number: "03",
            title: "Mission 3: Safe-Knacker",
            titleId: "link-m3-title",
            description: "Schleifen bauen, Eingaben vergleichen und Zufall einsetzen.",
            levels: [
                { id: "link-m3-l1", label: "Dauerschleife" },
                { id: "link-m3-l2", label: "Zu hoch, zu niedrig" },
                { id: "link-m3-l3", label: "Safe knacken" }
            ]
        },
        {
            number: "04",
            title: "Mission 4: Geheimdienst-Chat",
            titleId: "link-m4-title",
            description: "Zeichen scannen, Zahlen lesen und eine Nachricht verschlüsseln.",
            levels: [
                { id: "link-m4-l1", label: "Buchstaben-Scanner" },
                { id: "link-m4-l2", label: "ASCII-Matrix" },
                { id: "link-m4-l3", label: "Caesar-Code" }
            ]
        },
        {
            number: "AG",
            title: "Agentensteuerung",
            titleId: "link-agent-training-title",
            href: "agent_training_start.html",
            description: "Turtle-Agenten über Koordinaten steuern, Orte markieren und echte Rückgaben untersuchen.",
            unitLabel: "Schritt",
            levels: [
                { id: "link-agent-training-l1", href: "agent_training_level1.html", label: "Zielpunkt erfassen" },
                { id: "link-agent-training-l2", href: "agent_training_level2.html", label: "Eigene Agentenbefehle" },
                { id: "link-agent-training-l3", href: "agent_training_level3.html", label: "Suchen und aufnehmen" }
            ]
        }
    ]);

    function currentPageName() {
        return window.location?.pathname?.split("/").pop() || "mission1_start.html";
    }

    function currentMissionIndex(pageName = currentPageName()) {
        if (/^agent_training_/.test(pageName)) return missions.length - 1;
        const match = pageName.match(/^mission([1-4])_/);
        return match ? Number(match[1]) - 1 : 0;
    }

    function applyPageTheme(pageName = currentPageName()) {
        const body = document.body;
        if (!body?.classList) return;
        const missionIndex = currentMissionIndex(pageName);
        const isAgentTraining = /^agent_training_/.test(pageName);
        body.classList.add("learning-page", isAgentTraining ? "agent-training" : `mission-${missionIndex + 1}`);
        body.classList.add(pageName.includes("_start") ? "mission-start-page" : "mission-level-page");
        body.dataset.mission = isAgentTraining ? "agent-training" : String(missionIndex + 1);
    }

    function createLockBadge() {
        const badge = document.createElement("span");
        badge.className = "nav-lock";
        badge.textContent = "Gesperrt";
        badge.setAttribute("aria-hidden", "true");
        return badge;
    }

    function createLink({ id, href, label, locked = true, heading = false }) {
        const link = document.createElement("a");
        link.id = id;
        link.className = [locked ? "locked" : "", heading ? "mission-heading-link" : ""]
            .filter(Boolean)
            .join(" ");

        const labelElement = document.createElement("span");
        labelElement.className = "nav-link-label";
        labelElement.textContent = label;
        link.appendChild(labelElement);

        if (locked) {
            link.setAttribute("aria-disabled", "true");
            link.tabIndex = -1;
            link.appendChild(createLockBadge());
        } else {
            link.href = href;
        }
        return link;
    }

    function createMenuButton() {
        const button = document.createElement("button");
        button.id = "menu-btn";
        button.type = "button";
        button.className = "menu-btn";
        button.setAttribute("aria-controls", "mySidebar");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Lernpfad öffnen");

        const icon = document.createElement("span");
        icon.className = "menu-btn-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "☰";
        button.appendChild(icon);

        const label = document.createElement("span");
        label.textContent = "Pfad";
        button.appendChild(label);
        return button;
    }

    function createHomeLink() {
        const link = document.createElement("a");
        link.id = "agent-py-home";
        link.className = "mission-home-link";
        link.href = "index.html";
        link.setAttribute("aria-label", "Agent PY – zur Startseite");

        const logo = document.createElement("img");
        logo.className = "mission-home-logo";
        logo.setAttribute("src", "assets/brand/agent-py-logo.png?v=20260720-2");
        logo.setAttribute("alt", "");
        logo.setAttribute("width", "1600");
        logo.setAttribute("height", "232");
        logo.setAttribute("aria-hidden", "true");

        link.appendChild(logo);
        return link;
    }

    function createNavigationDock() {
        const dock = document.createElement("div");
        dock.id = "learning-nav-dock";
        dock.className = "learning-nav-dock";
        dock.appendChild(createHomeLink());
        dock.appendChild(createMenuButton());
        return dock;
    }

    function render(root = document.getElementById("navigation-root")) {
        if (!root) return false;

        const pageName = currentPageName();
        const activeMission = currentMissionIndex(pageName);
        applyPageTheme(pageName);

        const sidebar = document.createElement("dialog");
        sidebar.id = "mySidebar";
        sidebar.className = "sidebar";
        sidebar.setAttribute("aria-labelledby", "sidebar-title");

        const surface = document.createElement("div");
        surface.className = "sidebar-surface";

        const header = document.createElement("header");
        header.className = "sidebar-header";

        const brand = document.createElement("div");
        brand.className = "sidebar-brand";
        const eyebrow = document.createElement("span");
        eyebrow.className = "sidebar-eyebrow";
        eyebrow.textContent = "Python Agenten-Training";
        const title = document.createElement("h2");
        title.id = "sidebar-title";
        title.textContent = "Dein Lernpfad";
        brand.appendChild(eyebrow);
        brand.appendChild(title);

        const closeButton = document.createElement("button");
        closeButton.id = "navigation-close-btn";
        closeButton.type = "button";
        closeButton.className = "navigation-close-btn";
        closeButton.setAttribute("aria-label", "Lernpfad schließen");
        closeButton.textContent = "×";
        header.appendChild(brand);
        header.appendChild(closeButton);
        surface.appendChild(header);

        const nav = document.createElement("nav");
        nav.className = "mission-navigation";
        nav.setAttribute("aria-label", "Missionen und Trainingsschritte");

        missions.forEach((mission, missionIndex) => {
            const locked = missionIndex > 0;
            const section = document.createElement("section");
            section.className = "nav-mission" + (missionIndex === activeMission ? " is-current" : "");
            section.dataset.mission = String(missionIndex + 1);

            const missionNumber = document.createElement("span");
            missionNumber.className = "nav-mission-number";
            missionNumber.textContent = mission.number;
            section.appendChild(missionNumber);

            const missionTitle = document.createElement("div");
            missionTitle.className = "mission-title";
            missionTitle.appendChild(createLink({
                id: mission.titleId,
                href: mission.href,
                label: mission.title,
                locked,
                heading: true
            }));
            section.appendChild(missionTitle);

            const description = document.createElement("p");
            description.className = "mission-desc";
            description.textContent = mission.description;
            section.appendChild(description);

            const levels = document.createElement("div");
            levels.className = "mission-levels";
            mission.levels.forEach((level, levelIndex) => {
                levels.appendChild(createLink({
                    ...level,
                    label: `${mission.unitLabel || "Level"} ${levelIndex + 1}: ${level.label}`,
                    locked: missionIndex > 0 || levelIndex > 0
                }));
            });
            section.appendChild(levels);
            nav.appendChild(section);
        });
        surface.appendChild(nav);

        const footer = document.createElement("footer");
        footer.className = "sidebar-footer";
        const resetButton = document.createElement("button");
        resetButton.id = "reset-progress-btn";
        resetButton.type = "button";
        resetButton.className = "progress-reset-btn";
        resetButton.textContent = "Fortschritt zurücksetzen";
        footer.appendChild(resetButton);
        surface.appendChild(footer);

        sidebar.appendChild(surface);
        root.replaceWith(createNavigationDock(), sidebar);
        return true;
    }

    return Object.freeze({ render });
})();

window.AgentNavigation.render();
