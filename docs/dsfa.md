# Datenschutz-Folgenabschätzung (DSFA) Einsatzauftrag

Stand: 30.10.2026, Codestand 6f44e34. Gegenstand: die Web-App einsatzauftrag.app und die Bibliothek `einsatzauftrag`.

Dieses Dokument ist ein Entwurf des Entwicklers. Es ersetzt keine Prüfung durch eine Datenschutzbeauftragte oder einen Datenschutzbeauftragten und keine Rechtsberatung. Punkte, die ich aus dem Code nicht belegen kann, sind als "zu klären" markiert und in Abschnitt 9 gesammelt.

## 1. Zweck und Aufbau

Die Folgenabschätzung nach Art. 35 DSGVO folgt dem üblichen Ablauf: Beschreibung der Verarbeitung, Prüfung von Notwendigkeit und Verhältnismäßigkeit, Bewertung der Risiken für Betroffene, Abhilfemaßnahmen, Ergebnis. Technische Einzelheiten stehen in `docs/arc42.md`, die Nutzer-Information in `web/datenschutz.html`.

## 2. Schwellenwertanalyse: ist eine DSFA nötig?

Eine DSFA ist nötig, wenn eine Verarbeitung voraussichtlich ein hohes Risiko für die Rechte und Freiheiten natürlicher Personen hat (Art. 35 Abs. 1 DSGVO). Ich habe die Kriterien der Leitlinien der Artikel-29-Datenschutzgruppe (WP 248) gegen die Verarbeitung gehalten.

| Kriterium | Trifft zu? | Begründung |
| --- | --- | --- |
| Bewertung oder Scoring | Nein | Die App bewertet niemanden. |
| Automatisierte Entscheidung mit Rechtswirkung | Nein | Die App entscheidet nichts, sie setzt Text auf ein Formular. |
| Systematische Überwachung | Nein | Die Reichweitenmessung zählt Seitenaufrufe, ohne Kennung und ohne Verfolgung einzelner Personen. |
| Besondere Kategorien (Art. 9) oder Strafdaten | Möglich | Der Vordruck hat freie Textfelder. Abschnitt 1a (Schadenlage) und 4e (Medizinische Versorgung) können Angaben zu Verletzten oder Erkrankten enthalten. Die App verlangt oder strukturiert solche Angaben nicht. |
| Verarbeitung in großem Umfang | Nein | Die Inhalte bleiben auf dem Gerät des Nutzers. Beim Betreiber fallen nur Verbindungsdaten und Zählimpulse an. |
| Abgleich oder Zusammenführung von Datensätzen | Nein | |
| Schutzbedürftige Betroffene | Möglich | Betroffene sind Einsatzkräfte (Abhängigkeitsverhältnis zur Organisation) und gegebenenfalls Hilfebedürftige im Einsatzgebiet. |
| Innovative Technologie | Nein | Kompression und Service Worker sind Browser-Standard. |
| Hindert Betroffene an Rechten oder Leistungen | Nein | |

Zwei Kriterien treffen möglicherweise zu, beide nur durch das, was Nutzer selbst in Freitextfelder schreiben. Ob die Muss-Liste der zuständigen Aufsichtsbehörde nach Art. 35 Abs. 4 DSGVO eine solche reine Client-Anwendung ohne serverseitige Speicherung erfasst, habe ich nicht geprüft (zu klären).

Ergebnis der Schwellenwertanalyse: Für die Verarbeitung durch den Betreiber (Abschnitt 3.1) ist eine DSFA voraussichtlich nicht zwingend. Für die Verwendung durch eine einsetzende Stelle, die in die App Namen, Anschriften und Gesundheitsangaben schreibt, kann sie es sein, und diese Stelle ist dann dafür verantwortlich. Ich führe die DSFA trotzdem vollständig durch, weil sie die Risiken des Werkzeugs an einer Stelle bündelt, die einsetzende Stellen für die eigene DSFA übernehmen können, und weil sie Lücken in der App aufdeckt (Abschnitt 6).

## 3. Beschreibung der Verarbeitung

### 3.1 Rollen

| Verarbeitung | Verantwortlicher | Anmerkung |
| --- | --- | --- |
| Auslieferung der Website, Zählimpuls | Betreiber: Johannes Rudolph, Kniphauser Straße 16, 26419 Schortens | Laut Datenschutzerklärung der App. |
| Inhalte eines Einsatzauftrags im Browser | Die einsetzende Stelle bzw. der Nutzer, der die Daten eingibt | Der Betreiber hat keinen Zugriff und bestimmt weder Zweck noch Mittel der Eingabe. Er stellt ein Werkzeug bereit. |
| Weitergabe von PDF und Link | Der Nutzer, der weitergibt | |

Offen: ob der Betreiber für die App eine Funktion im Rahmen des THW trägt oder sie privat betreibt. Der Quellcode nennt eine E-Mail-Adresse bei thw-oldenburg.de, die Datenschutzerklärung nennt eine Privatperson als Verantwortlichen. Diese Rollenfrage entscheidet, wer die DSFA beschließt und wer Aufsichtsbehörde ist (zu klären).

### 3.2 Art, Umfang, Kontext, Zweck

Zweck: Einsatzaufträge nach dem Vordruck Fb Fü 3 am Bildschirm ausfüllen und als PDF ausgeben, einzeln oder aus einer Tabelle.

Art der Verarbeitung: Erfassen, Anzeigen, Speichern des Entwurfs im Browser, Verdichten und Kodieren, Ausgeben als PDF, Download, Einlesen von PDF, Tabelle, Link. Alles im Browser.

Zeitlicher Rahmen: Der Entwurf bleibt im lokalen Speicher, bis der Nutzer ihn leert oder die Websitedaten löscht. Eine automatische Frist gibt es nicht.

### 3.3 Datenkategorien und Betroffene

Inhalt der Aufträge (liegt beim Nutzer, siehe 3.1):

| Feld | Mögliche personenbezogene Daten | Betroffene |
| --- | --- | --- |
| Absender, Empfänger, Unterschrift, Dienststelle, abgesandt von | Namen, Funktionen, Funkrufnamen | Einsatzkräfte, Führungskräfte |
| Einsatz, lfd. Nr., Ort/Datum | Einsatzort, Zeitpunkt | Einsatzkräfte, Anwohner |
| 1a Gefahren- und Schadenlage | Adressen, Schadensorte, Angaben zu Betroffenen des Schadens | Anwohner, Verletzte |
| 1b, 1c, 3a bis 3c | Kräfte, Einsatzbereiche, Absichten | Einsatzkräfte |
| 4a bis 4g Logistik | Unterbringung (4f), Verpflegung mit möglichen Unverträglichkeiten (4a), medizinische Versorgung (4e), Abrechnung (4g) | Einsatzkräfte, Betroffene |
| 5 Führung und Verbindung | Telefonnummern, Funkkanäle, Standorte von Führungsstellen | Führungskräfte |
| Logo | Kein Personenbezug, sofern es nur ein Wappen ist | |

Die App kennt die Inhalte nur als Zeichenketten. Sie wertet nichts aus, vergleicht nichts und bildet keine Profile.

Beim Betreiber anfallende Daten:

| Datum | Quelle | Zweck | Rechtsgrundlage |
| --- | --- | --- | --- |
| IP-Adresse, Zeitpunkt, abgerufene Datei, Browser-Kennung | GitHub Pages (GitHub Inc.), Server-Logs | Bereitstellung und Absicherung | Art. 6 Abs. 1 lit. f |
| Seitenpfad, Seitentitel, Referrer, Bildschirmbreite, Browser, System, Land | GoatCounter | Reichweitenmessung | Art. 6 Abs. 1 lit. f, Widerspruch möglich |

Die Datenschutzerklärung nennt für GoatCounter, dass die IP-Adresse nur zum Erkennen wiederholter Aufrufe am selben Tag dient und nicht gespeichert wird. Das ist eine Angabe des Dienstes; ich habe sie nicht geprüft (zu klären).

### 3.4 Datenfluss

1. Eingabe in die Maske, Tabelle, PDF oder Link: Daten gelangen in den Speicher des Browsers.
2. Entwurf: Die Maske sichert ihren Stand im `localStorage` (`ea.entwurf.v1`). Einstellungen und Logo liegen ebenfalls dort.
3. Ausgabe: Die PDF entsteht im Browser. Sie enthält zusätzlich im Info-Eintrag `Keywords` alle eingegebenen Feldwerte als komprimierten, base64url-kodierten Text.
4. Link: "Link teilen" legt dieselben Werte ins Fragment (`#a=…`). Der Browser überträgt das Fragment nicht an den Server.
5. Weitergabe: Danach entscheidet der Nutzer, wohin Datei oder Link gehen (Mail, Messenger, Ablage, Druck).

Kein Auftragsinhalt wird von der App an einen Server gesendet. Das lässt sich im Code nachvollziehen: Die einzigen Netzzugriffe sind das Laden eigener Dateien (Seite, Programmteile, Schrift), das nachgeladene Zählskript und das Zählsignal.

### 3.5 Eingesetzte Mittel und Empfänger

| Empfänger / Auftragsverarbeiter | Rolle | Daten | Stand |
| --- | --- | --- | --- |
| GitHub Inc. (Microsoft), USA | Hosting der Website | Verbindungsdaten | Drittlandübermittlung; Grundlage (Angemessenheitsbeschluss zum EU-US Data Privacy Framework, Zertifizierung) und Vertrag zur Auftragsverarbeitung sind zu klären. |
| GoatCounter | Reichweitenmessung | Zählimpuls | Sitz, Hosting und Vertrag sind zu klären. Das Skript wird von `gc.zgo.at` geladen, Zählimpulse gehen an `einsatzauftrag.goatcounter.com`. |
| Empfänger von PDF oder Link | Vom Nutzer gewählt | Alle Eingaben | Außerhalb der App. |

## 4. Notwendigkeit und Verhältnismäßigkeit

Zweckbindung. Die Daten werden nur zum Ausfüllen und Ausgeben des Vordrucks verarbeitet. Es gibt keine Zweitverwendung.

Datenminimierung. Alle Felder des Vordrucks sind optional. Die App fragt keine Konten, keine Kennungen und keine Pflichtangaben ab. Der Betreiber erhält keine Auftragsinhalte. Das ist die stärkste Maßnahme dieser Verarbeitung und der Grund, warum das Risiko für die Betroffenen insgesamt gering bleibt.

Speicherbegrenzung. Verbesserungswürdig: Der Entwurf bleibt unbegrenzt im Browser. Der Nutzer kann ihn mit "Felder leeren" entfernen, eine Frist gibt es nicht (Maßnahme M5).

Rechtsgrundlage der Inhalte. Sie liegt bei der einsetzenden Stelle, bei Behörden regelmäßig in einer Aufgabenzuweisung (Art. 6 Abs. 1 lit. e DSGVO mit der jeweiligen Rechtsgrundlage, bei Gesundheitsdaten zusätzlich Art. 9 Abs. 2). Die App legt keine Grundlage fest.

Rechtsgrundlage der Verbindungsdaten und der Reichweitenmessung. Berechtigtes Interesse, Art. 6 Abs. 1 lit. f. Für die Messung: Interesse an der Kenntnis der Nutzung; Eingriff gering, weil weder Cookie noch geräteübergreifende Kennung; Widerspruch nach Art. 21 über ein Kästchen in der Datenschutzerklärung. Der Zugriff auf Endgerät-Speicher für Anzeigemodus, Entwurf und Logo stützt sich auf § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich für den gewünschten Dienst). Für das Zählskript selbst nimmt die Datenschutzerklärung dagegen eine Einwilligungsfreiheit an, weil kein Zugriff auf Endgerät-Informationen und kein Cookie erfolgt; dass es das Kästchen über `localStorage` auswertet, ist ein Schreibzugriff, der dem Widerspruch dient (zu klären: Bewertung durch Datenschutzbeauftragte).

Information der Betroffenen. Die Datenschutzerklärung der App unterrichtet Nutzer. Betroffene, deren Daten in Aufträgen stehen (Einsatzkräfte, Anwohner), werden von der einsetzenden Stelle informiert, nicht von der App.

Betroffenenrechte. Für die Verbindungsdaten und die Messung ist der Betreiber Ansprechpartner (E-Mail in der Datenschutzerklärung). Für Auftragsinhalte hat der Betreiber keine Daten, auf die er Auskunft geben oder die er löschen könnte; die einsetzende Stelle muss dies in ihren Prozessen abbilden. Löschen im Browser kann der Nutzer selbst.

## 5. Risikoanalyse

Bewertet wird das Risiko für die Betroffenen, nicht für den Betreiber. Eintrittswahrscheinlichkeit und Schwere: gering, mittel, hoch.

| Nr. | Risiko | Quelle | Wahrscheinlichkeit | Schwere | Risiko vor Maßnahmen |
| --- | --- | --- | --- | --- | --- |
| R1 | Unbefugter liest den Entwurf auf einem gemeinsam genutzten oder verlorenen Gerät. | Entwurf im `localStorage`, unverschlüsselt, ohne Frist | mittel | mittel bis hoch (Namen, Anschriften, möglicherweise Gesundheitsangaben) | mittel |
| R2 | Link mit allen Eingaben gelangt über einen Messenger oder ein Mailsystem an Dritte oder bleibt dort dauerhaft gespeichert. | Funktion "Link teilen" | mittel | mittel | mittel |
| R3 | PDF enthält die Eingaben zusätzlich maschinenlesbar in den Metadaten und wird an Stellen weitergegeben, die nur den ausgedruckten Auftrag sehen sollten. | Eintrag `Keywords` | gering (die Metadaten enthalten nur Felder, die auch auf der Seite stehen) | gering bis mittel | gering |
| R4 | Das Zählskript von `gc.zgo.at` wird kompromittiert oder verändert und liest Eingaben aus der Seite. | Fremdskript im Kontext der Seite, keine Content Security Policy | gering | hoch | mittel |
| R5 | Skript-Einschleusung über eine Schwachstelle der App (XSS) exfiltriert Eingaben. | Eingabeverarbeitung | gering (Eingaben werden per `textContent` und SVG-Elementen ausgegeben, kein `innerHTML` im Code) | hoch | gering |
| R6 | Verbindungsdaten und Zählimpuls ermöglichen Rückschlüsse auf einzelne Nutzer. | GitHub Pages, GoatCounter | gering | gering | gering |
| R7 | Drittlandübermittlung der Verbindungsdaten an GitHub (USA). | Hosting | mittel | gering | gering |
| R8 | Falscher Inhalt, etwa abgeschnittener Text oder Zahlendreher, führt zu fehlerhaftem Einsatz. | Satz, Eingabe | gering (Text wird nie abgeschnitten, nur einzeilige Felder kürzen mit "…") | mittel; berührt Integrität, nicht Vertraulichkeit | gering |
| R9 | Übungsauftrag wird für echten gehalten oder umgekehrt. | Kennzeichnung | gering | mittel | gering |
| R10 | Präparierter Link oder präparierte PDF überlastet den Browser oder schiebt falsche Inhalte in die Maske. | Einlesen von Link und PDF | gering | gering | gering |
| R11 | Daten bleiben im Cache oder Speicher länger, als der Nutzer annimmt. | Entwurf, Logo | mittel | gering bis mittel | gering bis mittel |
| R12 | Verlust des Entwurfs (Browser löscht Speicher). | Verfügbarkeit | mittel | gering; die Eingabe ist wiederholbar | gering |

Bewertung der Risiken zu Rechten und Freiheiten: Für alle genannten Risiken außer R1, R2, R4 und R11 ist das Risiko bereits vor weiteren Maßnahmen gering. Das Gesamtrisiko ist nicht hoch, weil keine Inhalte zentral gesammelt werden und weder Profile noch Überwachung entstehen.

## 6. Bestehende und geplante Maßnahmen

### 6.1 Bestehende Maßnahmen (im Code belegt)

| Nr. | Maßnahme | Wirkt auf |
| --- | --- | --- |
| B1 | Verarbeitung der Inhalte ausschließlich im Browser, kein Backend. | R1 bis R5 insgesamt, Datenminimierung |
| B2 | Keine Cookies, keine Konten, keine Anmeldung. | R6 |
| B3 | Fragment des Links wird nicht an den Server übertragen. | R2 |
| B4 | Schrift, Programmcode und Symbole liegen auf der Seite selbst; keine Werbung, keine weiteren eingebundenen Dienste außer dem Zählskript. | R4, R6 |
| B5 | Zählskript wird erst nach dem Laden der Seite eingebunden; Widerspruch per Kästchen, Wirkung über `localStorage`. | R6 |
| B6 | Ausgabe von Eingaben über `textContent` und SVG-Elemente, kein `innerHTML`. | R5 |
| B7 | Entpacken mit Obergrenze von 4 MiB; Prüfung von Kennung und Fassung; verständliche Fehlermeldung bei beschädigten Daten. | R10 |
| B8 | Hinweise in der Datenschutzerklärung: Entwurf im Browser, Daten in PDF und Link, Empfehlung "Felder leeren" und privates Fenster auf gemeinsam genutzten Geräten. | R1, R2, R3, R11 |
| B9 | "Felder leeren" entfernt den Entwurf. "Logo entfernen" entfernt das Logo. | R1, R11 |
| B10 | Der Satz kürzt nie Mehrzeiliges, teilt auf Fortsetzungsseiten. | R8 |
| B11 | Wasserzeichen "ÜBUNG" auf jeder Seite, Fußzeile nennt es; Übungsband in der Maske. | R9 |
| B12 | Tabellen werden nicht gespeichert. Der Cache enthält nur statische Dateien. | R11 |
| B13 | Quelloffen unter EUPL-1.2, Tests für Satz, Austausch, Tabellen und PDF. | R5, R8 |

### 6.2 Zusätzliche Maßnahmen

| Nr. | Maßnahme | Wirkt auf | Verantwortlich | Stand |
| --- | --- | --- | --- | --- |
| M1 | Content Security Policy per `<meta http-equiv>` in allen drei Seiten: Skripte nur von der eigenen Herkunft und von `gc.zgo.at`, Verbindungen nur zur eigenen Herkunft und zu `einsatzauftrag.goatcounter.com`, keine Inline-Skripte außer den kurzen, mit Hash freigegebenen. | R4, R5 | Betreiber | offen |
| M2 | Zählskript selbst ausliefern oder auf die Messung verzichten, sobald die Bewertung der einsetzenden Stelle das verlangt. Alternativ Messung serverseitig über die Logs des Hosters. | R4 | Betreiber | offen |
| M3 | Neben "Link teilen" und beim PDF-Download einen kurzen Hinweis anzeigen: enthält alle Eingaben lesbar, nur dorthin weitergeben, wo der Auftrag hin darf. | R2, R3 | Betreiber | offen |
| M4 | Einstellung für die einsetzende Stelle, Link- und Metadaten-Funktion abzuschalten (z. B. über eine Konfigurationsdatei oder einen Parameter beim Bauen). Bei abgeschalteter Metadaten-Funktion trägt die PDF keine Eingaben im Eintrag `Keywords`. | R2, R3 | Betreiber | offen |
| M5 | Entwurf nach einer Frist (z. B. 24 Stunden) automatisch verwerfen, Frist einstellbar; deutlicher Hinweis beim Start, wenn ein Entwurf vorliegt. | R1, R11 | Betreiber | offen |
| M6 | Geräteschutz und Löschung gehören in die Regeln der einsetzenden Stelle: Geräte mit Bildschirmsperre und Verschlüsselung, keine gemeinsam genutzten Konten, privates Fenster auf fremden Geräten. | R1 | Einsetzende Stelle | offen |
| M7 | Auftragsverarbeitung bzw. Rechtsgrundlage der Übermittlung für GitHub Pages und GoatCounter prüfen und dokumentieren. | R7 | Betreiber | offen |
| M8 | Verfahrensverzeichnis nach Art. 30 für die Verarbeitung des Betreibers anlegen. | Nachweis | Betreiber | offen |
| M9 | Automatisierte Browsertests für Entwurf, PDF-Ausgabe, Link und Einlesen. | R8, R10 | Betreiber | offen |
| M10 | Bei Änderung der Datenflüsse (neuer Dienst, Sendefunktion, Konten) diese DSFA vor der Umsetzung neu bewerten. | alle | Betreiber | laufend |

## 7. Restrisiko

Nach Umsetzung von M1 bis M5 gilt:

| Nr. | Restrisiko | Bewertung |
| --- | --- | --- |
| R1 | Entwurf bleibt bis zur Frist auf dem Gerät, ungeschützt gegen jemanden mit Zugriff auf das entsperrte Gerät. | gering |
| R2 | Der Nutzer entscheidet bewusst über den Empfänger; der Messenger speichert den Link. | gering bis mittel, bei besonders sensiblen Aufträgen Funktion abschaltbar (M4) |
| R4 | Mit CSP und verbindlichen Zielen deutlich verringert; verbleibt bei eingebundenem Zählskript. | gering |
| R11 | Vom Nutzer löschbar, nach Frist automatisch. | gering |

Ohne die Maßnahmen M1 bis M5 bleibt das Gesamtrisiko nach meiner Einschätzung gering bis mittel, sofern die Nutzer keine Gesundheitsdaten in die Freitexte schreiben. Für Einsätze, in denen das regelmäßig geschieht, sollte die einsetzende Stelle M4 verlangen und eine eigene Bewertung vornehmen.

## 8. Ergebnis

Die Verarbeitung durch die App hat kein hohes Risiko für die Rechte und Freiheiten Betroffener, weil Auftragsinhalte das Gerät nicht verlassen und beim Betreiber nur Verbindungs- und Zähldaten ohne Personenbezug im engeren Sinn anfallen. Eine Konsultation der Aufsichtsbehörde nach Art. 36 DSGVO ist auf dieser Grundlage nicht erforderlich.

Das gilt unter drei Bedingungen: Die einsetzende Stelle verantwortet Inhalte und Geräte selbst. Die offenen Maßnahmen M1 bis M5 werden umgesetzt. Die Punkte in Abschnitt 9 werden geklärt.

Empfehlung zur Reihenfolge: M1 und M3 sind klein und sofort machbar, M5 ist ein kleiner Eingriff in `main.ts`, M2 und M4 verlangen eine Entscheidung des Betreibers bzw. der einsetzenden Stelle.

## 9. Zu klären

1. Rolle des Betreibers: privat oder in Funktion des THW (3.1). Das entscheidet über Verantwortlichen, Aufsicht und Beschlussfassung.
2. Aktuelle Muss-Liste der zuständigen Datenschutz-Aufsichtsbehörde nach Art. 35 Abs. 4 DSGVO.
3. Rechtsgrundlage der Drittlandübermittlung und Auftragsverarbeitungsvertrag mit GitHub (Pages).
4. Hosting, Sitz und Vertrag von GoatCounter; die Angaben zur IP-Adresse beruhen auf den Aussagen des Dienstes.
5. Bewertung des Widerspruchs-Eintrags `skipgc` im `localStorage` nach § 25 TDDDG.
6. Ob die einsetzende Stelle Gesundheitsdaten in den Aufträgen erwartet und dafür eine Rechtsgrundlage nach Art. 9 Abs. 2 hat.
7. Beteiligung der oder des Datenschutzbeauftragten (Art. 35 Abs. 2) und Einholen des Standpunkts der Betroffenen oder ihrer Vertretung, soweit angemessen (Art. 35 Abs. 9).

## 10. Freigabe und Überprüfung

| | |
| --- | --- |
| Erstellt von | Entwurf aus dem Repository, 30.10.2026 |
| Geprüft durch Datenschutzbeauftragte(n) | offen |
| Entscheidung des Verantwortlichen | offen |
| Nächste Überprüfung | bei jeder Änderung der Datenflüsse, spätestens in zwölf Monaten |
