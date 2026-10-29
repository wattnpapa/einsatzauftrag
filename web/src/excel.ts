import type { CellValue, Workbook, Worksheet } from "exceljs";
import type { Gestaltung } from "../../src/index.js";
import { felderFuer, feldZuKopf, type Feld } from "./felder.js";

// ExcelJS ist groß (rund 1 MB). Es wird erst geladen, wenn jemand die Vorlage
// holt oder eine Excel-Datei einliest; die Eingabemaske braucht es nie.
async function excel(): Promise<typeof import("exceljs")> {
    const modul = await import("exceljs");
    return (modul as unknown as { default?: typeof import("exceljs") }).default ?? modul;
}

export const BLATT = "Einsatzaufträge";
const KOPF_FARBE = "FF12275E";

function blattMitKopf(mappe: Workbook, name: string, felder: readonly Feld[]): Worksheet {
    const blatt = mappe.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    blatt.columns = felder.map(feld => ({
        header: feld.titel,
        key: feld.schluessel,
        width: feld.breite,
        // Als Text, sonst macht Excel aus „0815“ eine 815 und aus „13:45“ eine Uhrzeit.
        style: { numFmt: "@", alignment: { vertical: "top", wrapText: Boolean(feld.mehrzeilig) } }
    }));
    const kopf = blatt.getRow(1);
    kopf.font = { bold: true, color: { argb: "FFFFFFFF" } };
    kopf.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KOPF_FARBE } };
    kopf.alignment = { vertical: "middle", wrapText: true };
    kopf.height = 32;
    felder.forEach((feld, index) => {
        kopf.getCell(index + 1).note = feld.beschreibung;
    });
    return blatt;
}

/**
 * Die Vorlage: ein leeres Blatt „Einsatzaufträge“ (eine Zeile je Auftrag),
 * ein Blatt „Beispiel“ mit einem ausgefüllten Auftrag und eine Anleitung. Die
 * Spalten sind die Felder der Gestaltung; gelesen werden immer alle.
 */
export async function erzeugeVorlage(gestaltung: Gestaltung = "vordruck"): Promise<Blob> {
    const ExcelJS = await excel();
    const mappe: Workbook = new ExcelJS.Workbook();
    mappe.creator = "einsatzauftrag";
    const felder = felderFuer(gestaltung);

    blattMitKopf(mappe, BLATT, felder);
    const beispiel = blattMitKopf(mappe, "Beispiel", felder);
    beispiel.addRow(Object.fromEntries(felder.map(feld => [feld.schluessel, feld.beispiel])));

    const anleitung = mappe.addWorksheet("Anleitung");
    anleitung.columns = [
        { header: "Spalte", key: "titel", width: 30 },
        { header: "Bedeutung", key: "beschreibung", width: 70, style: { alignment: { wrapText: true, vertical: "top" } } },
        { header: "Beispiel", key: "beispiel", width: 50, style: { alignment: { wrapText: true, vertical: "top" } } }
    ];
    anleitung.getRow(1).font = { bold: true };
    anleitung.addRow({ titel: `Jede Zeile im Blatt „${BLATT}“ ergibt einen Einsatzauftrag. Leere Zeilen werden übersprungen, leere Zellen bleiben im Vordruck leer. Zeilenumbrüche in einer Zelle (Alt+Eingabe) bleiben erhalten. Das Blatt „Beispiel“ wird nur gelesen, wenn es das einzige ausgefüllte ist.` });
    anleitung.addRow({});
    for (const feld of felder) {
        anleitung.addRow({ titel: feld.titel, beschreibung: feld.beschreibung, beispiel: feld.beispiel });
    }

    const puffer = await mappe.xlsx.writeBuffer();
    return new Blob([puffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function zweistellig(zahl: number): string {
    return String(zahl).padStart(2, "0");
}

/** Zellwert als Text, so wie er in der Zelle zu sehen war. */
export function zellText(wert: CellValue): string {
    if (wert === null || wert === undefined) {
        return "";
    }
    if (typeof wert === "string") {
        return wert;
    }
    if (typeof wert === "number") {
        return String(wert);
    }
    if (typeof wert === "boolean") {
        return wert ? "ja" : "nein";
    }
    if (wert instanceof Date) {
        // ExcelJS liefert Datum und Uhrzeit in UTC. Eine reine Uhrzeit hängt am Excel-Nulltag 1899-12-30.
        const uhrzeit = `${zweistellig(wert.getUTCHours())}:${zweistellig(wert.getUTCMinutes())}`;
        if (wert.getUTCFullYear() < 1901) {
            return uhrzeit;
        }
        const datum = `${zweistellig(wert.getUTCDate())}.${zweistellig(wert.getUTCMonth() + 1)}.${wert.getUTCFullYear()}`;
        return wert.getUTCHours() || wert.getUTCMinutes() ? `${datum} ${uhrzeit}` : datum;
    }
    if ("richText" in wert) {
        return wert.richText.map(teil => teil.text).join("");
    }
    if ("formula" in wert || "sharedFormula" in wert) {
        return zellText((wert as { result?: CellValue }).result ?? null);
    }
    if ("text" in wert) {
        return String(wert.text);
    }
    return "";
}

function blattAlsText(blatt: Worksheet): string[][] {
    const breite = blatt.columnCount;
    const tabelle: string[][] = [];
    blatt.eachRow({ includeEmpty: true }, zeile => {
        const werte: string[] = [];
        for (let spalte = 1; spalte <= breite; spalte++) {
            werte.push(zellText(zeile.getCell(spalte).value));
        }
        tabelle[zeile.number - 1] = werte;
    });
    for (let index = 0; index < tabelle.length; index++) {
        tabelle[index] ??= [];
    }
    return tabelle;
}

/**
 * Liest die Excel-Datei als Tabelle aus Text. Genommen wird das Blatt mit den
 * meisten bekannten Spaltenköpfen, das Daten enthält; bei Gleichstand
 * „Einsatzaufträge“ vor anderen und „Beispiel“ zuletzt.
 */
export async function leseExcel(daten: ArrayBuffer, hinweise: string[] = []): Promise<string[][]> {
    const ExcelJS = await excel();
    const mappe = new ExcelJS.Workbook();
    try {
        await mappe.xlsx.load(daten);
    } catch {
        throw new Error("Die Datei ist keine lesbare Excel-Datei (.xlsx). Ist sie beschädigt oder nur umbenannt? In Excel öffnen und als .xlsx oder CSV neu speichern.");
    }
    const kandidaten = mappe.worksheets.map(blatt => {
        const text = blattAlsText(blatt);
        const koepfe = Math.max(0, ...text.slice(0, 10).map(zeile => zeile.filter(zelle => feldZuKopf(zelle)).length));
        const gefuellt = text.filter(zeile => zeile.some(zelle => zelle.trim() !== "")).length > 1;
        const bewertung = koepfe + (gefuellt ? 1000 : 0) + (blatt.name === BLATT ? 0.5 : 0) - (blatt.name === "Beispiel" ? 0.5 : 0);
        return { blatt, text, koepfe, bewertung };
    }).filter(kandidat => kandidat.koepfe > 0).sort((a, b) => b.bewertung - a.bewertung);
    const bestes = kandidaten[0];
    if (!bestes) {
        throw new Error("In der Datei steht kein Blatt mit bekannten Spalten (z. B. „Empfänger“, „2 Auftrag“).");
    }
    if (mappe.worksheets.length > 1) {
        hinweise.push(`Gelesen wurde das Blatt „${bestes.blatt.name}“.`);
    }
    return bestes.text;
}
