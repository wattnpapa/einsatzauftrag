import { describe, expect, it } from "vitest";
import { dateiname, erzeugePdf, HERKUNFT } from "../../web/src/pdf.js";

const lang = Array(60).fill("Deichabschnitt sichern, Sickerstellen markieren und dem Abschnittsleiter melden.").join(" ");

describe("erzeugePdf", () => {
    it("beginnt jeden Auftrag auf einer neuen Seite und zählt die Seiten je Auftrag", () => {
        const { pdf, seiten } = erzeugePdf([{ empfaenger: "A" }, { empfaenger: "B", auftrag: lang }, { empfaenger: "C" }], {}, { komprimiert: false });
        expect(seiten[0]).toBe(1);
        expect(seiten[1]).toBeGreaterThan(1);
        expect(seiten[2]).toBe(1);
        expect(pdf.getNumberOfPages()).toBe(seiten.reduce((a, b) => a + b, 0));
        expect(pdf.output()).toContain("Erstellt mit github.com/wattnpapa/einsatzauftrag".slice(0, 20));
    });

    it("lässt die Fußzeile über die Optionen ändern", () => {
        const { pdf } = erzeugePdf([{}], { fusszeile: "Eigene Zeile" }, { komprimiert: false });
        const inhalt = pdf.output();
        expect(inhalt).toContain("Eigene Zeile");
        expect(inhalt).not.toContain(HERKUNFT);
    });
});

describe("dateiname", () => {
    const zeit = new Date(2026, 9, 27, 13, 45, 7);

    it("nennt einen Auftrag mit Nummer und Zeit", () => {
        expect(dateiname(1, zeit, "12")).toBe("einsatzauftrag_nr12_2026-10-27_134507.pdf");
        expect(dateiname(1, zeit, "12 / a")).toBe("einsatzauftrag_nr12a_2026-10-27_134507.pdf");
        expect(dateiname(1, zeit)).toBe("einsatzauftrag_2026-10-27_134507.pdf");
    });

    it("nennt mehrere Aufträge ohne Nummer", () => {
        expect(dateiname(3, zeit, "12")).toBe("einsatzauftraege_2026-10-27_134507.pdf");
    });
});
