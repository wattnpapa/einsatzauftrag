import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { fuerPdf, kuerzeAufBreite, trenneLangeWoerter, umbrechen, umbrechenMitTabs } from "../src/text.js";

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

describe("fuerPdf", () => {
    it("lässt WinAnsi stehen und ersetzt, was Helvetica nicht kennt", () => {
        expect(fuerPdf("Grüße „Test“ – 5 € … ß")).toBe("Grüße „Test“ – 5 € … ß");
        expect(fuerPdf("54.13514° N → https://x")).toBe("54.13514° N -> https://x");
        expect(fuerPdf("a\u200bb\tc\r\nd\re")).toBe("ab c\nd\ne");
        expect(fuerPdf("Łódź ✓ 😀")).toBe("?ódz x ?");
    });
});

describe("umbrechenMitTabs", () => {
    it("setzt Text ohne Tabulator wie umbrechen, je Zeile ein Stück bei 0", () => {
        const dokument = pdf();
        const text = "Deichabschnitt sichern, Sickerstellen markieren und melden.\n\nzwei";
        expect(umbrechenMitTabs(dokument, text, 50, 6.25).map(zeile => zeile.map(stueck => stueck.text).join(""))).toEqual(umbrechen(dokument, text, 50));
        expect(umbrechenMitTabs(dokument, text, 50, 6.25).every(zeile => zeile.length === 1 && zeile[0]?.x === 0)).toBe(true);
        expect(umbrechenMitTabs(dokument, " \t \n", 50, 6.25)).toEqual([]);
    });

    it("stellt Tabulatoren aufeinanderfolgender Zeilen bündig untereinander, auf dem Raster", () => {
        const dokument = pdf();
        const zeilen = umbrechenMitTabs(dokument, "Übungszeitraum:\t25.10.2024 ab 18:00 Uhr\n\t26.10.2024 ab 08:00 Uhr", 160, 6.25);
        expect(zeilen).toHaveLength(2);
        const [erste, zweite] = zeilen;
        expect(erste?.map(stueck => stueck.text)).toEqual(["Übungszeitraum:", "25.10.2024 ab 18:00 Uhr"]);
        expect(zweite?.map(stueck => stueck.text)).toEqual(["26.10.2024 ab 08:00 Uhr"]);
        const spalte = erste?.[1]?.x ?? 0;
        expect(zweite?.[0]?.x).toBe(spalte);
        expect(spalte).toBeGreaterThan(dokument.getTextWidth("Übungszeitraum:"));
        expect((spalte / 6.25) % 1).toBe(0);
    });

    it("richtet jede Spalte nach ihrem breitesten Text aus", () => {
        const dokument = pdf();
        const [erste, zweite] = umbrechenMitTabs(dokument, "Koordination:\tJohn:\t0152\n\tDaniel Falkenhof:\t0172", 160, 6.25);
        expect(erste?.[2]?.x).toBe(zweite?.[1]?.x);
        expect(erste?.[2]?.x ?? 0).toBeGreaterThan((zweite?.[0]?.x ?? 0) + dokument.getTextWidth("Daniel Falkenhof:"));
    });

    it("rückt umbrochene Zeilen bis zum letzten Tabstopp ein", () => {
        const dokument = pdf();
        const zeilen = umbrechenMitTabs(dokument, `•\t${"Nachrichtlich LV HHMVSH, RSt Kiel, RSt Bremen ".repeat(3)}`, 60, 6.25);
        expect(zeilen.length).toBeGreaterThan(2);
        const einzug = zeilen[0]?.[1]?.x;
        expect(einzug).toBe(6.25);
        for (const zeile of zeilen.slice(1)) {
            expect(zeile.map(stueck => stueck.x)).toEqual([einzug]);
        }
        for (const zeile of zeilen) {
            for (const stueck of zeile) {
                expect(stueck.x + dokument.getTextWidth(stueck.text)).toBeLessThanOrEqual(60 + 1e-9);
            }
        }
    });

    it("springt in die nächste Zeile, wenn kein Tabstopp mehr passt", () => {
        const dokument = pdf();
        const zeilen = umbrechenMitTabs(dokument, "ab\tcd\tef\tgh", 14, 6.25);
        const texte = zeilen.flat().map(stueck => stueck.text);
        expect(texte).toEqual(["ab", "cd", "ef", "gh"]);
        for (const stueck of zeilen.flat()) {
            expect(stueck.x).toBeLessThan(14);
        }
    });
});
