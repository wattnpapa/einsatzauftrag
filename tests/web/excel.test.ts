import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { BLATT, erzeugeVorlage, leseExcel, zellText } from "../../web/src/excel.js";
import { FELDER, leseTabelle } from "../../web/src/felder.js";

async function puffer(mappe: ExcelJS.Workbook): Promise<ArrayBuffer> {
    const daten = await mappe.xlsx.writeBuffer();
    const bytes = new Uint8Array(daten as unknown as ArrayBufferLike);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("Excel", () => {
    it("liest aus der leeren Vorlage das Beispiel, sobald es das einzige gefüllte Blatt ist", async () => {
        const vorlage = await erzeugeVorlage();
        const hinweise: string[] = [];
        const tabelle = leseTabelle(await leseExcel(await vorlage.arrayBuffer(), hinweise));
        expect(hinweise).toEqual(["Gelesen wurde das Blatt „Beispiel“."]);
        expect(tabelle.zeilen).toHaveLength(1);
        expect(tabelle.zeilen[0]?.werte.fuehrung).toContain("\n");
    });

    it("nimmt das ausgefüllte Blatt der Vorlage vor dem Beispiel", async () => {
        const mappe = new ExcelJS.Workbook();
        await mappe.xlsx.load(await (await erzeugeVorlage()).arrayBuffer());
        const blatt = mappe.getWorksheet(BLATT);
        blatt?.addRow(FELDER.map(feld => feld.schluessel === "empfaenger" ? "Gruppe X" : ""));
        blatt?.addRow(FELDER.map(feld => feld.schluessel === "empfaenger" ? "Gruppe Y" : ""));
        const tabelle = leseTabelle(await leseExcel(await puffer(mappe)));
        expect(tabelle.zeilen.map(zeile => zeile.werte.empfaenger)).toEqual(["Gruppe X", "Gruppe Y"]);
    });

    it("meldet kaputte Dateien und Mappen ohne bekannte Spalten verständlich", async () => {
        await expect(leseExcel(new TextEncoder().encode("kein zip").buffer as ArrayBuffer)).rejects.toThrow(/keine lesbare Excel-Datei/);
        const mappe = new ExcelJS.Workbook();
        mappe.addWorksheet("Tabelle1").addRow(["a", "b"]);
        await expect(leseExcel(await puffer(mappe))).rejects.toThrow(/kein Blatt mit bekannten Spalten/);
    });

    it("gibt Zellwerte so wieder, wie sie in der Zelle stehen", () => {
        expect(zellText(null)).toBe("");
        expect(zellText(12)).toBe("12");
        expect(zellText(true)).toBe("ja");
        expect(zellText(new Date(Date.UTC(1899, 11, 30, 13, 45)))).toBe("13:45");
        expect(zellText(new Date(Date.UTC(2026, 9, 27)))).toBe("27.10.2026");
        expect(zellText(new Date(Date.UTC(2026, 9, 27, 8, 5)))).toBe("27.10.2026 08:05");
        expect(zellText({ richText: [{ text: "a" }, { text: "b" }] })).toBe("ab");
        expect(zellText({ formula: "1+1", result: 2 } as ExcelJS.CellFormulaValue)).toBe("2");
        expect(zellText({ text: "Link", hyperlink: "https://example.org" })).toBe("Link");
    });
});
