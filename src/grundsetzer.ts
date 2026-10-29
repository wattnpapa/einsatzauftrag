import type { jsPDF } from "jspdf";
import type { EinsatzauftragDaten } from "./daten.js";
import { BREITE, FUSS_Y, GRAU, LINKS, RECHTS, SCHWARZ, type Element, zeilenhoehe } from "./elemente.js";
import type { EinsatzauftragOptionen } from "./optionen.js";
import type { Satzschrift } from "./schrift.js";
import { kuerzeAufBreite, umbrechen } from "./text.js";

// Was beide Gestaltungen gemeinsam haben: die Liste der Zeichenelemente je
// Seite, Text und Linien, Umbruch, das Fließen eines Abschnitts über
// Seitengrenzen und die Fußzeile am Blattrand.

/** Eine Zeile eines Abschnitts: Kennung links („1a“, leer bei Freitext) und umbrochener Text. */
export interface Textzeilen {
    kennung: string;
    zeilen: string[];
    mindesthoehe: number;
}

/** Wie eine Gestaltung einen Abschnitt zeichnet; das Fließen über Seiten ist gemeinsam. */
export interface Abschnittsbau {
    /** Abstand zwischen Außenkante und Kopfzeile (Doppellinie des Vordrucks), oben wie unten. */
    rand: number;
    /** Unterkante, bis zu der gesetzt wird. */
    unten: number;
    kopfhoehe: (fortsetzung: boolean) => number;
    kopf: (oben: number, hoehe: number, fortsetzung: boolean) => void;
    zeile: (zeile: Textzeilen, oben: number, hoehe: number) => void;
    /** Rahmen und Trennlinien, nachdem alle Zeilen der Seite stehen. */
    rahmen: (oben: number, zeilenOben: number, unten: number) => void;
    /** Mindesthöhe des Rests einer geteilten Zeile auf der nächsten Seite. */
    restMindesthoehe: number;
}

export abstract class Grundsetzer {
    protected readonly seiten: Element[][] = [];
    protected elemente: Element[] = [];
    protected y = 0;
    /** Erste Position unter dem Kopf: Darüber ist die Seite noch leer. */
    protected seitenanfang = 0;
    /** Zeilenabstand der Eintragungen. */
    protected readonly zeile: number;
    /** Luft über und unter dem Text einer Zeile. */
    protected polster = 0;

    constructor(
        protected readonly pdf: jsPDF,
        protected readonly daten: EinsatzauftragDaten,
        protected readonly optionen: EinsatzauftragOptionen,
        protected readonly schriftart: Satzschrift,
        protected readonly schrift: number,
        protected readonly abstand: number
    ) {
        this.zeile = zeilenhoehe(schrift);
    }

    abstract setze(): Element[][];

    protected abstract neueSeite(): void;

    // ---- Grundbausteine ----

    /** Beginnt eine neue Seite in der Liste; der Kopf kommt von der Gestaltung. */
    protected beginneSeite(): void {
        this.elemente = [];
        this.seiten.push(this.elemente);
    }

    protected seiteLeer(): boolean {
        return this.y <= this.seitenanfang + 0.01;
    }

    /** Stellt Schrift und Größe in der PDF ein; gibt zurück, ob fett möglich war. */
    protected waehleSchrift(groesse: number, fett = false): boolean {
        const wirdFett = fett && this.schriftart.fett;
        this.pdf.setFont(this.schriftart.name, wirdFett ? "bold" : "normal");
        this.pdf.setFontSize(groesse);
        return wirdFett;
    }

    protected text(text: string, x: number, y: number, groesse: number, {
        fett = false,
        farbe = SCHWARZ,
        ausrichtung = "links"
    }: { fett?: boolean; farbe?: string; ausrichtung?: "links" | "mitte" | "rechts" } = {}): void {
        if (!text) {
            return;
        }
        const wirdFett = this.waehleSchrift(groesse, fett);
        this.elemente.push({
            art: "text", text, x, y, groesse, schrift: this.schriftart.name, fett: wirdFett, farbe, ausrichtung, breite: this.pdf.getTextWidth(text)
        });
    }

    protected linie(x1: number, y1: number, x2: number, y2: number, staerke: number, farbe = SCHWARZ): void {
        this.elemente.push({ art: "linie", x1, y1, x2, y2, staerke, farbe });
    }

    /** Text der Eintragungen umbrechen. */
    protected umbrich(text: string | undefined, breite: number, groesse = this.schrift): string[] {
        this.waehleSchrift(groesse);
        return umbrechen(this.pdf, text ?? "", breite);
    }

    /** Mehrere Zeilen ab der Grundlinie `y` setzen. */
    protected zeilen(zeilen: readonly string[], x: number, y: number): void {
        zeilen.forEach((zeile, index) => this.text(zeile, x, y + index * this.zeile, this.schrift));
    }

    /**
     * Einzeiliger Wert: verkleinert bis 6 pt, dann mit „…“ gekürzt, damit er
     * nicht ins Nachbarfeld läuft.
     */
    protected einzeilig(text: string | undefined, x: number, y: number, breite: number, groesse = this.schrift, fett = false, farbe = SCHWARZ): void {
        const wert = (text ?? "").replace(/\s+/g, " ").trim();
        if (!wert) {
            return;
        }
        let aktuell = groesse;
        this.waehleSchrift(aktuell, fett);
        while (this.pdf.getTextWidth(wert) > breite && aktuell > 6) {
            aktuell = Math.max(6, aktuell - 0.25);
            this.pdf.setFontSize(aktuell);
        }
        this.text(kuerzeAufBreite(this.pdf, wert, breite), x, y, aktuell, { fett, farbe });
    }

    protected zeilenhoehe(zeilen: number, mindesthoehe: number): number {
        return Math.max(mindesthoehe, zeilen * this.zeile + 2 * this.polster);
    }

    // ---- Abschnitt über Seiten fließen lassen ----

    /**
     * Setzt die Zeilen eines Abschnitts, auf der nächsten Seite weiter, wenn
     * sie nicht passen. Die Kopfzeile steht nie allein am Seitenende; lange
     * Zeilen werden zeilenweise geteilt, nichts fällt weg.
     */
    protected fliesse(offen: Textzeilen[], bau: Abschnittsbau): void {
        let fortsetzung = false;
        while (offen.length > 0) {
            const kopf = bau.kopfhoehe(fortsetzung);
            const erste = offen[0] as Textzeilen;
            // Mit der Kopfzeile muss die erste Zeile (bei langem Text deren erste zwei Zeilen) noch passen.
            const mindestens = this.zeilenhoehe(Math.min(2, erste.zeilen.length), erste.mindesthoehe);
            if (this.y + bau.rand + kopf + mindestens + bau.rand > bau.unten && !this.seiteLeer()) {
                this.neueSeite();
            }
            const oben = this.y;
            bau.kopf(oben + bau.rand, kopf, fortsetzung);
            let y = oben + bau.rand + kopf;
            const zeilenOben = y;
            let gesetzt = 0;
            while (offen.length > 0) {
                const zeile = offen[0] as Textzeilen;
                const hoehe = this.zeilenhoehe(zeile.zeilen.length, zeile.mindesthoehe);
                if (y + hoehe + bau.rand <= bau.unten) {
                    bau.zeile(zeile, y, hoehe);
                    y += hoehe;
                    gesetzt++;
                    offen.shift();
                    continue;
                }
                // Zeile passt nicht ganz: teilen, wenn auf dieser Seite noch
                // mindestens zwei Textzeilen Platz haben (auf einer frischen
                // Seite auch eine), sonst als Ganzes auf die nächste Seite.
                const passen = Math.floor((bau.unten - bau.rand - y - 2 * this.polster) / this.zeile);
                const mindestTeil = gesetzt === 0 ? 1 : 2;
                if (passen >= mindestTeil && zeile.zeilen.length > passen) {
                    const teil = { ...zeile, zeilen: zeile.zeilen.slice(0, passen) };
                    const teilhoehe = this.zeilenhoehe(passen, 0);
                    bau.zeile(teil, y, teilhoehe);
                    y += teilhoehe;
                    zeile.zeilen = zeile.zeilen.slice(passen);
                    zeile.mindesthoehe = bau.restMindesthoehe;
                }
                break;
            }
            bau.rahmen(oben, zeilenOben, y);
            this.y = y + bau.rand + this.abstand;
            if (offen.length > 0) {
                this.neueSeite();
                fortsetzung = true;
            }
        }
    }

    // ---- Blattrand ----

    /** Links die Fußzeile der Optionen, rechts lfd. Nr. und „Seite x von y“, auf jeder Seite. */
    protected fusszeilen(): void {
        const anzahl = this.seiten.length;
        const nummer = (this.daten.laufendeNummer ?? "").replace(/\s+/g, " ").trim();
        this.seiten.forEach((seite, index) => {
            this.elemente = seite;
            const rechts = [nummer ? `lfd. Nr. ${nummer}` : "", `Seite ${index + 1} von ${anzahl}`].filter(Boolean).join(" · ");
            this.waehleSchrift(7);
            const rechtsText = kuerzeAufBreite(this.pdf, rechts, BREITE / 2);
            this.text(rechtsText, RECHTS, FUSS_Y, 7, { farbe: GRAU, ausrichtung: "rechts" });
            const fuss = (this.optionen.fusszeile ?? "").replace(/\s+/g, " ").trim();
            if (fuss) {
                this.waehleSchrift(7);
                this.text(kuerzeAufBreite(this.pdf, fuss, BREITE - this.pdf.getTextWidth(rechtsText) - 5), LINKS, FUSS_Y, 7, { farbe: GRAU });
            }
        });
    }
}
