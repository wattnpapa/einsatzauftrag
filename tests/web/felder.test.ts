import { describe, expect, it } from "vitest";
import { UNTERPUNKTE } from "../../src/index.js";
import { auftragKopieren, FELDER, feldZuKopf, fuehrungText, fuehrungZeilen, hatInhalt, hochzaehlen, istJa, KOPIE_LEERT, leseTabelle, NAECHSTER_LEERT, naechsterAuftrag, vorlageTabelle, zuDaten } from "../../web/src/felder.js";

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
        expect(hatInhalt({ uebung: "nein" })).toBe(false);
        expect(hatInhalt({ uebung: "ja" })).toBe(true);
    });

    it("liest die Übungskennzeichnung aus Haken und Tabellenspalte", () => {
        expect(zuDaten({ uebung: "ja" }).uebung).toBe(true);
        expect(zuDaten({ uebung: "X" }).uebung).toBe(true);
        expect(zuDaten({ uebung: "nein" }).uebung).toBe(false);
        expect(zuDaten({}).uebung).toBe(false);
        expect(istJa(" Ja ")).toBe(true);
        expect(istJa("vielleicht")).toBe(false);
        expect(feldZuKopf("Übung")).toBe("uebung");
        expect(feldZuKopf("Ist Übung")).toBe("uebung");
        expect(leseTabelle([["Empfänger", "Übung"], ["Gruppe A", "x"]]).zeilen[0]?.werte.uebung).toBe("x");
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

describe("Folgeaufträge", () => {
    const werte = {
        absender: "ZTr TZ", einsatz: "Hochwasser", laufendeNummer: "A-09", empfaenger: "B-Gruppe",
        "1a": "Lage", auftrag: "Deich sichern", "3a": "km 4,2", "4a": "Log-V", fuehrung: "TMO",
        ortDatum: "Oldenburg, 27.10.2026", abgesandtAm: "27.10.", abgesandtUm: "13:45", abgesandtVon: "Fm Muster"
    } as const;

    it("zählt die letzte Zahl der lfd. Nr. hoch und behält Nullen und Zusätze", () => {
        expect(hochzaehlen("12")).toBe("13");
        expect(hochzaehlen("A-09")).toBe("A-10");
        expect(hochzaehlen("007/b")).toBe("008/b");
        expect(hochzaehlen("ohne")).toBe("ohne");
    });

    it("„Auftrag kopieren“ behält alles bis auf Empfänger und Absendung", () => {
        const kopie = auftragKopieren(werte);
        expect(kopie).toEqual({ ...werte, laufendeNummer: "A-10", empfaenger: undefined, abgesandtAm: undefined, abgesandtUm: undefined });
        expect(Object.keys(kopie)).not.toContain("empfaenger");
        for (const schluessel of KOPIE_LEERT) {
            expect(kopie[schluessel]).toBeUndefined();
        }
        expect(werte.empfaenger).toBe("B-Gruppe");
    });

    it("„Nächster Auftrag“ leert zusätzlich Auftrag und Durchführung", () => {
        const neu = naechsterAuftrag(werte);
        for (const schluessel of NAECHSTER_LEERT) {
            expect(neu[schluessel]).toBeUndefined();
        }
        expect(neu).toMatchObject({ laufendeNummer: "A-10", "1a": "Lage", "4a": "Log-V", fuehrung: "TMO", abgesandtVon: "Fm Muster" });
    });

    it("lässt eine fehlende lfd. Nr. fehlen", () => {
        expect(auftragKopieren({ empfaenger: "A", auftrag: "B" })).toEqual({ auftrag: "B" });
    });
});
