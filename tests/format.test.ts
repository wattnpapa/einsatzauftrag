import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { bloecke, hatAuszeichnung, laeufe, ohneAuszeichnung, umbrechenLaeufe } from "../src/format.js";
import { setzeEinsatzauftrag, type Element } from "../src/index.js";

type Text = Extract<Element, { art: "text" }>;
type Linie = Extract<Element, { art: "linie" }>;

function neuePdf(): jsPDF {
    return new jsPDF({ unit: "mm", format: "a4", compress: false });
}

const L = (text: string, stil: Partial<{ fett: boolean; kursiv: boolean; durch: boolean }> = {}) =>
    ({ text, fett: false, kursiv: false, durch: false, ...stil });

describe("laeufe", () => {
    it("liest Markdown: fett, kursiv, beides und durchgestrichen, auch ineinander", () => {
        expect(laeufe("a **b *c*** ~~d~~ __e__ _f_ ***g***")).toEqual([
            L("a "), L("b ", { fett: true }), L("c", { fett: true, kursiv: true }), L(" "), L("d", { durch: true }),
            L(" "), L("e", { fett: true }), L(" "), L("f", { kursiv: true }), L(" "), L("g", { fett: true, kursiv: true })
        ]);
    });

    it("lässt stehen, was in Markdown keine Auszeichnung ist", () => {
        for (const text of ["5 * 3 * 2 = 30", "2 ** 3 und offen ~~", "TMO 304_OL_THW", "snake_case_name", "** nicht fett **"]) {
            expect(hatAuszeichnung(text)).toBe(false);
            expect(ohneAuszeichnung(text)).toBe(text);
        }
    });

    it("nimmt maskierte Zeichen wörtlich", () => {
        expect(laeufe("\\*kein\\* kursiv, a\\|b, C:\\temp")).toEqual([L("*kein* kursiv, a|b, C:\\temp")]);
        expect(hatAuszeichnung("\\*")).toBe(true);
        expect(ohneAuszeichnung("**a**\n*b*")).toBe("a\nb");
    });
});

describe("bloecke", () => {
    it("fasst Tabellenzeilen zusammen und erkennt den Kopf", () => {
        expect(bloecke("Vorher\n| A | B |\n|---|---|\n| 1 | 2\nNachher", true)).toEqual([
            { art: "absatz", text: "Vorher" },
            { art: "tabelle", zeilen: [["A", "B"], ["1", "2"]], kopfzeilen: 1 },
            { art: "absatz", text: "Nachher" }
        ]);
        expect(bloecke("| A | B |", false)).toEqual([{ art: "absatz", text: "| A | B |" }]);
        expect(bloecke("  \n ", true)).toEqual([]);
        expect(bloecke("| a \\| b | c |", true)).toEqual([{ art: "tabelle", zeilen: [["a \\| b", "c"]], kopfzeilen: 0 }]);
    });
});

describe("umbrechenLaeufe", () => {
    it("bricht über Stilgrenzen hinweg an Wortgrenzen um", () => {
        const pdf = neuePdf();
        const zeilen = umbrechenLaeufe(pdf, laeufe("**Wasser**schaden ".repeat(20).trim()), 60, 10);
        expect(zeilen.length).toBeGreaterThan(1);
        for (const zeile of zeilen) {
            const text = zeile.map(lauf => lauf.text).join("");
            expect(text.trim()).toBe(text);
            expect(text).toMatch(/^(Wasserschaden ?)+$/);
        }
    });
});

describe("Satz mit Auszeichnungen", () => {
    it("setzt fette, kursive und durchgestrichene Stücke nebeneinander", () => {
        const satz = setzeEinsatzauftrag(neuePdf(), { auftrag: "Deich **sofort** sichern, *Achtung* ~~Sandsäcke~~" });
        const elemente = satz.seiten[0]?.elemente ?? [];
        const texte = elemente.filter((e): e is Text => e.art === "text");
        const fett = texte.find(e => e.text === "sofort");
        const kursiv = texte.find(e => e.text === "Achtung");
        const durch = texte.find(e => e.text === "Sandsäcke");
        expect(fett?.fett).toBe(true);
        expect(kursiv?.kursiv).toBe(true);
        expect(texte.find(e => e.text === "Deich")?.kursiv).toBeUndefined();
        // Leerzeichen stehen nicht am Rand der Stücke, sondern als Abstand dazwischen.
        const anfang = texte.find(e => e.text === "Deich");
        expect(fett?.x).toBeGreaterThan((anfang?.x ?? 0) + (anfang?.breite ?? 0) + 0.5);
        expect(texte.filter(e => e.y === fett?.y).every(e => e.text === e.text.trim())).toBe(true);
        const strich = elemente.find((e): e is Linie => e.art === "linie" && Math.abs(e.x1 - (durch?.x ?? -1)) < 1e-6);
        expect(strich?.x2).toBeCloseTo((durch?.x ?? 0) + (durch?.breite ?? 0), 6);
        expect(strich?.y1).toBeLessThan(durch?.y ?? 0);
    });

    it("setzt Tabellen mit Kopf in die Abschnitte, nicht in Absender oder Unterschrift", () => {
        const tabelle = "| Fahrzeug | Funkrufname |\n| --- | --- |\n| GKW | Heros OL 21/52 |\n| MTW | Heros OL 21/19 |";
        const satz = setzeEinsatzauftrag(neuePdf(), { unterpunkte: { "1b": tabelle }, absender: "| a | b |" });
        const elemente = satz.seiten[0]?.elemente ?? [];
        const texte = elemente.filter((e): e is Text => e.art === "text");
        expect(texte.find(e => e.text === "Fahrzeug")?.fett).toBe(true);
        expect(texte.find(e => e.text === "GKW")?.fett).toBe(false);
        expect(texte.some(e => e.text.includes("|") && e.text !== "| a | b |")).toBe(false);
        expect(texte.some(e => e.text === "| a | b |")).toBe(true);
        expect(elemente.some(e => e.art === "flaeche" && e.farbe === "#e6e6e6")).toBe(true);
        const gkw = texte.find(e => e.text === "GKW") as Text;
        const funk = texte.find(e => e.text === "Heros OL 21/52") as Text;
        expect(funk.y).toBeCloseTo(gkw.y, 6);
        expect(funk.x).toBeGreaterThan(gkw.x + gkw.breite);
    });

    it("bricht breite Tabellen in den Zellen um und bleibt im Formular", () => {
        const lang = "Sandsackverbau an Sickerstellen und Ausleuchtung der Deichkrone";
        const tabelle = Array.from({ length: 60 }, (_, i) => `| ${i} | ${lang} | ${lang} | ${lang} |`).join("\n");
        const satz = setzeEinsatzauftrag(neuePdf(), { auftrag: tabelle });
        expect(satz.seiten.length).toBeGreaterThan(1);
        for (const seite of satz.seiten) {
            for (const e of seite.elemente) {
                if (e.art === "text") {
                    expect(e.x + (e.ausrichtung === "links" ? e.breite : 0)).toBeLessThanOrEqual(190.01);
                    expect(e.y).toBeLessThanOrEqual(292);
                }
            }
        }
    });

    it("blättert bei einer Tabellenzeile, die höher als eine Seite ist, nicht endlos", () => {
        const riesig = `| ${Array(4000).fill("Wort").join(" ")} |`;
        const satz = setzeEinsatzauftrag(neuePdf(), { auftrag: riesig });
        expect(satz.seiten.length).toBeLessThan(5);
    });
});
