import { describe, expect, it } from "vitest";
import { UNTERPUNKTE } from "../../src/index.js";
import { FELDER, feldZuKopf, fuehrungText, fuehrungZeilen, hatInhalt, leseTabelle, vorlageTabelle, zuDaten } from "../../web/src/felder.js";

describe("FELDER", () => {
    it("hat jedes Feld genau einmal, alle Unterpunkte eingeschlossen", () => {
        const schluessel = FELDER.map(feld => feld.schluessel);
        expect(new Set(schluessel).size).toBe(schluessel.length);
        for (const punkt of UNTERPUNKTE) {
            expect(schluessel).toContain(punkt);
        }
    });

    it("erkennt jeden eigenen Spaltenkopf wieder", () => {
        for (const feld of FELDER) {
            expect(feldZuKopf(feld.titel)).toBe(feld.schluessel);
        }
    });
});

describe("feldZuKopf", () => {
    it("erkennt Kurzformen und Schreibvarianten", () => {
        expect(feldZuKopf("Nr.")).toBe("laufendeNummer");
        expect(feldZuKopf("lfd. Nr.")).toBe("laufendeNummer");
        expect(feldZuKopf("EMPFAENGER")).toBe("empfaenger");
        expect(feldZuKopf("Auftrag")).toBe("auftrag");
        expect(feldZuKopf("1a")).toBe("1a");
        expect(feldZuKopf("4c Kraftstoff")).toBe("4c");
        expect(feldZuKopf("Führung und Verbindung")).toBe("fuehrung");
        expect(feldZuKopf("Bemerkung")).toBeUndefined();
        expect(feldZuKopf("4h")).toBeUndefined();
    });
});

describe("leseTabelle", () => {
    it("findet die Kopfzeile, überspringt leere Zeilen und merkt unbekannte Spalten", () => {
        const tabelle = leseTabelle([
            ["Einsatzaufträge für Übung"],
            ["Lfd. Nr.", "Empfänger", "2 Auftrag", "Notiz"],
            ["1", "Gruppe A", "Deich sichern\r\nund melden", "intern"],
            ["", "", "", ""],
            ["2", "Gruppe B", "", ""]
        ]);
        expect(tabelle.unbekannt).toEqual(["Notiz"]);
        expect(tabelle.zeilen).toEqual([
            { zeile: 3, werte: { laufendeNummer: "1", empfaenger: "Gruppe A", auftrag: "Deich sichern\nund melden" } },
            { zeile: 5, werte: { laufendeNummer: "2", empfaenger: "Gruppe B" } }
        ]);
    });

    it("fügt doppelte Spalten zusammen", () => {
        const tabelle = leseTabelle([["5 Führung und Verbindung", "Führung"], ["Funk", "EA Süd"]]);
        expect(tabelle.zeilen[0]?.werte.fuehrung).toBe("Funk\n\nEA Süd");
    });

    it("meldet eine Tabelle ohne bekannte Spalte", () => {
        expect(() => leseTabelle([["a", "b"], ["1", "2"]])).toThrow(/Keine bekannte Spalte/);
    });

    it("liest die eigene CSV-Vorlage mit ihrer Beispielzeile", () => {
        const tabelle = leseTabelle(vorlageTabelle());
        expect(tabelle.unbekannt).toEqual([]);
        expect(tabelle.zeilen).toHaveLength(1);
        expect(tabelle.zeilen[0]?.werte.empfaenger).toBe("B-Gruppe 1. TZ");
    });
});

describe("zuDaten", () => {
    it("übersetzt die Werte in die Daten der Bibliothek", () => {
        const daten = zuDaten({ empfaenger: "A", "3b": "Sandsäcke", fuehrung: "Funk" });
        expect(daten.empfaenger).toBe("A");
        expect(daten.unterpunkte?.["3b"]).toBe("Sandsäcke");
        expect(daten.unterpunkte?.["1a"]).toBe("");
        expect(daten.fuehrung).toEqual(["Funk"]);
    });

    it("erkennt leere Werte", () => {
        expect(hatInhalt({})).toBe(false);
        expect(hatInhalt({ auftrag: "  " })).toBe(false);
        expect(hatInhalt({ "4g": "Handkasse" })).toBe(true);
    });
});

describe("Abschnitt 5 als Zeilen", () => {
    it("teilt Text aus einer Tabelle an Leerzeilen", () => {
        expect(fuehrungZeilen("A\nB\n\n\nC\n \n")).toEqual(["A\nB", "C"]);
        expect(fuehrungZeilen("A\\n\\nB")).toEqual(["A", "B"]);
        expect(fuehrungZeilen("")).toEqual([]);
    });

    it("hält eine Eingabe mit Leerzeilen als eine Zeile", () => {
        const text = fuehrungText(["\nErreichbarkeiten:\n\nFüSt Rostock\n", "", "Führungsstelle"]);
        expect(fuehrungZeilen(text)).toEqual(["Erreichbarkeiten:\n\nFüSt Rostock", "Führungsstelle"]);
        expect(fuehrungZeilen(fuehrungText(["Nur eine\n\nZeile"]))).toEqual(["Nur eine\n\nZeile"]);
        expect(fuehrungText(["", " "])).toBe("");
    });

    it("gibt der Bibliothek die Zeilen als Liste", () => {
        expect(zuDaten({ fuehrung: fuehrungText(["A\n\nB", "C"]) }).fuehrung).toEqual(["A\n\nB", "C"]);
        expect(zuDaten({ fuehrung: "A\n\nB" }).fuehrung).toEqual(["A", "B"]);
    });
});
