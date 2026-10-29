import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import {
    ABSCHNITTE,
    UNTERPUNKTE,
    setzeEinsatzauftrag,
    zeichneEinsatzauftrag,
    type EinsatzauftragDaten,
    type Element,
    type Seite
} from "../src/index.js";

function neuePdf(): jsPDF {
    return new jsPDF({ unit: "mm", format: "a4", compress: false });
}

function texte(seite: Seite | undefined): string[] {
    return (seite?.elemente ?? []).filter((e): e is Extract<Element, { art: "text" }> => e.art === "text").map(e => e.text);
}

const satz = "Deichabschnitt sichern, Sickerstellen markieren und dem Abschnittsleiter melden.";

describe("setzeEinsatzauftrag", () => {
    it("setzt den leeren Vordruck auf eine Seite in 10 pt", () => {
        const ergebnis = setzeEinsatzauftrag(neuePdf(), {});
        expect(ergebnis.seiten).toHaveLength(1);
        expect(ergebnis.schriftgroesse).toBe(10);
        const alle = texte(ergebnis.seiten[0]);
        expect(alle).toEqual(expect.arrayContaining([
            "Fb Fü 3", "Einsatzauftrag", "Technisches", "Hilfswerk", "Absender", "für den Einsatz", "lfd. Nr.:",
            "Empfänger", "Ort, Datum", "Dienststelle", "Abgesandt", "Unterschrift:", "Seite 1 von 1"
        ]));
        for (const abschnitt of ABSCHNITTE) {
            expect(alle).toContain(`${abschnitt.nummer}. ${abschnitt.titel}`);
        }
        for (const punkt of UNTERPUNKTE) {
            expect(alle).toContain(punkt);
        }
    });

    it("bleibt im Formular und innerhalb des Blatts", () => {
        const daten: EinsatzauftragDaten = { auftrag: Array(80).fill(satz).join(" ") };
        for (const seite of setzeEinsatzauftrag(neuePdf(), daten).seiten) {
            for (const element of seite.elemente) {
                const ys = element.art === "linie" ? [element.y1, element.y2] : element.art === "text" ? [element.y] : [element.y, element.y + element.h];
                for (const y of ys) {
                    expect(y).toBeGreaterThanOrEqual(0);
                    expect(y).toBeLessThanOrEqual(292);
                }
            }
        }
    });

    it("hält die Seitenränder nach DIN 5008 ein: links 25 mm, rechts 20 mm", () => {
        const pdf = neuePdf();
        const daten: EinsatzauftragDaten = { einsatz: "x ".repeat(300), auftrag: Array(80).fill(satz).join(" "), abgesandtVon: "y".repeat(200) };
        for (const seite of setzeEinsatzauftrag(pdf, daten, { fusszeile: "z ".repeat(200) }).seiten) {
            for (const e of seite.elemente) {
                const [links, rechts] = e.art === "linie" ? [Math.min(e.x1, e.x2), Math.max(e.x1, e.x2)]
                    : e.art === "text" ? (e.ausrichtung === "links" ? [e.x, e.x + e.breite] : e.ausrichtung === "rechts" ? [e.x - e.breite, e.x] : [e.x - e.breite / 2, e.x + e.breite / 2])
                    : [e.x, e.x + e.b];
                expect(links).toBeGreaterThanOrEqual(25 - 1e-9);
                expect(rechts).toBeLessThanOrEqual(190 + 1e-9);
            }
        }
    });

    it("trägt alle Felder ein", () => {
        const daten: EinsatzauftragDaten = {
            absender: "OV Oldenburg",
            einsatz: "Hochwasser",
            laufendeNummer: "12",
            empfaenger: "B-Gruppe",
            unterpunkte: Object.fromEntries(UNTERPUNKTE.map(punkt => [punkt, `Text ${punkt}`])),
            auftrag: "Deich sichern",
            fuehrung: "Funk Kanal 1\nEA Süd\nPlatz des Führers: GKW",
            ortDatum: "Oldenburg, 27.10.2026",
            unterschrift: "Muster",
            dienststelle: "ZTr",
            abgesandtAm: "27.10.",
            abgesandtUm: "13:45",
            abgesandtVon: "Fm Muster"
        };
        const alle = texte(setzeEinsatzauftrag(neuePdf(), daten).seiten[0]);
        expect(alle).toEqual(expect.arrayContaining([
            "OV Oldenburg", "Hochwasser", "12", "B-Gruppe", ...UNTERPUNKTE.map(punkt => `Text ${punkt}`), "Deich sichern",
            "Funk Kanal 1", "EA Süd", "Platz des Führers: GKW", "Oldenburg, 27.10.2026", "Muster", "ZTr", "27.10.", "13:45",
            "Fm Muster", "lfd. Nr. 12 · Seite 1 von 1"
        ]));
    });

    it("verkleinert die Schrift, wenn der Auftrag so auf eine Seite passt", () => {
        const daten: EinsatzauftragDaten = { auftrag: Array(14).fill(satz).join(" ") };
        const ergebnis = setzeEinsatzauftrag(neuePdf(), daten);
        expect(ergebnis.seiten).toHaveLength(1);
        expect(ergebnis.schriftgroesse).toBeLessThan(10);
        expect(ergebnis.schriftgroesse).toBeGreaterThanOrEqual(8);
    });

    it("geht auf weitere Seiten, wenn auch 8 pt nicht reichen, und behält dann 10 pt", () => {
        const daten: EinsatzauftragDaten = { laufendeNummer: "7", auftrag: Array(60).fill(satz).join(" ") };
        const ergebnis = setzeEinsatzauftrag(neuePdf(), daten);
        expect(ergebnis.seiten.length).toBeGreaterThan(1);
        expect(ergebnis.schriftgroesse).toBe(10);
        const zweite = texte(ergebnis.seiten[1]);
        expect(zweite).toContain("Einsatzauftrag");
        expect(zweite).toContain(`lfd. Nr. 7 · Seite 2 von ${ergebnis.seiten.length}`);
        // Der Auftrag wurde geteilt und läuft unter der wiederholten Kopfzeile weiter.
        expect(zweite).toContain("2. Auftrag (Fortsetzung)");
    });

    it("verliert beim Teilen keine Zeile", () => {
        const woerter = Array.from({ length: 900 }, (_, index) => `w${index}`);
        const ergebnis = setzeEinsatzauftrag(neuePdf(), { auftrag: woerter.join(" ") }, { schriftgroesse: 10 });
        const gesetzt = ergebnis.seiten.flatMap(texte).join(" ").split(/\s+/).filter(wort => /^w\d+$/.test(wort));
        expect(gesetzt).toEqual(woerter);
    });

    it("hält sich an eine feste Schriftgröße", () => {
        expect(setzeEinsatzauftrag(neuePdf(), { auftrag: Array(14).fill(satz).join(" ") }, { schriftgroesse: 10 }).schriftgroesse).toBe(10);
    });

    it("nimmt Kennung, Titel, Organisation und Fußzeile aus den Optionen", () => {
        const alle = texte(setzeEinsatzauftrag(neuePdf(), {}, {
            kennung: "Muster 1",
            titel: "Auftrag",
            organisation: "Feuerwehr\nMusterstadt",
            fusszeile: "Erstellt mit Test"
        }).seiten[0]);
        expect(alle).toEqual(expect.arrayContaining(["Muster 1", "Auftrag", "Feuerwehr", "Musterstadt", "Erstellt mit Test"]));
        expect(alle).not.toContain("Hilfswerk");
    });

    it("setzt ein Logo rechts in den Kopf", () => {
        const logo = { daten: "data:image/png;base64,AAAA", format: "PNG" as const, breite: 200, hoehe: 100 };
        const seite = setzeEinsatzauftrag(neuePdf(), {}, { logo }).seiten[0];
        const bild = seite?.elemente.find(e => e.art === "bild");
        expect(bild).toMatchObject({ art: "bild", format: "PNG" });
        if (bild?.art === "bild") {
            expect(bild.b / bild.h).toBeCloseTo(2);
            expect(bild.x + bild.b).toBeLessThanOrEqual(190);
        }
        const leer = setzeEinsatzauftrag(neuePdf(), {}, { logo, organisation: "" }).seiten[0];
        expect(texte(leer)).not.toContain("Hilfswerk");
    });

    it("kürzt überlange einzeilige Felder statt sie überlaufen zu lassen", () => {
        const alle = texte(setzeEinsatzauftrag(neuePdf(), { abgesandtUm: "x".repeat(200) }).seiten[0]);
        expect(alle.some(text => text.startsWith("xxx") && text.endsWith("…"))).toBe(true);
    });

    it("lässt die Schrift des Dokuments unverändert", () => {
        const pdf = neuePdf();
        pdf.setFont("courier", "normal");
        pdf.setFontSize(17);
        setzeEinsatzauftrag(pdf, { auftrag: satz });
        expect(pdf.getFont().fontName).toBe("courier");
        expect(pdf.getFontSize()).toBe(17);
    });
});

describe("zeichneEinsatzauftrag", () => {
    it("zeichnet jede Seite und erzeugt bei gleicher Eingabe dieselbe PDF", () => {
        const daten: EinsatzauftragDaten = { einsatz: "Übung", auftrag: Array(60).fill(satz).join(" ") };
        const inhalt = () => {
            const pdf = neuePdf();
            pdf.setCreationDate(new Date(0));
            pdf.setFileId("00000000000000000000000000000000");
            const ergebnis = zeichneEinsatzauftrag(pdf, daten);
            expect(pdf.getNumberOfPages()).toBe(ergebnis.seiten.length);
            return pdf.output();
        };
        const erste = inhalt();
        expect(erste).toContain("Einsatzauftrag");
        expect(erste).toContain("bung");
        expect(inhalt()).toBe(erste);
    });
});

describe("Logo", () => {
    it("bettet das Logo in die PDF ein", () => {
        const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const pdf = neuePdf();
        zeichneEinsatzauftrag(pdf, {}, { logo: { daten: png, format: "PNG", breite: 1, hoehe: 1 } });
        expect(pdf.output()).toContain("/Subtype /Image");
    });
});

describe("Abschnitt 5", () => {
    it("hält Zeilenumbrüche in einer Zelle und beginnt erst nach einer Leerzeile eine neue", () => {
        const seite = setzeEinsatzauftrag(neuePdf(), { fuehrung: "Erreichbarkeiten:\n\nFüSt Rostock\nTel. 1\nTel. 2\n\n\nFührungsstelle Südtor 8" }, { schriftgroesse: 10 }).seiten[0];
        const y = (text: string) => (seite?.elemente ?? []).find((e): e is Extract<Element, { art: "text" }> => e.art === "text" && e.text === text)?.y ?? NaN;
        const zeile = 10 * 25.4 / 72 * 1.18;
        expect(y("Tel. 1") - y("FüSt Rostock")).toBeCloseTo(zeile);
        expect(y("Tel. 2") - y("Tel. 1")).toBeCloseTo(zeile);
        // Zwischen den Blöcken liegt eine Zeilentrennung, also mehr als ein Zeilenabstand.
        expect(y("FüSt Rostock") - y("Erreichbarkeiten:")).toBeGreaterThan(zeile + 1);
        expect(y("Führungsstelle Südtor 8") - y("Tel. 2")).toBeGreaterThan(zeile + 1);
        // Trennlinien quer über das Formular: oben an jeder der drei Zellen.
        const zellen = (seite?.elemente ?? []).filter(e => e.art === "linie" && e.y1 === e.y2 && e.x1 === 25 && e.x2 === 190
            && e.y1 > y("Erreichbarkeiten:") - 6 && e.y1 < y("Führungsstelle Südtor 8"));
        expect(zellen).toHaveLength(3);
    });

    it("setzt jeden Eintrag einer Liste als eigene Zeile und behält Leerzeilen darin", () => {
        const seite = setzeEinsatzauftrag(neuePdf(), { fuehrung: ["\nErreichbarkeiten:\n\nFüSt Rostock\n\n\nTel. 1\n\n", "", "Führungsstelle Südtor 8"] }, { schriftgroesse: 10 }).seiten[0];
        const y = (text: string) => (seite?.elemente ?? []).find((e): e is Extract<Element, { art: "text" }> => e.art === "text" && e.text === text)?.y ?? NaN;
        const zeile = 10 * 25.4 / 72 * 1.18;
        // Eine Leerzeile ist eine Zeile Abstand, zwei sind zwei.
        expect(y("FüSt Rostock") - y("Erreichbarkeiten:")).toBeCloseTo(2 * zeile);
        expect(y("Tel. 1") - y("FüSt Rostock")).toBeCloseTo(3 * zeile);
        const zellen = (seite?.elemente ?? []).filter(e => e.art === "linie" && e.y1 === e.y2 && e.x1 === 25 && e.x2 === 190
            && e.y1 > y("Erreichbarkeiten:") - 6 && e.y1 < y("Führungsstelle Südtor 8"));
        expect(zellen).toHaveLength(2);
    });

    it("hat ohne Text zwei leere Zeilen wie der Vordruck", () => {
        const mitText = setzeEinsatzauftrag(neuePdf(), { fuehrung: "A\nB" }, { schriftgroesse: 10 }).seiten[0];
        const leer = setzeEinsatzauftrag(neuePdf(), {}, { schriftgroesse: 10 }).seiten[0];
        const linien = (seite: Seite | undefined) => (seite?.elemente ?? []).filter(e => e.art === "linie").length;
        expect(linien(mitText)).toBe(linien(leer));
    });
});
