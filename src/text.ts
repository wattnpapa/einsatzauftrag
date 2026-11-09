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

/** Ein Stück einer gesetzten Zeile: Text, der `x` mm hinter dem Zeilenanfang beginnt. */
export interface Stueck {
    readonly text: string;
    readonly x: number;
}

/** Eine gesetzte Zeile. Ohne Tabulator ist es ein Stück bei 0, mit Tabulatoren eines je Tabstopp. */
export type Zeile = readonly Stueck[];

/**
 * Bricht den Text wie `umbrechen`, setzt aber Tabulatoren als Tabstopps.
 * Aufeinanderfolgende Zeilen mit Tabulator bilden Spalten wie elastische
 * Tabstopps: Spalte k beginnt für alle diese Zeilen an derselben Stelle,
 * hinter dem breitesten Text der Spalte davor, aufgerundet auf ein Vielfaches
 * von `raster` (mm). Ein Tabulator je Spalte genügt also, damit
 * „Übungszeitraum:⇥25.10.“ und „⇥26.10.“ bündig stehen, gleich bei welcher
 * Schriftgröße. Bricht eine Zeile mit Tabulator um, beginnen ihre Folgezeilen
 * am letzten Tabstopp (hängender Einzug, so wird „•⇥Text“ zur Liste), solange
 * er in den linken drei Fünfteln der Breite liegt.
 */
export function umbrechenMitTabs(pdf: jsPDF, text: string, maxWidth: number, raster: number): Zeile[] {
    const normal = String(text).replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").replace(/\s+$/, "");
    if (normal.trim() === "") {
        return [];
    }
    const absaetze = normal.split("\n");
    const zeilen: Zeile[] = [];
    for (let index = 0; index < absaetze.length;) {
        const absatz = absaetze[index] as string;
        if (absatz.trim() === "") {
            zeilen.push([{ text: "", x: 0 }]);
            index++;
        } else if (!absatz.includes("\t") || !(raster > 0)) {
            zeilen.push(...(pdf.splitTextToSize(trenneLangeWoerter(pdf, absatz.replace(/\t/g, " "), maxWidth), maxWidth) as string[])
                .map(zeile => [{ text: zeile, x: 0 }]));
            index++;
        } else {
            let ende = index;
            while (ende < absaetze.length && (absaetze[ende] as string).includes("\t")) {
                ende++;
            }
            const block = absaetze.slice(index, ende);
            const spalten = tabSpalten(pdf, block.map(zeile => zeile.split("\t")), maxWidth, raster);
            for (const zeile of block) {
                zeilen.push(...tabAbsatz(pdf, zeile, maxWidth, spalten, raster));
            }
            index = ende;
        }
    }
    return zeilen;
}

/**
 * Anfang jeder Spalte eines Blocks von Zeilen mit Tabulator; `undefined`, wo
 * keine Spalte mehr in die Breite passt.
 */
function tabSpalten(pdf: jsPDF, zellen: readonly (readonly string[])[], maxWidth: number, raster: number): (number | undefined)[] {
    const luecke = pdf.getTextWidth(" ");
    const spalten: (number | undefined)[] = [0];
    const anzahl = Math.max(...zellen.map(zeile => zeile.length));
    for (let spalte = 1; spalte < anzahl; spalte++) {
        const vorher = spalten[spalte - 1];
        if (vorher === undefined) {
            spalten.push(undefined);
            continue;
        }
        let breiteste = 0;
        for (const zeile of zellen) {
            const breite = spalte < zeile.length ? vorher + pdf.getTextWidth(zeile[spalte - 1] ?? "") : 0;
            // Was ohnehin umbricht, bestimmt keine Spalte.
            if (breite <= maxWidth) {
                breiteste = Math.max(breiteste, breite);
            }
        }
        const anfang = (Math.floor((breiteste + luecke) / raster) + 1) * raster;
        spalten.push(anfang < maxWidth ? anfang : undefined);
    }
    return spalten;
}

function tabAbsatz(pdf: jsPDF, absatz: string, maxWidth: number, spalten: readonly (number | undefined)[], raster: number): Zeile[] {
    const zeilen: Stueck[][] = [];
    let zeile: Stueck[] = [];
    let stueck: Stueck | undefined;
    let einzug = 0;
    let cursor = 0;
    const neueZeile = () => {
        if (stueck) {
            zeile.push(stueck);
        }
        zeilen.push(zeile);
        zeile = [];
        stueck = undefined;
        cursor = einzug;
    };
    const luecke = pdf.getTextWidth(" ");
    absatz.split("\t").forEach((teil, index) => {
        if (index > 0) {
            if (stueck) {
                zeile.push(stueck);
                cursor = stueck.x + pdf.getTextWidth(stueck.text);
                stueck = undefined;
            }
            const mindestens = cursor + (zeile.length > 0 ? luecke : 0);
            const spalte = spalten[index];
            // Ist der Text davor umgebrochen und schon hinter der Spalte, der nächste Rasterstopp.
            const stopp = spalte !== undefined && spalte >= mindestens ? spalte : (Math.floor(mindestens / raster) + 1) * raster;
            if (stopp >= maxWidth) {
                neueZeile();
            } else {
                cursor = stopp;
                if (cursor <= maxWidth * 0.6) {
                    einzug = cursor;
                }
            }
        }
        if (teil === "") {
            return;
        }
        for (const wort of trenneLangeWoerter(pdf, teil, maxWidth - einzug).split(" ")) {
            const kandidat: Stueck = stueck ? { text: `${stueck.text} ${wort}`, x: stueck.x } : { text: wort, x: cursor };
            const leer = zeile.length === 0 && !stueck;
            if (leer || kandidat.x + pdf.getTextWidth(kandidat.text) <= maxWidth) {
                stueck = kandidat;
            } else {
                neueZeile();
                stueck = { text: wort, x: cursor };
            }
        }
    });
    neueZeile();
    return zeilen.map(stuecke => stuecke.filter(teil => teil.text !== "")).map(stuecke => stuecke.length > 0 ? stuecke : [{ text: "", x: 0 }]);
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

/** Ersatz für häufige Zeichen, die Helvetica in der PDF nicht kennt. */
const ERSATZ: Record<string, string> = {
    "→": "->", "⇒": "=>", "⟶": "->", "➔": "->", "➜": "->", "➞": "->", "▶": ">", "►": ">",
    "←": "<-", "⇐": "<=", "⟵": "<-", "↔": "<->", "⇔": "<=>", "↑": "^", "↓": "v",
    "≥": ">=", "≤": "<=", "≠": "!=", "≈": "~", "−": "-", "‑": "-", "‐": "-", "‒": "-", "―": "—",
    "✓": "x", "✔": "x", "☑": "[x]", "☐": "[ ]", "✗": "x", "✘": "x", "❌": "x",
    "◦": "-", "▪": "•", "■": "•", "●": "•", "◆": "•", "‣": "•", "⁃": "-",
    "‚": "‚", "‛": "'", "′": "'", "″": "\"", "‹": "‹", "›": "›",
    "­": "", "​": "", "‌": "", "‍": "", "⁠": "", "﻿": "",
    " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", " ": " "
};

/** Was die Standardschriften der PDF (WinAnsi) über Latin-1 hinaus darstellen. */
const WINANSI_ZUSATZ = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/**
 * Macht Text für die Standardschriften der PDF druckbar. Ein einziges Zeichen
 * außerhalb von WinAnsi (etwa „→“) lässt jsPDF die ganze Zeile anders
 * kodieren: Sie erscheint gesperrt, mit falschen Zeichen und zu breit. Solche
 * Zeichen werden ersetzt, Akzente notfalls abgelegt, der Rest wird zu „?“.
 */
export function fuerPdf(text: string): string {
    let ergebnis = "";
    for (const zeichen of text.replace(/\r\n?/g, "\n").normalize("NFC")) {
        const code = zeichen.codePointAt(0) ?? 0;
        if (zeichen === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_ZUSATZ.has(zeichen)) {
            ergebnis += zeichen;
        } else if (zeichen in ERSATZ) {
            ergebnis += ERSATZ[zeichen];
        } else if (zeichen === "\t") {
            ergebnis += " ";
        } else if (code < 0x20 || (code >= 0x7f && code < 0xa0)) {
            // Steuerzeichen fallen weg.
        } else {
            const ohneAkzent = zeichen.normalize("NFD").replace(/[̀-ͯ]/g, "");
            ergebnis += ohneAkzent && [...ohneAkzent].every(teil => (teil.codePointAt(0) ?? 0) <= 0xff) ? ohneAkzent : "?";
        }
    }
    return ergebnis;
}
