import { describe, expect, it } from "vitest";
import { aenderung, auszeichnen, DURCH, FETT, KURSIV, tabelleAusTabulatoren, tabelleEinfuegen } from "../../web/src/format.js";

describe("auszeichnen", () => {
    it("setzt die Auszeichnung um die Auswahl und lässt Leerraum draußen", () => {
        expect(auszeichnen({ wert: "Deich sofort sichern", start: 6, ende: 13 }, FETT))
            .toEqual({ wert: "Deich **sofort** sichern", start: 6, ende: 17 });
    });

    it("nimmt eine vorhandene Auszeichnung wieder weg", () => {
        expect(auszeichnen({ wert: "a **b** c", start: 4, ende: 5 }, FETT)).toEqual({ wert: "a b c", start: 2, ende: 3 });
        expect(auszeichnen({ wert: "a ~~b~~ c", start: 2, ende: 7 }, DURCH)).toEqual({ wert: "a b c", start: 2, ende: 3 });
    });

    it("fügt ohne Auswahl einen ausgewählten Platzhalter ein", () => {
        const ergebnis = auszeichnen({ wert: "ab", start: 1, ende: 1 }, KURSIV);
        expect(ergebnis.wert).toBe("a*kursiv*b");
        expect(ergebnis.wert.slice(ergebnis.start, ergebnis.ende)).toBe("kursiv");
    });

    it("unterscheidet kursiv und fett an der Zahl der Sterne", () => {
        expect(auszeichnen({ wert: "**b**", start: 2, ende: 3 }, KURSIV).wert).toBe("***b***");
        expect(auszeichnen({ wert: "***b***", start: 3, ende: 4 }, KURSIV).wert).toBe("**b**");
        expect(auszeichnen({ wert: "***b***", start: 3, ende: 4 }, FETT).wert).toBe("*b*");
        expect(auszeichnen({ wert: "*b*", start: 1, ende: 2 }, FETT).wert).toBe("***b***");
    });

    it("zeichnet über mehrere Zeilen jede Zeile einzeln aus", () => {
        expect(auszeichnen({ wert: "eins\n\nzwei", start: 0, ende: 10 }, FETT).wert).toBe("**eins**\n\n**zwei**");
    });
});

describe("Tabellen", () => {
    it("macht aus Zellen mit Tabulatoren eine Tabelle mit Kopf", () => {
        expect(tabelleAusTabulatoren("Fahrzeug\tRufname\r\nGKW\tHeros 21/52\nMTW\n")).toBe(
            "| Fahrzeug | Rufname |\n| --- | --- |\n| GKW | Heros 21/52 |\n| MTW |  |");
        expect(tabelleAusTabulatoren("kein | Tab")).toBeUndefined();
        expect(tabelleAusTabulatoren("a|b\tc\n1\t2")).toBe("| a\\|b | c |\n| --- | --- |\n| 1 | 2 |");
    });

    it("fügt die Tabelle auf eigenen Zeilen ein", () => {
        const ergebnis = tabelleEinfuegen({ wert: "vorher nachher", start: 7, ende: 7 });
        expect(ergebnis.wert).toBe("vorher \n| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |\nnachher");
        expect(ergebnis.wert.slice(ergebnis.start, ergebnis.ende)).toBe("Spalte 1");
        expect(tabelleEinfuegen({ wert: "", start: 0, ende: 0 }, "a\tb\nc\td").wert).toBe("| a | b |\n| --- | --- |\n| c | d |");
    });
});

describe("aenderung", () => {
    it("findet das kleinste geänderte Stück", () => {
        expect(aenderung("a b c", "a **b** c")).toEqual({ start: 2, ende: 3, text: "**b**" });
        expect(aenderung("abc", "abc")).toEqual({ start: 3, ende: 3, text: "" });
    });
});
