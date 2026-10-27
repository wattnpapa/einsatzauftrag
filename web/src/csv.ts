// CSV lesen und schreiben, wie Excel und LibreOffice es in Deutschland tun:
// Semikolon als Trenner, Anführungszeichen um Felder mit Trenner oder
// Zeilenumbruch, verdoppelte Anführungszeichen im Feld.

/**
 * Macht aus den Bytes einer CSV-Datei Text. Erst UTF-8; scheitert das, ist es
 * fast immer Windows-1252, so speichert Excel unter Windows „CSV (Trennzeichen-
 * getrennt)“. Ohne diesen Rückfall würden aus Umlauten Ersatzzeichen und
 * Spalten wie „Empfänger“ nicht erkannt.
 */
export function dekodiereCsv(bytes: ArrayBuffer | Uint8Array): string {
    const anfang = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    // Excel „Unicode-Text“: UTF-16 mit Byte-Order-Mark, meist mit Tabulator getrennt.
    if (anfang[0] === 0xff && anfang[1] === 0xfe) {
        return new TextDecoder("utf-16le").decode(bytes);
    }
    if (anfang[0] === 0xfe && anfang[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(bytes);
    }
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        // Von Hand statt TextDecoder("windows-1252"): Node liest das als
        // Latin-1 und verliert dabei €, „“ und Gedankenstriche.
        return Array.from(new Uint8Array(bytes), byte =>
            byte >= 0x80 && byte < 0xa0 ? WINDOWS_1252[byte - 0x80] ?? "" : String.fromCharCode(byte)).join("");
    }
}

/** Windows-1252 an 0x80–0x9F; außerhalb davon gleicht es Latin-1. Leer: unbelegt. */
const WINDOWS_1252 = Array.from("€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ");

/** Trenner aus der Kopfzeile erraten: Semikolon, Tabulator oder Komma. */
export function erkenneTrenner(text: string): string {
    const kopf = text.split(/\r?\n/, 1)[0] ?? "";
    const kandidaten = [";", "\t", ","];
    let bester = ";";
    let anzahl = 0;
    for (const trenner of kandidaten) {
        const treffer = kopf.split(trenner).length - 1;
        if (treffer > anzahl) {
            bester = trenner;
            anzahl = treffer;
        }
    }
    return bester;
}

/**
 * `hinweise` sammelt Felder in Anführungszeichen, die über mehrere Zeilen
 * reichen und dort Trennzeichen enthalten: meist fehlt ein schließendes
 * Anführungszeichen, und die folgende Tabellenzeile steckt im Feld.
 */
export function leseCsv(text: string, trenner = erkenneTrenner(text), hinweise: string[] = []): string[][] {
    const quelle = text.replace(/^﻿/, "");
    const zeilen: string[][] = [];
    let zeile: string[] = [];
    let feld = "";
    let inAnfuehrung = false;
    // Für die Fehlermeldung: Zeile, in der das offene Anführungszeichen steht.
    let zeilennummer = 1;
    let anfuehrungAb = 0;

    for (let i = 0; i < quelle.length; i++) {
        const zeichen = quelle[i];
        if (inAnfuehrung) {
            if (zeichen === "\n") {
                zeilennummer++;
            }
            if (zeichen === "\"") {
                if (quelle[i + 1] === "\"") {
                    feld += "\"";
                    i++;
                } else {
                    inAnfuehrung = false;
                    // Geht der Text nach dem schließenden Zeichen weiter („"Zitat" und weiter“),
                    // war das Feld nicht in Anführungszeichen gefasst: sie gehören zum Inhalt.
                    const danach = quelle[i + 1];
                    if (danach !== undefined && danach !== trenner && danach !== "\n" && danach !== "\r") {
                        feld = `"${feld}"`;
                        continue;
                    }
                    if (feld.split(/\r?\n/).slice(1).some(zeile => zeile.includes(trenner))) {
                        hinweise.push(`Ab Zeile ${anfuehrungAb} umfasst ein Feld in Anführungszeichen mehrere Zeilen mit Trennzeichen. Fehlt dort ein schließendes Anführungszeichen? Dann ist die folgende Zeile im Feld verschwunden.`);
                    }
                }
            } else {
                feld += zeichen;
            }
            continue;
        }
        // Ein Anführungszeichen öffnet nur am Feldanfang; mitten im Text
        // (Text mit "Zitat") gehört es zum Inhalt, wie Excel es auch liest.
        if (zeichen === "\"" && feld === "") {
            inAnfuehrung = true;
            anfuehrungAb = zeilennummer;
        } else if (zeichen === trenner) {
            zeile.push(feld);
            feld = "";
        } else if (zeichen === "\n" || zeichen === "\r") {
            if (zeichen === "\r" && quelle[i + 1] === "\n") {
                i++;
            }
            zeilennummer++;
            zeile.push(feld);
            zeilen.push(zeile);
            zeile = [];
            feld = "";
        } else {
            feld += zeichen;
        }
    }
    if (inAnfuehrung) {
        // Sonst verschlucken die Anführungszeichen still alle folgenden Zeilen.
        throw new Error(`In Zeile ${anfuehrungAb} wird ein Anführungszeichen geöffnet und nicht wieder geschlossen. Bitte die Datei prüfen.`);
    }
    if (feld !== "" || zeile.length > 0) {
        zeile.push(feld);
        zeilen.push(zeile);
    }
    return zeilen;
}

export function schreibeCsv(zeilen: string[][], trenner = ";"): string {
    const feld = (wert: string) =>
        /[";\n\r,\t]/.test(wert) ? `"${wert.replace(/"/g, "\"\"")}"` : wert;
    // BOM, damit Excel die Datei als UTF-8 öffnet und Umlaute stimmen.
    return "﻿" + zeilen.map(zeile => zeile.map(feld).join(trenner)).join("\r\n") + "\r\n";
}
