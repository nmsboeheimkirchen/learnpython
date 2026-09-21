# Klassen und Konten: Planungsstand

## Neuer Auftrag 21.09.2026 – CTEST, Bestätigung und Passwortreset

**Abgeschlossen:** r7 auf Hostinger freigeschaltet und bestätigt. CTEST→Test, E-Mailbestätigung, Passwortreset und authentifiziertes SMTP sind live. ZweiteTestmail ohne Warnung empfangen, komplette CI und Live-Smokes erfolgreich. Nächster Schritt: Nutzer registriert eine neue Person mit einer noch nicht belegten E-Mail und testet Bestätigung/Login/Reset. Betriebsdetails oben in LOGIN-HANDOFF.md; keine offenen automatischen Deployment-Aufgaben.

Echtgerätefeedback für r6 ist positiv. Registrierung in bestehende Klasse **Test** per **CTEST** und Passwort-Wiederherstellung sind nun beauftragt. Die lokale Erweiterung nutzt additive Schema3/4, Einmal-Links, zwei Passworteingaben (mindestens 8 Zeichen), Sitzungswiderruf und dieselbe persistente Mailquote für alle Kontomails. Bestehende Konten/Lernstände bleiben erhalten; keine Lehreransicht/E-Mail-Änderung/Kontolöschung in diesem Auftrag.

Die Testmail wurde am 21.09. im Posteingang empfangen, aber der Screenshot zeigt eine Absenderwarnung. Authentifizierten Versand vor öffentlicher Freischaltung klären; SMTP benötigt das separate Postfachpasswort, niemals im Chat/Repository. Chronologie, Tests und letzter Live-Stand stehen oben in LOGIN-HANDOFF.md. Die folgenden Betriebsstände sind historisch.

## UI-Auftrag abgeschlossen 21.09.2026 – r6 live, Echtgerätefeedback als Nächstes

Live ist **pilot-20260920-r6**, auf Hostinger geprüft und bestätigt. Obere Person-/Vollbildsteuerung, beständige Navigationshülle, Gastdialog, Passwortauge, Entwurfspeichern, kompakter Fortschritt und Anzeigename bearbeiten sind umgesetzt. 40/40 Login-/Shelltests und gesamte CI grün; persönliche Daten unverändert. **Nächster Schritt ist Nutzerfeedback auf echtem iPad/PC Chrome.** Mailversand, Registrierung/Klassenbeitritt und Passwortreset bleiben ausgeschaltet. Details/Rückfallsicherung im obersten Abschnitt von LOGIN-HANDOFF.md. Der folgende ursprüngliche Umsetzungsplan bleibt zur Nachvollziehbarkeit erhalten.

1. **Alle Kontobedienelemente oben rechts:** das feste Panel unten rechts vollständig entfernen, einschließlich reserviertem unteren Seitenabstand. Gemeinsame Kopfzeile auf Start-, Missions-, Level- und Sonderseiten, ohne Kollision mit Pfad-/Präsentationssteuerung. Vollbild und Person immer erreichbar; Mindest-Touchfläche 44×44, sichere Ränder/iPad-Tastatur beachten. Nur das Personensymbol öffnet Login (Umriss) bzw. Benutzermenü (gefüllt), niemals sofort ausloggen. Abmelden ist ein ausdrücklicher Menüeintrag.
2. **Symbole zur Freigabe:** Lucide `maximize-2` / `minimize-2` für diagonale Vollbildpfeile; `user-round` als Umriss/gefüllte Silhouette; `eye` / `eye-off` im Passwortfeld. Menü: Fortschritt, Kontoinfo bearbeiten, Code speichern, Abmelden. Symbolbeschriftungen für Screenreader/Tooltip, Zustände per aria-expanded/aria-pressed und Form, nicht allein Farbe. Vorschau liegt in der Thread-Visualisierung `agentpy-konto-symbole.html`, keine neue Bilddatei/Iconbibliothek ins Produkt kopiert.
3. **Gastdialog bei jedem bewussten Missionsstart:** zentriert, Info „Code und Fortschritt nur in diesem Browser; kein geräteübergreifendes Konto; Löschen der Browserdaten verliert Stand“, primär „OK – Mission starten“, darunter Anmelden. Nicht bei jedem Levelwechsel wiederholen, keine dauerhafte Unterdrückung. Geplantes Missionsziel bis Login/Abbruch merken; nach erfolgreichem Login dieses Ziel öffnen. Direkte Deep Links und Browser-Zurück ohne Schleifen gestalten; bei abgelaufener Sitzung vor weiterer Arbeit verständlich reagieren. Gastdaten nicht automatisch ins Konto übernehmen.
4. **Login-Fokus:** Goldrahmen aus account-ui.css durch dezenten cyanfarbenen Fokus/Schein mit genügend Abstand zum Label ersetzen. Tastaturfokus bleibt deutlich, echte Labels erhalten, auf iPad-Autofill und Bildschirmtastatur prüfen. Auge im Feld, zugänglich beschriftet, Passwort nach Schließen wieder verdecken/leeren; keine Geheimnisse in Vorschauzustand oder Logs.
5. **Vollbild beim Missionswechsel erhalten:** heutiger Code verwendet echte Dokumentwechsel (`window.location.href`, normale Links), wodurch der Browser Vollbild beendet. Entwurf: beständige äußere App-Hülle mit Vollbild/Kontosteuerung; nur Missionsinhalt wechselt. Technischen Spike für gleichursprünglichen Inhaltsrahmen vs. interne Navigation vor breitem Umbau. Alle Sonderseiten, Laufzeit-Skripte, Abschlusslinks, History/Deep Links, Auth-Wechsel, ausstehende Saves und Sitzungsinvalidierung berücksichtigen. Kein blindes HTML-Austauschen mit doppelten Runner-Listenern. Automatisches requestFullscreen nach Reload ohne Nutzeraktion ist kein verlässlicher Lösungsweg. Browser-/Systemausstieg respektieren, reale iPad-Version mit und ohne Tastatur testen; WebKit-Desktoptest allein beweist kein iPad-Vollbild. Quelle: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API und https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen .
6. **Konto/Status statt unterem Overlay:** kompakte Kontoinfo und vereinbarter Fortschritt (% plus Kürzel), keine erfundenen Bestands-Abschlusszeiten. Anzeigename separat änderbar; E-Mail/Passwort-Reset/Klassenbeitritt weiter bis verlässlichem Mailweg zurückstellen. Code speichern soll bewusst den aktuellen Entwurf sichern, ohne Aufgabe zu absolvieren; genaue Beschriftung/optional .py-Download bei Umsetzung festlegen. Nur auf Seiten mit Editor aktiv. Autospeicherung nach Ausführung/Abschluss bleibt erhalten. Speicherstatus ruhig oben/im Menü; ungelöste Fehler/Konflikte als sichtbare Warnung am Konto plus Dialog, Retry/Export/Neu laden bleiben erreichbar. Niemals durch Entfernen des Panels Fehler oder Sicherheits-Sperren unsichtbar machen.
7. **Reihenfolge nach Freigabe:** gemeinsamer Kopf/Icon-/Dialog-/Fokusumbau; Vollbild-Navigationsspike und Integration; Kontomenü/Fortschrittsanzeige/Entwurfssicherung; Tests inklusive realem iPad, dann gesichertes Hostinger-Release. Bestehendes Michael-Konto unangetastet, synthetische Tests für Login/Logout, Gastabgrenzung, Fokus/Touch, Verlustwarnung, Gerätewechsel, Abbruch, Zurück/Deep Links und Vollbild über mehrere Missions-/Levelwechsel.

Die folgenden Abschnitte sind frühere fachliche Entscheidungen; der dortige Betriebsstand „r2/Cron fehlt“ ist überholt.

Stand 19.09.2026. **Phase 1 ist implementiert; die Live-Freigabe wartet noch auf bestätigten Mail-Empfang und den hPanel-Cron-Job.** Enthalten: Kopfzeile/Vollbild, Passwortsichtbarkeit, Klassencode, Selbstregistrierung mit E-Mail-Bestätigung, transaktionale Platzreservierung und persistenter gedrosselter Versand. Hostinger liefert vorerst weiter r2; `CTEST` ist nur in isolierten Tests aktiv. Der private stabile Mail-Dispatcher liegt bereits auf Hostinger, ändert aber weder Website noch Konten. Persönliches Konto und Lernstand bleiben erhalten. Aktueller Betriebsstand: [LOGIN-HANDOFF.md](LOGIN-HANDOFF.md).

Phase 2 bleibt separat: Passwort vergessen/erneutes Anfordern, kompakter Kontobereich einschließlich `Mein Konto`, E-Mail-/Namensänderung und Löschung. Lehrerrechte/Klassenübersicht, Fortschrittsprozente und PICO-Umbau sind ebenfalls nicht Bestandteil dieser Umsetzung.

## Vorgeschlagene Reihenfolge

1. Bestätigte Eckpunkte verwenden: Klassencode plus bestätigte E-Mail, zunächst 32 Schülerplätze, Lehrerrechte nur durch Superadmin und Mitbetreuung nach Bestätigung. Fortschrittsbasis 60/10/20/10; gewünschte Bonuswerte unten, Heli-Phasen noch abgleichen.
2. Startseitenkopf und Login überarbeiten; Klassencode/Registrierung mit Testklasse erproben. Mailzustellung muss vor öffentlicher Selbstregistrierung verlässlich funktionieren.
3. E-Mail-Bestätigung, Passwort vergessen und kompakter Kontobereich; danach Abnahme auf zwei echten Schulgeräten.
4. Freigegebene Lehrerrollen, Klassenverwaltung, Mitbetreuung, Fortschrittstabelle und CSV. Die spätere Umbenennung/inhaltliche Überarbeitung von PICO blockiert die Login- und Speicherarbeiten nicht.

## Oberfläche

- Logo oben links; `Starten` und A/B-Umschalter im Kopf entfernen, übrige Missionsnavigation zunächst behalten. Haupt-Startmöglichkeit im Seiteninhalt bleibt erhalten.
- Rechts Vollbild-Umschalter und `Anmelden`, angemeldet `Mein Konto`. Vollbild nur nach Klick, mit verständlichem Beenden/Fallback; Arbeitsseiten ebenfalls berücksichtigen. Es ersetzt kein responsives Layout für breite Schullaptops.
- Passwort anzeigen/verbergen in Login, Registrierung und Passwortwechsel; zugänglich beschriftet, nach Schließen wieder verborgen. Acht Zeichen bleiben Mindestlänge.
- Im Login: „Zur Neuanmeldung brauchst du einen Klassencode.“ Deutlicher Link `Neuanmeldung` und später `Passwort vergessen?`.

## Registrierung und Klassencode

`Neuanmeldung → Code prüfen → Willkommen in [Klasse] → Name, E-Mail, Passwort → E-Mail bestätigen → Konto nutzen`

- Zum isolierten Test ein echter serverseitiger Einladungsdatensatz `CTEST` für Klasse `Test`; kein fest eingebauter Bypass. Nach Test widerrufbar.
- Fünf Fehlversuche insgesamt, dann fünf Minuten Wartezeit (vorgeschlagene Auslegung). Serverseitig zählen, Neustart der Maske hebt die Sperre nicht auf. Zusätzliche abgestufte Missbrauchsbremse gegen neue Sitzungen/verteiltes Raten; kein pauschales Fünf-Versuche-Limit pro Schul-IP, sonst sperrt eine Person die Klasse aus.
- Cancel oder Abbruch kehrt ausdrücklich zum Gastmodus zurück. Bestehender Gaststand bleibt unverändert; keine automatische Kontenübernahme.
- Code liefert nur eine kurzlebige serverseitige Registrierungsberechtigung. Klassen-ID, Mitgliedschaft und Kapazität werden beim Anlegen/Bestätigen erneut geprüft; frei übergebene Klassen-IDs reichen nicht.
- Fünf zufällige Großbuchstaben (26^5 Möglichkeiten), aktive Codes eindeutig, erneuerbar, widerrufbar und zeitlich begrenzbar. Einladungen separat von der dauerhaften Klassen-ID speichern. Testcode nur für die Testklasse.
- **Bestätigt am 19.09.: Klassencode plus verifizierte E-Mail genügt für den ersten Pilot**, ohne Schul-Maildomain-Beschränkung oder zusätzliche Einzelfreigabe. Ein Code verhindert keine absichtliche Weitergabe; auch das Platzlimit bestätigt keine Schulzugehörigkeit. Fremde könnten Plätze belegen, weshalb Widerruf/Wechsel des Codes und Entfernen unberechtigter Mitgliedschaften möglich bleiben müssen.
- Zunächst maximal 32 Schülerkonten je Klasse; Lehrkräfte zählen nicht mit. Gleichzeitige letzte Platzvergabe muss transaktional sein. Unbestätigte Anmeldungen nur zeitlich begrenzt reservieren, damit sie keine Plätze dauerhaft blockieren. Bestehende E-Mail erzeugt niemals ein zweites Konto. Später darf der Klasseninhaber ggf. die Kapazität je Klasse einstellen; Grenzen und Verhalten bei Verringerung unter die bestehende Mitgliederzahl vor Umsetzung festlegen, niemals automatisch Mitglieder löschen.

## Kontobereich und E-Mail

- Kompakte Anzeige: Name, E-Mail, Klasse, Fortschritt und zuletzt erreichter Abschnitt; Aktionen Anzeigename ändern, Passwort ändern, E-Mail ändern und Konto löschen. Keine überladene Mitgliederseite.
- E-Mail-Bestätigung und Passwort-Reset über zufällige, kurzlebige, einmal nutzbare Links; kein Passwort per Mail. Antwort bei Reset verrät nicht, ob die Adresse registriert ist. Versand-/Wiederholungsbegrenzung und Zustellung an reale Schulpostfächer testen.
- Gewünschter Hinweis nach erfolgreichem Vormerken der Bestätigungsmail: „Wir senden dir eine Bestätigungs-E-Mail. Öffne dein E-Mail-Programm, zum Beispiel Outlook, und klicke auf den Bestätigungslink. Wenn sich gerade deine ganze Klasse anmeldet, hab bitte etwas Geduld: Wir verschicken höchstens 10 Bestätigungsmails pro Minute. Schau auch im Spam-Ordner nach.“ Nicht schon „E-Mail gesendet“ behaupten, solange die Nachricht nur vorgemerkt ist; bei Fehlern einen passenden Fehler-/Wiederholungshinweis zeigen.
- Versandregel vom 19.09.: höchstens 10 Bestätigungsmails pro Minute projektweit, nicht je Klasse oder Browser. Serverseitige persistente Warteschlange mit nebenläufigkeitssicherer Begrenzung (höchstens 10 Versandversuche in jedem rollierenden 60-Sekunden-Fenster); weitere Anmeldungen warten, statt wegen des Versandlimits verloren zu gehen. Erneutes Anfordern und Wiederholungsversuche dürfen das Limit nicht umgehen; mehrfaches Klicken darf keine parallelen identischen Aufträge erzeugen. Der Versandweg ist noch nicht festgelegt; zusätzlich dessen konkrete Anbieterlimits berücksichtigen.
- E-Mail-Wechsel erst nach erneuter Authentifizierung und Bestätigung der neuen Adresse; alte Adresse benachrichtigen. Erst dann ändert sich der Loginname, interne Konto-ID und Lernstand bleiben gleich. Kein Zusammenlegen zweier existierender Konten durch E-Mail-Wechsel.
- Konto löschen erfordert erneute Bestätigung/Authentifizierung, beendet Sitzungen und entfernt Lernstände/Mitgliedschaften gemäß noch festzulegendem Lösch-/Backupkonzept. Nicht mit „aus Klasse entfernen“ verwechseln.
- Phase 1 verwendet PHP/Sendmail, vorgesehener Absender `noreply@agentpy.bildungdigital.at`. Eine ausdrücklich beauftragte Testmail an `michael@cybershoes.io` wurde vom Transport angenommen; Empfang ist noch nicht bestätigt. Automatisches erneutes Anfordern folgt später; derzeit Lehrperson kontaktieren bzw. nach Ablauf der 48-stündigen Reservierung erneut anmelden. Quellen: [OWASP Passwort-Reset](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [E-Mail-Verifikation](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html).

### Wartungsmarkierung: MAIL-TRANSPORT-LIMIT

- Am 19.09.2026 nachgeprüft: Hostinger dokumentiert für den eingebauten PHP-/Sendmail-Versand tatsächlich 10 Mails/Minute sowie 100 in rollierenden 24 Stunden. Die aufgeführten Cloud-Tarife haben dieselben Grenzen; ein Hostingupgrade hebt sie nicht automatisch auf. SMTP verwendet die Limits des gewählten Maildienstes. Damit ist die frühere Aussage „kein verifiziertes Hostinger-Limit“ für diesen konkreten Versandweg korrigiert. [Hostinger: Sendmail-Limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/).
- Beim späteren Hostingupgrade oder Wechsel des Maildienstes **nicht nur den Hinweistext ändern**: Transport/Minuten- und Tagesbudget prüfen, zentrale Serverkonfiguration und Warteschlangensteuerung einschließlich Wiederholungen anpassen, UI-Hinweis aus den öffentlichen Grenzwerten ableiten und Tests aktualisieren. Implementiert in `server/src/mail.php`, `registration.php`, `bootstrap.php`, `config.example.php` und `assets/data/account-bootstrap.js`, mit Marker `MAIL-TRANSPORT-LIMIT`. SMTP-Adapter selbst ist noch nicht implementiert; höhere Grenzen werden für den eingebauten Sendmail-Transport abgewiesen.
- Eine Grenze nur nach bestätigter Änderung des tatsächlichen Versandwegs erhöhen/entfernen; dauerhafte Warteschlange, ausstehende Aufträge und Missbrauchsschutz nicht pauschal löschen. Alle Mailtypen desselben Versandwegs (Bestätigung, erneutes Anfordern, Reset, E-Mail-Wechsel) teilen dessen Anbieterbudget. Bei Nutzung des eingebauten Hostingversands auch mögliche Mitnutzung durch andere Websites berücksichtigen; unser Zähler kann deren Verbrauch nicht allein bestimmen.
- Tests bei Limitwechsel: z. B. 10 → 20 pro Minute in der Testkonfiguration muss gleichzeitig Versandtakt und angezeigte Zahl ändern; Tagesbudget, parallele Worker, Wiederholungen und bereits wartende Mails prüfen. Bei ausgeschöpftem Tagesbudget passenden Wartehinweis statt bloß „etwas Geduld“ anzeigen; keine verlorenen Aufträge oder irreführenden Versandbestätigungen.

## Lehrkräfte und mehrere Betreuende

- Bestätigt am 19.09.: Lehrerrolle von Anfang an nur durch Superadmin vergeben. Ein geteilter fünfstelliger Code darf niemals allein Verwaltungsrechte verleihen. „Lehrer:innen Böheimkirchen“ ist eine Berechtigungs-/Schulgruppe, keine normale Schülerklasse mit 32 Plätzen.
- Freigegebene Lehrkräfte können Klassen erzeugen und Einladungen verwalten. Eine Klasse hat eine verantwortliche Lehrkraft und weitere ausdrücklich bestätigte Betreuende. Diese zählen nicht zur Schülergrenze.
- Bestätigt am 19.09.: `Klasse hinzufügen` per Klassencode stellt für eine bereits bestätigte Lehrkraft eine Anfrage; die verantwortliche Lehrkraft bestätigt den Zugriff. Alternativ gezielte Mitbetreuungs-Einladung. Der Schülercode allein gibt keinen Zugriff auf Namen, E-Mails oder Fortschritte.
- Lehreraktionen ausschließlich für zugeordnete Klassen: Fortschritt sehen, Namen ändern, Passwort-Reset auslösen und Mitgliedschaften verwalten. E-Mail-Änderung mit Verifikationsablauf, nicht unbemerkt ersetzen. Passwort niemals anzeigen. Für den Unterricht ggf. zeitlich begrenztes Einmalpasswort mit erzwungenem Wechsel vorsehen; Entscheidung noch offen.
- Empfehlung: globale Kontolöschung zunächst nur Kontoinhaber/Superadmin, Lehrkraft entfernt aus ihrer Klasse. Falls Lehrkräfte Konten vollständig löschen dürfen sollen, genaue Rechte und Bestätigung zuerst festlegen. Sicherheitsrelevante Verwaltungsaktionen protokollieren.
- Datenmodell: Rollen, Schulgruppe, Schüler-Mitgliedschaft, Klassen-Betreuende und Einladungen getrennt. Das heutige `users.class_id` ist nur Pilotbasis; Migration erhält bestehende Zuordnung und Lernstände. Schüler zunächst eine aktive Klasse, Lehrer mehrere. Klassennamen künftig innerhalb Schule/Schuljahr, nicht global eindeutig.
- Jede API-Anfrage prüft die tatsächliche Rolle und Klassenzuordnung, auch CSV und Verwaltungsaktionen: [OWASP Zugriffskontrolle](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Fortschrittsberechnung: bestätigte Basis und gewünschte Bonuswerte

Prozentwerte sind Lernfortschritt, keine manipulationssichere Benotung; Erfolg wird weiterhin im Browser festgestellt. Nur erfolgreich abgeschlossene Pflichtabschnitte zählen, keine Seitenaufrufe, Codeversuche, Freischaltungen oder Überspring-Links.

| Bereich | Anteil |
| --- | ---: |
| Missionen 1–4 | 60 %, je Mission 15 % |
| Agententraining | 10 % |
| Ein Wahlweg: PICO **oder** Pixelmuseum | 20 % |
| Vollständige Helikopterflucht | 10 % |

- Innerhalb eines Bereichs nach dessen Pflichtabschnitten berechnen. PICO und Museum sind unterschiedlich lang, deshalb innerhalb des jeweiligen Wegs normalisieren; der weiter abgeschlossene Weg liefert den Wahlweg-Anteil, nicht beide addieren.
- 100 % bedeutet vollständiger Pflichtweg einschließlich Flucht. Gewünschte Änderung vom 19.09.: Ein vollständig erledigter zweiter Wahlweg gibt 20 Bonus-Prozentpunkte statt bisher vorgeschlagener 10; damit 120 % bei vollständigem Pflichtweg und beiden Projekten.
- Mission 2, Level 3 (`mission2_level3`, Kürzel `02-3`, nicht Pixelmuseum) bleibt optional und bringt weitere 5 Bonus-Prozentpunkte. Daraus folgen 100 % Pflichtweg, 105 % mit Mission 2–3, 120 % mit beiden Projekten und maximal 125 % mit beiden Extras. Historisches `mission1_level4` nicht zusätzlich zählen.
- Anzeigeregel als Fortführung des bisherigen Vorschlags: Solange Pflichtabschnitte fehlen, Basis und bereits verdienten Bonus getrennt zeigen, z. B. „80 % + 5 Bonuspunkte“. Erst bei Basis 100 den Gesamtwert 105/120/125 anzeigen; Bonus darf fehlende Pflichtabschnitte niemals verdecken. Jeder Bonus nur einmal, nicht bei jedem erneuten Abschluss. Die bereits verdienten Extras bleiben bis dahin gespeichert.
- PICO 2a soll nach aktueller Tendenz aus dem aktiven Lernweg entfernt werden; weder Pflichtanteil noch Bonus dafür vorsehen. Die Entfernung und die Story-Überarbeitung sind noch nicht umgesetzt; historische gespeicherte Lösungen nicht löschen.
- Im aktuellen Code sind zwei Heli-Abschlüsse erfasst. Roadmap nennt noch „Systeme manuell starten“ und Abflug/Finale. Vor endgültiger Gewichtung die zwei gewünschten fehlenden Phasen abgleichen und eine versionierte Liste der zählenden Pflichtabschnitte festlegen; noch nicht existierende Aufgaben nicht als abgeschlossen ausgeben.
- Kürzel z. B. `03-2`, `AG-3`, `P-4`, `M-2`, `H-2`. „Zuletzt geschafft“ ist nicht automatisch die höchste Nummer. Dafür serverseitigen Abschlusszeitpunkt/letzten abgeschlossenen Abschnitt ergänzen; aktuell enthält der Stand Codes und Gesamt-Änderungszeit, keine verlässliche Abschlusschronik. Bestandsdaten nicht mit erfundenen Zeitpunkten nachtragen.
- Lehrertabelle: Name | E-Mail | Fortschritt | zuletzt geschafft | letzte Aktivität. Bei altem Bestand ohne Chronik ehrlicher Ersatz „erreichter Stand“, nicht erfundene Reihenfolge.
- CSV: Auswahl `;` (Vorschlag Standard) oder `,`, UTF-8, korrektes Quoting und Schutz vor Tabellenformeln aus Namen/E-Mail-Feldern. Nur autorisierte Klasse, keine Passwörter oder vollständigen Schülercodes.

## PICO später umbenennen und vereinfachen

- Nutzer ist mit Namen und innerer Agentengeschichte noch nicht zufrieden; ein neuer Name ist offen. Login, Klassenzuordnung und Speicherung können unabhängig davon weiterentwickelt werden.
- Anzeigenamen, Geschichten und Fortschrittskürzel von stabilen technischen Missions-/Level-IDs trennen. Bestehende IDs wie `pico_level2` bei reiner Umbenennung beibehalten; weder Konten noch gespeicherte Codes umbenennen oder zurücksetzen. Alte Seitenadressen erhalten oder bei späterer URL-Änderung weiterleiten.
- Reine Text-/Namensänderung ist kein neuer Lernabschnitt. Falls Aufgaben oder Erfolgskriterien substanziell geändert werden, Kursversion und explizite Zuordnung alter Abschlüsse planen; keine neue Aufgabe automatisch durch einen fachlich anderen alten Abschluss erfüllen lassen und keinen alten Stand stillschweigend entwerten.
- Für PICO 2a Navigation und Weiter-Buttons von Level 2 direkt auf Level 3 umstellen. Dies ist grundsätzlich vorbereitet: `server/src/storage.php` schaltet Level 3 schon nach Level 2 frei, `assets/runner.js` erlaubt Codeübernahme aus Level 2a oder direkt Level 2; `tests/runner.test.mjs` enthält dafür bereits einen Test. Alle weiteren Verweise und die Darstellung müssen bei tatsächlicher Entfernung trotzdem angepasst/geprüft werden.
- Bestehende 2a-Lösungen historisch erhalten und weiterhin kompatibel einlesen; direkte Altlinks sinnvoll nach Level 3 führen. Nicht einfach den Speicherschlüssel aus der Validierung entfernen, wenn dadurch alte Daten beim Laden/Speichern verloren gingen. Gespeicherten Schülercode nicht per Textersetzung auf einen neuen Drohnennamen umschreiben.
- Ziel des späteren Umbaus: kürzerer, klar geführter Wahlweg für Lernende mit mehr Unterstützungsbedarf. Neuer Name und konkrete Story getrennt von der Login-Umsetzung entscheiden.

## Tests vor Freigabe

- Code falsch/richtig/abgelaufen/widerrufen; fünfter Fehlversuch, Wartezeit, Reload/neue Sitzung, gemeinsam genutzte Schul-IP; keine Gastdatenvermischung bei Abbruch.
- 32 Plätze, zwei gleichzeitige Anmeldungen um letzten Platz, auslaufende Reservierungen, doppelte E-Mail; keine halb angelegten Konten.
- Verifikation/Reset/E-Mail-Wechsel: falsche, abgelaufene und wiederverwendete Links, Zustellfehler, alte Sitzungen, fremde Konten; geänderter Login behält Lernstand.
- Bestätigungsmails: 32 gleichzeitige Registrierungen, höchstens 10 Versandversuche je rollierenden 60 Sekunden auch bei parallelen Versandprozessen und Minutenwechsel; restliche Aufträge bleiben erhalten. Neustart, Versandfehler/Wiederholung und erneutes Anfordern testen; keine doppelten Warteschlangenaufträge durch Mehrfachklick. Hinweis mit Outlook/10-pro-Minute stimmt mit dem tatsächlichen Wartestatus überein; keine erfundene Zustellbestätigung und keine bereits durch Wartezeit unbrauchbaren Bestätigungslinks.
- Rechte-Matrix: Schüler, unbestätigte Lehrkraft, zuständige Lehrkraft, fremde Lehrkraft, Mitbetreuung, Superadmin. Fremde Klassen und CSV-Zugriffe serverseitig verweigern; Entzug wirkt sofort.
- Fortschritt: beide Wahlwege getrennt und gemeinsam, optionale/übersprungene Level, alte Schlüssel, fehlende Fluchtphasen, Grenzen 100/105/120/125, separat ausgewiesene Boni vor vollständigem Pflichtweg, keine Doppelzählung und echte Abschlussreihenfolge.
- PICO-Änderung: alter Gast- und Kontostand bleibt nach Umbenennung vollständig lesbar, Login/Gerätewechsel unverändert; Level 2 → 3 und Codeübernahme mit/ohne historischen 2a-Abschluss, Altlinks, Navigation und serverseitige Freischaltungen prüfen. Alte 2a-Daten bleiben erhalten und zählen weder als Pflicht noch als Bonus. Substanziell geänderte Aufgaben nur gemäß expliziter Kursversions-Regel übernehmen.
- CSV mit Umlauten, Trennzeichen, Anführungszeichen, Zeilenumbrüchen und Formelanfängen; UI/Fokus/Vollbild auf Schullaptop sowie Chromium/WebKit.

## Noch gemeinsam entscheiden

1. Genaue fehlende Heli-Phasen und versionierte Pflichtabschnitte vor endgültiger Fortschrittsberechnung abgleichen. Basis 60/10/20/10 ist grundsätzlich akzeptiert, zweites Projekt +20 und Mission 2–3 +5 sind als gewünschte Bonuswerte festgehalten.
2. Mailabsender/-versand, Löschkonzept und noch offene Verwaltungsdetails vor den jeweiligen Umsetzungsschritten festlegen.
3. PICO-Nachfolgername und Story später entscheiden; gewünschte Entfernung von Level 2a als separaten, bestandsschonenden Kursumbau einplanen. Keine Voraussetzung für Registrierung/Datenspeicherung.
