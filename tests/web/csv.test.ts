import { describe, expect, it } from "vitest";
import { dekodiereCsv, erkenneTrenner, leseCsv, schreibeCsv } from "../../web/src/csv.js";

describe("CSV", () => {
    it("liest Anführungszeichen, Zeilenumbrüche im Feld und BOM", () => {
        const text = "﻿Nr;Inhalt\r\n1;\"Zeile 1\nZeile 2; mit \"\"Zitat\"\"\"\r\n2;kurz";
        expect(leseCsv(text)).toEqual([
            ["Nr", "Inhalt"],
            ["1", "Zeile 1\nZeile 2; mit \"Zitat\""],
            ["2", "kurz"]
        ]);
    });

    it("erkennt Komma und Tabulator", () => {
        expect(erkenneTrenner("Nr,Inhalt,Absender\n1,2,3")).toBe(",");
        expect(erkenneTrenner("Nr\tInhalt\n1\t2")).toBe("\t");
        expect(erkenneTrenner("Nr;Inhalt")).toBe(";");
    });

    it("schreibt, was es wieder liest", () => {
        const zeilen = [["Nr", "Inhalt"], ["1", "a;b\n\"c\""]];
        expect(leseCsv(schreibeCsv(zeilen))).toEqual(zeilen);
    });

    it("meldet ein nicht geschlossenes Anführungszeichen mit Zeile, statt Zeilen zu verschlucken", () => {
        const text = "Nr;Inhalt\r\n1;ok\r\n2;\"kaputt\r\n3;weiter\r\n";
        expect(() => leseCsv(text)).toThrow(/Zeile 3 /);
    });

    it("liest UTF-8 und fällt bei Windows-1252 zurück", () => {
        const utf8 = new TextEncoder().encode("Empfänger;Übermittlungsweg");
        expect(dekodiereCsv(utf8)).toBe("Empfänger;Übermittlungsweg");
        // „Empfänger“ in Windows-1252: ä ist 0xE4.
        const windows = new Uint8Array([0x45, 0x6d, 0x70, 0x66, 0xe4, 0x6e, 0x67, 0x65, 0x72, 0x3b, 0x80]);
        expect(dekodiereCsv(windows)).toBe("Empfänger;€");
    });

    it("liest UTF-16 mit Byte-Order-Mark (Excel „Unicode-Text“)", () => {
        const text = "Nr\tEmpfänger\n1\tHeros";
        const le = new Uint8Array([0xff, 0xfe, ...Array.from(text).flatMap(z => [z.charCodeAt(0) & 0xff, z.charCodeAt(0) >> 8])]);
        expect(dekodiereCsv(le)).toBe(text);
    });

    it("meldet ein Anführungszeichen, das erst eine Zeile später schließt", () => {
        const hinweise: string[] = [];
        const zeilen = leseCsv("Nr;Inhalt\n1;\"offen\n2;B;zweite\"\n3;dritte\n", undefined, hinweise);
        expect(zeilen).toHaveLength(3);
        expect(hinweise[0]).toMatch(/^Ab Zeile 2 umfasst ein Feld/);
    });

    it("lässt Anführungszeichen mitten im Text stehen", () => {
        expect(leseCsv("Nr;Inhalt\n1;Text mit \"Zitat\" drin\n")).toEqual([["Nr", "Inhalt"], ["1", "Text mit \"Zitat\" drin"]]);
    });
});

describe("Anführungszeichen am Feldanfang", () => {
    it("behält ein Zitat am Anfang, wenn der Text danach weitergeht", () => {
        expect(leseCsv('Nr;Inhalt\n1;"Zitat am Anfang" und weiter\n', ";")).toEqual([["Nr", "Inhalt"], ["1", '"Zitat am Anfang" und weiter']]);
        expect(leseCsv('Nr;Inhalt\n1;"ganz; gefasst"\n', ";")).toEqual([["Nr", "Inhalt"], ["1", "ganz; gefasst"]]);
    });
});
