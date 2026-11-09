// Formatieren in den Textfeldern der Maske: setzt die Auszeichnungen der
// Bibliothek (src/format.ts) um die Auswahl, ohne DOM, damit es testbar bleibt.

export interface Auswahl {
    readonly wert: string;
    readonly start: number;
    readonly ende: number;
}

export interface Auszeichnung {
    readonly vor: string;
    readonly nach: string;
    /** Steht im Feld, wenn nichts ausgewählt war, und ist danach ausgewählt. */
    readonly platzhalter: string;
}

export const FETT: Auszeichnung = { vor: "**", nach: "**", platzhalter: "fett" };
export const DURCH: Auszeichnung = { vor: "~~", nach: "~~", platzhalter: "durchgestrichen" };

export function farbe(name: "rot" | "blau" | "grün" | "orange"): Auszeichnung {
    return { vor: `[${name}]`, nach: `[/${name}]`, platzhalter: name === "grün" ? "grün" : name };
}

/**
 * Setzt die Auszeichnung um die Auswahl oder nimmt sie weg, wenn sie schon
 * darum steht. Über mehrere Zeilen wird jede Zeile für sich ausgezeichnet,
 * weil Auszeichnungen nicht über Zeilenenden reichen. Leerraum am Rand der
 * Auswahl bleibt außerhalb.
 */
export function auszeichnen(auswahl: Auswahl, { vor, nach, platzhalter }: Auszeichnung): Auswahl {
    const { wert, start, ende } = auswahl;
    const davor = wert.slice(0, start);
    const markiert = wert.slice(start, ende);
    const danach = wert.slice(ende);
    if (start === ende) {
        return { wert: `${davor}${vor}${platzhalter}${nach}${danach}`, start: start + vor.length, ende: start + vor.length + platzhalter.length };
    }
    // Schon ausgezeichnet: außen um die Auswahl oder als Teil von ihr.
    if (davor.endsWith(vor) && danach.startsWith(nach)) {
        return { wert: `${davor.slice(0, -vor.length)}${markiert}${danach.slice(nach.length)}`, start: start - vor.length, ende: ende - vor.length };
    }
    if (markiert.length >= vor.length + nach.length && markiert.startsWith(vor) && markiert.endsWith(nach)) {
        const innen = markiert.slice(vor.length, markiert.length - nach.length);
        return { wert: `${davor}${innen}${danach}`, start, ende: start + innen.length };
    }
    const neu = markiert.split("\n").map(zeile => {
        const treffer = /^(\s*)(.*?)(\s*)$/.exec(zeile) as RegExpExecArray;
        const [, links = "", kern = "", rechts = ""] = treffer;
        return kern ? `${links}${vor}${kern}${nach}${rechts}` : zeile;
    }).join("\n");
    return { wert: `${davor}${neu}${danach}`, start, ende: start + neu.length };
}

/** Zellen als Tabellenzeile; „|“ in einer Zelle würde sie teilen und wird zu „/“. */
function tabellenzeile(zellen: readonly string[]): string {
    return `| ${zellen.map(zelle => zelle.replace(/\|/g, "/").replace(/\s+/g, " ").trim()).join(" | ")} |`;
}

/**
 * Text aus einer Tabellenkalkulation (Spalten mit Tabulator getrennt) als
 * Tabelle, die erste Zeile als Kopf. Kein solcher Text: `undefined`.
 */
export function tabelleAusTabulatoren(text: string): string | undefined {
    const zeilen = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
    if (!zeilen.some(zeile => zeile.includes("\t"))) {
        return undefined;
    }
    const zellen = zeilen.map(zeile => zeile.split("\t"));
    const spalten = Math.max(...zellen.map(zeile => zeile.length));
    const voll = zellen.map(zeile => Array.from({ length: spalten }, (_, index) => zeile[index] ?? ""));
    const [kopf = [], ...rumpf] = voll;
    return [tabellenzeile(kopf), tabellenzeile(kopf.map(() => "---")), ...rumpf.map(tabellenzeile)].join("\n");
}

/** Leere Tabelle zum Ausfüllen. */
const VORLAGE = "| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |";

/**
 * Fügt an der Auswahl eine Tabelle ein, immer auf eigenen Zeilen. Ist die
 * Auswahl Text mit Tabulatoren (aus Excel), wird er zur Tabelle; sonst
 * kommt eine leere Vorlage, deren erste Kopfzelle ausgewählt ist.
 */
export function tabelleEinfuegen(auswahl: Auswahl, eingefuegt?: string): Auswahl {
    const { wert, start, ende } = auswahl;
    const quelle = eingefuegt ?? wert.slice(start, ende);
    const tabelle = tabelleAusTabulatoren(quelle) ?? VORLAGE;
    const davor = wert.slice(0, start);
    const danach = wert.slice(ende);
    const vorne = davor === "" || davor.endsWith("\n") ? "" : "\n";
    const hinten = danach === "" || danach.startsWith("\n") ? "" : "\n";
    const anfang = start + vorne.length;
    const neu = `${davor}${vorne}${tabelle}${hinten}${danach}`;
    if (tabelle === VORLAGE) {
        return { wert: neu, start: anfang + 2, ende: anfang + 2 + "Spalte 1".length };
    }
    return { wert: neu, start: anfang + tabelle.length, ende: anfang + tabelle.length };
}

/** Kleinstes Stück, das sich zwischen altem und neuem Text geändert hat. */
export function aenderung(alt: string, neu: string): { start: number; ende: number; text: string } {
    let start = 0;
    while (start < alt.length && start < neu.length && alt[start] === neu[start]) {
        start++;
    }
    let hinten = 0;
    while (hinten < alt.length - start && hinten < neu.length - start && alt[alt.length - 1 - hinten] === neu[neu.length - 1 - hinten]) {
        hinten++;
    }
    return { start, ende: alt.length - hinten, text: neu.slice(start, neu.length - hinten) };
}
