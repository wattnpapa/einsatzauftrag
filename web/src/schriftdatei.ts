import type { Schriftart } from "../../src/index.js";

// Eigene Schrift für die allgemeine Gestaltung, etwa Aptos: Die App bringt
// keine mit (Aptos gehört Microsoft), der Nutzer wählt die TrueType-Dateien
// aus seiner Office-Installation. Sie bleiben im Browser und gehen mit in
// die PDF; die Vorschau meldet sie unter demselben Namen beim Browser an.

/** Größe, ab der eine Datei sicher keine Schrift für ein Formular ist. */
const MAX_BYTES = 4 * 1024 * 1024;

function base64(bytes: ArrayBuffer): string {
    let binaer = "";
    new Uint8Array(bytes).forEach(byte => {
        binaer += String.fromCharCode(byte);
    });
    return btoa(binaer);
}

function bytes(base64Text: string): ArrayBuffer {
    const binaer = atob(base64Text);
    const ergebnis = new Uint8Array(binaer.length);
    for (let index = 0; index < binaer.length; index++) {
        ergebnis[index] = binaer.charCodeAt(index);
    }
    return ergebnis.buffer;
}

/** Name der Schrift aus dem Dateinamen: „Aptos-Bold.ttf“ und „aptos.ttf“ ergeben beide „Aptos“. */
export function schriftname(dateiname: string): string {
    const kern = dateiname.replace(/\.[^.]+$/, "").replace(/[-_ ]?(bold|fett|regular|normal|display|serif|narrow|light|semibold|extrabold)$/i, "").trim();
    return kern ? kern.charAt(0).toUpperCase() + kern.slice(1) : "Eigene";
}

/** Ob die Datei dem Namen nach der fette Schnitt ist. */
export function istFett(dateiname: string): boolean {
    return /bold|fett|[-_ ]b\.ttf$/i.test(dateiname);
}

/**
 * Liest eine oder zwei TrueType-Dateien (normal und fett, erkannt am Namen) zu
 * einer Schriftart. Eine zweite normale Datei ersetzt die erste; fehlt der
 * fette Schnitt, bleibt der vorhandene (aus `bisher`) erhalten.
 */
export async function leseSchrift(dateien: readonly File[], bisher?: Schriftart): Promise<Schriftart> {
    const neu: { name?: string; normal?: string; fett?: string } = {};
    for (const datei of dateien) {
        if (!/\.ttf$/i.test(datei.name)) {
            throw new Error(`„${datei.name}“ ist keine TrueType-Datei (.ttf). OpenType mit CFF-Umrissen (.otf) kann die PDF nicht einbetten.`);
        }
        if (datei.size > MAX_BYTES) {
            throw new Error(`„${datei.name}“ ist mit ${Math.round(datei.size / 1024 / 1024)} MB zu groß für eine Schrift.`);
        }
        const inhalt = await datei.arrayBuffer();
        const kopf = new DataView(inhalt);
        if (inhalt.byteLength < 12 || ![0x00010000, 0x74727565].includes(kopf.getUint32(0))) {
            throw new Error(`„${datei.name}“ ist keine TrueType-Schrift.`);
        }
        if (istFett(datei.name)) {
            neu.fett = base64(inhalt);
        } else {
            neu.normal = base64(inhalt);
            neu.name = schriftname(datei.name);
        }
    }
    if (neu.normal) {
        // Neuer normaler Schnitt: ein alter fetter passt nicht mehr dazu.
        return { name: neu.name ?? "Eigene", normal: neu.normal, fett: neu.fett };
    }
    if (!bisher) {
        throw new Error("Es fehlt der normale Schnitt. Erwartet werden Aptos.ttf (und Aptos-Bold.ttf); eine Datei mit „Bold“ im Namen gilt als fett.");
    }
    return { name: bisher.name, normal: bisher.normal, fett: neu.fett ?? bisher.fett };
}

const angemeldet = new Set<string>();

/** Meldet die Schrift beim Browser an, damit die Vorschau sie zeigt. */
export async function meldeSchriftAn(schriftart: Schriftart | undefined): Promise<void> {
    if (!schriftart || typeof FontFace === "undefined" || !("fonts" in document)) {
        return;
    }
    const schluessel = `${schriftart.name}:${schriftart.normal.length}:${schriftart.fett?.length ?? 0}`;
    if (angemeldet.has(schluessel)) {
        return;
    }
    angemeldet.add(schluessel);
    const schnitte = [
        new FontFace(schriftart.name, bytes(schriftart.normal), { weight: "400" }),
        ...(schriftart.fett ? [new FontFace(schriftart.name, bytes(schriftart.fett), { weight: "700" })] : [])
    ];
    for (const schnitt of schnitte) {
        try {
            document.fonts.add(await schnitt.load());
        } catch {
            // Dann zeigt die Vorschau die Ersatzschrift; die PDF ist davon unberührt.
        }
    }
}
