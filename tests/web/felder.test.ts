import { describe, expect, it } from "vitest";
import { UNTERPUNKTE } from "../../src/index.js";
import { FELDER, felderFuer, feldZuKopf, fuehrungText, fuehrungZeilen, hatInhalt, leseTabelle, vorlageTabelle, zuDaten } from "../../web/src/felder.js";

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

    it("zeigt je Gestaltung ihre Felder: Unterzeilen und Abgesandt im Vordruck, Freitexte allgemein", () => {
        const vordruck = felderFuer("vordruck").map(feld => feld.schluessel);
        const allgemein = felderFuer("allgemein").map(feld => feld.schluessel);
        expect(vordruck).toEqual(expect.arrayContaining([...UNTERPUNKTE, "abgesandtAm", "auftrag", "fuehrung"]));
        expect(vordruck).not.toContain("lage");
        expect(allgemein).toEqual(["absender", "einsatz", "laufendeNummer", "empfaenger", "lage", "auftrag", "durchfuehrung", "logistik", "fuehrung", "ortDatum", "unterschrift", "dienststelle"]);
        expect(vorlageTabelle("allgemein")[0]).toEqual(["Absender", "Für den Einsatz", "Lfd. Nr.", "Empfänger", "1 Lage", "2 Auftrag", "3 Durchführung", "4 Logistik", "5 Führung und Verbindung", "Ort, Datum", "Unterschrift", "Dienststelle"]);
        expect(vorlageTabelle()[0]).toContain("1a Gefahren- / Schadenlage");
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
        expect(feldZuKopf("Lage")).toBe("lage");
        expect(feldZuKopf("3 Durchführung")).toBe("durchfuehrung");
        expect(feldZuKopf("Logistik")).toBe("logistik");
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

    it("liest die eigene CSV-Vorlage mit ihrer Beispielzeile, in beiden Gestaltungen", () => {
        const tabelle = leseTabelle(vorlageTabelle());
        expect(tabelle.unbekannt).toEqual([]);
        expect(tabelle.zeilen).toHaveLength(1);
        expect(tabelle.zeilen[0]?.werte.empfaenger).toBe("B-Gruppe 1. TZ");
        const allgemein = leseTabelle(vorlageTabelle("allgemein"));
        expect(allgemein.unbekannt).toEqual([]);
        expect(allgemein.zeilen[0]?.werte.lage).toContain("Pegel");
        expect(allgemein.zeilen[0]?.werte["1a"]).toBeUndefined();
    });
});

describe("zuDaten", () => {
    it("übersetzt die Werte in die Daten der Bibliothek", () => {
        const daten = zuDaten({ empfaenger: "A", "3b": "Sandsäcke", fuehrung: "Funk", lage: "Pegel", logistik: "Sand" });
        expect(daten.empfaenger).toBe("A");
        expect(daten.unterpunkte?.["3b"]).toBe("Sandsäcke");
        expect(daten.unterpunkte?.["1a"]).toBe("");
        expect(daten.fuehrung).toBe("Funk");
        expect(daten.lage).toBe("Pegel");
        expect(daten.durchfuehrung).toBe("");
        expect(daten.logistik).toBe("Sand");
    });

    it("erkennt leere Werte", () => {
        expect(hatInhalt({})).toBe(false);
        expect(hatInhalt({ auftrag: "  " })).toBe(false);
        expect(hatInhalt({ "4g": "Handkasse" })).toBe(true);
    });
});

describe("Abschnitt 5 als Zeilen", () => {
    it("teilt an Leerzeilen und fügt wieder zusammen", () => {
        expect(fuehrungZeilen("A\nB\n\n\nC\n \n")).toEqual(["A\nB", "C"]);
        expect(fuehrungZeilen("")).toEqual([]);
        expect(fuehrungText(["A\nB", "", "C"])).toBe("A\nB\n\nC");
    });

    it("hält eine Eingabe mit Leerzeilen als eine Zeile", () => {
        const text = fuehrungText(["Erreichbarkeiten:\n\nFüSt Rostock\n", "Führungsstelle"]);
        expect(fuehrungZeilen(text)).toEqual(["Erreichbarkeiten:\nFüSt Rostock", "Führungsstelle"]);
    });
});
