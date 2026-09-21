# Lehreransicht: Vorschlag zur Freigabe, noch nicht implementiert

Stand 21.09.2026. Nutzer hat echte CTEST-Registrierung, Bestätigung und Reset erfolgreich getestet. Zunächst Unterrichtstest mit fünf Schüler:innen; Lehrer-/Superadminrechte bleiben bis Freigabe unverändert.

## Erster sinnvoller Release

- Bestehendes Konto **michael@cybershoes.io** bekommt zusätzlich die Lehrerrolle, die bestehende Klasse **Test** und ein Klassenlimit von **10**. Bestehender Lernstand, Konto-ID, Login und CTEST bleiben erhalten. Test zählt als erste der zehn Klassen; keine zweite gleichnamige Testklasse anlegen.
- Im Personenmenü erscheint **Meine Klassen** ausschließlich für serverseitig berechtigte Lehrkräfte.
- Klassenübersicht: Name, aktive Schüler:innen/32, offene Bestätigungen, freier Platz; Button Klasse erstellen. Klick auf Test öffnet die Tabelle.
- Tabelle: Anzeigename | E-Mail | Status (E-Mail offen / bestätigt) | Fortschritt | erreichte Abschnitte. Ausstehende Registrierung ist eine zeitlich begrenzte Reservierung, noch kein aktiver Schüleraccount; Ablauf/Platzfreigabe korrekt berücksichtigen. Name/E-Mail nie für unberechtigte Konten oder andere Klassen ausgeben.
- Aktualisieren-Button reicht für den ersten Testtag. Bei fünf Anmeldungen muss Michael verlässlich sehen: Reservierung → E-Mail bestätigt → Mitgliedschaft in Test → gespeicherter Fortschritt. Ausstehende Prozentwerte als Strich, nicht erfundene 0 %. Alte Daten besitzen keine echte Abschlusschronik; deshalb „erreichte Abschnitte“, nicht „zuletzt geschafft“ behaupten.
- Neue Klasse: Name eingeben, serverseitig transaktional Klassenlimit prüfen, Klasse samt Eigentümer und zufälligem eindeutigen **5-Großbuchstaben-Code** erzeugen. Je Klasse zunächst 32 Schülerplätze; Lehrer zählen nicht dazu. Die zehn beziehen sich auf betreute/eigene Klassen, nicht auf verbrauchte Codes. Vorschlag: Eigentümerklassen zählen zum persönlichen Limit; fremde Mitbetreuung später separat.
- Je Klasse ein aktiver Beitrittscode. Codewechsel widerruft den alten Code, erhält Mitglieder/Lernstand und verbraucht keinen neuen Klassenplatz. Codes bleiben wie CTEST zunächst 90 Tage gültig. Anzeige neuer Codes einmalig mit Kopieren; bestehende Hashes lassen sich nicht zurückrechnen. Falls der Code dauerhaft wiederanzeigbar sein soll, muss dafür vor Umsetzung eine private verschlüsselte Ablage geplant werden, kein Klartext-Logging. Für den ersten bestehenden Testcode ist CTEST bereits bekannt.
- Keine Konto-/Klassenlöschung, kein E-Mail-Ändern, kein Admin-Passwortsetzen und keine CSV-Funktion im ersten Release. Selbstbedienungs-Reset bleibt vorhanden. Das begrenzt den ersten Test auf Klassenbeitritt und nachvollziehbaren Lernstand.

## Sicherheits- und Datenmodell

- Separate Rollen/Berechtigungen, Lehrerprofil mit Klassenlimit, Klassen-Eigentümer/Betreuungszuordnung und Schüler-Mitgliedschaft. `users.class_id` ist heute Pilotbasis; Migration muss vorhandene Schülerzuordnung und persönliche Stände erhalten. Lehrer-Schüler-Doppelrolle bewusst zulassen, aber das Lehrerkonto nicht als 32. Schülerplatz zählen.
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

1. Backup und additive Migration; persönliche Konten/Lernstände erhalten.
2. Schüler/Gäste/Lehrer einer anderen Klasse erhalten keinen Zugriff, auch nicht mit direkt manipulierter Klassen-ID.
3. Klasse Test vorhanden; CTEST bleibt gültig; neue Anmeldung erscheint offen und nach Bestätigung als Mitglied, Passwortreset ändert die Zuordnung nicht.
4. Fünf parallele Schüleranmeldungen, 32er-Grenze inklusive Reservierungen, Lehrerplatz ausgenommen. Parallele Klasse 10/11 wird zuverlässig begrenzt.
5. Codewechsel/Ablauf, Doppelregistrierung, Namens-Escaping, Chromium/iPad-WebKit und CSV erst in späterem gesondertem Schritt.

**Freigabe noch offen:** Dieser Vorschlag ist die Planung, kein Auftrag zur stillen Rollenänderung. Empfohlen zuerst obigen kleinen Lehrer-Release freigeben; Superadmin separat danach.
