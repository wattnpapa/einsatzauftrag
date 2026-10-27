// Schreibt Beispiel-PDFs nach ausgabe/: einen leeren Vordruck, einen
// typischen Auftrag (eine Seite) und einen langen (mehrere Seiten).
import { mkdirSync, writeFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { zeichneEinsatzauftrag } from "../dist/index.js";

const typisch = {
    absender: "OV Oldenburg, ZTr TZ",
    einsatz: "Hochwasser Hunte 2026",
    laufendeNummer: "12",
    empfaenger: "B-Gruppe 1. TZ OV Oldenburg",
    unterpunkte: {
        "1a": "Pegel Hunte bei 5,80 m, steigend. Deich bei Tungeln an zwei Stellen durchfeuchtet.",
        "1b": "1. TZ mit GKW, MzKW, MTW einsatzbereit am Bereitstellungsraum Bümmerstede.",
        "1c": "B-Gruppe wird ab 14:00 Uhr dem EA Deich Süd unterstellt.",
        "3a": "Schwerpunkt Sicherung Deichabschnitt km 4,2 bis 4,6.",
        "3b": "Sandsackverbau an Sickerstellen, Ausleuchtung Deichkrone.",
        "3c": "Zusammenarbeit mit FF Oldenburg-Kreyenbrück, Lagemeldung stündlich.",
        "4a": "Verpflegung über Log-V, Ausgabe 18:00 Uhr.",
        "4c": "Betankung an der Unterkunft.",
        "4f": "Unterkunft Turnhalle Bümmerstede."
    },
    auftrag: "Deichabschnitt km 4,2 bis 4,6 gegen Durchsickern sichern und bis auf Weiteres überwachen.",
    fuehrung: "Funk: TMO-Gruppe 304_OL_THW, Rufname Heros Oldenburg 21/10\nEA Deich Süd, Gemeindehaus Tungeln",
    ortDatum: "Oldenburg, 27.10.2026",
    unterschrift: "Mustermann",
    dienststelle: "ZTr TZ",
    abgesandtAm: "27.10.",
    abgesandtUm: "13:45",
    abgesandtVon: "Fm Muster"
};
const lang = {
    ...typisch,
    auftrag: Array(30).fill("Deichabschnitt sichern, Sickerstellen markieren und dem Abschnittsleiter melden.").join(" "),
    unterpunkte: Object.fromEntries(Object.entries(typisch.unterpunkte).map(([k, v]) => [k, `${v}\n${v} ${v}`]))
};

mkdirSync("ausgabe", { recursive: true });
for (const [name, daten] of [["leer", {}], ["typisch", typisch], ["lang", lang]]) {
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const satz = zeichneEinsatzauftrag(pdf, daten, { fusszeile: "Erstellt mit Einsatzauftrag (EUPL-1.2)" });
    writeFileSync(`ausgabe/${name}.pdf`, Buffer.from(pdf.output("arraybuffer")));
    console.log(`${name}: ${satz.seiten.length} Seite(n), ${satz.schriftgroesse} pt`);
}
