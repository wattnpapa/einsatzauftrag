import type { jsPDF } from "jspdf";
import type { EinsatzauftragDaten } from "./daten.js";
import { setzeEinsatzauftrag, type EinsatzauftragOptionen, type Einsatzauftragsatz, type Seite } from "./satz.js";

/**
 * Zeichnet eine gesetzte Seite auf die aktuelle Seite der PDF. Danach sind
 * Schrift, Farben und Strichstärke auf die jsPDF-Vorgaben zurückgesetzt.
 */
export function zeichneSeite(pdf: jsPDF, seite: Seite): void {
    for (const element of seite.elemente) {
        switch (element.art) {
            case "flaeche":
                pdf.setFillColor(element.farbe);
                pdf.rect(element.x, element.y, element.b, element.h, "F");
                break;
            case "linie":
                pdf.setDrawColor(0, 0, 0);
                pdf.setLineWidth(element.staerke);
                pdf.line(element.x1, element.y1, element.x2, element.y2);
                break;
            case "text":
                pdf.setFont("helvetica", element.fett ? "bold" : "normal");
                pdf.setFontSize(element.groesse);
                pdf.setTextColor(element.farbe);
                pdf.text(element.text, element.x, element.y, {
                    align: element.ausrichtung === "links" ? "left" : element.ausrichtung === "mitte" ? "center" : "right"
                });
                break;
            case "bild":
                pdf.addImage(element.daten, element.format, element.x, element.y, element.b, element.h);
                break;
        }
    }
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);
    pdf.setDrawColor(0, 0, 0);
    pdf.setFillColor(0, 0, 0);
    pdf.setLineWidth(0.200025);
}

/**
 * Setzt den Einsatzauftrag und zeichnet ihn: die erste Seite auf die aktuelle
 * Seite der PDF, jede weitere auf eine neu angehängte. Die PDF muss DIN A4
 * hoch in Millimetern sein (`new jsPDF({ unit: "mm", format: "a4" })`).
 */
export function zeichneEinsatzauftrag(pdf: jsPDF, daten: EinsatzauftragDaten, optionen: EinsatzauftragOptionen = {}): Einsatzauftragsatz {
    const satz = setzeEinsatzauftrag(pdf, daten, optionen);
    satz.seiten.forEach((seite, index) => {
        if (index > 0) {
            pdf.addPage("a4", "p");
        }
        zeichneSeite(pdf, seite);
    });
    return satz;
}
