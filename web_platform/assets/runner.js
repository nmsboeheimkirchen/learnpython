// Globale Hilfsfunktionen für Skulpt und UI
let currentOutput = "";

function builtinRead(x) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) {
        throw "File not found: '" + x + "'";
    }
    return Sk.builtinFiles["files"][x];
}

function outf(text) {
    const outDiv = document.getElementById("console-output");
    outDiv.innerHTML += text.replace(/\n/g, "<br>");
    currentOutput += text;
    // Automatisch nach unten scrollen
    outDiv.scrollTop = outDiv.scrollHeight;
}

// Eine Custom-Input-Funktion, die auf Enter im Konsolen-Feld wartet
function customInput(promptMsg) {
    return new Promise((resolve) => {
        const outDiv = document.getElementById("console-output");
        
        // Zeige den Prompt an, falls vorhanden
        if (promptMsg) {
            outDiv.innerHTML += promptMsg.replace(/\n/g, "<br>");
            currentOutput += promptMsg;
        }

        // Erstelle eine Eingabe-Zeile am Ende der Konsole
        const inputSpan = document.createElement("span");
        inputSpan.contentEditable = "true";
        inputSpan.style.borderBottom = "1px solid #34a853";
        inputSpan.style.outline = "none";
        inputSpan.style.minWidth = "20px";
        inputSpan.style.display = "inline-block";
        outDiv.appendChild(inputSpan);
        inputSpan.focus();

        outDiv.scrollTop = outDiv.scrollHeight;

        // Warte auf Enter
        inputSpan.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                const v = inputSpan.innerText;
                // Damit der Cursor verschwindet und die Eingabe zum Text wird
                inputSpan.contentEditable = "false";
                inputSpan.style.borderBottom = "none";
                outDiv.innerHTML += "<br>";
                currentOutput += v + "\n";
                resolve(v);
            }
        });
    });
}

function runit(levelTestFunction) {
    const code = window.editor.getValue();
    const outDiv = document.getElementById("console-output");
    outDiv.innerHTML = ""; 
    currentOutput = "";

    // Skulpt konfigurieren
    Sk.pre = "console-output";
    Sk.configure({
        output: outf,
        read: builtinRead,
        inputfunTakesPrompt: true,
        inputfun: customInput
    });

    try {
        let myPromise = Sk.misceval.asyncToPromise(function() {
            return Sk.importMainWithBody("<stdin>", false, code, true);
        });

        myPromise.then(function(mod) {
            // Erfolg: Prüfe Level
            if(levelTestFunction) {
                levelTestFunction(code, currentOutput);
            }
        }, function(err) {
            outDiv.innerHTML += "<br><span style='color:#ea4335'>FEHLER: " + err.toString() + "</span>";
            outDiv.scrollTop = outDiv.scrollHeight;
        });
    } catch(e) {
        outDiv.innerHTML += "<br><span style='color:#ea4335'>FEHLER: " + e.toString() + "</span>";
    }
}

function triggerSuccess() {
    document.getElementById("next-level-btn").style.display = "block";
    document.getElementById("status-text").innerHTML = "✅ <b>MISSION ERFÜLLT!</b>";
    document.getElementById("status-text").style.color = "#34a853";
    
    document.getElementById("progress-fill").style.width = (parseInt(document.getElementById("progress-fill").style.width) + 10) + "%";

    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

    var defaults = { spread: 360, ticks: 50, gravity: 0, decay: 0.94, startVelocity: 30, colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8'] };
    function shootStars() {
        confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ['star'] });
        confetti({ ...defaults, particleCount: 10, scalar: 0.75, shapes: ['circle'] });
    }
    setTimeout(shootStars, 250);
    setTimeout(shootStars, 400);

    var duration = 3 * 1000;
    var animationEnd = Date.now() + duration;
    var interval = setInterval(function() {
        var timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) { return clearInterval(interval); }
        var particleCount = 50 * (timeLeft / duration);
        confetti({ particleCount: particleCount, startVelocity: 30, spread: 360, ticks: 60, origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 } });
        confetti({ particleCount: particleCount, startVelocity: 30, spread: 360, ticks: 60, origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 } });
    }, 250);
}

// Fügt Lehrer-Cheat-Buttons ein, wenn ein #l am Ende der URL steht
document.addEventListener("DOMContentLoaded", function() {
    if (window.location.hash.toLowerCase() === "#l") {
        document.querySelectorAll(".test-btn").forEach(btn => {
            btn.style.display = "block";
        });
        
        // Fügt zu allen Level-Links automatisch das #l hinzu, damit man im Lehrer-Modus bleibt
        document.querySelectorAll(".next-level-btn").forEach(btn => {
            const currentOnclick = btn.getAttribute("onclick");
            if (currentOnclick && currentOnclick.includes("window.location.href=")) {
                const newOnclick = currentOnclick.replace("'", "#l'"); // e.g. 'level2.html' -> 'level2.html#l'
                // Fallback falls doppelte anführungszeichen verwendet wurden
                const finalOnclick = newOnclick.replace('"', '#l"');
                btn.setAttribute("onclick", currentOnclick.replace(/href='([^']+)'/, "href='$1#l'").replace(/href="([^"]+)"/, 'href="$1#l"'));
            }
        });
    }
});
