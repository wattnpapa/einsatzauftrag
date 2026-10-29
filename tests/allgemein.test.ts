import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import {
    ABSCHNITTE,
    LEITFARBE,
    registriereSchrift,
    setzeEinsatzauftrag,
    zeichneEinsatzauftrag,
    zeichneSeite,
    type EinsatzauftragDaten,
    type Element,
    type Schriftart,
    type Seite
} from "../src/index.js";

function neuePdf(): jsPDF {
    return new jsPDF({ unit: "mm", format: "a4", compress: false });
}

function textElemente(seite: Seite | undefined): Extract<Element, { art: "text" }>[] {
    return (seite?.elemente ?? []).filter((e): e is Extract<Element, { art: "text" }> => e.art === "text");
}

function texte(seite: Seite | undefined): string[] {
    return textElemente(seite).map(e => e.text);
}

const satz = "Deichabschnitt sichern, Sickerstellen markieren und dem Abschnittsleiter melden.";

/** Red Hat Mono (OFL) steht stellvertretend für Aptos, das nicht mitgeliefert werden darf. */
const schriftart: Schriftart = {
    name: "Aptos",
    normal: readFileSync(new URL("./fixtures/RedHatMono-Regular.ttf", import.meta.url)).toString("base64"),
    fett: readFileSync(new URL("./fixtures/RedHatMono-Bold.ttf", import.meta.url)).toString("base64")
};

describe("Gestaltung allgemein", () => {
    it("setzt das leere Blatt mit Titel, Anschrift, fünf Abschnitten und Unterschrift auf eine Seite", () => {
        const ergebnis = setzeEinsatzauftrag(neuePdf(), {}, { gestaltung: "allgemein" });
        expect(ergebnis.seiten).toHaveLength(1);
        expect(ergebnis.schriftgroesse).toBe(10);
        const alle = texte(ergebnis.seiten[0]);
        expect(alle).toEqual(expect.arrayContaining(["Einsatzauftrag", "Absender", "Empfänger", "Einsatz", "lfd. Nr.", "Ort, Datum", "Unterschrift", "Dienststelle", "Seite 1 von 1"]));
        for (const abschnitt of ABSCHNITTE) {
            expect(alle).toContain(String(abschnitt.nummer));
            expect(alle).toContain(abschnitt.titel);
        }
        // Keine Unterzeilen, kein THW-Kopf, keine Abgesandt-Zeile.
        expect(alle).not.toContain("1a");
        expect(alle).not.toContain("Fb Fü 3");
        expect(alle).not.toContain("Hilfswerk");
        expect(alle.some(text => text.startsWith("Abgesandt"))).toBe(false);
        // Keine gelbe oder blaue Fläche.
        expect(ergebnis.seiten[0]?.elemente.some(e => e.art === "flaeche")).toBe(false);
    });

    it("nimmt Rot als Leitfarbe für Titel, Linien und Nummern, auf Wunsch Schwarz", () => {
        const rot = setzeEinsatzauftrag(neuePdf(), {}, { gestaltung: "allgemein" }).seiten[0];
        const titel = textElemente(rot).find(e => e.text === "Einsatzauftrag");
        expect(titel?.farbe).toBe(LEITFARBE);
        expect(titel?.fett).toBe(true);
        expect(textElemente(rot).find(e => e.text === "1")?.farbe).toBe(LEITFARBE);
        expect(textElemente(rot).find(e => e.text === "Lage")?.farbe).toBe("#000000");
        expect(rot?.elemente.some(e => e.art === "linie" && e.farbe === LEITFARBE)).toBe(true);

        const schwarz = setzeEinsatzauftrag(neuePdf(), {}, { gestaltung: "allgemein", leitfarbe: "#000000" }).seiten[0];
        expect(textElemente(schwarz).find(e => e.text === "Einsatzauftrag")?.farbe).toBe("#000000");
        expect(schwarz?.elemente.every(e => e.art !== "linie" || e.farbe !== LEITFARBE)).toBe(true);
        // Unbrauchbare Farben fallen auf Rot zurück.
        const kaputt = setzeEinsatzauftrag(neuePdf(), {}, { gestaltung: "allgemein", leitfarbe: "rot" }).seiten[0];
        expect(textElemente(kaputt).find(e => e.text === "Einsatzauftrag")?.farbe).toBe(LEITFARBE);
    });

    it("trägt die Freitexte ein und hält die Unterzeilen des Vordrucks mit Kennung", () => {
        const daten: EinsatzauftragDaten = {
            absender: "Kreisfeuerwehr",
            einsatz: "Hochwasser",
            laufendeNummer: "12",
            empfaenger: "THW OV Oldenburg",
            lage: "Pegel steigend\nDeich durchfeuchtet",
            auftrag: "Deich sichern",
            durchfuehrung: "Sandsackverbau",
            logistik: "Sandsäcke vom Bauhof",
            fuehrung: "EL Gerätehaus\n\nFunk TMO 304",
            unterpunkte: { "3b": "Einzelauftrag aus der Tabelle" },
            ortDatum: "Oldenburg, 27.10.2026",
            unterschrift: "Muster",
            dienststelle: "KBM",
            abgesandtAm: "27.10.",
            abgesandtUm: "13:45",
            abgesandtVon: "Fm Muster"
        };
        const seite = setzeEinsatzauftrag(neuePdf(), daten, { gestaltung: "allgemein", kennung: "Formblatt 3", organisation: "Landkreis\nKatastrophenschutz" }).seiten[0];
        const alle = texte(seite);
        expect(alle).toEqual(expect.arrayContaining([
            "Kreisfeuerwehr", "Hochwasser", "12", "THW OV Oldenburg", "Pegel steigend", "Deich durchfeuchtet", "Deich sichern", "Sandsackverbau",
            "Sandsäcke vom Bauhof", "EL Gerätehaus", "Funk TMO 304", "3b", "Einzelauftrag aus der Tabelle", "Oldenburg, 27.10.2026", "Muster", "KBM",
            "Abgesandt am 27.10. um 13:45 von Fm Muster", "Formblatt 3", "Landkreis", "Katastrophenschutz", "lfd. Nr. 12 · Seite 1 von 1"
        ]));
        // Die Unterzeile steht unter dem Freitext des Abschnitts 3, vor Abschnitt 4.
        const y = (text: string) => textElemente(seite).find(e => e.text === text)?.y ?? NaN;
        expect(y("3b")).toBeGreaterThan(y("Sandsackverbau"));
        expect(y("3b")).toBeLessThan(y("Logistik"));
        // Die Leerzeile in Abschnitt 5 bleibt eine Leerzeile.
        expect(y("Funk TMO 304") - y("EL Gerätehaus")).toBeCloseTo(2 * 10 * 25.4 / 72 * 1.18);
    });

    it("bleibt innerhalb der Seitenränder nach DIN 5008", () => {
        const daten: EinsatzauftragDaten = { einsatz: "x ".repeat(300), lage: Array(40).fill(satz).join(" "), auftrag: Array(80).fill(satz).join(" "), absender: "y".repeat(200) };
        const ergebnis = setzeEinsatzauftrag(neuePdf(), daten, { gestaltung: "allgemein", fusszeile: "z ".repeat(200), organisation: "Ein sehr langer Name einer Organisation, der nicht passt" });
        expect(ergebnis.seiten.length).toBeGreaterThan(1);
        for (const seite of ergebnis.seiten) {
            for (const e of seite.elemente) {
                const [links, rechts] = e.art === "linie" ? [Math.min(e.x1, e.x2), Math.max(e.x1, e.x2)]
                    : e.art === "text" ? (e.ausrichtung === "links" ? [e.x, e.x + e.breite] : e.ausrichtung === "rechts" ? [e.x - e.breite, e.x] : [e.x - e.breite / 2, e.x + e.breite / 2])
                    : [e.x, e.x + e.b];
                expect(links).toBeGreaterThanOrEqual(25 - 1e-9);
                expect(rechts).toBeLessThanOrEqual(190 + 1e-9);
                const ys = e.art === "linie" ? [e.y1, e.y2] : e.art === "text" ? [e.y] : [e.y, e.y + e.h];
                for (const y of ys) {
                    expect(y).toBeGreaterThanOrEqual(0);
                    expect(y).toBeLessThanOrEqual(292);
                }
            }
        }
    });

    it("setzt lange Aufträge mit Kopf und „(Fortsetzung)“ fort, ohne eine Zeile zu verlieren", () => {
        const woerter = Array.from({ length: 1200 }, (_, index) => `w${index}`);
        const ergebnis = setzeEinsatzauftrag(neuePdf(), { laufendeNummer: "7", auftrag: woerter.join(" ") }, { gestaltung: "allgemein", schriftgroesse: 10 });
        expect(ergebnis.seiten.length).toBeGreaterThan(1);
        const zweite = texte(ergebnis.seiten[1]);
        expect(zweite).toContain("Einsatzauftrag");
        expect(zweite).toContain("Auftrag (Fortsetzung)");
        expect(zweite).toContain(`lfd. Nr. 7 · Seite 2 von ${ergebnis.seiten.length}`);
        const gesetzt = ergebnis.seiten.flatMap(texte).join(" ").split(/\s+/).filter(wort => /^w\d+$/.test(wort));
        expect(gesetzt).toEqual(woerter);
    });

    it("verkleinert die Schrift, wenn der Auftrag so auf eine Seite passt", () => {
        const ergebnis = setzeEinsatzauftrag(neuePdf(), { auftrag: Array(45).fill(satz).join(" ") }, { gestaltung: "allgemein" });
        expect(ergebnis.seiten).toHaveLength(1);
        expect(ergebnis.schriftgroesse).toBeLessThan(10);
        expect(setzeEinsatzauftrag(neuePdf(), { auftrag: Array(45).fill(satz).join(" ") }, { gestaltung: "allgemein", schriftgroesse: 10 }).seiten.length).toBe(2);
    });

    it("setzt das Logo rechts oben", () => {
        const logo = { daten: "data:image/png;base64,AAAA", format: "PNG" as const, breite: 200, hoehe: 100 };
        const seite = setzeEinsatzauftrag(neuePdf(), {}, { gestaltung: "allgemein", logo, organisation: "Feuerwehr" }).seiten[0];
        const bild = seite?.elemente.find(e => e.art === "bild");
        expect(bild).toMatchObject({ art: "bild", format: "PNG" });
        if (bild?.art === "bild") {
            expect(bild.b / bild.h).toBeCloseTo(2);
            expect(bild.x + bild.b).toBeCloseTo(190);
            const organisation = textElemente(seite).find(e => e.text === "Feuerwehr");
            expect(organisation?.x).toBeLessThan(bild.x);
        }
    });

    it("zeichnet bei gleicher Eingabe dieselbe PDF", () => {
        const daten: EinsatzauftragDaten = { einsatz: "Übung", lage: Array(60).fill(satz).join(" ") };
        const inhalt = () => {
            const pdf = neuePdf();
            pdf.setCreationDate(new Date(0));
            pdf.setFileId("00000000000000000000000000000000");
            const ergebnis = zeichneEinsatzauftrag(pdf, daten, { gestaltung: "allgemein" });
            expect(pdf.getNumberOfPages()).toBe(ergebnis.seiten.length);
            return pdf.output();
        };
        const erste = inhalt();
        expect(erste).toContain("Einsatzauftrag");
        expect(inhalt()).toBe(erste);
    });
});

describe("Vordruck mit Freitext", () => {
    it("setzt Lage, Durchführung und Logistik als Zeile ohne Kennung vor die Unterzeilen", () => {
        const seite = setzeEinsatzauftrag(neuePdf(), { lage: "Freie Lage", durchfuehrung: "Freie Durchführung", logistik: "Freie Logistik", unterpunkte: { "1a": "Zeile 1a" } }).seiten[0];
        const y = (text: string) => textElemente(seite).find(e => e.text === text)?.y ?? NaN;
        expect(y("Freie Lage")).toBeGreaterThan(y("1. Lage"));
        expect(y("Freie Lage")).toBeLessThan(y("1a"));
        expect(Math.abs(y("Zeile 1a") - y("1a"))).toBeLessThan(2);
        expect(y("Freie Durchführung")).toBeLessThan(y("3a"));
        expect(y("Freie Logistik")).toBeLessThan(y("4a"));
    });
});

describe("Eigene Schrift", () => {
    it("bettet die Schrift ein, misst mit ihr und setzt Fettes fett", () => {
        const pdf = neuePdf();
        const ergebnis = setzeEinsatzauftrag(pdf, { auftrag: "Deich sichern", laufendeNummer: "3" }, { gestaltung: "allgemein", schriftart });
        const elemente = textElemente(ergebnis.seiten[0]);
        expect(elemente.every(e => e.schrift === "Aptos")).toBe(true);
        expect(elemente.find(e => e.text === "Einsatzauftrag")?.fett).toBe(true);
        // Monospace misst breiter als Helvetica.
        const breite = elemente.find(e => e.text === "Deich sichern")?.breite ?? 0;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        expect(breite).toBeGreaterThan(pdf.getTextWidth("Deich sichern"));
        zeichneEinsatzauftrag(pdf, { auftrag: satz }, { gestaltung: "allgemein", schriftart });
        expect(pdf.output()).toContain("/FontFile2");
        expect(pdf.getFontList()["Aptos"]).toEqual(["normal", "bold"]);
    });

    it("setzt ohne fetten Schnitt alles normal und fällt nicht auf Times zurück", () => {
        const pdf = neuePdf();
        const ergebnis = setzeEinsatzauftrag(pdf, {}, { schriftart: { name: "Nur", normal: schriftart.normal } });
        const elemente = textElemente(ergebnis.seiten[0]);
        expect(elemente.every(e => e.schrift === "Nur" && !e.fett)).toBe(true);
        expect(pdf.getFontList()["Nur"]).toEqual(["normal"]);
    });

    it("registriert je PDF nur einmal und ignoriert leere Angaben", () => {
        const pdf = neuePdf();
        expect(registriereSchrift(pdf, undefined)).toEqual({ name: "helvetica", fett: true });
        expect(registriereSchrift(pdf, { name: " ", normal: "x" })).toEqual({ name: "helvetica", fett: true });
        expect(registriereSchrift(pdf, schriftart)).toEqual({ name: "Aptos", fett: true });
        expect(registriereSchrift(pdf, schriftart)).toEqual({ name: "Aptos", fett: true });
        expect(pdf.getFontList()["Aptos"]).toEqual(["normal", "bold"]);
    });

    it("zeichnet eine gesetzte Seite auf eine andere PDF, wenn die Schrift dort registriert ist", () => {
        const satzPdf = neuePdf();
        const ergebnis = setzeEinsatzauftrag(satzPdf, { auftrag: satz }, { gestaltung: "allgemein", schriftart });
        const ziel = neuePdf();
        registriereSchrift(ziel, schriftart);
        zeichneSeite(ziel, ergebnis.seiten[0] as Seite);
        expect(ziel.output()).toContain("/FontFile2");
    });

    it("gilt auch für den Vordruck", () => {
        const elemente = textElemente(setzeEinsatzauftrag(neuePdf(), { auftrag: satz }, { schriftart }).seiten[0]);
        expect(elemente.every(e => e.schrift === "Aptos")).toBe(true);
        expect(elemente.find(e => e.text === "Einsatzauftrag")?.fett).toBe(true);
    });
});
