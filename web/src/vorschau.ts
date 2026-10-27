import { BLATT_BREITE, BLATT_HOEHE, type Seite } from "../../src/index.js";

// Vorschau als SVG aus denselben Zeichenelementen, die in die PDF gehen.
// Umbruch und Schriftgröße stimmen damit genau; die Schrift des Browsers
// weicht von Helvetica leicht ab und wird auf die gemessene Breite gestaucht.

const SVG = "http://www.w3.org/2000/svg";
const PT = 25.4 / 72;

function element<K extends keyof SVGElementTagNameMap>(name: K, attribute: Record<string, string | number>): SVGElementTagNameMap[K] {
    const knoten = document.createElementNS(SVG, name);
    for (const [schluessel, wert] of Object.entries(attribute)) {
        knoten.setAttribute(schluessel, String(wert));
    }
    return knoten;
}

function bildQuelle(daten: string | Uint8Array, format: "PNG" | "JPEG"): string {
    if (typeof daten === "string") {
        return daten.startsWith("data:") ? daten : `data:image/${format.toLowerCase()};base64,${daten}`;
    }
    let binaer = "";
    daten.forEach(byte => {
        binaer += String.fromCharCode(byte);
    });
    return `data:image/${format.toLowerCase()};base64,${btoa(binaer)}`;
}

/** Eine Seite als SVG-Element im Maßstab mm. */
export function seiteAlsSvg(seite: Seite, beschriftung: string): SVGSVGElement {
    const svg = element("svg", { viewBox: `0 0 ${BLATT_BREITE} ${BLATT_HOEHE}`, role: "img", "aria-label": beschriftung, class: "seitenbild" });
    svg.appendChild(element("rect", { x: 0, y: 0, width: BLATT_BREITE, height: BLATT_HOEHE, fill: "#ffffff" }));
    for (const teil of seite.elemente) {
        switch (teil.art) {
            case "flaeche":
                svg.appendChild(element("rect", { x: teil.x, y: teil.y, width: teil.b, height: teil.h, fill: teil.farbe }));
                break;
            case "linie":
                svg.appendChild(element("line", {
                    x1: teil.x1, y1: teil.y1, x2: teil.x2, y2: teil.y2, stroke: "#000000", "stroke-width": teil.staerke
                }));
                break;
            case "text": {
                const text = element("text", {
                    x: teil.x,
                    y: teil.y,
                    "font-size": teil.groesse * PT,
                    "font-family": "Helvetica, Arial, 'Liberation Sans', sans-serif",
                    "font-weight": teil.fett ? 700 : 400,
                    fill: teil.farbe,
                    "text-anchor": teil.ausrichtung === "links" ? "start" : teil.ausrichtung === "mitte" ? "middle" : "end"
                });
                if (teil.text.length > 1 && teil.breite > 0) {
                    text.setAttribute("textLength", String(teil.breite));
                    text.setAttribute("lengthAdjust", "spacingAndGlyphs");
                }
                text.setAttribute("xml:space", "preserve");
                text.textContent = teil.text;
                svg.appendChild(text);
                break;
            }
            case "bild":
                svg.appendChild(element("image", {
                    x: teil.x, y: teil.y, width: teil.b, height: teil.h, href: bildQuelle(teil.daten, teil.format), preserveAspectRatio: "none"
                }));
                break;
        }
    }
    return svg;
}

/** Ersetzt den Inhalt von `ziel` durch die Seiten. */
export function zeigeSeiten(ziel: HTMLElement, seiten: readonly Seite[]): void {
    const neu = seiten.map((seite, index) => seiteAlsSvg(seite, `Vorschau Seite ${index + 1} von ${seiten.length}`));
    ziel.replaceChildren(...neu);
}
