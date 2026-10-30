import { FELDER, type Werte } from "./felder.js";

// Aufträge als kurzer Text zum Mitführen: in den Metadaten der PDF und im
// Fragment eines Links. JSON der Feldwerte, deflate-raw über die eingebaute
// CompressionStream, dann base64url. Ohne Server, ohne weiteres Paket.

/** Fassung des Inhalts; eine neuere lehnt `dekodiereWerte` mit Hinweis ab. */
export const FASSUNG = 1;

/** Kennung vor den Daten in den PDF-Metadaten (Eintrag „Keywords“). */
export const PDF_KENNUNG = `einsatzauftrag:v${FASSUNG}:`;

/** Obergrenze des entpackten Inhalts, damit ein präparierter Link den Browser nicht flutet. */
const HOECHSTENS_BYTES = 4 * 1024 * 1024;

export const BESCHAEDIGT = "Die Auftragsdaten sind beschädigt oder unvollständig.";

/** Nur bekannte Felder mit Inhalt, in der Reihenfolge der Maske. */
function bereinigt(werte: Readonly<Record<string, unknown>>): Werte {
    const ergebnis: Werte = {};
    for (const feld of FELDER) {
        const wert = werte[feld.schluessel];
        if (typeof wert === "string" && wert.trim() !== "") {
            ergebnis[feld.schluessel] = wert;
        }
    }
    return ergebnis;
}

async function durch(bytes: Uint8Array, strom: CompressionStream | DecompressionStream, grenze = Infinity): Promise<Uint8Array> {
    const leser = new Blob([bytes as BlobPart]).stream().pipeThrough(strom).getReader();
    const teile: Uint8Array[] = [];
    let laenge = 0;
    for (;;) {
        const { done, value } = await leser.read();
        if (done) {
            break;
        }
        laenge += value.length;
        if (laenge > grenze) {
            await leser.cancel();
            throw new Error("zu groß");
        }
        teile.push(value);
    }
    const ganz = new Uint8Array(laenge);
    let stelle = 0;
    for (const teil of teile) {
        ganz.set(teil, stelle);
        stelle += teil.length;
    }
    return ganz;
}

function zuBase64url(bytes: Uint8Array): string {
    let binaer = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
        binaer += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binaer).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function ausBase64url(text: string): Uint8Array {
    if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) {
        throw new Error(BESCHAEDIGT);
    }
    const binaer = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binaer.length);
    for (let index = 0; index < binaer.length; index++) {
        bytes[index] = binaer.charCodeAt(index);
    }
    return bytes;
}

/** Einen oder mehrere Aufträge als base64url-Text. Leere Felder und fremde Schlüssel fallen weg. */
export async function kodiereWerte(werte: readonly Werte[] | Werte): Promise<string> {
    const alle: readonly Werte[] = Array.isArray(werte) ? werte : [werte as Werte];
    const json = JSON.stringify({ v: FASSUNG, auftraege: alle.map(eintrag => bereinigt(eintrag)) });
    return zuBase64url(await durch(new TextEncoder().encode(json), new CompressionStream("deflate-raw")));
}

/** Umkehrung von `kodiereWerte`. Unbekannte Schlüssel werden übergangen; kaputte Daten ergeben einen Fehler mit Erklärung. */
export async function dekodiereWerte(text: string): Promise<Werte[]> {
    const bytes = ausBase64url(text.trim());
    let inhalt: unknown;
    try {
        const json = new TextDecoder("utf-8", { fatal: true }).decode(await durch(bytes, new DecompressionStream("deflate-raw"), HOECHSTENS_BYTES));
        inhalt = JSON.parse(json);
    } catch {
        throw new Error(BESCHAEDIGT);
    }
    if (typeof inhalt !== "object" || inhalt === null || !("v" in inhalt) || typeof inhalt.v !== "number") {
        throw new Error(BESCHAEDIGT);
    }
    if (inhalt.v > FASSUNG) {
        throw new Error("Die Auftragsdaten stammen aus einer neueren Fassung der App. Bitte die Seite neu laden und es noch einmal versuchen.");
    }
    if (!("auftraege" in inhalt) || !Array.isArray(inhalt.auftraege) || inhalt.auftraege.length === 0
        || !inhalt.auftraege.every((eintrag: unknown) => typeof eintrag === "object" && eintrag !== null && !Array.isArray(eintrag))) {
        throw new Error(BESCHAEDIGT);
    }
    return (inhalt.auftraege as Record<string, unknown>[]).map(eintrag => bereinigt(eintrag));
}

// ---- PDF ---------------------------------------------------------------------

/** Ob die Datei eine PDF ist: Endung, Typ oder Signatur „%PDF-“ am Anfang. */
export function istPdf(name: string, typ: string, bytes: ArrayBuffer | Uint8Array): boolean {
    if (/\.pdf$/i.test(name) || typ === "application/pdf") {
        return true;
    }
    const ansicht = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return latin1(ansicht.subarray(0, 1024)).includes("%PDF-");
}

function latin1(bytes: Uint8Array): string {
    let text = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
        text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return text;
}

/**
 * Sucht die Kennung in den Bytes einer PDF und gibt die base64url-Daten dahinter
 * zurück. Bei mehreren Treffern (angehängte Änderungen) zählt der letzte.
 */
export function findePdfDaten(bytes: ArrayBuffer | Uint8Array): string | undefined {
    const text = latin1(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    const muster = new RegExp(`${PDF_KENNUNG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([A-Za-z0-9_-]+)`, "g");
    let gefunden: string | undefined;
    for (const treffer of text.matchAll(muster)) {
        gefunden = treffer[1];
    }
    return gefunden;
}

export const KEINE_PDF_DATEN = "Diese PDF enthält keine Auftragsdaten. Nur PDFs aus dieser App lassen sich wieder einlesen.";

/** Die Aufträge aus einer PDF dieser App; ohne Daten ein Fehler mit `KEINE_PDF_DATEN`. */
export async function leseAusPdf(bytes: ArrayBuffer | Uint8Array): Promise<Werte[]> {
    const daten = findePdfDaten(bytes);
    if (!daten) {
        throw new Error(KEINE_PDF_DATEN);
    }
    return dekodiereWerte(daten);
}
