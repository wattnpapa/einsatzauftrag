import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { kuerzeAufBreite, trenneLangeWoerter, umbrechen } from "../src/text.js";

function pdf(): jsPDF {
    const dokument = new jsPDF({ unit: "mm", format: "a4" });
    dokument.setFontSize(10);
    return dokument;
}

describe("umbrechen", () => {
    it("liefert für leeren Text keine Zeile und hält Absätze", () => {
        expect(umbrechen(pdf(), "  \n ", 50)).toEqual([]);
        expect(umbrechen(pdf(), "eins\n\nzwei", 50)).toEqual(["eins", "", "zwei"]);
        expect(umbrechen(pdf(), "eins\\nzwei\r\ndrei", 50)).toEqual(["eins", "zwei", "drei"]);
    });

    it("teilt Wörter, die breiter als die Zeile sind", () => {
        const dokument = pdf();
        const zeilen = umbrechen(dokument, "Wasserschadenpumpeneinsatzfahrzeugbereitstellungsraum", 30);
        expect(zeilen.length).toBeGreaterThan(1);
        for (const zeile of zeilen) {
            expect(dokument.getTextWidth(zeile)).toBeLessThanOrEqual(30.01);
        }
        expect(zeilen.slice(0, -1).every(zeile => zeile.endsWith("-"))).toBe(true);
    });

    it("bricht an eigenen Bruchstellen ohne zusätzlichen Strich", () => {
        const dokument = pdf();
        const stuecke = trenneLangeWoerter(dokument, "abschnittsleitung/einsatzabschnitt/deichverteidigung", 40).split(" ");
        expect(stuecke.length).toBeGreaterThan(1);
        expect(stuecke[0]?.endsWith("/")).toBe(true);
    });

    it("bewältigt sehr lange Wörter schnell", () => {
        const start = Date.now();
        const zeilen = umbrechen(pdf(), "x".repeat(20000), 40);
        expect(zeilen.length).toBeGreaterThan(100);
        expect(Date.now() - start).toBeLessThan(5000);
    });
});

describe("kuerzeAufBreite", () => {
    it("lässt passenden Text stehen und kürzt zu langen mit „…“", () => {
        const dokument = pdf();
        expect(kuerzeAufBreite(dokument, "kurz", 50)).toBe("kurz");
        const gekuerzt = kuerzeAufBreite(dokument, "ein ziemlich langer Text ohne Ende", 20);
        expect(gekuerzt.endsWith("…")).toBe(true);
        expect(dokument.getTextWidth(gekuerzt)).toBeLessThanOrEqual(20);
    });
});
