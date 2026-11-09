import type { jsPDF } from "jspdf";
import { trenneLangeWoerter } from "./text.js";

// Auszeichnungen im Text der Eintragungen. Der Text bleibt reiner Text, damit
// er wie bisher in Tabellen, Links und den Metadaten der PDF reist:
//
//   **fett**   ~~durchgestrichen~~   [rot]farbig[/rot]
//
// Farben: rot, blau, grün (gruen), orange. Zeilen, die mit „|“ beginnen,
// bilden eine Tabelle; eine Zeile aus Strichen („| --- | --- |“) macht die
// Zeilen darüber zum fett gesetzten Tabellenkopf. Ein Zeichen ohne passendes
// Gegenstück bleibt stehen, wie es ist.

/** Farben, die eine Auszeichnung nennen kann, mit ihrem Farbwert im Druck. */
export const FARBEN: Readonly<Record<string, string>> = {
    rot: "#c00000",
    blau: "#0033cc",
    gruen: "#007a1f",
    orange: "#d45f00"
};

const SCHWARZ = "#000000";

export interface Stil {
    readonly fett: boolean;
    readonly durch: boolean;
    readonly farbe: string;
}

/** Ein Stück Text in einem Stil. */
export interface Lauf extends Stil {
    readonly text: string;
}

export const GRUNDSTIL: Stil = { fett: false, durch: false, farbe: SCHWARZ };

/** Ein Block des Textes: Absätze oder eine Tabelle aus aufeinanderfolgenden Zeilen. */
export type Block =
    | { readonly art: "absatz"; readonly text: string }
    | { readonly art: "tabelle"; readonly zeilen: readonly (readonly string[])[]; readonly kopfzeilen: number };

const FARBNAME = "rot|blau|grün|gruen|orange";
const AUSZEICHNUNG = new RegExp(`\\*\\*(.+?)\\*\\*|~~(.+?)~~|\\[(${FARBNAME})\\](.*?)\\[\\/\\3\\]`, "i");

function farbwert(name: string): string {
    const schluessel = name.toLowerCase().replace("ü", "ue");
    return FARBEN[schluessel] ?? SCHWARZ;
}

/** Ob der Text Auszeichnungen trägt, die der Satz umsetzt. */
export function hatAuszeichnung(text: string): boolean {
    return AUSZEICHNUNG.test(text);
}

/** Zerlegt eine Zeile in Läufe; Auszeichnungen dürfen ineinander stecken. */
export function laeufe(text: string, stil: Stil = GRUNDSTIL): Lauf[] {
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
        const [, fett, durch, farbe, farbig] = treffer;
        if (fett !== undefined) {
            ergebnis.push(...laeufe(fett, { ...stil, fett: true }));
        } else if (durch !== undefined) {
            ergebnis.push(...laeufe(durch, { ...stil, durch: true }));
        } else {
            ergebnis.push(...laeufe(farbig ?? "", { ...stil, farbe: farbwert(farbe ?? "") }));
        }
        rest = rest.slice(treffer.index + treffer[0].length);
    }
    return verschmelzen(ergebnis.filter(lauf => lauf.text !== ""));
}

/** Text ohne Auszeichnungen, etwa für einzeilige Anzeigen. */
export function ohneAuszeichnung(text: string): string {
    return text.split("\n").map(zeile => laeufe(zeile).map(lauf => lauf.text).join("")).join("\n");
}

function gleicherStil(a: Stil, b: Stil): boolean {
    return a.fett === b.fett && a.durch === b.durch && a.farbe === b.farbe;
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

/** Ob eine Zeile zu einer Tabelle gehört: beginnt mit „|“ und hat mindestens eine Spalte. */
function istTabellenzeile(zeile: string): boolean {
    const t = zeile.trim();
    return t.startsWith("|") && t.length > 1 && t.slice(1).includes("|");
}

function zellen(zeile: string): string[] {
    let t = zeile.trim().slice(1);
    if (t.endsWith("|")) {
        t = t.slice(0, -1);
    }
    return t.split("|").map(zelle => zelle.trim());
}

function istTrennzeile(zeile: readonly string[]): boolean {
    return zeile.length > 0 && zeile.every(zelle => /^:?-{2,}:?$/.test(zelle));
}

/**
 * Normalisiert den Text wie der Umbruch (Zeilenenden, „\n“ als Text,
 * Tabulatoren, Leerraum am Ende) und teilt ihn in Absätze. Mit `tabellen`
 * werden aufeinanderfolgende Tabellenzeilen zu einer Tabelle. Leerer Text
 * ergibt keinen Block.
 */
export function bloecke(text: string, tabellen: boolean): Block[] {
    const normal = String(text).replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/\s+$/, "");
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
    pdf.setFont("helvetica", stil.fett ? "bold" : "normal");
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
    const zeilen: Lauf[][] = [];
    let zeile: Lauf[] = [];
    let breite = 0;
    for (const wort of woerter) {
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
