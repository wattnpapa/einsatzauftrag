import { jsPDF } from "jspdf";
import { zeichneEinsatzauftrag, type EinsatzauftragOptionen } from "../../src/index.js";
import { zuDaten, type Werte } from "./felder.js";

/** Herkunftszeile am Blattrand jedes Auftrags, den diese App erzeugt. */
export const HERKUNFT = "Erstellt mit einsatzauftrag.app";

export interface Ergebnis {
    pdf: jsPDF;
    /** Seiten je Auftrag, in der Reihenfolge der Eingabe. */
    seiten: number[];
}

/** Setzt alle Aufträge in eine PDF; jeder beginnt auf einer neuen Seite. */
export function erzeugePdf(alle: readonly Werte[], optionen: EinsatzauftragOptionen, { komprimiert = true } = {}): Ergebnis {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p", compress: komprimiert });
    pdf.setProperties({ title: alle.length === 1 ? "Einsatzauftrag" : "Einsatzaufträge", creator: "einsatzauftrag" });
    const seiten = alle.map((werte, index) => {
        if (index > 0) {
            pdf.addPage("a4", "p");
        }
        return zeichneEinsatzauftrag(pdf, zuDaten(werte), { fusszeile: HERKUNFT, ...optionen }).seiten.length;
    });
    return { pdf, seiten };
}

/**
 * Dateiname aus lfd. Nr. und Zeitpunkt, damit mehrere Downloads im Ordner
 * unterscheidbar bleiben, z. B. „einsatzauftrag_nr12_2026-10-27_1345.pdf“.
 */
export function dateiname(anzahl: number, zeit: Date, nummer = ""): string {
    const zwei = (zahl: number) => String(zahl).padStart(2, "0");
    const nr = nummer.replace(/[^\p{L}\p{N}-]+/gu, "").slice(0, 20);
    return [
        anzahl > 1 ? "einsatzauftraege" : "einsatzauftrag",
        anzahl === 1 && nr ? `nr${nr}` : "",
        `${zeit.getFullYear()}-${zwei(zeit.getMonth() + 1)}-${zwei(zeit.getDate())}_${zwei(zeit.getHours())}${zwei(zeit.getMinutes())}${zwei(zeit.getSeconds())}`
    ].filter(Boolean).join("_") + ".pdf";
}
