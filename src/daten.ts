// Inhalt eines Einsatzauftrags und die feste Gliederung des Vordrucks.

/**
 * Gestaltung des Blatts. „vordruck“ ist der Vordruck Fb Fü 3 des THW mit
 * blauem Balken, gelben Kopfzeilen und den Unterzeilen 1a–4g. „allgemein“
 * ist für Stellen außerhalb des THW: schlicht, eine Leitfarbe, die fünf
 * Abschnitte Lage, Auftrag, Durchführung, Logistik, Führung und Verbindung
 * als Freitext ohne Unterzeilen.
 */
export type Gestaltung = "vordruck" | "allgemein";

/** Kennung einer Unterzeile der Abschnitte 1, 3 und 4. */
export type Unterpunkt =
    | "1a" | "1b" | "1c"
    | "3a" | "3b" | "3c"
    | "4a" | "4b" | "4c" | "4d" | "4e" | "4f" | "4g";

/**
 * Was auf dem Vordruck steht. Alle Felder sind optional; was fehlt, bleibt
 * leer. Zeilenumbrüche („\n“) im Text bleiben erhalten.
 */
export interface EinsatzauftragDaten {
    absender?: string;
    /** „für den Einsatz“ */
    einsatz?: string;
    /** „lfd. Nr.:“ */
    laufendeNummer?: string;
    empfaenger?: string;
    /** Texte der Zeilen 1a–1c, 3a–3c, 4a–4g. */
    unterpunkte?: Partial<Record<Unterpunkt, string>>;
    /**
     * Abschnitt 1 als Freitext (Gestaltung „allgemein“). Im Vordruck steht er
     * als Zeile ohne Kennung vor 1a; umgekehrt stehen gefüllte Unterzeilen in
     * der allgemeinen Gestaltung mit ihrer Kennung unter dem Freitext.
     */
    lage?: string;
    /** Abschnitt 2, erhaltener Auftrag. */
    auftrag?: string;
    /** Abschnitt 3 als Freitext, wie `lage`. */
    durchfuehrung?: string;
    /** Abschnitt 4 als Freitext, wie `lage`. */
    logistik?: string;
    /**
     * Abschnitt 5. Zeilenumbrüche bleiben in der Zelle erhalten; eine Leerzeile
     * beginnt eine neue Formularzeile. Mindestens zwei Zeilen wie im Vordruck.
     */
    fuehrung?: string;
    ortDatum?: string;
    unterschrift?: string;
    dienststelle?: string;
    abgesandtAm?: string;
    abgesandtUm?: string;
    abgesandtVon?: string;
}

/** Ein Abschnitt des Vordrucks mit gelber Kopfzeile. */
export interface Abschnitt {
    readonly nummer: number;
    readonly titel: string;
    /** Feld des Freitexts in `EinsatzauftragDaten`. */
    readonly freitext: "lage" | "auftrag" | "durchfuehrung" | "logistik" | "fuehrung";
    /** Erläuterung in der Kopfzeile, klein gesetzt. */
    readonly erlaeuterung: string;
    /** Unterzeilen mit Kennung; leer bei Abschnitten mit freien Zeilen (2 und 5). */
    readonly unterpunkte: readonly { readonly kennung: Unterpunkt; readonly bedeutung: string }[];
}

export const ABSCHNITTE: readonly Abschnitt[] = [
    {
        nummer: 1,
        titel: "Lage",
        freitext: "lage",
        erlaeuterung: "(1a: Gefahren- / Schadenlage, 1b: eigene Lage, 1c: Unterstellung und Abgabe von Kräften)",
        unterpunkte: [
            { kennung: "1a", bedeutung: "Gefahren- / Schadenlage" },
            { kennung: "1b", bedeutung: "eigene Lage" },
            { kennung: "1c", bedeutung: "Unterstellung und Abgabe von Kräften" }
        ]
    },
    {
        nummer: 2,
        titel: "Auftrag",
        freitext: "auftrag",
        erlaeuterung: "(erhaltener Auftrag)",
        unterpunkte: []
    },
    {
        nummer: 3,
        titel: "Durchführung",
        freitext: "durchfuehrung",
        erlaeuterung: "(3a: Schwerpunkt, eigene Absicht, 3b: Einzelaufträge, 3c: Zusammenarbeit mit anderen Kräften und Koordinierung, Zeitangaben, Schutzmaßnahmen)",
        unterpunkte: [
            { kennung: "3a", bedeutung: "Schwerpunkt, eigene Absicht" },
            { kennung: "3b", bedeutung: "Einzelaufträge" },
            { kennung: "3c", bedeutung: "Zusammenarbeit mit anderen Kräften und Koordinierung, Zeitangaben, Schutzmaßnahmen" }
        ]
    },
    {
        nummer: 4,
        titel: "Logistik",
        freitext: "logistik",
        erlaeuterung: "(4a: Verpflegung, 4b: Verbrauchsgüter, 4c: Betriebsstoff, 4d: Instandsetzung, 4e: Medizinische Versorgung, 4f: Unterbringung, 4g: Haushalt, Handkasse, Abrechnung)",
        unterpunkte: [
            { kennung: "4a", bedeutung: "Verpflegung" },
            { kennung: "4b", bedeutung: "Verbrauchsgüter" },
            { kennung: "4c", bedeutung: "Betriebsstoff" },
            { kennung: "4d", bedeutung: "Instandsetzung" },
            { kennung: "4e", bedeutung: "Medizinische Versorgung" },
            { kennung: "4f", bedeutung: "Unterbringung" },
            { kennung: "4g", bedeutung: "Haushalt, Handkasse, Abrechnung" }
        ]
    },
    {
        nummer: 5,
        titel: "Führung und Verbindung",
        freitext: "fuehrung",
        erlaeuterung: "(Telekommunikationsverbindungen und Meldewesen, Führungsstellen, Einsatzleitungen, Platz des Führers)",
        unterpunkte: []
    }
];

/** Alle Unterpunkte in der Reihenfolge des Vordrucks. */
export const UNTERPUNKTE: readonly Unterpunkt[] = ABSCHNITTE.flatMap(abschnitt => abschnitt.unterpunkte.map(punkt => punkt.kennung));
