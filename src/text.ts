import type { jsPDF } from "jspdf";

// Textumbruch für die Formularzellen. Übernommen aus bos-nachrichtenvordruck
// (src/pdfText.ts), damit lange Wörter dort wie hier umbrechen.

/**
 * Bricht den Text in Zeilen der Breite `maxWidth` in der aktuellen Schrift:
 * Absätze an Zeilenumbrüchen (auch als Text geschriebenen „\n“), leere
 * Absätze als leere Zeile. Leerer Text ergibt keine Zeile.
 */
export function umbrechen(pdf: jsPDF, text: string, maxWidth: number): string[] {
    const normal = String(text).replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/\s+$/, "");
    if (normal.trim() === "") {
        return [];
    }
    return normal.split("\n").flatMap(absatz =>
        absatz.trim() === "" ? [""] : pdf.splitTextToSize(trenneLangeWoerter(pdf, absatz, maxWidth), maxWidth) as string[]);
}

/**
 * Wörter, die breiter als eine Zeile sind, in Stücke teilen, statt sie ohne
 * Zeichen zu zerreißen: an eigenen Bruchstellen wie „/“ oder „-“ ohne Zusatz,
 * sonst mit Trennstrich („Wasserschadenpumpen-“ / „einsatz“).
 */
export function trenneLangeWoerter(pdf: jsPDF, absatz: string, maxWidth: number): string {
    return absatz.replace(/\S+/g, wort => {
        if (pdf.getTextWidth(wort) <= maxWidth) {
            return wort;
        }
        const stuecke: string[] = [];
        let rest = wort;
        // Mehr Zeichen, als in die schmalsten Glyphen einer Zeile passen, passen sicher nicht: Dann ist weder das ganze Wort
        // zu messen noch über seine ganze Länge zu suchen (bei 20 000 Zeichen kostete das Minuten).
        const schmal = Math.min(...[".", "i", "l", "'", " "].map(zeichen => pdf.getTextWidth(zeichen)).filter(breite => breite > 0));
        const kapazitaet = Number.isFinite(schmal) && schmal > 0 ? Math.ceil(maxWidth / schmal) + 2 : Number.MAX_SAFE_INTEGER;
        while (rest.length > kapazitaet || pdf.getTextWidth(rest) > maxWidth) {
            // Wie viele Zeichen höchstens in die Zeile passen (die Breite wächst mit der Länge: binär suchen,
            // sonst misst ein Wort von 2000 Zeichen tausendfach ein Wort von 2000 Zeichen).
            let passen = 1;
            for (let tief = 1, hoch = Math.min(rest.length - 1, kapazitaet); tief <= hoch;) {
                const mitte = (tief + hoch) >> 1;
                if (pdf.getTextWidth(rest.slice(0, mitte)) <= maxWidth) {
                    passen = mitte;
                    tief = mitte + 1;
                } else {
                    hoch = mitte - 1;
                }
            }
            // Hat das Wort eigene Bruchstellen (Adressen, Kennungen, Bindestriche),
            // dort umbrechen und keinen Strich einfügen: Ein eingefügter wäre vom
            // echten nicht zu unterscheiden. Nur, wenn die Zeile gut gefüllt ist.
            let bruch = 0;
            for (let stelle = 1; stelle < Math.min(rest.length - 1, passen); stelle++) {
                if ("/-.@_".includes(rest.charAt(stelle)) && pdf.getTextWidth(rest.slice(0, stelle + 1)) <= maxWidth) {
                    bruch = stelle + 1;
                }
            }
            if (bruch > 0 && pdf.getTextWidth(rest.slice(0, bruch)) >= maxWidth / 2) {
                stuecke.push(rest.slice(0, bruch));
                rest = rest.slice(bruch);
                continue;
            }
            let tief = 1;
            for (let t = 1, hoch = Math.min(rest.length - 1, kapazitaet); t <= hoch;) {
                const mitte = (t + hoch) >> 1;
                if (pdf.getTextWidth(`${rest.slice(0, mitte)}-`) <= maxWidth) {
                    tief = mitte;
                    t = mitte + 1;
                } else {
                    hoch = mitte - 1;
                }
            }
            stuecke.push(`${rest.slice(0, tief)}-`);
            rest = rest.slice(tief);
        }
        return [...stuecke, rest].join(" ");
    });
}

/** Kürzt `text` mit „…“, bis er in der aktuellen Schriftgröße in `maxWidth` passt. */
export function kuerzeAufBreite(pdf: jsPDF, text: string, maxWidth: number): string {
    if (pdf.getTextWidth(text) <= maxWidth) {
        return text;
    }
    let gekuerzt = text.trimEnd();
    while (gekuerzt && pdf.getTextWidth(`${gekuerzt}…`) > maxWidth) {
        gekuerzt = gekuerzt.slice(0, -1).trimEnd();
    }
    return `${gekuerzt}…`;
}
