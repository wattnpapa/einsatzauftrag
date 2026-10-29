import type { jsPDF } from "jspdf";
import { ABSCHNITTE, type Abschnitt, type EinsatzauftragDaten } from "./daten.js";
import { BREITE, GRAU, LINKS, PT, RECHTS, oberlaenge, type Element } from "./elemente.js";
import { Grundsetzer, type Textzeilen } from "./grundsetzer.js";
import type { EinsatzauftragOptionen } from "./optionen.js";
import type { Satzschrift } from "./schrift.js";
import { kuerzeAufBreite } from "./text.js";

// Gestaltung „allgemein“ für Stellen außerhalb des THW: kein Vordruck, kein
// Kasten. Schwarzer Text, eine Leitfarbe (Rot) für Titel, Linien und die
// Nummern der Abschnitte, die fünf Abschnitte Lage, Auftrag, Durchführung,
// Logistik, Führung und Verbindung als Freitext. Gefüllte Unterzeilen des
// Vordrucks (1a …) stehen mit ihrer Kennung unter dem Freitext, damit nichts
// verloren geht, wenn die Daten aus einer THW-Tabelle kommen.

const OBEN = 16;
const UNTEN = 280;

/** Höhe des Kopfs (Titel, Organisation, Logo) auf der ersten und auf Folgeseiten. */
const KOPF_HOEHE = 13;
const KOPF_HOEHE_FORTSETZUNG = 8;
const KOPF_LINIE = 0.8;

/** Beschriftungen stehen links vom Wert; Abschnittstext ist um die Nummernspalte eingerückt. */
const BESCHRIFTUNG_BREITE = 19;
const SPALTE_RECHTS = 104;
const META_ZEILE_MIN = 7;
const EINZUG = 8;

const ABSCHNITT_KOPF = 7.5;
const ABSCHNITT_LINIE = 0.3;
/** Platz für Handschrift, wenn ein Abschnitt leer bleibt. */
const LEER_MIN = 12;
const AUFTRAG_LEER_MIN = 16;

const UNTERSCHRIFT_MIN = 12;
const UNTERSCHRIFT_SPALTEN = [0, 57, 114] as const;
const UNTERSCHRIFT_BREITE = 50;

const SCHRIFT_TITEL = 20;
const SCHRIFT_TITEL_FORTSETZUNG = 14;
const SCHRIFT_ABSCHNITT = 12;
const SCHRIFT_BESCHRIFTUNG = 8;
const SCHRIFT_KENNUNG = 7;

export const LEITFARBE = "#c8102e";
const LINIE_GRAU = "#8c8c8c";

export class AllgemeinSetzer extends Grundsetzer {
    private readonly leitfarbe: string;

    constructor(pdf: jsPDF, daten: EinsatzauftragDaten, optionen: EinsatzauftragOptionen, schriftart: Satzschrift, schrift: number, abstand: number) {
        super(pdf, daten, optionen, schriftart, schrift, abstand);
        this.polster = 0.6;
        this.leitfarbe = /^#[0-9a-f]{6}$/i.test(optionen.leitfarbe ?? "") ? (optionen.leitfarbe as string).toLowerCase() : LEITFARBE;
    }

    setze(): Element[][] {
        this.neueSeite();
        this.anschrift();
        for (const abschnitt of ABSCHNITTE) {
            this.abschnitt(abschnitt);
        }
        this.unterschrift();
        this.fusszeilen();
        return this.seiten;
    }

    protected neueSeite(): void {
        this.beginneSeite();
        this.y = OBEN;
        this.kopf(this.seiten.length > 1);
        this.seitenanfang = this.y;
    }

    // ---- Kopf ----

    private kopf(fortsetzung: boolean): void {
        const oben = this.y;
        const hoehe = fortsetzung ? KOPF_HOEHE_FORTSETZUNG : KOPF_HOEHE;
        const titelGroesse = fortsetzung ? SCHRIFT_TITEL_FORTSETZUNG : SCHRIFT_TITEL;
        const titelGrund = oben + titelGroesse * PT * 0.72;
        const textRechts = this.logo(oben, hoehe);
        const organisationBreite = this.organisation(oben, hoehe, textRechts, fortsetzung);
        const titelBreite = textRechts - organisationBreite - LINKS - 6;
        this.waehleSchrift(titelGroesse, true);
        this.text(kuerzeAufBreite(this.pdf, this.optionen.titel ?? "Einsatzauftrag", titelBreite), LINKS, titelGrund, titelGroesse, { fett: true, farbe: this.leitfarbe });
        if (!fortsetzung && this.optionen.kennung) {
            this.einzeilig(this.optionen.kennung, LINKS, titelGrund + 4.5, titelBreite, SCHRIFT_BESCHRIFTUNG, false, GRAU);
        }
        const linieY = oben + hoehe + 1;
        this.linie(LINKS, linieY, RECHTS, linieY, KOPF_LINIE, this.leitfarbe);
        this.y = linieY + KOPF_LINIE + this.abstand;
    }

    /** Logo rechts oben im Kopf; gibt die rechte Grenze für den Text zurück. */
    private logo(oben: number, hoehe: number): number {
        const logo = this.optionen.logo;
        if (!logo || logo.breite <= 0 || logo.hoehe <= 0) {
            return RECHTS;
        }
        const maxHoehe = hoehe - 1;
        const b = Math.min(45, maxHoehe * logo.breite / logo.hoehe);
        const h = b * logo.hoehe / logo.breite;
        const x = RECHTS - b;
        this.elemente.push({ art: "bild", daten: logo.daten, format: logo.format, x, y: oben + (maxHoehe - h) / 2, b, h });
        return x - 3;
    }

    /** Organisation rechtsbündig neben dem Logo; gibt die Breite des gesetzten Texts zurück. */
    private organisation(oben: number, hoehe: number, rechts: number, fortsetzung: boolean): number {
        const zeilen = (this.optionen.organisation ?? "").split(/\r?\n|\\n/).map(z => z.trim()).filter(Boolean).slice(0, 3);
        if (zeilen.length === 0) {
            return 0;
        }
        const verfuegbar = Math.min(70, rechts - LINKS - 50);
        if (verfuegbar < 10) {
            return 0;
        }
        let groesse = fortsetzung || zeilen.length > 2 ? 8 : 10;
        this.waehleSchrift(groesse, true);
        while (Math.max(...zeilen.map(z => this.pdf.getTextWidth(z))) > verfuegbar && groesse > 6) {
            groesse -= 0.25;
            this.pdf.setFontSize(groesse);
        }
        const abstand = groesse * PT * 1.1;
        const erste = oben + (hoehe - 1) / 2 - (zeilen.length - 1) * abstand / 2 + groesse * PT * 0.35;
        let breite = 0;
        zeilen.forEach((zeile, index) => {
            const text = kuerzeAufBreite(this.pdf, zeile, verfuegbar);
            breite = Math.max(breite, this.pdf.getTextWidth(text));
            this.text(text, rechts, erste + index * abstand, groesse, { fett: true, ausrichtung: "rechts" });
        });
        return breite;
    }

    // ---- Absender, Empfänger, Einsatz, lfd. Nr. ----

    private anschrift(): void {
        const linksWert = LINKS + BESCHRIFTUNG_BREITE;
        const rechtsBeschriftung = LINKS + SPALTE_RECHTS;
        const rechtsWert = rechtsBeschriftung + BESCHRIFTUNG_BREITE - 3;
        const zeilen = [
            [
                { beschriftung: "Absender", x: LINKS, wertX: linksWert, zeilen: this.umbrich(this.daten.absender, rechtsBeschriftung - linksWert - 4) },
                { beschriftung: "Einsatz", x: rechtsBeschriftung, wertX: rechtsWert, zeilen: this.umbrich(this.daten.einsatz, RECHTS - rechtsWert) }
            ],
            [
                { beschriftung: "Empfänger", x: LINKS, wertX: linksWert, zeilen: this.umbrich(this.daten.empfaenger, rechtsBeschriftung - linksWert - 4) },
                { beschriftung: "lfd. Nr.", x: rechtsBeschriftung, wertX: rechtsWert, zeilen: this.umbrich(this.daten.laufendeNummer, RECHTS - rechtsWert, this.schrift + 1) }
            ]
        ];
        let y = this.y;
        for (const paar of zeilen) {
            const hoehe = Math.max(META_ZEILE_MIN, ...paar.map(feld => feld.zeilen.length * this.zeile + 2 * this.polster));
            const grund = y + this.polster + oberlaenge(this.schrift);
            for (const feld of paar) {
                this.text(feld.beschriftung, feld.x, grund, SCHRIFT_BESCHRIFTUNG, { farbe: GRAU });
                if (feld.beschriftung === "lfd. Nr.") {
                    feld.zeilen.forEach((zeile, i) => this.text(zeile, feld.wertX, grund + i * this.zeile, this.schrift + 1, { fett: true }));
                } else {
                    this.zeilen(feld.zeilen, feld.wertX, grund);
                }
            }
            y += hoehe;
        }
        y += 1;
        this.linie(LINKS, y, RECHTS, y, 0.2, LINIE_GRAU);
        this.y = y + 0.2 + this.abstand;
    }

    // ---- Abschnitte 1–5 ----

    private textzeilen(abschnitt: Abschnitt): Textzeilen[] {
        const breite = BREITE - EINZUG;
        const frei = this.umbrich(this.daten[abschnitt.freitext], breite);
        const unterzeilen = abschnitt.unterpunkte
            .map(punkt => ({ kennung: punkt.kennung, zeilen: this.umbrich(this.daten.unterpunkte?.[punkt.kennung], breite), mindesthoehe: 0 }))
            .filter(zeile => zeile.zeilen.length > 0);
        if (frei.length === 0 && unterzeilen.length === 0) {
            return [{ kennung: "", zeilen: [], mindesthoehe: abschnitt.nummer === 2 ? AUFTRAG_LEER_MIN : LEER_MIN }];
        }
        return [...(frei.length > 0 ? [{ kennung: "", zeilen: frei, mindesthoehe: 0 }] : []), ...unterzeilen];
    }

    private abschnitt(abschnitt: Abschnitt): void {
        this.fliesse(this.textzeilen(abschnitt), {
            rand: 0,
            unten: UNTEN,
            restMindesthoehe: 0,
            kopfhoehe: () => ABSCHNITT_KOPF,
            kopf: (oben, _hoehe, fortsetzung) => {
                const grund = oben + SCHRIFT_ABSCHNITT * PT * 0.72;
                this.text(String(abschnitt.nummer), LINKS, grund, SCHRIFT_ABSCHNITT, { fett: true, farbe: this.leitfarbe });
                this.text(`${abschnitt.titel}${fortsetzung ? " (Fortsetzung)" : ""}`, LINKS + EINZUG, grund, SCHRIFT_ABSCHNITT, { fett: true });
                const linieY = grund + 1.8;
                this.linie(LINKS, linieY, RECHTS, linieY, ABSCHNITT_LINIE, this.leitfarbe);
            },
            zeile: (zeile, oben) => {
                const grund = oben + this.polster + oberlaenge(this.schrift);
                this.text(zeile.kennung, LINKS + 0.5, grund, SCHRIFT_KENNUNG, { farbe: GRAU });
                this.zeilen(zeile.zeilen, LINKS + EINZUG, grund);
            },
            rahmen: () => undefined
        });
    }

    // ---- Unterschrift ----

    private unterschrift(): void {
        const felder = [this.daten.ortDatum, this.daten.unterschrift, this.daten.dienststelle]
            .map(wert => this.umbrich(wert, UNTERSCHRIFT_BREITE - 1));
        const wertOben = 2;
        const linieAb = Math.max(UNTERSCHRIFT_MIN, wertOben + Math.max(...felder.map(f => f.length)) * this.zeile + 1.5);
        const abgesandt = [
            this.daten.abgesandtAm ? `am ${this.daten.abgesandtAm}` : "",
            this.daten.abgesandtUm ? `um ${this.daten.abgesandtUm}` : "",
            this.daten.abgesandtVon ? `von ${this.daten.abgesandtVon}` : ""
        ].filter(Boolean).join(" ");
        const hoehe = linieAb + 5 + (abgesandt ? 5 : 0);
        if (this.y + hoehe > UNTEN && !this.seiteLeer()) {
            this.neueSeite();
        }
        const oben = this.y + 2;
        const linieY = oben + linieAb;
        ["Ort, Datum", "Unterschrift", "Dienststelle"].forEach((beschriftung, index) => {
            const x = LINKS + (UNTERSCHRIFT_SPALTEN[index] as number);
            this.zeilen(felder[index] ?? [], x + 0.5, oben + wertOben + oberlaenge(this.schrift));
            this.linie(x, linieY, x + UNTERSCHRIFT_BREITE, linieY, 0.2, LINIE_GRAU);
            this.text(beschriftung, x, linieY + 3.5, SCHRIFT_BESCHRIFTUNG, { farbe: GRAU });
        });
        this.y = linieY + 5;
        if (abgesandt) {
            this.einzeilig(`Abgesandt ${abgesandt}`, LINKS, this.y + 3, BREITE, SCHRIFT_BESCHRIFTUNG, false, GRAU);
            this.y += 5;
        }
    }
}
