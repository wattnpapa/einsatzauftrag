# einsatzauftrag

Füllt den Einsatzauftrag nach dem Vordruck „Fb Fü 3“ des THW mit jsPDF als PDF aus. Das Formular selbst, also Kopf mit blauem Balken, die Abschnitte 1 bis 5 mit gelber Kopfzeile, Linien und Beschriftung, zeichnet die Bibliothek als Vektorgrafik auf DIN A4 hoch, mit den Seitenrändern nach DIN 5008 (links 25 mm, rechts 20 mm). Eine Word-Vorlage braucht sie nicht. Die Maße sind an einem Bild des Word-Formulars abgenommen.

Die Zeilen wachsen mit ihrem Text. Ohne feste Schriftgröße probiert der Satz 10, 9,5, 9, 8,5 und 8 pt und rückt die Abschnitte enger zusammen, bis der Auftrag auf eine Seite passt. Reicht auch das nicht, nimmt er die größte Schrift, die mit der geringsten Seitenzahl auskommt, und setzt auf der nächsten Seite fort: mit dem Kopf, der Kopfzeile des Abschnitts mit „(Fortsetzung)“ und am Fuß jeder Seite lfd. Nr. und „Seite x von y“. Lange Texte werden dabei zeilenweise geteilt, nichts wird abgeschnitten. Zeichen, die die PDF-Standardschrift nicht kennt, werden ersetzt („→“ wird „->“), sonst würde jsPDF die ganze Zeile falsch setzen.

Gegenüber dem Word-Formular hat Abschnitt 4 auch die Zeile 4d (Instandsetzung), die dort in der Kopfzeile genannt ist, aber als Zeile fehlt. Das THW-Zeichen ist nicht enthalten; rechts im Kopf steht „Technisches Hilfswerk“ als Text, ein eigenes Logo lässt sich als Bild einsetzen.

## Web-App

Unter `web/` liegt eine Web-App, veröffentlicht unter [einsatzauftrag.app](https://einsatzauftrag.app/) über GitHub Pages. Sie füllt einen einzelnen Einsatzauftrag über eine Eingabemaske mit Live-Vorschau aus oder erzeugt viele auf einmal aus einer Excel- oder CSV-Tabelle (eine Zeile je Auftrag). Excel- und CSV-Vorlage gibt es dort zum Herunterladen. Alles läuft im Browser, nichts wird hochgeladen; nach dem ersten Aufruf startet die App auch ohne Netz.

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

In `fuehrung` (Abschnitt 5) beginnt eine Leerzeile eine neue Formularzeile. Sollen Leerzeilen innerhalb einer Formularzeile stehen bleiben, die Zeilen als Liste übergeben: `fuehrung: ["Erreichbarkeiten:\n\nFüSt Rostock", "Führungsstelle Südtor 8"]`.

Die erste Seite landet auf der aktuellen Seite der PDF, weitere werden angehängt. Für mehrere Aufträge in einer Datei vor jedem weiteren `pdf.addPage()` aufrufen.

`setzeEinsatzauftrag(pdf, daten, optionen)` rechnet nur den Satz aus und gibt je Seite eine Liste einfacher Zeichenelemente zurück (Fläche, Linie, Text, Bild in mm). Die Web-App zeichnet daraus ihre Vorschau als SVG; `zeichneSeite(pdf, seite)` zeichnet eine Seite in die PDF.

| Option | Wirkung |
| --- | --- |
| `kennung` | Text im linken Kopffeld, Standard „Fb Fü 3“ |
| `titel` | Text im blauen Balken, Standard „Einsatzauftrag“ |
| `organisation` | Text im rechten Kopffeld, Zeilen mit `\n`, Standard „Technisches\nHilfswerk“ |
| `logo` | `{ daten, format: "PNG" \| "JPEG", breite, hoehe }`, rechts im Kopf |
| `schriftgroesse` | feste Schriftgröße der Eintragungen in pt statt der automatischen Wahl |
| `fusszeile` | kleiner Text links unten am Blattrand |

Mit `uebung: true` in den Daten trägt jede Seite quer das hellrote Wasserzeichen „ÜBUNG“ hinter dem Formular, und die Fußzeile nennt es, wie beim Erfassungsbogen: Ein Übungsauftrag wird so nie für einen echten gehalten.

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
