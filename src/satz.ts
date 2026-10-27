import type { jsPDF } from "jspdf";
import { ABSCHNITTE, type Abschnitt, type EinsatzauftragDaten } from "./daten.js";
import { kuerzeAufBreite, umbrechen } from "./text.js";

// Satz des Einsatzauftrags: rechnet aus, was wohin kommt, und legt es als
// Liste einfacher Zeichenelemente je Seite ab. Gezeichnet wird erst danach
// (zeichnen.ts); eine Vorschau kann dieselbe Liste anders darstellen.
//
// Die Maße folgen dem Vordruck „Fb Fü 3“ des THW, abgenommen an einem Bild
// des Word-Formulars und auf DIN A4 hoch mit 10 mm Rand umgerechnet. Zeilen
// wachsen mit ihrem Text; reicht eine Seite nicht, geht es auf der nächsten
// weiter, mit dem Kopf und der Kopfzeile des Abschnitts „(Fortsetzung)“.

/** Ein Zeichenelement. Maße in mm von der linken oberen Blattecke. */
export type Element =
    /** Gefüllte Fläche ohne Rand. */
    | { readonly art: "flaeche"; readonly x: number; readonly y: number; readonly b: number; readonly h: number; readonly farbe: string }
    /** Gerade Linie, Stärke in mm. */
    | { readonly art: "linie"; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly staerke: number }
    /**
     * Text in Helvetica. `x`/`y` ist der Ankerpunkt auf der Grundlinie,
     * `groesse` in pt, `breite` die in der PDF gemessene Breite in mm.
     */
    | {
        readonly art: "text";
        readonly text: string;
        readonly x: number;
        readonly y: number;
        readonly groesse: number;
        readonly fett: boolean;
        readonly farbe: string;
        readonly ausrichtung: "links" | "mitte" | "rechts";
        readonly breite: number;
    }
    /** Bild, etwa ein Logo. */
    | {
        readonly art: "bild";
        readonly daten: string | Uint8Array;
        readonly format: "PNG" | "JPEG";
        readonly x: number;
        readonly y: number;
        readonly b: number;
        readonly h: number;
    };

export interface Seite {
    readonly elemente: readonly Element[];
}

/** Logo im rechten Kopffeld. Breite und Höhe in Pixeln, nur fürs Seitenverhältnis. */
export interface EinsatzauftragLogo {
    daten: string | Uint8Array;
    format: "PNG" | "JPEG";
    breite: number;
    hoehe: number;
}

export interface EinsatzauftragOptionen {
    /** Kennung im linken Kopffeld. Standard „Fb Fü 3“. */
    kennung?: string;
    /** Titel im blauen Balken. Standard „Einsatzauftrag“. */
    titel?: string;
    /**
     * Text im rechten Kopffeld, Zeilen mit „\n“ getrennt. Standard
     * „Technisches\nHilfswerk“; leer lässt das Feld frei (oder nur das Logo).
     */
    organisation?: string;
    logo?: EinsatzauftragLogo | undefined;
    /**
     * Schriftgröße der Eintragungen in pt. Ohne Angabe sucht der Satz zwischen
     * 10 und 8 pt die größte, mit der der Auftrag auf möglichst wenige Seiten
     * passt.
     */
    schriftgroesse?: number | undefined;
    /** Kleiner Text links unten am Blattrand, z. B. eine Herkunftsangabe. */
    fusszeile?: string | undefined;
}

export interface Einsatzauftragsatz {
    readonly seiten: readonly Seite[];
    /** Schriftgröße der Eintragungen in pt. */
    readonly schriftgroesse: number;
}

// ---- Maße (mm) -------------------------------------------------------------

export const BLATT_BREITE = 210;
export const BLATT_HOEHE = 297;
const LINKS = 10;
const RECHTS = 200;
const BREITE = RECHTS - LINKS;
const OBEN = 9;
/** Unterkante des Formulars; darunter steht nur noch die Fußzeile. */
const UNTEN = 285;
const FUSS_Y = 291;

const KOPF_HOEHE = 9.7;
const KOPF_KENNUNG = 25.5;
const KOPF_TITEL = 121.7;

/** Abstand der beiden Striche einer Doppellinie. */
const DOPPEL = 0.8;
const STRICH = 0.2;
const STRICH_FEIN = 0.15;

const ADRESSE_BESCHRIFTUNG = 34;
const ADRESSE_LFDNR = 34;
const ADRESSE_MINDESTHOEHEN = [9.2, 13.5, 9] as const;

const KENNUNG_SPALTE = 7.4;
const ZEILE_MIN = 6.4;
const AUFTRAG_MIN = 13;
const ABSCHNITT_KOPF_MIN = 10;
const ERLAEUTERUNG_X = 41.7;

const ABSCHLUSS_OBEN_MIN = 13.5;
const ABSCHLUSS_UNTEN_MIN = 9.7;
/** Spalten der Zeile „Abgesandt“: Beginn von „am/um“, „von“, „Unterschrift:“. */
const ABGESANDT_SPALTEN = [28.4, 87.6, 136.1] as const;
/** Beginn von „Ort, Datum“, „Unterschrift“ und „Dienststelle“. */
const ABSCHLUSS_SPALTEN = [9, 66, 139] as const;

const GELB = "#ffffa6";
const BLAU = "#0000f5";
const SCHWARZ = "#000000";
const GRAU = "#555555";

const PT = 25.4 / 72;
const SCHRIFT_BESCHRIFTUNG = 10;
const SCHRIFT_TITEL = 11;
const SCHRIFT_ERLAEUTERUNG = 8;
const SCHRIFT_KENNUNG = 7;

/** Abstände zwischen den Blöcken: wie im Vordruck, und eng, wenn das eine Seite spart. */
const BLOCKABSTAENDE = [5.5, 2.5] as const;
/** Schriftgrößen der Eintragungen, die die automatische Wahl probiert. */
export const SCHRIFTGROESSEN = [10, 9.5, 9, 8.5, 8] as const;

/** Zeilenabstand in mm für eine Schriftgröße in pt. */
function zeilenhoehe(groesse: number): number {
    return groesse * PT * 1.18;
}

/** Abstand von der Oberkante einer Textzeile bis zur Grundlinie. */
function oberlaenge(groesse: number): number {
    return groesse * PT * 0.86;
}

// ---- Satz ------------------------------------------------------------------

/**
 * Setzt den Einsatzauftrag. Ohne feste Schriftgröße wird die größte gewählt,
 * mit der er auf die geringste mögliche Seitenzahl passt; dabei rücken die
 * Blöcke auch enger zusammen, wenn das eine Seite spart.
 */
export function setzeEinsatzauftrag(pdf: jsPDF, daten: EinsatzauftragDaten, optionen: EinsatzauftragOptionen = {}): Einsatzauftragsatz {
    const vorher = { schrift: pdf.getFont(), groesse: pdf.getFontSize() };
    try {
        const groessen = optionen.schriftgroesse ? [optionen.schriftgroesse] : SCHRIFTGROESSEN;
        const versuche: Einsatzauftragsatz[] = [];
        for (const groesse of groessen) {
            for (const abstand of BLOCKABSTAENDE) {
                const seiten = new Setzer(pdf, daten, optionen, groesse, abstand).setze().map(elemente => ({ elemente }));
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

interface Textzeilen {
    /** Kennung in der linken Spalte, z. B. „1a“; leer bei freien Zeilen. */
    kennung: string;
    zeilen: string[];
    mindesthoehe: number;
}

class Setzer {
    private readonly seiten: Element[][] = [];
    private elemente: Element[] = [];
    private y = OBEN;
    private readonly zeile: number;
    private readonly polster: number;

    constructor(
        private readonly pdf: jsPDF,
        private readonly daten: EinsatzauftragDaten,
        private readonly optionen: EinsatzauftragOptionen,
        private readonly schrift: number,
        private readonly abstand: number
    ) {
        this.zeile = zeilenhoehe(schrift);
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

    // ---- Grundbausteine ----

    private neueSeite(): void {
        this.elemente = [];
        this.seiten.push(this.elemente);
        this.y = OBEN;
        this.kopf();
        this.y += KOPF_HOEHE + this.abstand;
    }

    private text(text: string, x: number, y: number, groesse: number, {
        fett = false,
        farbe = SCHWARZ,
        ausrichtung = "links"
    }: { fett?: boolean; farbe?: string; ausrichtung?: "links" | "mitte" | "rechts" } = {}): void {
        if (!text) {
            return;
        }
        this.pdf.setFont("helvetica", fett ? "bold" : "normal");
        this.pdf.setFontSize(groesse);
        this.elemente.push({ art: "text", text, x, y, groesse, fett, farbe, ausrichtung, breite: this.pdf.getTextWidth(text) });
    }

    private linie(x1: number, y1: number, x2: number, y2: number, staerke = STRICH): void {
        this.elemente.push({ art: "linie", x1, y1, x2, y2, staerke });
    }

    private doppellinie(y: number): void {
        this.linie(LINKS, y, RECHTS, y, STRICH_FEIN);
        this.linie(LINKS, y + DOPPEL, RECHTS, y + DOPPEL, STRICH_FEIN);
    }

    /** Text der Eintragungen umbrechen. */
    private umbrich(text: string | undefined, breite: number, groesse = this.schrift): string[] {
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(groesse);
        return umbrechen(this.pdf, text ?? "", breite);
    }

    /** Mehrere Zeilen ab der Grundlinie `y` setzen. */
    private zeilen(zeilen: readonly string[], x: number, y: number): void {
        zeilen.forEach((zeile, index) => this.text(zeile, x, y + index * this.zeile, this.schrift));
    }

    /**
     * Einzeiliger Wert: verkleinert bis 6 pt, dann mit „…“ gekürzt, damit er
     * nicht ins Nachbarfeld läuft.
     */
    private einzeilig(text: string | undefined, x: number, y: number, breite: number, groesse = this.schrift, fett = false): void {
        const wert = (text ?? "").replace(/\s+/g, " ").trim();
        if (!wert) {
            return;
        }
        this.pdf.setFont("helvetica", fett ? "bold" : "normal");
        let aktuell = groesse;
        this.pdf.setFontSize(aktuell);
        while (this.pdf.getTextWidth(wert) > breite && aktuell > 6) {
            aktuell = Math.max(6, aktuell - 0.25);
            this.pdf.setFontSize(aktuell);
        }
        this.text(kuerzeAufBreite(this.pdf, wert, breite), x, y, aktuell, { fett });
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
            this.linie(LINKS, y, RECHTS, y);
        }
        for (const x of [LINKS, titelLinks, titelRechts, RECHTS]) {
            this.linie(x, oben, x, unten);
        }
        this.einzeiligMitte(this.optionen.kennung ?? "Fb Fü 3", LINKS + KOPF_KENNUNG / 2, mitte, KOPF_KENNUNG - 2, SCHWARZ);
        this.einzeiligMitte(this.optionen.titel ?? "Einsatzauftrag", titelLinks + KOPF_TITEL / 2, mitte, KOPF_TITEL - 4, "#ffffff");
        this.organisation(titelRechts, oben, RECHTS - titelRechts);
    }

    private einzeiligMitte(text: string, x: number, y: number, breite: number, farbe: string): void {
        this.pdf.setFont("helvetica", "bold");
        let groesse = SCHRIFT_TITEL;
        this.pdf.setFontSize(groesse);
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
        this.pdf.setFont("helvetica", "bold");
        let groesse = zeilen.length > 2 ? 8 : 11;
        this.pdf.setFontSize(groesse);
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
                this.linie(LINKS, y, RECHTS, y);
            }
            this.text(zeile.beschriftung, LINKS + 1.5, grund(y), SCHRIFT_BESCHRIFTUNG);
            this.zeilen(zeile.zeilen, wertX, grund(y));
            if (index === 1) {
                this.linie(lfdLinks, y, lfdLinks, y + hoehe);
                this.text("lfd. Nr.:", lfdLinks + 1.5, grund(y), SCHRIFT_BESCHRIFTUNG);
                this.einzeilig(this.daten.laufendeNummer, lfdLinks + 1.5, grund(y) + this.zeile + 1, ADRESSE_LFDNR - 3, this.schrift + 1, true);
            }
            y += hoehe;
        });
        this.linie(LINKS + ADRESSE_BESCHRIFTUNG, oben + DOPPEL, LINKS + ADRESSE_BESCHRIFTUNG, y);
        this.doppellinie(y);
        this.linie(LINKS, oben, LINKS, y + DOPPEL);
        this.linie(RECHTS, oben, RECHTS, y + DOPPEL);
        this.y = y + DOPPEL + this.abstand;
    }

    // ---- Abschnitte 1–5 ----

    private textzeilen(abschnitt: Abschnitt): Textzeilen[] {
        const breite = BREITE - KENNUNG_SPALTE - 3;
        if (abschnitt.unterpunkte.length > 0) {
            return abschnitt.unterpunkte.map(punkt => ({
                kennung: punkt.kennung,
                zeilen: this.umbrich(this.daten.unterpunkte?.[punkt.kennung], breite),
                mindesthoehe: ZEILE_MIN
            }));
        }
        if (abschnitt.nummer === 2) {
            return [{ kennung: "", zeilen: this.umbrich(this.daten.auftrag, breite), mindesthoehe: AUFTRAG_MIN }];
        }
        // Abschnitt 5: jede Textzeile in eine Formularzeile, mindestens zwei.
        const absaetze = String(this.daten.fuehrung ?? "").replace(/\\n/g, "\n").split(/\r?\n/).map(absatz => absatz.trim()).filter(Boolean);
        while (absaetze.length < 2) {
            absaetze.push("");
        }
        return absaetze.map(absatz => ({ kennung: "", zeilen: this.umbrich(absatz, breite), mindesthoehe: ZEILE_MIN }));
    }

    private zeilenhoehe(zeilen: number, mindesthoehe: number): number {
        return Math.max(mindesthoehe, zeilen * this.zeile + 2 * this.polster);
    }

    private abschnitt(abschnitt: Abschnitt): void {
        const offen = this.textzeilen(abschnitt);
        let fortsetzung = false;
        while (offen.length > 0) {
            const kopf = this.abschnittKopfhoehe(abschnitt, fortsetzung);
            const erste = offen[0] as Textzeilen;
            // Kopfzeile nie allein am Seitenende: Mit ihr muss die erste Zeile
            // (oder bei langem Text deren erste zwei Zeilen) noch passen.
            const mindestens = this.zeilenhoehe(Math.min(2, erste.zeilen.length), erste.mindesthoehe);
            if (this.y + DOPPEL + kopf + mindestens + DOPPEL > UNTEN && this.y > OBEN + KOPF_HOEHE + this.abstand + 0.01) {
                this.neueSeite();
            }
            const oben = this.y;
            this.doppellinie(oben);
            this.abschnittKopf(abschnitt, oben + DOPPEL, kopf, fortsetzung);
            let y = oben + DOPPEL + kopf;
            const zeilenOben = y;
            let gesetzt = 0;
            while (offen.length > 0) {
                const zeile = offen[0] as Textzeilen;
                const hoehe = this.zeilenhoehe(zeile.zeilen.length, zeile.mindesthoehe);
                if (y + hoehe + DOPPEL <= UNTEN) {
                    this.textzeile(zeile, y);
                    y += hoehe;
                    gesetzt++;
                    offen.shift();
                    continue;
                }
                // Zeile passt nicht ganz: teilen, wenn auf dieser Seite noch
                // mindestens zwei Textzeilen Platz haben (auf einer frischen
                // Seite auch eine), sonst als Ganzes auf die nächste Seite.
                const passen = Math.floor((UNTEN - DOPPEL - y - 2 * this.polster) / this.zeile);
                const mindestTeil = gesetzt === 0 ? 1 : 2;
                if (passen >= mindestTeil && zeile.zeilen.length > passen) {
                    const teil = { ...zeile, zeilen: zeile.zeilen.slice(0, passen) };
                    const teilhoehe = this.zeilenhoehe(passen, 0);
                    this.textzeile(teil, y);
                    y += teilhoehe;
                    zeile.zeilen = zeile.zeilen.slice(passen);
                    zeile.mindesthoehe = ZEILE_MIN;
                }
                break;
            }
            this.linie(LINKS + KENNUNG_SPALTE, zeilenOben, LINKS + KENNUNG_SPALTE, y);
            this.doppellinie(y);
            this.linie(LINKS, oben, LINKS, y + DOPPEL);
            this.linie(RECHTS, oben, RECHTS, y + DOPPEL);
            this.y = y + DOPPEL + this.abstand;
            if (offen.length > 0) {
                this.neueSeite();
                fortsetzung = true;
            }
        }
    }

    private abschnittKopfZeilen(abschnitt: Abschnitt): string[] {
        const x = this.erlaeuterungX(abschnitt);
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(SCHRIFT_ERLAEUTERUNG);
        return this.pdf.splitTextToSize(abschnitt.erlaeuterung, RECHTS - 1.5 - x) as string[];
    }

    /** Die Erläuterung beginnt bündig wie im Vordruck, bei langem Titel dahinter. */
    private erlaeuterungX(abschnitt: Abschnitt): number {
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(SCHRIFT_TITEL);
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
        this.linie(LINKS, oben, RECHTS, oben);
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
            this.linie(LINKS, y, RECHTS, y);
        }
        this.linie(LINKS, oben, LINKS, unten);
        this.linie(RECHTS, oben, RECHTS, unten);

        ["Ort, Datum", "Unterschrift", "Dienststelle"].forEach((beschriftung, index) => {
            const x = spalten[index] as number;
            this.text(beschriftung, x, oben + beschriftungY, 9);
            this.zeilen(felder[index] ?? [], x, oben + wertOben + oberlaenge(this.schrift));
        });

        const [am, von, unterschrift] = ABGESANDT_SPALTEN.map(x => LINKS + x) as [number, number, number];
        for (const x of [am, von, unterschrift]) {
            this.linie(x, mitte, x, unten);
        }
        const grundlinie = mitte + ABSCHLUSS_UNTEN_MIN / 2 + SCHRIFT_BESCHRIFTUNG * PT * 0.35;
        const um = am + 29.5;
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

    // ---- Blattrand ----

    private fusszeilen(): void {
        const anzahl = this.seiten.length;
        const nummer = (this.daten.laufendeNummer ?? "").replace(/\s+/g, " ").trim();
        this.seiten.forEach((seite, index) => {
            this.elemente = seite;
            const rechts = [nummer ? `lfd. Nr. ${nummer}` : "", `Seite ${index + 1} von ${anzahl}`].filter(Boolean).join(" · ");
            this.pdf.setFont("helvetica", "normal");
            this.pdf.setFontSize(7);
            const rechtsText = kuerzeAufBreite(this.pdf, rechts, BREITE / 2);
            this.text(rechtsText, RECHTS, FUSS_Y, 7, { farbe: GRAU, ausrichtung: "rechts" });
            const fuss = (this.optionen.fusszeile ?? "").replace(/\s+/g, " ").trim();
            if (fuss) {
                this.pdf.setFontSize(7);
                this.text(kuerzeAufBreite(this.pdf, fuss, BREITE - this.pdf.getTextWidth(rechtsText) - 5), LINKS, FUSS_Y, 7, { farbe: GRAU });
            }
        });
    }
}
