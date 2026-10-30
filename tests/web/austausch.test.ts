import { describe, expect, it } from "vitest";
import { BESCHAEDIGT, dekodiereWerte, findePdfDaten, istPdf, KEINE_PDF_DATEN, kodiereWerte, leseAusPdf, PDF_KENNUNG } from "../../web/src/austausch.js";
import type { Werte } from "../../web/src/felder.js";
import { erzeugePdf } from "../../web/src/pdf.js";

const voll: Werte = {
    absender: "ZTr TZ OV Oldenburg",
    einsatz: "Hochwasser Hunte 2026",
    laufendeNummer: "12",
    empfaenger: "B-Gruppe 1. TZ",
    "1a": "Pegel 5,80 m, steigend.\nDeich durchfeuchtet.",
    auftrag: "Deichabschnitt km 4,2 bis 4,6 sichern (Süd) – „sofort“ → melden; 100 % \\ ÄÖÜ äöü ß €",
    fuehrung: "TMO 304_OL_THW\n\nEA Deich Süd\r\nGemeindehaus",
    abgesandtUm: "13:45"
};

/** Rohes JSON so verpacken, wie es kodiereWerte tut, um fremde Inhalte zu prüfen. */
async function verpacke(json: string): Promise<string> {
    const strom = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(strom).arrayBuffer());
    return Buffer.from(bytes).toString("base64url");
}

async function entpacke(text: string): Promise<unknown> {
    const strom = new Blob([Buffer.from(text, "base64url")]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return JSON.parse(await new Response(strom).text());
}

describe("kodiereWerte und dekodiereWerte", () => {
    it("bringen einen Auftrag mit Sonderzeichen, Umlauten und Zeilenumbrüchen unverändert zurück", async () => {
        const text = await kodiereWerte(voll);
        expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(await dekodiereWerte(text)).toEqual([voll]);
    });

    it("führen mehrere Aufträge in ihrer Reihenfolge mit", async () => {
        const alle: Werte[] = [{ empfaenger: "A" }, voll, { empfaenger: "C", laufendeNummer: "14" }];
        expect(await dekodiereWerte(await kodiereWerte(alle))).toEqual(alle);
    });

    it("lassen leere Werte und fremde Schlüssel weg und schreiben das Versionsfeld", async () => {
        const text = await kodiereWerte({ empfaenger: "A", auftrag: "", "3a": "  ", fremd: "x" } as Werte);
        expect(await entpacke(text)).toEqual({ v: 1, auftraege: [{ empfaenger: "A" }] });
        expect(await dekodiereWerte(text)).toEqual([{ empfaenger: "A" }]);
    });

    it("übergehen beim Dekodieren unbekannte Schlüssel und Nicht-Texte", async () => {
        const text = await verpacke(JSON.stringify({ v: 1, auftraege: [{ empfaenger: "A", neuesFeld: "x", laufendeNummer: 12, auftrag: "B" }], weiteres: true }));
        expect(await dekodiereWerte(text)).toEqual([{ empfaenger: "A", auftrag: "B" }]);
    });

    it("melden kaputte Eingaben verständlich", async () => {
        await expect(dekodiereWerte("")).rejects.toThrow(BESCHAEDIGT);
        await expect(dekodiereWerte("kein base64!")).rejects.toThrow(BESCHAEDIGT);
        await expect(dekodiereWerte("AAAAAAAA")).rejects.toThrow(BESCHAEDIGT);
        const echt = await kodiereWerte(voll);
        await expect(dekodiereWerte(echt.slice(0, Math.floor(echt.length / 2)))).rejects.toThrow(BESCHAEDIGT);
        await expect(dekodiereWerte(await verpacke("{kein json"))).rejects.toThrow(BESCHAEDIGT);
        await expect(dekodiereWerte(await verpacke(JSON.stringify({ auftraege: [{}] })))).rejects.toThrow(BESCHAEDIGT);
        await expect(dekodiereWerte(await verpacke(JSON.stringify({ v: 1, auftraege: [] })))).rejects.toThrow(BESCHAEDIGT);
        await expect(dekodiereWerte(await verpacke(JSON.stringify({ v: 1, auftraege: ["x"] })))).rejects.toThrow(BESCHAEDIGT);
    });

    it("weisen Daten einer neueren Fassung mit Hinweis ab", async () => {
        await expect(dekodiereWerte(await verpacke(JSON.stringify({ v: 2, auftraege: [{}] })))).rejects.toThrow(/neueren Fassung/);
    });
});

describe("PDF mit Auftragsdaten", () => {
    it("trägt die Daten unter der Kennung in den Metadaten und liest sie zurück", async () => {
        const { pdf } = await erzeugePdf([voll], {});
        const bytes = new Uint8Array(pdf.output("arraybuffer"));
        expect(istPdf("auftrag.bin", "", bytes)).toBe(true);
        const daten = findePdfDaten(bytes);
        expect(daten).toBe(await kodiereWerte(voll));
        expect(Buffer.from(bytes).toString("latin1")).toContain(`/Keywords (${PDF_KENNUNG}${daten})`);
        expect(await leseAusPdf(bytes.buffer)).toEqual([voll]);
    });

    it("führt bei mehreren Aufträgen alle mit", async () => {
        const alle: Werte[] = [{ empfaenger: "A" }, { empfaenger: "B", auftrag: "Zwei\nZeilen" }];
        const { pdf } = await erzeugePdf(alle, {});
        expect(await leseAusPdf(pdf.output("arraybuffer"))).toEqual(alle);
    });

    it("nimmt bei mehreren Treffern den letzten", async () => {
        const alt = await kodiereWerte({ empfaenger: "alt" });
        const neu = await kodiereWerte({ empfaenger: "neu" });
        const bytes = new TextEncoder().encode(`%PDF-1.3\n/Keywords (${PDF_KENNUNG}${alt})\n/Keywords (${PDF_KENNUNG}${neu})\n%%EOF`);
        expect(await leseAusPdf(bytes)).toEqual([{ empfaenger: "neu" }]);
    });

    it("meldet eine PDF ohne Daten", async () => {
        await expect(leseAusPdf(new TextEncoder().encode("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF"))).rejects.toThrow(KEINE_PDF_DATEN);
    });

    it("erkennt PDFs an Endung, Typ oder Signatur", () => {
        const leer = new Uint8Array();
        expect(istPdf("Auftrag.PDF", "", leer)).toBe(true);
        expect(istPdf("auftrag", "application/pdf", leer)).toBe(true);
        expect(istPdf("auftraege.csv", "text/csv", new TextEncoder().encode("Empfänger;Auftrag"))).toBe(false);
    });
});
