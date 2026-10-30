import { ABSCHNITTE, UNTERPUNKTE, type EinsatzauftragDaten, type Unterpunkt } from "../../src/index.js";

// Die Felder der Eingabemaske und die Spalten der Tabelle: eine Liste für
// beides, damit Maske, Excel-Vorlage und Einlesen nicht auseinanderlaufen.

export type Feldschluessel =
    | "absender" | "einsatz" | "laufendeNummer" | "empfaenger"
    | Unterpunkt | "auftrag" | "fuehrung"
    | "ortDatum" | "unterschrift" | "dienststelle"
    | "abgesandtAm" | "abgesandtUm" | "abgesandtVon";

export interface Feld {
    readonly schluessel: Feldschluessel;
    /** Spaltenkopf der Vorlage. */
    readonly titel: string;
    readonly beschreibung: string;
    readonly beispiel: string;
    /** Weitere Spaltenköpfe, die beim Einlesen erkannt werden. */
    readonly auch?: readonly string[];
    /** Mehrzeiliger Text (Zeilenumbruch in der Zelle erlaubt). */
    readonly mehrzeilig?: boolean;
    /** Spaltenbreite in der Excel-Vorlage. */
    readonly breite: number;
}

const BEISPIELE: Record<Unterpunkt, string> = {
    "1a": "Pegel Hunte 5,80 m, steigend. Deich bei Tungeln an zwei Stellen durchfeuchtet.",
    "1b": "1. TZ mit GKW, MzKW und MTW einsatzbereit im Bereitstellungsraum.",
    "1c": "B-Gruppe ab 14:00 Uhr dem EA Deich Süd unterstellt.",
    "3a": "Sicherung Deichabschnitt km 4,2 bis 4,6.",
    "3b": "Sandsackverbau an Sickerstellen, Ausleuchtung Deichkrone.",
    "3c": "Zusammenarbeit mit FF Kreyenbrück, Lagemeldung stündlich.",
    "4a": "Verpflegung über Log-V, Ausgabe 18:00 Uhr.",
    "4b": "Sandsäcke vom Bauhof.",
    "4c": "Betankung an der Unterkunft.",
    "4d": "",
    "4e": "SEG Sanität am Deich Süd.",
    "4f": "Turnhalle Bümmerstede.",
    "4g": ""
};

function unterpunktFeld(kennung: Unterpunkt): Feld {
    const abschnitt = ABSCHNITTE.find(eintrag => eintrag.unterpunkte.some(punkt => punkt.kennung === kennung));
    const bedeutung = abschnitt?.unterpunkte.find(punkt => punkt.kennung === kennung)?.bedeutung ?? "";
    return {
        schluessel: kennung,
        titel: `${kennung} ${bedeutung}`,
        beschreibung: `${abschnitt?.nummer ?? ""}. ${abschnitt?.titel ?? ""}, Zeile ${kennung}: ${bedeutung}.`,
        beispiel: BEISPIELE[kennung],
        auch: [kennung, `${abschnitt?.titel ?? ""} ${kennung}`],
        mehrzeilig: true,
        breite: 36
    };
}

export const FELDER: readonly Feld[] = [
    { schluessel: "absender", titel: "Absender", beschreibung: "Wer den Auftrag erteilt.", beispiel: "ZTr TZ OV Oldenburg", breite: 22 },
    { schluessel: "einsatz", titel: "Für den Einsatz", beschreibung: "Bezeichnung des Einsatzes.", beispiel: "Hochwasser Hunte 2026", auch: ["Einsatz"], breite: 22 },
    { schluessel: "laufendeNummer", titel: "Lfd. Nr.", beschreibung: "Laufende Nummer des Auftrags.", beispiel: "12", auch: ["Laufende Nummer", "Nr", "Nummer"], breite: 9 },
    { schluessel: "empfaenger", titel: "Empfänger", beschreibung: "Wer den Auftrag erhält.", beispiel: "B-Gruppe 1. TZ", breite: 22 },
    ...UNTERPUNKTE.filter(punkt => punkt.startsWith("1")).map(unterpunktFeld),
    {
        schluessel: "auftrag",
        titel: "2 Auftrag",
        beschreibung: "2. Auftrag: erhaltener Auftrag.",
        beispiel: "Deichabschnitt km 4,2 bis 4,6 gegen Durchsickern sichern und überwachen.",
        auch: ["Auftrag"],
        mehrzeilig: true,
        breite: 44
    },
    ...UNTERPUNKTE.filter(punkt => !punkt.startsWith("1")).map(unterpunktFeld),
    {
        schluessel: "fuehrung",
        titel: "5 Führung und Verbindung",
        beschreibung: "5. Führung und Verbindung: Telekommunikationsverbindungen und Meldewesen, Führungsstellen, Einsatzleitungen, Platz des Führers. Zeilenumbrüche bleiben erhalten; eine Leerzeile in der Zelle beginnt eine neue Zeile im Vordruck. Gleich benannte weitere Spalten ergeben ebenfalls je eine Zeile.",
        beispiel: "TMO-Gruppe 304_OL_THW, Rufname Heros Oldenburg 21/10\n\nEA Deich Süd, Gemeindehaus Tungeln",
        auch: ["Führung und Verbindung", "Führung"],
        mehrzeilig: true,
        breite: 40
    },
    { schluessel: "ortDatum", titel: "Ort, Datum", beschreibung: "Ort und Datum der Unterschrift.", beispiel: "Oldenburg, 27.10.2026", auch: ["Ort Datum", "Ort"], breite: 20 },
    { schluessel: "unterschrift", titel: "Unterschrift", beschreibung: "Name in Druckschrift, falls gewünscht; unterschrieben wird von Hand.", beispiel: "Mustermann", breite: 16 },
    { schluessel: "dienststelle", titel: "Dienststelle", beschreibung: "Dienststelle oder Funktion der unterschreibenden Person.", beispiel: "ZTr TZ", breite: 16 },
    { schluessel: "abgesandtAm", titel: "Abgesandt am", beschreibung: "Datum der Absendung.", beispiel: "27.10.", breite: 12 },
    { schluessel: "abgesandtUm", titel: "Abgesandt um", beschreibung: "Uhrzeit der Absendung.", beispiel: "13:45", breite: 12 },
    { schluessel: "abgesandtVon", titel: "Abgesandt von", beschreibung: "Wer den Auftrag abgesandt hat.", beispiel: "Fm Muster", breite: 16 }
];

export type Werte = Partial<Record<Feldschluessel, string>>;

/** Werte der Maske oder einer Tabellenzeile in die Daten der Bibliothek. */
export function zuDaten(werte: Werte): EinsatzauftragDaten {
    const wert = (schluessel: Feldschluessel) => werte[schluessel] ?? "";
    return {
        absender: wert("absender"),
        einsatz: wert("einsatz"),
        laufendeNummer: wert("laufendeNummer"),
        empfaenger: wert("empfaenger"),
        unterpunkte: Object.fromEntries(UNTERPUNKTE.map(punkt => [punkt, wert(punkt)])),
        auftrag: wert("auftrag"),
        fuehrung: wert("fuehrung"),
        ortDatum: wert("ortDatum"),
        unterschrift: wert("unterschrift"),
        dienststelle: wert("dienststelle"),
        abgesandtAm: wert("abgesandtAm"),
        abgesandtUm: wert("abgesandtUm"),
        abgesandtVon: wert("abgesandtVon")
    };
}

/**
 * Abschnitt 5 als einzelne Formularzeilen: Im gespeicherten Text trennt eine
 * Leerzeile die Zeilen, so wie die Bibliothek ihn setzt.
 */
export function fuehrungZeilen(text: string): string[] {
    return text.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/).map(zeile => zeile.replace(/^\s*\n|\n\s*$/g, "").trimEnd()).filter(zeile => zeile.trim() !== "");
}

/** Umkehrung von `fuehrungZeilen`. Leerzeilen innerhalb einer Zeile fallen weg, damit sie eine Zeile bleibt. */
export function fuehrungText(zeilen: readonly string[]): string {
    return zeilen.map(zeile => zeile.replace(/\r\n?/g, "\n").replace(/\n[ \t]*(?=\n)/g, "").replace(/^\n+|\n+$/g, "").trimEnd())
        .filter(zeile => zeile.trim() !== "").join("\n\n");
}

/** Zählt die letzte Zahl in der lfd. Nr. hoch, mit führenden Nullen: „A-09“ wird „A-10“. */
export function hochzaehlen(nummer: string): string {
    const treffer = /^(.*?)(\d+)(\D*)$/.exec(nummer.trim());
    if (!treffer) {
        return nummer;
    }
    const [, vorne = "", zahl = "", hinten = ""] = treffer;
    return `${vorne}${String(Number(zahl) + 1).padStart(zahl.length, "0")}${hinten}`;
}

/** Was „Nächster Auftrag“ leert. */
export const NAECHSTER_LEERT: readonly Feldschluessel[] = ["empfaenger", "auftrag", "3a", "3b", "3c", "abgesandtAm", "abgesandtUm"];

/** Was „Auftrag kopieren“ leert: derselbe Auftrag an einen weiteren Empfänger. */
export const KOPIE_LEERT: readonly Feldschluessel[] = ["empfaenger", "abgesandtAm", "abgesandtUm"];

/** Neue Werte aus den bisherigen: `leert` fällt weg, die lfd. Nr. zählt hoch. */
function folgeauftrag(werte: Werte, leert: readonly Feldschluessel[]): Werte {
    const neu: Werte = { ...werte };
    for (const schluessel of leert) {
        delete neu[schluessel];
    }
    if (werte.laufendeNummer) {
        neu.laufendeNummer = hochzaehlen(werte.laufendeNummer);
    }
    return neu;
}

/** „Nächster Auftrag“: Rahmen bleibt, Empfänger, Auftrag, Durchführung und „Abgesandt“ leer. */
export function naechsterAuftrag(werte: Werte): Werte {
    return folgeauftrag(werte, NAECHSTER_LEERT);
}

/** „Auftrag kopieren“: alles bleibt, nur Empfänger und „Abgesandt“ leer. */
export function auftragKopieren(werte: Werte): Werte {
    return folgeauftrag(werte, KOPIE_LEERT);
}

/** Ob irgendein Feld etwas enthält. */
export function hatInhalt(werte: Werte): boolean {
    return FELDER.some(feld => (werte[feld.schluessel] ?? "").trim() !== "");
}

function normal(text: string): string {
    return text.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
}

const KOEPFE = new Map<string, Feldschluessel>();
for (const feld of FELDER) {
    for (const kopf of [feld.titel, feld.schluessel, ...(feld.auch ?? [])]) {
        if (!KOEPFE.has(normal(kopf))) {
            KOEPFE.set(normal(kopf), feld.schluessel);
        }
    }
}

/**
 * Spaltenkopf zum Feld. Erkannt werden der Titel der Vorlage, Kurzformen
 * („1a“, „Nr.“) und ein Kopf, der mit der Kennung eines Unterpunkts beginnt
 * („4c Kraftstoff“).
 */
export function feldZuKopf(kopf: string): Feldschluessel | undefined {
    const schluessel = KOEPFE.get(normal(kopf));
    if (schluessel) {
        return schluessel;
    }
    const kennung = /^\s*([134])\s*([a-g])(?![a-z])/i.exec(kopf);
    if (kennung) {
        const punkt = `${kennung[1]}${kennung[2]?.toLowerCase()}`;
        return UNTERPUNKTE.find(eintrag => eintrag === punkt);
    }
    return undefined;
}

export interface Tabellenzeile {
    /** Zeilennummer in der Datei, ab 1. */
    zeile: number;
    werte: Werte;
}

export interface Tabelle {
    zeilen: Tabellenzeile[];
    /** Erkannte Spalten in der Reihenfolge der Datei. */
    spalten: Feldschluessel[];
    /** Spaltenköpfe, die keinem Feld zugeordnet werden konnten. */
    unbekannt: string[];
}

/**
 * Macht aus einer Tabelle aus Text (Excel oder CSV) die Aufträge. Die
 * Kopfzeile ist die erste der ersten zehn Zeilen mit einem bekannten Kopf;
 * leere Zeilen werden übersprungen.
 */
export function leseTabelle(tabelle: readonly (readonly string[])[]): Tabelle {
    let kopfIndex = -1;
    for (let index = 0; index < Math.min(10, tabelle.length); index++) {
        if ((tabelle[index] ?? []).some(zelle => feldZuKopf(zelle))) {
            kopfIndex = index;
            break;
        }
    }
    if (kopfIndex < 0) {
        throw new Error("Keine bekannte Spalte gefunden. Erwartet werden Köpfe wie „Empfänger“, „2 Auftrag“ oder „1a Gefahren- / Schadenlage“, am einfachsten über die Vorlage.");
    }
    const kopf = tabelle[kopfIndex] ?? [];
    const zuordnung = kopf.map(zelle => feldZuKopf(zelle));
    const unbekannt = kopf.filter((zelle, index) => zelle.trim() !== "" && !zuordnung[index]);
    const zeilen: Tabellenzeile[] = [];
    for (let index = kopfIndex + 1; index < tabelle.length; index++) {
        const werte: Werte = {};
        (tabelle[index] ?? []).forEach((zelle, spalte) => {
            const schluessel = zuordnung[spalte];
            const text = zelle.replace(/\r\n?/g, "\n").trim();
            if (schluessel && text) {
                // Doppelte Spalten: Inhalte zusammenfügen statt still zu überschreiben.
                // Mehrere Spalten „5 …“ ergeben je eine Formularzeile.
                const trenner = schluessel === "fuehrung" ? "\n\n" : "\n";
                werte[schluessel] = werte[schluessel] ? `${werte[schluessel]}${trenner}${text}` : text;
            }
        });
        if (hatInhalt(werte)) {
            zeilen.push({ zeile: index + 1, werte });
        }
    }
    return { zeilen, spalten: zuordnung.filter((s): s is Feldschluessel => Boolean(s)), unbekannt };
}

/** Kopfzeile und eine Beispielzeile für die CSV-Vorlage. */
export function vorlageTabelle(): string[][] {
    return [FELDER.map(feld => feld.titel), FELDER.map(feld => feld.beispiel)];
}
