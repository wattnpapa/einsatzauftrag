# einsatzauftrag

Füllt den Einsatzauftrag nach dem Vordruck „Fb Fü 3“ des THW mit jsPDF als PDF aus. Das Formular selbst, also Kopf mit blauem Balken, die Abschnitte 1 bis 5 mit gelber Kopfzeile, Linien und Beschriftung, zeichnet die Bibliothek als Vektorgrafik auf DIN A4 hoch, mit den Seitenrändern nach DIN 5008 (links 25 mm, rechts 20 mm). Eine Word-Vorlage braucht sie nicht. Die Maße sind an einem Bild des Word-Formulars abgenommen.

Die Zeilen wachsen mit ihrem Text. Ohne feste Schriftgröße probiert der Satz 10, 9,5, 9, 8,5 und 8 pt und rückt die Abschnitte enger zusammen, bis der Auftrag auf eine Seite passt. Reicht auch das nicht, nimmt er die größte Schrift, die mit der geringsten Seitenzahl auskommt, und setzt auf der nächsten Seite fort: mit dem Kopf, der Kopfzeile des Abschnitts mit „(Fortsetzung)“ und am Fuß jeder Seite lfd. Nr. und „Seite x von y“. Lange Texte werden dabei zeilenweise geteilt, nichts wird abgeschnitten. Zeichen, die die PDF-Standardschrift nicht kennt, werden ersetzt („→“ wird „->“), sonst würde jsPDF die ganze Zeile falsch setzen.

Gegenüber dem Word-Formular hat Abschnitt 4 auch die Zeile 4d (Instandsetzung), die dort in der Kopfzeile genannt ist, aber als Zeile fehlt. Das THW-Zeichen ist nicht enthalten; rechts im Kopf steht „Technisches Hilfswerk“ als Text, ein eigenes Logo lässt sich als Bild einsetzen.

## Gestaltung „allgemein“

Kommt der Auftrag von einer Stelle außerhalb des THW, passt der Vordruck oft nicht. Die Gestaltung `allgemein` setzt dasselbe Blatt ohne Vordruck: kein Kasten, keine Farbflächen, schwarzer Text und eine Leitfarbe (Rot, auf Wunsch Schwarz) für Titel, Linien und Abschnittsnummern. Gegliedert ist es in Absender, Empfänger, Einsatz und lfd. Nr., dann die fünf Abschnitte Lage, Auftrag, Durchführung, Logistik, Führung und Verbindung als Freitext (`lage`, `auftrag`, `durchfuehrung`, `logistik`, `fuehrung`), zuletzt Ort/Datum, Unterschrift und Dienststelle. Die Unterzeilen 1a bis 4g gibt es dort nicht; sind sie trotzdem gefüllt (etwa aus einer THW-Tabelle), stehen sie mit ihrer Kennung unter dem Freitext. Umgekehrt setzt der Vordruck gefüllte Freitexte als Zeile ohne Kennung vor 1a, 3a und 4a. Schriftverkleinerung und Fortsetzungsseiten funktionieren wie beim Vordruck.

Als Schrift lässt sich eine eigene TrueType-Schrift einbetten, etwa Aptos. Aptos gehört Microsoft und liegt nicht im Repository; wer sie hat (Microsoft 365, Windows), übergibt die Dateien als Base64 in `schriftart`. Ohne Angabe bleibt es bei Helvetica.

## Web-App

Unter `web/` liegt eine Web-App, veröffentlicht unter [einsatzauftrag.app](https://einsatzauftrag.app/) über GitHub Pages. Sie füllt einen einzelnen Einsatzauftrag über eine Eingabemaske mit Live-Vorschau aus oder erzeugt viele auf einmal aus einer Excel- oder CSV-Tabelle (eine Zeile je Auftrag). Excel- und CSV-Vorlage gibt es dort zum Herunterladen. Alles läuft im Browser, nichts wird hochgeladen; nach dem ersten Aufruf startet die App auch ohne Netz.

Unter „Gestaltung und Kopf“ wählt man zwischen dem THW-Vordruck und der allgemeinen Gestaltung. Die Maske zeigt dann nur die Felder der gewählten Gestaltung, die Vorlagen bekommen die passenden Spalten; eingelesen werden immer alle. Für die allgemeine Gestaltung lassen sich die Leitfarbe (Rot oder Schwarz) und die TTF-Dateien einer eigenen Schrift wie Aptos wählen; Schrift und Logo bleiben im Browser des Geräts.

```bash
npm run web          # Entwicklungsserver
npm run web:build    # dist-web/
```

Der Workflow `.github/workflows/pages.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie. Einmalig in den Repository-Einstellungen unter Pages als Quelle „GitHub Actions“ wählen; dort ist auch die Domain einsatzauftrag.app eingetragen. Die App nutzt relative Pfade und läuft unter der Domain wie unter `wattnpapa.github.io/einsatzauftrag/`.

## Verwendung als Bibliothek

```bash
npm install jspdf github:wattnpapa/einsatzauftrag
```

```ts
import { jsPDF } from "jspdf";
import { zeichneEinsatzauftrag } from "einsatzauftrag";

const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
const satz = zeichneEinsatzauftrag(pdf, {
    absender: "ZTr TZ OV Oldenburg",
    einsatz: "Hochwasser Hunte 2026",
    laufendeNummer: "12",
    empfaenger: "B-Gruppe 1. TZ",
    unterpunkte: { "1a": "Pegel 5,80 m, steigend.", "3b": "Sandsackverbau an Sickerstellen." },
    auftrag: "Deichabschnitt km 4,2 bis 4,6 sichern.",
    fuehrung: "TMO 304_OL_THW\n\nEA Deich Süd",
    ortDatum: "Oldenburg, 27.10.2026"
});
console.log(satz.seiten.length, satz.schriftgroesse);
pdf.save("einsatzauftrag.pdf");
```

Die erste Seite landet auf der aktuellen Seite der PDF, weitere werden angehängt. Für mehrere Aufträge in einer Datei vor jedem weiteren `pdf.addPage()` aufrufen.

`setzeEinsatzauftrag(pdf, daten, optionen)` rechnet nur den Satz aus und gibt je Seite eine Liste einfacher Zeichenelemente zurück (Fläche, Linie, Text, Bild in mm). Die Web-App zeichnet daraus ihre Vorschau als SVG; `zeichneSeite(pdf, seite)` zeichnet eine Seite in die PDF.

| Option | Wirkung |
| --- | --- |
| `gestaltung` | `"vordruck"` (Fb Fü 3, Standard) oder `"allgemein"` |
| `kennung` | Text im linken Kopffeld, Standard „Fb Fü 3“; allgemein nur, wenn angegeben, klein unter dem Titel |
| `titel` | Text im blauen Balken bzw. Titel des Blatts, Standard „Einsatzauftrag“ |
| `organisation` | Text im rechten Kopffeld, Zeilen mit `\n`, Standard „Technisches\nHilfswerk“ (allgemein: leer) |
| `logo` | `{ daten, format: "PNG" \| "JPEG", breite, hoehe }`, rechts im Kopf |
| `schriftgroesse` | feste Schriftgröße der Eintragungen in pt statt der automatischen Wahl |
| `schriftart` | `{ name, normal, fett? }`, TrueType-Dateien als Base64, etwa Aptos; wird je PDF eingebettet |
| `leitfarbe` | Hex-Farbe der Gestaltung „allgemein“, Standard Rot `#c8102e`; `#000000` für ein Blatt ohne Farbe |
| `fusszeile` | kleiner Text links unten am Blattrand |

```ts
const satz = zeichneEinsatzauftrag(pdf, {
    absender: "Kreisfeuerwehr Oldenburg, Einsatzleitung",
    empfaenger: "THW OV Oldenburg, 1. TZ",
    lage: "Pegel Hunte 5,80 m, steigend.",
    auftrag: "Deichabschnitt km 4,2 bis 4,6 sichern.",
    durchfuehrung: "Sandsackverbau, Ausleuchtung der Deichkrone.",
    logistik: "Sandsäcke über den Bauhof.",
    fuehrung: "Einsatzleitung Gerätehaus Kreyenbrück"
}, {
    gestaltung: "allgemein",
    organisation: "Landkreis Oldenburg\nKatastrophenschutz",
    schriftart: { name: "Aptos", normal: aptosBase64, fett: aptosBoldBase64 }
});
```

Wer `zeichneSeite` auf einer anderen `jsPDF`-Instanz nutzt als der, mit der gesetzt wurde, ruft dort vorher `registriereSchrift(pdf, schriftart)` auf; jsPDF kennt eingebettete Schriften nur je Dokument.

## Entwicklung

```bash
npm install
npm test             # Vitest
npm run typecheck
npm run build        # dist/
npm run beispiel     # Beispiel-PDFs nach ausgabe/
```

## Lizenz

EUPL-1.2, siehe [LICENSE](LICENSE).
