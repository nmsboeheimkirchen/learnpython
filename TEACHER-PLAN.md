# Lehreransicht: erster freigegebener Umfang umgesetzt

Stand 22.09.2026. **Lehrer:innen ist live eingerichtet.** Erster Umfang mit r9 ausgeliefert und in Chromium/WebKit geprüft; Betriebsdetails und aktueller Release in LOGIN-HANDOFF.md. Zwei andere Konten mit Lernständen sowie Test/CTEST nach frischer privater Sicherung entfernt. Bereits bestehendes `.com`-Konto samt seinem eigenen Lernstand erhalten und als Lehrkraft freigeschaltet. Dieser Plan ersetzt die früheren Vorschläge mit `.io`, Erhalt von Test/CTEST und 90 Tagen Codegültigkeit.

## Entwurf und Freigabe

- Klickbarer Entwurf: `C:/Users/Cy-X/.codex/visualizations/2026/09/16/01a0aae0-d7f5-7652-92cb-0f8e6038c963/agentpy-lehrer-entwurf.html`. Ausschließlich lokale Beispieldaten, keine API-/Hostinger-Verbindung. Ansichten: Meine Klassen, Klassenmitglieder, Klasse erstellen, Kontomenü, Startseite, Fortsetzen über Missionsübersicht. Designsteuerung: aktive/abgelaufene Codes, leere/beispielhafte Klassen, vorhandener/fehlender Lernstand. Lucide-Symbole stehen direkt im Entwurf.
- Der in der Nutzernachricht erwähnte Übersichtsscreenshot fehlt. Arbeitsannahme: Lernpfad-/Missionsübersicht mit abgeschlossenen und offenen Abschnitten, frühere Abschnitte wieder aufrufbar. Vor Implementierung ggf. mit Referenz abgleichen.
- Entwurf anschließend freigegeben und implementiert. Die unten beschriebene einmalige Kontenbereinigung ist abgeschlossen und darf NICHT bei späteren Deployments wiederholt werden. SMTP/DNS und andere Websites unverändert.

## Startseite

- Bei gespeichertem Lernstand im jeweils aktiven Konto oder Browser: **Setze fort / Missionen ansehen**. Setze fort öffnet die Übersicht mit Orientierung zum nächsten Abschnitt, nicht direkt einen Level. Bereits abgeschlossene Abschnitte bleiben zum Wiederholen erreichbar.
- Ohne gespeicherten Lernstand: **Training starten / Missionen ansehen**. Training startet bei System Access. Gast- und Kontostand weiter strikt trennen; Fehler beim Kontoladen ist kein Grund für Gastfallback.

## Einmaliger Neustart nach Entwurfsfreigabe

- Ziel ist ausdrücklich **michael@cybershoes.com**, NICHT das bisherige `.io`-Konto. Beim Bestandscheck bereits vorhanden; eigene Daten wurden erhalten. Anzeigename Michael, interne Gruppe/Klasse **Lehrer:innen**, serverseitige Lehrerrolle, Limit zehn eigene Schülerklassen. Gruppe Lehrer:innen zählt nicht zu diesen zehn; Start ist 0/10.
- Temporäres Passwort wurde vom Nutzer vorgegeben; nicht in Entwurf, Handoff, Git, Kommandozeilen oder Logs wiederholen. Nur sicher entgegennehmen und gehasht speichern; Änderung durch Nutzer nach erster Anmeldung einplanen.
- Nutzer verlangt ausdrücklich: alle anderen AGENT-PY-Konten samt Lernfortschritt entfernen, Klasse Test und Zugangscode CTEST ebenfalls entfernen. Das bisherige `.io`-Konto fällt unter diesen Reset. Exakte Zielmengen unmittelbar vor Ausführung read-only auflösen.
- Vorher frisches privates Backup, Herkunft/Umfang/Restoreverfahren dokumentieren; die alte r7-Sicherung ist nicht aktuell. Backup bleibt eine Wiederherstellungskopie, kein aktiver Kontobestand. Nicht versehentlich aus altem Backup neue Nutzerdaten überschreiben.
- Transaktionaler, ausschließlich auf die AGENT-PY-Datenbank begrenzter Reset: abhängige Lernstände, Mitgliedschaften, Schreibbelege, Registrierungsvormerkungen, Tokens und zugehörige Mailqueue konsistent bereinigen; alte Sitzungen ungültig machen. Worker darf keine alten Bestätigungs-/Resetmails nachsenden. Andere Websites, Datenbanken, Postfächer, SMTP-Zugang und DNS unverändert lassen.
- Neues Lehrerkonto verifizieren/Initialisierung prüfen, keine öffentliche automatische E-Mail-Sonderrolle. Nach Abschluss genau berichten, was entfernt wurde und wie das private Backup Wiederherstellung ermöglicht.

## Erster sinnvoller Release

- **michael@cybershoes.com** bekommt die Lehreransicht wie oben; erstellt die erste Schülerklasse selbst. Keine Testklasse und keinen CTEST-Code neu initialisieren.
- Im Personenmenü erscheint **Meine Klassen** ausschließlich für serverseitig berechtigte Lehrkräfte.
- Klassenübersicht: Name, aktive Schüler:innen/32, offene Bestätigungen, freier Platz; Button Klasse erstellen. Klick auf eine Klasse öffnet ihre Tabelle.
- Tabelle: Anzeigename | E-Mail | Status (E-Mail offen / bestätigt) | Fortschritt | erreichte Abschnitte. Ausstehende Registrierung ist eine zeitlich begrenzte Reservierung, noch kein aktiver Schüleraccount; Ablauf/Platzfreigabe korrekt berücksichtigen. Name/E-Mail nie für unberechtigte Konten oder andere Klassen ausgeben.
- Aktualisieren-Button reicht für den ersten Testtag. Bei fünf Anmeldungen muss Michael verlässlich sehen: Reservierung → E-Mail bestätigt → Mitgliedschaft in seiner Klasse → gespeicherter Fortschritt. Ausstehende Prozentwerte als Strich, nicht erfundene 0 %. Vorhandenes Datenmodell besitzt keine echte Abschlusschronik; deshalb zunächst „erreichte Abschnitte“, nicht „zuletzt geschafft“ behaupten. Beispiel-Prozentwerte im Entwurf sind keine Änderung der vereinbarten Kursgewichtung.
- Neue Klasse: Name eingeben, serverseitig transaktional Klassenlimit prüfen, Klasse samt Eigentümer und zufälligem eindeutigen **5-Großbuchstaben-Code** erzeugen. Je Klasse zunächst 32 Schülerplätze; Lehrer zählen nicht dazu. Die zehn beziehen sich auf betreute/eigene Klassen, nicht auf verbrauchte Codes. Vorschlag: Eigentümerklassen zählen zum persönlichen Limit; fremde Mitbetreuung später separat.
- Je Klasse ein aktiver Beitrittscode: kryptografisch zufällige eindeutige Kombination aus **fünf Großbuchstaben**, **zehn Tage ab Erzeugung** gültig. Server prüft tatsächlichen Ablaufzeitpunkt, Anzeige als lokales Datum (Europe/Vienna). Aktive Anzeige z.B. **Beitrittscode: GNLWS gültig bis 2.10.2026**, mit Kopierbutton. Bei Ablauf **Beitrittscode: generieren**, generieren unterstrichen als zugängliche Aktion. Nicht automatisch erneuern. Neuer Code gilt wieder zehn Tage; Mitglieder/Lernstände bleiben erhalten, kein zusätzlicher Klassenplatz wird verbraucht.
- Dauerhafte Anzeige aktiver Codes ist jetzt gewünscht und ersetzt den Einmalanzeige-Vorschlag: Hash für Lookup plus verschlüsselter Code mit privatem Serverschlüssel; keine Klartext-Codeablage in Logs. Berechtigte Eigentümer dürfen ihn abrufen, andere Klassen/Schüler nicht. Migrations-/Backup-/Schlüsselverlustkonzept bei Umsetzung berücksichtigen.
- Ablauf sperrt neue Beitritte; Verhalten bereits vorgemerkter, noch unbestätigter Registrierungen am Ablaufzeitpunkt ausdrücklich testen und mit bestehender Reservierungs-/Tokenlogik abstimmen. Keine unbegrenzte nachträgliche Beitrittsmöglichkeit.
- Keine Konto-/Klassenlöschung, kein E-Mail-Ändern, kein Admin-Passwortsetzen und keine CSV-Funktion im ersten Release. Selbstbedienungs-Reset bleibt vorhanden. Das begrenzt den ersten Test auf Klassenbeitritt und nachvollziehbaren Lernstand.

## Sicherheits- und Datenmodell

- Separate Rollen/Berechtigungen, Lehrerprofil mit Klassenlimit, Klassen-Eigentümer/Betreuungszuordnung und Schüler-Mitgliedschaft. `users.class_id` ist heute Pilotbasis. Migration additiv; der ausdrücklich beauftragte einmalige Datenreset ist ein separater protokollierter Operatorvorgang, keine bei jedem Deployment wiederholte Migration. Interne Lehrergruppe verleiht allein noch keine Rechte. Lehrerkonto nicht als Schülerplatz zählen.
- Kein Lehrerbeitritt über CTEST/anderen Schülercode. Lehrerrechte nur durch autorisierte Administration; erste Michael-Freischaltung als dokumentierter einmaliger Operatorvorgang nach Freigabe, keine dauerhaft im Code hartcodierte E-Mail-Ausnahme.
- Bestehender lokaler Präsentations-/Lösungsmodus `#l` ist KEINE Verwaltungsberechtigung. Kein localStorage-, Hash- oder Frontendflag darf Zugang zu Namen/E-Mails/Fortschritt eröffnen.
- Jeder API-Endpunkt prüft angemeldetes aktives Konto, Lehrerrolle und Zuordnung zur angefragten Klasse. Schreibaktionen zusätzlich CSRF/Origin; parallele Erstellung darf Klassenlimit nicht umgehen. Codes zufällig, Kollisionen transaktional behandeln; bestehende Code-/Kapazitätslimits nicht abschwächen.
- Anzeigen escaped/textContent; keine Passwörter, Hashes, Sitzungstokens oder E-Mail-Token in Tabellen/API-Listen. Sichere Änderungsprotokolle ohne Secrets für Rollenzuweisung, Klasse/Codeverwaltung.

## Danach: Superadmin und erweiterte Lehrkraftfunktionen

- **michael@3d.run** erst später als verifiziertes Konto, danach ausdrücklich Superadmin zuweisen. E-Mail allein beweist keine Rolle; kein automatisches Hochschalten bei Registrierung dieser Adresse.
- Superadmin verwaltet Lehrerrechte und Klassenlimit. „Lehrer löschen“ zunächst als Entzug der Lehrerrolle verstehen, NICHT Löschen von persönlichem Konto, Schülern oder Klassen. Vor Entzug Eigentümerklassen übertragen oder gezielt stilllegen; nie verwaisen lassen.
- Weitere Betreuende nur nach Bestätigung durch Klasseninhaber/Superadmin. Ein Schülercode allein darf keine Schülerdaten freigeben.
- Später: CSV (Trennzeichenwahl ;/,), Aktionen zur Mitgliedschaft, Schülername bearbeiten, Reset anstoßen, verifizierter E-Mail-Wechsel, Selbstlöschung/ggf. Adminlöschung mit klaren Regeln. Separat genaue Rechte abnehmen.

## Abnahme vor Live-Freigabe

1. Entwurf freigeben, frisches Backup und additive Migration. Anschließend einmaliger exakt begrenzter Datenreset mit Prüfung auf verwaiste Daten, alte Sitzungen und Mailjobs. Nur Michael-.com-Lehrerkonto in Lehrer:innen bleibt; 0/10 eigene Klassen. Abgeschlossen, nicht wiederholen.
2. Schüler/Gäste/Lehrer einer anderen Klasse erhalten keinen Zugriff, auch nicht mit direkt manipulierter Klassen-ID.
3. Test/CTEST und alte Nutzer/Lernstände entfernt. Michael legt benannte Klasse samt neuem Code an; neue Anmeldung erscheint offen und nach Bestätigung als Mitglied. Passwortreset ändert die Zuordnung nicht. Lehrerrolle niemals per Schülercode erlangbar.
4. Fünf parallele Schüleranmeldungen, 32er-Grenze inklusive Reservierungen, Lehrerplatz ausgenommen. Parallele Klasse 10/11 wird zuverlässig begrenzt.
5. Zehntägiger Codeablauf mit kontrollierter Testzeit, Anzeige/Generieren, Doppelregistrierung, Namens-Escaping, Chromium/iPad-WebKit. Startseite ohne Stand/mit Browserstand/mit Kontostand: richtige Buttons, Fortsetzen öffnet Übersicht, vorherige Abschnitte erreichbar. CSV erst später.

**Freigegeben:** Nutzer hat Entwurf abgenommen und den Gruppennamen Lehrer:innen korrigiert. Kleinen Lehrer-Release samt geplantem Reset umsetzen, testen, erst danach veröffentlichen. Superadmin separat danach.
