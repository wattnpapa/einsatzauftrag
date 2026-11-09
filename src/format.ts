import type { jsPDF } from "jspdf";
import { trenneLangeWoerter } from "./text.js";

// Auszeichnungen im Text der Eintragungen, als Markdown wie auf GitHub. Der
// Text bleibt reiner Text, damit er wie bisher in Tabellen, Links und den
// Metadaten der PDF reist:
//
//   **fett** oder __fett__   *kursiv* oder _kursiv_   ***beides***   ~~durchgestrichen~~
//
// Wie in Markdown: Eine Auszeichnung beginnt nicht vor und endet nicht nach
// einem Leerzeichen („5 * 3 * 2“ bleibt), Unterstriche wirken nicht mitten im
// Wort („304_OL_THW“ bleibt), „\*“, „\_“, „\~“, „\|“ und „\\“ stehen für das
// Zeichen selbst. Zeilen, die mit „|“ beginnen, bilden eine Tabelle; eine
// Zeile aus Strichen („| --- | --- |“) macht die Zeilen darüber zum fett
// gesetzten Tabellenkopf.

export interface Stil {
    readonly fett: boolean;
    readonly kursiv: boolean;
    readonly durch: boolean;
}

/** Ein Stück Text in einem Stil. */
export interface Lauf extends Stil {
    readonly text: string;
}

export const GRUNDSTIL: Stil = { fett: false, kursiv: false, durch: false };

/** Ein Block des Textes: Absätze oder eine Tabelle aus aufeinanderfolgenden Zeilen. */
export type Block =
    | { readonly art: "absatz"; readonly text: string }
    | { readonly art: "tabelle"; readonly zeilen: readonly (readonly string[])[]; readonly kopfzeilen: number };

/** Zeichen, die ein „\\“ davor zum gewöhnlichen Zeichen macht. */
const MASKIERBAR = "\\`*_~|[]#+-.!{}()<>";
/** Maskierte Zeichen stehen beim Zerlegen im Bereich für private Zeichen. */
const PRIVAT = 0xe000;

function maskieren(text: string): string {
    return text.replace(/\\(.)/g, (ganz, zeichen: string) =>
        MASKIERBAR.includes(zeichen) ? String.fromCharCode(PRIVAT + zeichen.charCodeAt(0)) : ganz);
}

function demaskieren(text: string): string {
    return text.replace(/[\ue000-\ue0ff]/g, zeichen => String.fromCharCode(zeichen.charCodeAt(0) - PRIVAT));
}

// Innen: nicht mit Leerraum beginnen oder enden. Unterstriche nicht mitten im Wort.
const INNEN = "(?=\\S)(.+?)(?<=\\S)";
const WORT = "[\\p{L}\\p{N}]";
const AUSZEICHNUNG = new RegExp([
    `\\*\\*\\*${INNEN}\\*\\*\\*(?!\\*)`,
    `\\*\\*${INNEN}\\*\\*(?!\\*)`,
    `(?<!${WORT})__${INNEN}__(?!${WORT})`,
    `~~${INNEN}~~`,
    // Kursiv beginnt nicht mit einem weiteren Stern, sonst wäre „** a **“ kursiv.
    `\\*(?!\\*)${INNEN}\\*(?!\\*)`,
    `(?<!${WORT})_${INNEN}_(?!${WORT})`
].join("|"), "u");

/** Ob der Text Auszeichnungen oder maskierte Zeichen trägt, die der Satz umsetzt. */
export function hatAuszeichnung(text: string): boolean {
    const maskiert = maskieren(text);
    return maskiert !== text || AUSZEICHNUNG.test(maskiert);
}

/** Zerlegt eine Zeile in Läufe; Auszeichnungen dürfen ineinander stecken. */
export function laeufe(text: string, stil: Stil = GRUNDSTIL): Lauf[] {
    return verschmelzen(zerlege(maskieren(text), stil)
        .map(lauf => ({ ...lauf, text: demaskieren(lauf.text) }))
        .filter(lauf => lauf.text !== ""));
}

function zerlege(text: string, stil: Stil): Lauf[] {
    const ergebnis: Lauf[] = [];
    let rest = text;
    while (rest) {
        const treffer = AUSZEICHNUNG.exec(rest);
        if (!treffer) {
            ergebnis.push({ ...stil, text: rest });
            break;
        }
        if (treffer.index > 0) {
            ergebnis.push({ ...stil, text: rest.slice(0, treffer.index) });
        }
        const [, beides, fett, fett2, durch, kursiv, kursiv2] = treffer;
        if (beides !== undefined) {
            ergebnis.push(...zerlege(beides, { ...stil, fett: true, kursiv: true }));
        } else if (fett !== undefined || fett2 !== undefined) {
            ergebnis.push(...zerlege(fett ?? fett2 ?? "", { ...stil, fett: true }));
        } else if (durch !== undefined) {
            ergebnis.push(...zerlege(durch, { ...stil, durch: true }));
        } else {
            ergebnis.push(...zerlege(kursiv ?? kursiv2 ?? "", { ...stil, kursiv: true }));
        }
        rest = rest.slice(treffer.index + treffer[0].length);
    }
    return ergebnis;
}

/** Text ohne Auszeichnungen, etwa für einzeilige Anzeigen. */
export function ohneAuszeichnung(text: string): string {
    return text.split("\n").map(zeile => laeufe(zeile).map(lauf => lauf.text).join("")).join("\n");
}

function gleicherStil(a: Stil, b: Stil): boolean {
    return a.fett === b.fett && a.kursiv === b.kursiv && a.durch === b.durch;
}

function verschmelzen(liste: readonly Lauf[]): Lauf[] {
    const ergebnis: Lauf[] = [];
    for (const lauf of liste) {
        const letzter = ergebnis[ergebnis.length - 1];
        if (letzter && gleicherStil(letzter, lauf)) {
            ergebnis[ergebnis.length - 1] = { ...letzter, text: letzter.text + lauf.text };
        } else {
            ergebnis.push(lauf);
        }
    }
    return ergebnis;
}

/** Schnitt der Helvetica für einen Stil. */
export function schnitt(stil: Stil): "normal" | "bold" | "italic" | "bolditalic" {
    return stil.fett ? (stil.kursiv ? "bolditalic" : "bold") : stil.kursiv ? "italic" : "normal";
}

/** Ob eine Zeile zu einer Tabelle gehört: beginnt mit „|“ und hat mindestens eine Spalte. */
function istTabellenzeile(zeile: string): boolean {
    const t = zeile.trim();
    return t.startsWith("|") && t.length > 1 && t.slice(1).includes("|");
}

/** Zellen einer Tabellenzeile; „\\|“ trennt nicht und bleibt für `laeufe` maskiert stehen. */
function zellen(zeile: string): string[] {
    let t = zeile.trim().slice(1);
    if (t.endsWith("|") && !t.endsWith("\\|")) {
        t = t.slice(0, -1);
    }
    return t.split(/(?<!\\)\|/).map(zelle => zelle.replace(/\t/g, " ").trim());
}

function istTrennzeile(zeile: readonly string[]): boolean {
    return zeile.length > 0 && zeile.every(zelle => /^:?-{2,}:?$/.test(zelle));
}

/**
 * Normalisiert den Text wie der Umbruch (Zeilenenden, „\n“ als Text,
 * Leerraum am Ende; Tabulatoren bleiben) und teilt ihn in Absätze. Mit `tabellen`
 * werden aufeinanderfolgende Tabellenzeilen zu einer Tabelle. Leerer Text
 * ergibt keinen Block.
 */
export function bloecke(text: string, tabellen: boolean): Block[] {
    // Tabulatoren bleiben für die Tabstopps stehen (`umbrechenMitTabs`).
    const normal = String(text).replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").replace(/\s+$/, "");
    if (normal.trim() === "") {
        return [];
    }
    const ergebnis: Block[] = [];
    let tabelle: string[][] = [];
    let kopfzeilen = 0;
    const abschliessen = () => {
        if (tabelle.length > 0) {
            ergebnis.push({ art: "tabelle", zeilen: tabelle, kopfzeilen });
        }
        tabelle = [];
        kopfzeilen = 0;
    };
    for (const zeile of normal.split("\n")) {
        if (tabellen && istTabellenzeile(zeile)) {
            const teile = zellen(zeile);
            if (istTrennzeile(teile)) {
                // Nur die erste Trennzeile macht einen Kopf; weitere fallen weg.
                if (kopfzeilen === 0) {
                    kopfzeilen = tabelle.length;
                }
            } else {
                tabelle.push(teile);
            }
            continue;
        }
        abschliessen();
        ergebnis.push({ art: "absatz", text: zeile });
    }
    abschliessen();
    return ergebnis;
}

function setzeSchrift(pdf: jsPDF, stil: Stil, groesse: number): void {
    pdf.setFont("helvetica", schnitt(stil));
    pdf.setFontSize(groesse);
}

/** Breite eines Laufs in mm. */
export function laufbreite(pdf: jsPDF, lauf: Lauf, groesse: number): number {
    setzeSchrift(pdf, lauf, groesse);
    return pdf.getTextWidth(lauf.text);
}

/**
 * Bricht ausgezeichnete Läufe in Zeilen der Breite `maxWidth` um, Wort für
 * Wort wie der einfache Umbruch. Wörter, die breiter als eine Zeile sind,
 * werden wie dort geteilt. Ergibt mindestens eine (leere) Zeile.
 */
export function umbrechenLaeufe(pdf: jsPDF, eingabe: readonly Lauf[], maxWidth: number, groesse: number): Lauf[][] {
    const zeilen: Lauf[][] = [];
    let zeile: Lauf[] = [];
    let breite = 0;
    for (const wort of woerter(pdf, eingabe, maxWidth, groesse)) {
        const wortbreite = wort.teile.reduce((summe, teil) => summe + laufbreite(pdf, teil, groesse), 0);
        if (zeile.length === 0) {
            zeile = [...wort.teile];
            breite = wortbreite;
            continue;
        }
        const lueckenbreite = wort.luecke ? laufbreite(pdf, wort.luecke, groesse) : 0;
        if (breite + lueckenbreite + wortbreite <= maxWidth + 1e-9) {
            zeile.push(...(wort.luecke ? [wort.luecke] : []), ...wort.teile);
            breite += lueckenbreite + wortbreite;
        } else {
            zeilen.push(verschmelzen(zeile));
            zeile = [...wort.teile];
            breite = wortbreite;
        }
    }
    zeilen.push(verschmelzen(zeile));
    return zeilen;
}

interface Wort {
    /** Lücke davor, `undefined` am Anfang. */
    readonly luecke: Lauf | undefined;
    readonly teile: Lauf[];
}

/**
 * Zerlegt Läufe in Wörter mit der Lücke davor. Lange Wörter sind schon in
 * Stücke geteilt, die in `maxWidth` passen.
 */
function woerter(pdf: jsPDF, eingabe: readonly Lauf[], maxWidth: number, groesse: number): Wort[] {
    // Erst lange Wörter je Lauf in Stücke teilen, dann in Wörter und Lücken zerlegen.
    const stuecke: { lauf: Lauf; leer: boolean }[] = [];
    for (const lauf of eingabe) {
        setzeSchrift(pdf, lauf, groesse);
        const geteilt = trenneLangeWoerter(pdf, lauf.text, maxWidth);
        for (const teil of geteilt.split(/(\s+)/)) {
            if (teil) {
                stuecke.push({ lauf: { ...lauf, text: /^\s+$/.test(teil) ? " " : teil }, leer: /^\s+$/.test(teil) });
            }
        }
    }
    // Wörter: Stücke ohne Lücke dazwischen, auch über Stilgrenzen („**Wasser**schaden“).
    const woerter: { luecke: Lauf | undefined; teile: Lauf[] }[] = [];
    let luecke: Lauf | undefined;
    let offen = false;
    for (const { lauf, leer } of stuecke) {
        if (leer) {
            luecke = lauf;
            offen = false;
        } else if (offen) {
            (woerter[woerter.length - 1] as { teile: Lauf[] }).teile.push(lauf);
        } else {
            woerter.push({ luecke, teile: [lauf] });
            luecke = undefined;
            offen = true;
        }
    }
    return woerter;
}

/** Ein Stück einer Zeile mit Tabstopps: Läufe, die `x` mm hinter dem Zeilenanfang beginnen. */
export interface TabStueck {
    readonly x: number;
    readonly laeufe: readonly Lauf[];
}

/**
 * Setzt aufeinanderfolgende Absätze mit Tabulatoren (je Absatz seine Läufe).
 * Sie bilden Spalten wie elastische Tabstopps: Spalte k beginnt für alle
 * Absätze an derselben Stelle, hinter dem breitesten Text der Spalte davor,
 * aufgerundet auf ein Vielfaches von `raster` (mm). Ein Tabulator je Spalte
 * genügt also, damit „Übungszeitraum:⇥25.10.“ und „⇥26.10.“ bündig stehen,
 * gleich bei welcher Schriftgröße. Passt keine Spalte mehr, geht es in der
 * nächsten Zeile weiter. Bricht ein Absatz um, beginnen die Folgezeilen am
 * letzten Tabstopp (hängender Einzug, so wird „•⇥Text“ zur Liste), solange er
 * in den linken drei Fünfteln der Breite liegt.
 */
export function umbrechenMitTabs(pdf: jsPDF, absaetze: readonly (readonly Lauf[])[], maxWidth: number, groesse: number, raster: number): TabStueck[][] {
    const zellen = absaetze.map(tabZellen);
    const spalten = tabSpalten(pdf, zellen, maxWidth, groesse, raster);
    return zellen.flatMap(absatz => tabAbsatz(pdf, absatz, maxWidth, groesse, spalten, raster));
}

/** Teilt die Läufe eines Absatzes an den Tabulatoren in Zellen. */
function tabZellen(absatz: readonly Lauf[]): Lauf[][] {
    const zellen: Lauf[][] = [[]];
    for (const lauf of absatz) {
        lauf.text.split("\t").forEach((teil, index) => {
            if (index > 0) {
                zellen.push([]);
            }
            if (teil) {
                (zellen[zellen.length - 1] as Lauf[]).push({ ...lauf, text: teil });
            }
        });
    }
    return zellen;
}

function zellbreite(pdf: jsPDF, zelle: readonly Lauf[], groesse: number): number {
    return zelle.reduce((summe, lauf) => summe + laufbreite(pdf, lauf, groesse), 0);
}

/** Anfang jeder Spalte; `undefined`, wo keine Spalte mehr in die Breite passt. */
function tabSpalten(pdf: jsPDF, zellen: readonly (readonly Lauf[][])[], maxWidth: number, groesse: number, raster: number): (number | undefined)[] {
    const luecke = laufbreite(pdf, { ...GRUNDSTIL, text: " " }, groesse);
    const spalten: (number | undefined)[] = [0];
    const anzahl = Math.max(...zellen.map(absatz => absatz.length));
    for (let spalte = 1; spalte < anzahl; spalte++) {
        const vorher = spalten[spalte - 1];
        if (vorher === undefined) {
            spalten.push(undefined);
            continue;
        }
        let breiteste = 0;
        for (const absatz of zellen) {
            const breite = spalte < absatz.length ? vorher + zellbreite(pdf, absatz[spalte - 1] ?? [], groesse) : 0;
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

function tabAbsatz(pdf: jsPDF, zellen: readonly Lauf[][], maxWidth: number, groesse: number,
    spalten: readonly (number | undefined)[], raster: number): TabStueck[][] {
    const luecke = laufbreite(pdf, { ...GRUNDSTIL, text: " " }, groesse);
    const zeilen: TabStueck[][] = [];
    let zeile: TabStueck[] = [];
    let stueck: { x: number; laeufe: Lauf[]; breite: number } | undefined;
    let einzug = 0;
    let cursor = 0;
    const stueckAbschliessen = () => {
        if (stueck) {
            zeile.push({ x: stueck.x, laeufe: verschmelzen(stueck.laeufe) });
            cursor = stueck.x + stueck.breite;
            stueck = undefined;
        }
    };
    const neueZeile = () => {
        stueckAbschliessen();
        zeilen.push(zeile);
        zeile = [];
        cursor = einzug;
    };
    zellen.forEach((zelle, index) => {
        if (index > 0) {
            stueckAbschliessen();
            const mindestens = cursor + (zeile.length > 0 ? luecke : 0);
            const spalte = spalten[index];
            // Ist der Text davor umgebrochen und schon hinter der Spalte: der nächste Rasterstopp.
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
        for (const wort of woerter(pdf, zelle, maxWidth - einzug, groesse)) {
            const wortbreite = zellbreite(pdf, wort.teile, groesse);
            if (stueck) {
                const lueckenbreite = wort.luecke ? laufbreite(pdf, wort.luecke, groesse) : 0;
                if (stueck.x + stueck.breite + lueckenbreite + wortbreite <= maxWidth + 1e-9) {
                    stueck.laeufe.push(...(wort.luecke ? [wort.luecke] : []), ...wort.teile);
                    stueck.breite += lueckenbreite + wortbreite;
                    continue;
                }
                neueZeile();
            } else if (zeile.length > 0 && cursor + wortbreite > maxWidth + 1e-9) {
                neueZeile();
            }
            stueck = { x: cursor, laeufe: [...wort.teile], breite: wortbreite };
        }
    });
    neueZeile();
    return zeilen;
}
