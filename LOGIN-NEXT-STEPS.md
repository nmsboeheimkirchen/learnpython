# Klassen und Konten: Diskussionsentwurf

Stand 18.09.2026. **Planung, nicht zur Umsetzung freigegeben.** Der Nutzer hat Anmeldung, Speichern und Abmelden mit dem persönlichen Testkonto bestätigt. Der vorhandene r2-Stand wird auf `dev-login-save` gesichert. Dieser Entwurf ändert weder Website noch API oder Datenbank; insbesondere ist `CTEST` noch nicht aktiv.

## Vorgeschlagene Reihenfolge

1. Klassen-, Rollen-, Registrierungs- und Fortschrittsregeln gemeinsam entscheiden.
2. Startseitenkopf und Login überarbeiten; Klassencode/Registrierung mit Testklasse erproben. Mailzustellung muss vor öffentlicher Selbstregistrierung verlässlich funktionieren.
3. E-Mail-Bestätigung, Passwort vergessen und kompakter Kontobereich; danach Abnahme auf zwei echten Schulgeräten.
4. Freigegebene Lehrerrollen, Klassenverwaltung, Mitbetreuung, Fortschrittstabelle und CSV.

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
- **Ein Code verhindert keine absichtliche Weitergabe.** Für garantierte Beschränkung auf die Schule wären zusätzlich erlaubte Schul-Maildomains oder eine Lehrerfreigabe erforderlich. Zu entscheiden, ob für den ersten Pilot der Code mit verifizierter E-Mail genügt.
- Maximal 32 Schülerkonten je Klasse; Lehrkräfte zählen nicht mit. Gleichzeitige letzte Platzvergabe muss transaktional sein. Unbestätigte Anmeldungen nur zeitlich begrenzt reservieren, damit sie keine Plätze dauerhaft blockieren. Bestehende E-Mail erzeugt niemals ein zweites Konto.

## Kontobereich und E-Mail

- Kompakte Anzeige: Name, E-Mail, Klasse, Fortschritt und zuletzt erreichter Abschnitt; Aktionen Anzeigename ändern, Passwort ändern, E-Mail ändern und Konto löschen. Keine überladene Mitgliederseite.
- E-Mail-Bestätigung und Passwort-Reset über zufällige, kurzlebige, einmal nutzbare Links; kein Passwort per Mail. Antwort bei Reset verrät nicht, ob die Adresse registriert ist. Versand-/Wiederholungsbegrenzung und Zustellung an reale Schulpostfächer testen.
- E-Mail-Wechsel erst nach erneuter Authentifizierung und Bestätigung der neuen Adresse; alte Adresse benachrichtigen. Erst dann ändert sich der Loginname, interne Konto-ID und Lernstand bleiben gleich. Kein Zusammenlegen zweier existierender Konten durch E-Mail-Wechsel.
- Konto löschen erfordert erneute Bestätigung/Authentifizierung, beendet Sitzungen und entfernt Lernstände/Mitgliedschaften gemäß noch festzulegendem Lösch-/Backupkonzept. Nicht mit „aus Klasse entfernen“ verwechseln.
- Mailversand/Absender und Ablauf bei nicht angekommenen Mails sind vor Freigabe offen. Quellen: [OWASP Passwort-Reset](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [E-Mail-Verifikation](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html).

## Lehrkräfte und mehrere Betreuende

- Empfehlung: Lehrerrolle von Anfang an nur durch Superadmin vergeben. Ein geteilter fünfstelliger Code darf niemals allein Verwaltungsrechte verleihen. „Lehrer:innen Böheimkirchen“ ist eine Berechtigungs-/Schulgruppe, keine normale Schülerklasse mit 32 Plätzen.
- Freigegebene Lehrkräfte können Klassen erzeugen und Einladungen verwalten. Eine Klasse hat eine verantwortliche Lehrkraft und weitere ausdrücklich bestätigte Betreuende. Diese zählen nicht zur Schülergrenze.
- `Klasse hinzufügen` per Klassencode kann für eine bereits bestätigte Lehrkraft eine Anfrage stellen; die verantwortliche Lehrkraft bestätigt den Zugriff. Alternativ gezielte Mitbetreuungs-Einladung. Der Schülercode allein gibt keinen Zugriff auf Namen, E-Mails oder Fortschritte.
- Lehreraktionen ausschließlich für zugeordnete Klassen: Fortschritt sehen, Namen ändern, Passwort-Reset auslösen und Mitgliedschaften verwalten. E-Mail-Änderung mit Verifikationsablauf, nicht unbemerkt ersetzen. Passwort niemals anzeigen. Für den Unterricht ggf. zeitlich begrenztes Einmalpasswort mit erzwungenem Wechsel vorsehen; Entscheidung noch offen.
- Empfehlung: globale Kontolöschung zunächst nur Kontoinhaber/Superadmin, Lehrkraft entfernt aus ihrer Klasse. Falls Lehrkräfte Konten vollständig löschen dürfen sollen, genaue Rechte und Bestätigung zuerst festlegen. Sicherheitsrelevante Verwaltungsaktionen protokollieren.
- Datenmodell: Rollen, Schulgruppe, Schüler-Mitgliedschaft, Klassen-Betreuende und Einladungen getrennt. Das heutige `users.class_id` ist nur Pilotbasis; Migration erhält bestehende Zuordnung und Lernstände. Schüler zunächst eine aktive Klasse, Lehrer mehrere. Klassennamen künftig innerhalb Schule/Schuljahr, nicht global eindeutig.
- Jede API-Anfrage prüft die tatsächliche Rolle und Klassenzuordnung, auch CSV und Verwaltungsaktionen: [OWASP Zugriffskontrolle](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Vorschlag zur Fortschrittsberechnung

Prozentwerte sind Lernfortschritt, keine manipulationssichere Benotung; Erfolg wird weiterhin im Browser festgestellt. Nur erfolgreich abgeschlossene Pflichtabschnitte zählen, keine Seitenaufrufe, Codeversuche, Freischaltungen oder Überspring-Links.

| Bereich | Anteil |
| --- | ---: |
| Missionen 1–4 | 60 %, je Mission 15 % |
| Agententraining | 10 % |
| Ein Wahlweg: PICO **oder** Pixelmuseum | 20 % |
| Vollständige Helikopterflucht | 10 % |

- Innerhalb eines Bereichs nach dessen Pflichtabschnitten berechnen. PICO und Museum sind unterschiedlich lang, deshalb innerhalb des jeweiligen Wegs normalisieren; der weiter abgeschlossene Weg liefert den Wahlweg-Anteil, nicht beide addieren.
- 100 % bedeutet vollständiger Pflichtweg einschließlich Flucht. Danach gibt ein vollständig erledigter zweiter Wahlweg 10 Bonuspunkte: 110 %. Bonus darf fehlende Pflichtabschnitte nicht verdecken; vor vollständigem Pflichtweg kein Aufrunden auf 100 durch Bonus.
- `mission2_level3` und `pico_level2a` sind laut Seiten ausdrücklich optional und verhindern nicht 100 %. Historisches `mission1_level4` nicht zusätzlich zählen. Optionale Zusatzleistungen separat kennzeichnen.
- Im aktuellen Code sind zwei Heli-Abschlüsse erfasst. Roadmap nennt noch „Systeme manuell starten“ und Abflug/Finale. Vor endgültiger Gewichtung die zwei gewünschten fehlenden Phasen abgleichen und eine versionierte Liste der zählenden Pflichtabschnitte festlegen; noch nicht existierende Aufgaben nicht als abgeschlossen ausgeben.
- Kürzel z. B. `03-2`, `AG-3`, `P-4`, `M-2`, `H-2`. „Zuletzt geschafft“ ist nicht automatisch die höchste Nummer. Dafür serverseitigen Abschlusszeitpunkt/letzten abgeschlossenen Abschnitt ergänzen; aktuell enthält der Stand Codes und Gesamt-Änderungszeit, keine verlässliche Abschlusschronik. Bestandsdaten nicht mit erfundenen Zeitpunkten nachtragen.
- Lehrertabelle: Name | E-Mail | Fortschritt | zuletzt geschafft | letzte Aktivität. Bei altem Bestand ohne Chronik ehrlicher Ersatz „erreichter Stand“, nicht erfundene Reihenfolge.
- CSV: Auswahl `;` (Vorschlag Standard) oder `,`, UTF-8, korrektes Quoting und Schutz vor Tabellenformeln aus Namen/E-Mail-Feldern. Nur autorisierte Klasse, keine Passwörter oder vollständigen Schülercodes.

## Tests vor Freigabe

- Code falsch/richtig/abgelaufen/widerrufen; fünfter Fehlversuch, Wartezeit, Reload/neue Sitzung, gemeinsam genutzte Schul-IP; keine Gastdatenvermischung bei Abbruch.
- 32 Plätze, zwei gleichzeitige Anmeldungen um letzten Platz, auslaufende Reservierungen, doppelte E-Mail; keine halb angelegten Konten.
- Verifikation/Reset/E-Mail-Wechsel: falsche, abgelaufene und wiederverwendete Links, Zustellfehler, alte Sitzungen, fremde Konten; geänderter Login behält Lernstand.
- Rechte-Matrix: Schüler, unbestätigte Lehrkraft, zuständige Lehrkraft, fremde Lehrkraft, Mitbetreuung, Superadmin. Fremde Klassen und CSV-Zugriffe serverseitig verweigern; Entzug wirkt sofort.
- Fortschritt: beide Wahlwege getrennt und gemeinsam, optionale/übersprungene Level, alte Schlüssel, fehlende Fluchtphasen, 100/110-Grenze und echte Abschlussreihenfolge.
- CSV mit Umlauten, Trennzeichen, Anführungszeichen, Zeilenumbrüchen und Formelanfängen; UI/Fokus/Vollbild auf Schullaptop sowie Chromium/WebKit.

## Noch gemeinsam entscheiden

1. Genügen Klassencode plus E-Mail-Bestätigung im ersten Pilot oder zusätzlich Schul-Maildomain/Lehrerfreigabe?
2. Lehrerrolle nur Superadmin und Mitbetreuung nach Bestätigung der verantwortlichen Lehrkraft?
3. Gewichtung 60/10/20/10, Bonus erst nach vollständigem Pflichtweg und genaue fehlende Heli-Phasen?
