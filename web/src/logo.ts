import type { EinsatzauftragLogo } from "../../src/index.js";

/** Größte Kantenlänge, auf die ein Logo verkleinert wird: reicht für 300 dpi bei 4 cm Breite. */
const MAX_KANTE = 600;

/**
 * Liest eine Bilddatei (PNG, JPEG, SVG, WebP, GIF) und macht daraus ein PNG
 * fester Höchstgröße, wie es jsPDF einbetten kann.
 */
export async function leseLogo(datei: File): Promise<EinsatzauftragLogo> {
    if (!datei.type.startsWith("image/")) {
        throw new Error("Das ist keine Bilddatei. Erwartet wird PNG, JPEG, SVG oder WebP.");
    }
    const url = URL.createObjectURL(datei);
    try {
        const bild = new Image();
        bild.src = url;
        await bild.decode().catch(() => {
            throw new Error("Das Bild ließ sich nicht lesen.");
        });
        const breite = bild.naturalWidth || 300;
        const hoehe = bild.naturalHeight || 150;
        const faktor = Math.min(1, MAX_KANTE / Math.max(breite, hoehe));
        const leinwand = document.createElement("canvas");
        leinwand.width = Math.max(1, Math.round(breite * faktor));
        leinwand.height = Math.max(1, Math.round(hoehe * faktor));
        leinwand.getContext("2d")?.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
        return { daten: leinwand.toDataURL("image/png"), format: "PNG", breite: leinwand.width, hoehe: leinwand.height };
    } finally {
        URL.revokeObjectURL(url);
    }
}
