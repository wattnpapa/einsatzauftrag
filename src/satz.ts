import type { jsPDF } from "jspdf";
import { ABSCHNITTE, type Abschnitt, type EinsatzauftragDaten } from "./daten.js";
import { BREITE, LINKS, PT, RECHTS, SCHRIFTGROESSEN, SCHWARZ, oberlaenge, zeilenhoehe, type Element } from "./elemente.js";
import { Grundsetzer, type Textzeilen } from "./grundsetzer.js";
import type { EinsatzauftragOptionen, Einsatzauftragsatz } from "./optionen.js";
import { AllgemeinSetzer } from "./satzAllgemein.js";
import { registriereSchrift, type Satzschrift } from "./schrift.js";
import { fuerPdf, kuerzeAufBreite } from "./text.js";

// Satz des Einsatzauftrags: rechnet aus, was wohin kommt, und legt es als
// Liste einfacher Zeichenelemente je Seite ab. Gezeichnet wird erst danach
// (zeichnen.ts); eine Vorschau kann dieselbe Liste anders darstellen.
//
// Hier steht der Vordruck „Fb Fü 3“ des THW, abgenommen an einem Bild des
// Word-Formulars und auf DIN A4 hoch umgerechnet. Zeilen wachsen mit ihrem
// Text; reicht eine Seite nicht, geht es auf der nächsten weiter, mit dem Kopf
// und der Kopfzeile des Abschnitts „(Fortsetzung)“. Die Gestaltung „allgemein“
// steht in satzAllgemein.ts.

export { BLATT_BREITE, BLATT_HOEHE, SCHRIFTGROESSEN, type Element, type Seite } from "./elemente.js";
export type { EinsatzauftragLogo, EinsatzauftragOptionen, Einsatzauftragsatz } from "./optionen.js";

// ---- Maße (mm) -------------------------------------------------------------

/**
 * Waagerechte Maße sind am Vordruck mit 190 mm Breite abgenommen und werden
 * auf die Breite zwischen den Rändern umgerechnet.
 */
const QUER = BREITE / 190;
const OBEN = 9;
/** Unterkante des Formulars; darunter steht nur noch die Fußzeile. */
const UNTEN = 285;

const KOPF_HOEHE = 9.7;
const KOPF_KENNUNG = 25.5 * QUER;
const KOPF_TITEL = 121.7 * QUER;

/** Abstand der beiden Striche einer Doppellinie. */
const DOPPEL = 0.8;
const STRICH = 0.2;
const STRICH_FEIN = 0.15;

const ADRESSE_BESCHRIFTUNG = 30;
const ADRESSE_LFDNR = 30;
const ADRESSE_MINDESTHOEHEN = [9.2, 13.5, 9] as const;

const KENNUNG_SPALTE = 7.4;
const ZEILE_MIN = 6.4;
const AUFTRAG_MIN = 13;
const ABSCHNITT_KOPF_MIN = 10;
const ERLAEUTERUNG_X = 41.7 * QUER;

const ABSCHLUSS_OBEN_MIN = 13.5;
const ABSCHLUSS_UNTEN_MIN = 9.7;
/** Spalten der Zeile „Abgesandt“: Beginn von „am/um“, „von“, „Unterschrift:“. */
const ABGESANDT_SPALTEN = [28.4 * QUER, 87.6 * QUER, 136.1 * QUER] as const;
/** Beginn von „Ort, Datum“, „Unterschrift“ und „Dienststelle“. */
const ABSCHLUSS_SPALTEN = [9 * QUER, 66 * QUER, 139 * QUER] as const;

const GELB = "#ffffa6";
const BLAU = "#0000f5";

const SCHRIFT_BESCHRIFTUNG = 10;
const SCHRIFT_TITEL = 11;
const SCHRIFT_ERLAEUTERUNG = 8;
const SCHRIFT_KENNUNG = 7;

/** Abstände zwischen den Blöcken: wie im Vordruck, und eng, wenn das eine Seite spart. */
const BLOCKABSTAENDE = [5.5, 2.5] as const;

// ---- Satz ------------------------------------------------------------------

/**
 * Setzt den Einsatzauftrag in der gewählten Gestaltung. Ohne feste
 * Schriftgröße wird die größte gewählt, mit der er auf die geringste mögliche
 * Seitenzahl passt; dabei rücken die Blöcke auch enger zusammen, wenn das
 * eine Seite spart.
 */
export function setzeEinsatzauftrag(pdf: jsPDF, daten: EinsatzauftragDaten, optionen: EinsatzauftragOptionen = {}): Einsatzauftragsatz {
    const vorher = { schrift: pdf.getFont(), groesse: pdf.getFontSize() };
    daten = druckbareDaten(daten);
    optionen = {
        ...optionen,
        ...(optionen.kennung !== undefined ? { kennung: fuerPdf(optionen.kennung) } : {}),
        ...(optionen.titel !== undefined ? { titel: fuerPdf(optionen.titel) } : {}),
        ...(optionen.organisation !== undefined ? { organisation: fuerPdf(optionen.organisation) } : {}),
        ...(optionen.fusszeile ? { fusszeile: fuerPdf(optionen.fusszeile) } : {})
    };
    try {
        const schriftart = registriereSchrift(pdf, optionen.schriftart);
        const groessen = optionen.schriftgroesse ? [optionen.schriftgroesse] : SCHRIFTGROESSEN;
        const versuche: Einsatzauftragsatz[] = [];
        for (const groesse of groessen) {
            for (const abstand of BLOCKABSTAENDE) {
                const setzer = optionen.gestaltung === "allgemein"
                    ? new AllgemeinSetzer(pdf, daten, optionen, schriftart, groesse, abstand)
                    : new VordruckSetzer(pdf, daten, optionen, schriftart, groesse, abstand);
                const seiten = setzer.setze().map(elemente => ({ elemente }));
                versuche.push({ seiten, schriftgroesse: groesse });
                // Passt es auf eine Seite, ist die größte Schrift gefunden.
                if (seiten.length === 1) {
                    return versuche[versuche.length - 1] as Einsatzauftragsatz;
                }
            }
        }
        const wenigste = Math.min(...versuche.map(versuch => versuch.seiten.length));
        return versuche.find(versuch => versuch.seiten.length === wenigste) as Einsatzauftragsatz;
    } finally {
        pdf.setFont(vorher.schrift.fontName, vorher.schrift.fontStyle);
        pdf.setFontSize(vorher.groesse);
    }
}

/** Alle Texte der Daten durch `fuerPdf`, damit Messen und Zeichnen dieselben Zeichen sehen. */
function druckbareDaten(daten: EinsatzauftragDaten): EinsatzauftragDaten {
    const ergebnis: EinsatzauftragDaten = {};
    for (const [schluessel, wert] of Object.entries(daten) as [keyof EinsatzauftragDaten, unknown][]) {
        if (typeof wert === "string") {
            (ergebnis as Record<string, unknown>)[schluessel] = fuerPdf(wert);
        } else if (wert && typeof wert === "object") {
            (ergebnis as Record<string, unknown>)[schluessel] = Object.fromEntries(Object.entries(wert as Record<string, unknown>)
                .map(([punkt, text]) => [punkt, typeof text === "string" ? fuerPdf(text) : text]));
        }
    }
    return ergebnis;
}

/** Abschnitt 5 (und jeder Freitext des Vordrucks): eine Leerzeile beginnt eine neue Formularzeile. */
export function formularzeilen(text: string | undefined): string[] {
    return String(text ?? "").replace(/\\n/g, "\n").replace(/\r\n?/g, "\n")
        .split(/\n[ \t]*\n/).map(absatz => absatz.replace(/^\s*\n|\n\s*$/g, "").trimEnd()).filter(absatz => absatz.trim() !== "");
}

class VordruckSetzer extends Grundsetzer {
    constructor(pdf: jsPDF, daten: EinsatzauftragDaten, optionen: EinsatzauftragOptionen, schriftart: Satzschrift, schrift: number, abstand: number) {
        super(pdf, daten, optionen, schriftart, schrift, abstand);
        this.polster = (ZEILE_MIN - zeilenhoehe(SCHRIFTGROESSEN[0])) / 2;
    }

    setze(): Element[][] {
        this.neueSeite();
        this.adresse();
        for (const abschnitt of ABSCHNITTE) {
            this.abschnitt(abschnitt);
        }
        this.abschluss();
        this.fusszeilen();
        return this.seiten;
    }

    protected neueSeite(): void {
        this.beginneSeite();
        this.y = OBEN;
        this.kopf();
        this.y += KOPF_HOEHE + this.abstand;
        this.seitenanfang = this.y;
    }

    private strich(x1: number, y1: number, x2: number, y2: number, staerke = STRICH): void {
        this.linie(x1, y1, x2, y2, staerke, SCHWARZ);
    }

    private doppellinie(y: number): void {
        this.strich(LINKS, y, RECHTS, y, STRICH_FEIN);
        this.strich(LINKS, y + DOPPEL, RECHTS, y + DOPPEL, STRICH_FEIN);
    }

    // ---- Kopf ----

    private kopf(): void {
        const oben = this.y;
        const unten = oben + KOPF_HOEHE;
        const mitte = oben + KOPF_HOEHE / 2 + SCHRIFT_TITEL * PT * 0.35;
        const titelLinks = LINKS + KOPF_KENNUNG;
        const titelRechts = titelLinks + KOPF_TITEL;

        this.elemente.push({ art: "flaeche", x: titelLinks, y: oben, b: KOPF_TITEL, h: KOPF_HOEHE, farbe: BLAU });
        for (const y of [oben, unten]) {
            this.strich(LINKS, y, RECHTS, y);
        }
        for (const x of [LINKS, titelLinks, titelRechts, RECHTS]) {
            this.strich(x, oben, x, unten);
        }
        this.einzeiligMitte(this.optionen.kennung ?? "Fb Fü 3", LINKS + KOPF_KENNUNG / 2, mitte, KOPF_KENNUNG - 2, SCHWARZ);
        this.einzeiligMitte(this.optionen.titel ?? "Einsatzauftrag", titelLinks + KOPF_TITEL / 2, mitte, KOPF_TITEL - 4, "#ffffff");
        this.organisation(titelRechts, oben, RECHTS - titelRechts);
    }

    private einzeiligMitte(text: string, x: number, y: number, breite: number, farbe: string): void {
        let groesse = SCHRIFT_TITEL;
        this.waehleSchrift(groesse, true);
        while (this.pdf.getTextWidth(text) > breite && groesse > 6) {
            groesse -= 0.25;
            this.pdf.setFontSize(groesse);
        }
        this.text(kuerzeAufBreite(this.pdf, text, breite), x, y, groesse, { fett: true, farbe, ausrichtung: "mitte" });
    }

    /** Rechtes Kopffeld: Organisation in Blau, rechts daneben das Logo. */
    private organisation(links: number, oben: number, breite: number): void {
        const rand = 1;
        const logo = this.optionen.logo;
        let textRechts = links + breite - rand * 1.5;
        if (logo && logo.breite > 0 && logo.hoehe > 0) {
            const h = KOPF_HOEHE - 2 * rand;
            const b = Math.min(breite - 2 * rand, h * logo.breite / logo.hoehe);
            const hoehe = b * logo.hoehe / logo.breite;
            const x = links + breite - rand - b;
            this.elemente.push({ art: "bild", daten: logo.daten, format: logo.format, x, y: oben + (KOPF_HOEHE - hoehe) / 2, b, h: hoehe });
            textRechts = x - rand;
        }
        const zeilen = (this.optionen.organisation ?? "Technisches\nHilfswerk").split(/\r?\n|\\n/).map(z => z.trim()).filter(Boolean).slice(0, 3);
        if (zeilen.length === 0) {
            return;
        }
        const verfuegbar = textRechts - links - rand * 1.5;
        if (verfuegbar < 5) {
            return;
        }
        let groesse = zeilen.length > 2 ? 8 : 11;
        this.waehleSchrift(groesse, true);
        while (Math.max(...zeilen.map(z => this.pdf.getTextWidth(z))) > verfuegbar && groesse > 6) {
            groesse -= 0.25;
            this.pdf.setFontSize(groesse);
        }
        const abstand = groesse * PT * 1.05;
        const erste = oben + KOPF_HOEHE / 2 - (zeilen.length - 1) * abstand / 2 + groesse * PT * 0.35;
        // Ohne Logo mittig im Feld, mit Logo rechtsbündig daneben.
        const mittig = textRechts === links + breite - rand * 1.5;
        zeilen.forEach((zeile, index) => {
            const text = kuerzeAufBreite(this.pdf, zeile, verfuegbar);
            this.text(text, mittig ? links + breite / 2 : textRechts, erste + index * abstand, groesse,
                { fett: true, farbe: BLAU, ausrichtung: mittig ? "mitte" : "rechts" });
        });
    }

    // ---- Absender, Einsatz, Empfänger ----

    private adresse(): void {
        const wertX = LINKS + ADRESSE_BESCHRIFTUNG + 1.5;
        const lfdLinks = RECHTS - ADRESSE_LFDNR;
        const zeilen = [
            { beschriftung: "Absender", zeilen: this.umbrich(this.daten.absender, RECHTS - wertX - 1.5) },
            { beschriftung: "für den Einsatz", zeilen: this.umbrich(this.daten.einsatz, lfdLinks - wertX - 1.5) },
            { beschriftung: "Empfänger", zeilen: this.umbrich(this.daten.empfaenger, RECHTS - wertX - 1.5) }
        ];
        const hoehen = zeilen.map((zeile, index) =>
            Math.max(ADRESSE_MINDESTHOEHEN[index] ?? ZEILE_MIN, zeile.zeilen.length * this.zeile + 2 * this.polster));

        const oben = this.y;
        this.doppellinie(oben);
        let y = oben + DOPPEL;
        const grund = (zeilenOben: number) => zeilenOben + this.polster + oberlaenge(this.schrift);
        zeilen.forEach((zeile, index) => {
            const hoehe = hoehen[index] ?? 0;
            if (index > 0) {
                this.strich(LINKS, y, RECHTS, y);
            }
            this.text(zeile.beschriftung, LINKS + 1.5, grund(y), SCHRIFT_BESCHRIFTUNG);
            this.zeilen(zeile.zeilen, wertX, grund(y));
            if (index === 1) {
                this.strich(lfdLinks, y, lfdLinks, y + hoehe);
                this.text("lfd. Nr.:", lfdLinks + 1.5, grund(y), SCHRIFT_BESCHRIFTUNG);
                this.einzeilig(this.daten.laufendeNummer, lfdLinks + 1.5, grund(y) + this.zeile + 1, ADRESSE_LFDNR - 3, this.schrift + 1, true);
            }
            y += hoehe;
        });
        this.strich(LINKS + ADRESSE_BESCHRIFTUNG, oben + DOPPEL, LINKS + ADRESSE_BESCHRIFTUNG, y);
        this.doppellinie(y);
        this.strich(LINKS, oben, LINKS, y + DOPPEL);
        this.strich(RECHTS, oben, RECHTS, y + DOPPEL);
        this.y = y + DOPPEL + this.abstand;
    }

    // ---- Abschnitte 1–5 ----

    private textzeilen(abschnitt: Abschnitt): Textzeilen[] {
        const breite = BREITE - KENNUNG_SPALTE - 3;
        if (abschnitt.unterpunkte.length > 0) {
            // Freitext der Gestaltung „allgemein“ steht als Zeile ohne Kennung vor den Unterzeilen.
            const frei = this.umbrich(this.daten[abschnitt.freitext], breite);
            return [
                ...(frei.length > 0 ? [{ kennung: "", zeilen: frei, mindesthoehe: ZEILE_MIN }] : []),
                ...abschnitt.unterpunkte.map(punkt => ({
                    kennung: punkt.kennung,
                    zeilen: this.umbrich(this.daten.unterpunkte?.[punkt.kennung], breite),
                    mindesthoehe: ZEILE_MIN
                }))
            ];
        }
        if (abschnitt.nummer === 2) {
            return [{ kennung: "", zeilen: this.umbrich(this.daten.auftrag, breite), mindesthoehe: AUFTRAG_MIN }];
        }
        // Abschnitt 5: Zeilenumbrüche bleiben in der Zelle wie bei 3c; erst eine
        // Leerzeile beginnt eine neue Formularzeile. Mindestens zwei wie im Vordruck.
        const absaetze = formularzeilen(this.daten.fuehrung);
        while (absaetze.length < 2) {
            absaetze.push("");
        }
        return absaetze.map(absatz => ({ kennung: "", zeilen: this.umbrich(absatz, breite), mindesthoehe: ZEILE_MIN }));
    }

    private abschnitt(abschnitt: Abschnitt): void {
        this.fliesse(this.textzeilen(abschnitt), {
            rand: DOPPEL,
            unten: UNTEN,
            restMindesthoehe: ZEILE_MIN,
            kopfhoehe: fortsetzung => this.abschnittKopfhoehe(abschnitt, fortsetzung),
            kopf: (oben, hoehe, fortsetzung) => {
                this.doppellinie(oben - DOPPEL);
                this.abschnittKopf(abschnitt, oben, hoehe, fortsetzung);
            },
            zeile: (zeile, oben) => this.textzeile(zeile, oben),
            rahmen: (oben, zeilenOben, unten) => {
                this.strich(LINKS + KENNUNG_SPALTE, zeilenOben, LINKS + KENNUNG_SPALTE, unten);
                this.doppellinie(unten);
                this.strich(LINKS, oben, LINKS, unten + DOPPEL);
                this.strich(RECHTS, oben, RECHTS, unten + DOPPEL);
            }
        });
    }

    private abschnittKopfZeilen(abschnitt: Abschnitt): string[] {
        const x = this.erlaeuterungX(abschnitt);
        this.waehleSchrift(SCHRIFT_ERLAEUTERUNG);
        return this.pdf.splitTextToSize(abschnitt.erlaeuterung, RECHTS - 1.5 - x) as string[];
    }

    /** Die Erläuterung beginnt bündig wie im Vordruck, bei langem Titel dahinter. */
    private erlaeuterungX(abschnitt: Abschnitt): number {
        this.waehleSchrift(SCHRIFT_TITEL, true);
        const titelEnde = LINKS + 1.5 + this.pdf.getTextWidth(`${abschnitt.nummer}. ${abschnitt.titel}`);
        return Math.max(LINKS + ERLAEUTERUNG_X, titelEnde + 5);
    }

    private abschnittKopfhoehe(abschnitt: Abschnitt, fortsetzung: boolean): number {
        if (fortsetzung) {
            return ZEILE_MIN + 1;
        }
        const zeilen = this.abschnittKopfZeilen(abschnitt).length;
        return Math.max(ABSCHNITT_KOPF_MIN, 4.6 + (zeilen - 1) * SCHRIFT_ERLAEUTERUNG * PT * 1.15 + 3);
    }

    private abschnittKopf(abschnitt: Abschnitt, oben: number, hoehe: number, fortsetzung: boolean): void {
        this.elemente.push({ art: "flaeche", x: LINKS, y: oben, b: BREITE, h: hoehe, farbe: GELB });
        this.text(`${abschnitt.nummer}. ${abschnitt.titel}${fortsetzung ? " (Fortsetzung)" : ""}`, LINKS + 1.5, oben + 5.2, SCHRIFT_TITEL, { fett: true });
        if (!fortsetzung) {
            const x = this.erlaeuterungX(abschnitt);
            this.abschnittKopfZeilen(abschnitt).forEach((zeile, index) =>
                this.text(zeile, x, oben + 4.4 + index * SCHRIFT_ERLAEUTERUNG * PT * 1.15, SCHRIFT_ERLAEUTERUNG));
        }
    }

    private textzeile(zeile: Textzeilen, oben: number): void {
        this.strich(LINKS, oben, RECHTS, oben);
        this.text(zeile.kennung, LINKS + 0.8, oben + 2.9, SCHRIFT_KENNUNG);
        this.zeilen(zeile.zeilen, LINKS + KENNUNG_SPALTE + 1.5, oben + this.polster + oberlaenge(this.schrift));
    }

    // ---- Unterschrift und Abgesandt ----

    private abschluss(): void {
        const spalten = ABSCHLUSS_SPALTEN.map(x => LINKS + x);
        const grenzen = [spalten[1] as number, spalten[2] as number, RECHTS - 1.5];
        const felder = [this.daten.ortDatum, this.daten.unterschrift, this.daten.dienststelle]
            .map((wert, index) => this.umbrich(wert, (grenzen[index] as number) - (spalten[index] as number) - 2));
        const beschriftungY = 3.6;
        const wertOben = beschriftungY + 1.4;
        const obenHoehe = Math.max(ABSCHLUSS_OBEN_MIN, wertOben + Math.max(...felder.map(f => f.length)) * this.zeile + this.polster);
        const gesamt = obenHoehe + ABSCHLUSS_UNTEN_MIN;
        if (this.y + gesamt > UNTEN) {
            this.neueSeite();
        }
        const oben = this.y;
        const mitte = oben + obenHoehe;
        const unten = mitte + ABSCHLUSS_UNTEN_MIN;

        for (const y of [oben, mitte, unten]) {
            this.strich(LINKS, y, RECHTS, y);
        }
        this.strich(LINKS, oben, LINKS, unten);
        this.strich(RECHTS, oben, RECHTS, unten);

        ["Ort, Datum", "Unterschrift", "Dienststelle"].forEach((beschriftung, index) => {
            const x = spalten[index] as number;
            this.text(beschriftung, x, oben + beschriftungY, 9);
            this.zeilen(felder[index] ?? [], x, oben + wertOben + oberlaenge(this.schrift));
        });

        const [am, von, unterschrift] = ABGESANDT_SPALTEN.map(x => LINKS + x) as [number, number, number];
        for (const x of [am, von, unterschrift]) {
            this.strich(x, mitte, x, unten);
        }
        const grundlinie = mitte + ABSCHLUSS_UNTEN_MIN / 2 + SCHRIFT_BESCHRIFTUNG * PT * 0.35;
        const um = am + 29.5 * QUER;
        this.text("Abgesandt", LINKS + 1.5, grundlinie, SCHRIFT_BESCHRIFTUNG);
        this.text("am", am + 1.5, grundlinie, SCHRIFT_BESCHRIFTUNG);
        this.text("um", um, grundlinie, SCHRIFT_BESCHRIFTUNG);
        this.text("von", von + 1.5, grundlinie, SCHRIFT_BESCHRIFTUNG);
        this.text("Unterschrift:", unterschrift + 1.5, grundlinie, SCHRIFT_BESCHRIFTUNG);
        this.einzeilig(this.daten.abgesandtAm, am + 7, grundlinie, um - am - 8);
        this.einzeilig(this.daten.abgesandtUm, um + 6, grundlinie, von - um - 7);
        this.einzeilig(this.daten.abgesandtVon, von + 8.5, grundlinie, unterschrift - von - 10);
        this.y = unten;
    }
}
