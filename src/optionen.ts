import type { Gestaltung } from "./daten.js";
import type { Seite } from "./elemente.js";
import type { Schriftart } from "./schrift.js";

/** Logo im Kopf. Breite und Höhe in Pixeln, nur fürs Seitenverhältnis. */
export interface EinsatzauftragLogo {
    daten: string | Uint8Array;
    format: "PNG" | "JPEG";
    breite: number;
    hoehe: number;
}

export interface EinsatzauftragOptionen {
    /** Gestaltung des Blatts, Standard „vordruck“ (Fb Fü 3). */
    gestaltung?: Gestaltung | undefined;
    /**
     * Kennung im linken Kopffeld des Vordrucks, Standard „Fb Fü 3“. In der
     * Gestaltung „allgemein“ nur gesetzt, wenn angegeben: klein unter dem Titel.
     */
    kennung?: string;
    /** Titel im blauen Balken bzw. über dem Blatt. Standard „Einsatzauftrag“. */
    titel?: string;
    /**
     * Text im rechten Kopffeld, Zeilen mit „\n“ getrennt. Standard
     * „Technisches\nHilfswerk“ im Vordruck, leer in der Gestaltung „allgemein“;
     * leer lässt das Feld frei (oder nur das Logo).
     */
    organisation?: string;
    logo?: EinsatzauftragLogo | undefined;
    /**
     * Schriftgröße der Eintragungen in pt. Ohne Angabe sucht der Satz zwischen
     * 10 und 8 pt die größte, mit der der Auftrag auf möglichst wenige Seiten
     * passt.
     */
    schriftgroesse?: number | undefined;
    /**
     * Eigene Schrift (TrueType, etwa Aptos) statt Helvetica, für alle Texte des
     * Blatts. Wird je PDF eingebettet, siehe `registriereSchrift`.
     */
    schriftart?: Schriftart | undefined;
    /**
     * Leitfarbe der Gestaltung „allgemein“ als Hex, Standard Rot („#c8102e“).
     * „#000000“ ergibt ein Blatt ganz ohne Farbe. Der Vordruck ignoriert sie.
     */
    leitfarbe?: string | undefined;
    /** Kleiner Text links unten am Blattrand, z. B. eine Herkunftsangabe. */
    fusszeile?: string | undefined;
}

export interface Einsatzauftragsatz {
    readonly seiten: readonly Seite[];
    /** Schriftgröße der Eintragungen in pt. */
    readonly schriftgroesse: number;
}
