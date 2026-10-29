import type { jsPDF } from "jspdf";

// Eigene Schrift (TrueType) für die Eintragungen und die Gestaltung
// „allgemein“, etwa Aptos. Die Bibliothek bringt keine Schrift mit: Aptos
// gehört Microsoft und darf nicht weitergegeben werden; der Aufrufer liefert
// die Dateien, die PDF bettet sie als Teilmenge ein.

export interface Schriftart {
    /** Name, unter dem die Schrift in der PDF geführt wird, z. B. „Aptos“. */
    name: string;
    /** TrueType-Datei des normalen Schnitts, Base64. */
    normal: string;
    /** TrueType-Datei des fetten Schnitts, Base64. Fehlt er, wird Fettes normal gesetzt. */
    fett?: string | undefined;
}

/** Schrift, mit der gesetzt wird: Name in der PDF und ob es einen fetten Schnitt gibt. */
export interface Satzschrift {
    readonly name: string;
    readonly fett: boolean;
}

export const HELVETICA: Satzschrift = { name: "helvetica", fett: true };

/**
 * Bettet die Schrift in diese PDF ein, falls noch nicht geschehen, und gibt
 * zurück, womit gesetzt wird. jsPDF kennt eingebettete Schriften nur je
 * Dokument: Für jede neue `jsPDF`-Instanz noch einmal aufrufen, sonst fällt
 * sie still auf Times zurück. `setzeEinsatzauftrag` tut das selbst; nur wer
 * `zeichneSeite` auf einer anderen PDF nutzt, muss es vorher tun.
 */
export function registriereSchrift(pdf: jsPDF, schriftart: Schriftart | undefined): Satzschrift {
    if (!schriftart || !schriftart.name.trim() || !schriftart.normal) {
        return HELVETICA;
    }
    const name = schriftart.name.trim();
    const vorhanden = pdf.getFontList()[name] ?? [];
    if (!vorhanden.includes("normal")) {
        pdf.addFileToVFS(`${name}-normal.ttf`, schriftart.normal);
        pdf.addFont(`${name}-normal.ttf`, name, "normal");
    }
    if (schriftart.fett && !vorhanden.includes("bold")) {
        pdf.addFileToVFS(`${name}-bold.ttf`, schriftart.fett);
        pdf.addFont(`${name}-bold.ttf`, name, "bold");
    }
    return { name, fett: (pdf.getFontList()[name] ?? []).includes("bold") };
}
