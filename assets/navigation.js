window.AgentNavigation = (() => {
    const missions = Object.freeze([
        {
            title: "Mission 1: System Access",
            titleId: "link-m1-title",
            href: "mission1_start.html",
            description: "Hacke dich in den Mainframe, indem du die grundlegenden Python-Befehle meisterst.",
            levels: [
                { id: "link-level1", href: "mission1_level1.html", label: "Level 1: Ping senden" },
                { id: "link-level2", label: "Level 2: Pause simulieren" },
                { id: "link-level3", label: "Level 3: Identifikation" },
                { id: "link-level4", label: "Level 4: Der Hack (Finale)" }
            ]
        },
        {
            title: "Mission 2: Bombe entschärfen",
            titleId: "link-m2-title",
            description: "Willkommen, Agent! Welches Kabel (Rot, Blau oder Grün) musst du durchschneiden?",
            levels: [
                { id: "link-m2-l1", label: "Level 1: Die If-Weiche" },
                { id: "link-m2-l2", label: "Level 2: Falsches Kabel" },
                { id: "link-m2-l3", label: "Level 3: Rotes Kabel" }
            ]
        },
        {
            title: "Mission 3: Safe-Knacker",
            titleId: "link-m3-title",
            description: "Knacke den Code des Haupttresors mit Schleifen und Zufallszahlen!",
            levels: [
                { id: "link-m3-l1", label: "Level 1: Dauerschleife" },
                { id: "link-m3-l2", label: "Level 2: Zu hoch, zu niedrig" },
                { id: "link-m3-l3", label: "Level 3: Safe knacken" }
            ]
        }
    ]);

    function createLink({ id, href = "#", label, locked = true, heading = false }) {
        const link = document.createElement("a");
        link.id = id;
        link.href = href;
        link.textContent = `${label}${locked ? " 🔒" : ""}`;
        link.className = [locked ? "locked" : "", heading ? "mission-heading-link" : ""]
            .filter(Boolean)
            .join(" ");
        return link;
    }

    function render(root = document.getElementById("navigation-root")) {
        if (!root) {
            return false;
        }

        const sidebar = document.createElement("div");
        sidebar.id = "mySidebar";
        sidebar.className = "sidebar active";

        const header = document.createElement("div");
        header.className = "sidebar-header";
        header.textContent = "Agenten Trainings-Pfad";
        sidebar.appendChild(header);

        missions.forEach((mission, missionIndex) => {
            const locked = missionIndex > 0;
            const title = document.createElement("div");
            title.className = "mission-title";
            title.appendChild(createLink({
                id: mission.titleId,
                href: mission.href,
                label: mission.title,
                locked,
                heading: true
            }));
            sidebar.appendChild(title);

            const description = document.createElement("div");
            description.className = "mission-desc";
            description.textContent = mission.description;
            sidebar.appendChild(description);

            mission.levels.forEach((level, levelIndex) => {
                sidebar.appendChild(createLink({
                    ...level,
                    locked: missionIndex > 0 || levelIndex > 0
                }));
            });
        });

        root.replaceWith(sidebar);
        return true;
    }

    return Object.freeze({ render });
})();

window.AgentNavigation.render();
