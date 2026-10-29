// Zeichenelemente, aus denen eine gesetzte Seite besteht, und die Maße, die
// beide Gestaltungen teilen. Maße in mm von der linken oberen Blattecke.

/** Ein Zeichenelement. */
export type Element =
    /** Gefüllte Fläche ohne Rand. */
    | { readonly art: "flaeche"; readonly x: number; readonly y: number; readonly b: number; readonly h: number; readonly farbe: string }
    /** Gerade Linie, Stärke in mm. */
    | { readonly art: "linie"; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly staerke: number; readonly farbe: string }
    /**
     * Text. `schrift` ist der Name der Schrift in der PDF („helvetica“ oder
     * eine mit `registriereSchrift` eingebettete), `x`/`y` der Ankerpunkt auf
     * der Grundlinie, `groesse` in pt, `breite` die in der PDF gemessene
     * Breite in mm.
     */
    | {
        readonly art: "text";
        readonly text: string;
        readonly x: number;
        readonly y: number;
        readonly groesse: number;
        readonly schrift: string;
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

export const BLATT_BREITE = 210;
export const BLATT_HOEHE = 297;
/** Seitenränder links 25 mm und rechts 20 mm nach DIN 5008. */
export const LINKS = 25;
export const RECHTS = BLATT_BREITE - 20;
export const BREITE = RECHTS - LINKS;
/** Grundlinie der Fußzeile am Blattrand. */
export const FUSS_Y = 291;

export const SCHWARZ = "#000000";
export const GRAU = "#555555";

export const PT = 25.4 / 72;

/** Schriftgrößen der Eintragungen, die die automatische Wahl probiert. */
export const SCHRIFTGROESSEN = [10, 9.5, 9, 8.5, 8] as const;

/** Zeilenabstand in mm für eine Schriftgröße in pt. */
export function zeilenhoehe(groesse: number): number {
    return groesse * PT * 1.18;
}

/** Abstand von der Oberkante einer Textzeile bis zur Grundlinie. */
export function oberlaenge(groesse: number): number {
    return groesse * PT * 0.86;
}
