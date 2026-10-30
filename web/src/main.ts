/// <reference types="vite/client" />
import { jsPDF } from "jspdf";
import "./seite.js";
import { ABSCHNITTE, setzeEinsatzauftrag, type EinsatzauftragLogo, type EinsatzauftragOptionen } from "../../src/index.js";
import { datenAusFragment, dekodiereWerte, istPdf, kodiereWerte, LANGER_LINK, leseAusPdf, linkMitDaten, tausender } from "./austausch.js";
import { dekodiereCsv, leseCsv, schreibeCsv } from "./csv.js";
import { auftragKopieren, FELDER, fuehrungText, fuehrungZeilen, hatInhalt, leseTabelle, naechsterAuftrag, vorlageTabelle, zuDaten, type Feldschluessel, type Tabellenzeile, type Werte } from "./felder.js";
import { leseLogo } from "./logo.js";
import { HERKUNFT, dateiname, erzeugePdf } from "./pdf.js";
import { zeigeSeiten } from "./vorschau.js";

declare const __FASSUNG__: string;

// ---- Hilfen ------------------------------------------------------------------

function el<T extends HTMLElement = HTMLElement>(id: string): T {
    const knoten = document.getElementById(id);
    if (!knoten) {
        throw new Error(`Element #${id} fehlt`);
    }
    return knoten as T;
}

function speicher(): Storage | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/** Schreibt in den lokalen Speicher und meldet, wenn das nicht geht (voll, Privatmodus). */
function merke(schluessel: string, wert: unknown): void {
    const warnung = el("speicher-warnung");
    try {
        const ablage = speicher();
        if (!ablage) {
            throw new Error("kein Speicher");
        }
        if (wert === undefined) {
            ablage.removeItem(schluessel);
        } else {
            ablage.setItem(schluessel, JSON.stringify(wert));
        }
        warnung.hidden = true;
    } catch {
        warnung.textContent = "Der Browser lässt nichts speichern (Privatmodus oder Speicher voll). Die Eingaben gehen beim Neuladen verloren; PDF herunterladen funktioniert weiter.";
        warnung.hidden = false;
    }
}

function lies<T>(schluessel: string): T | undefined {
    try {
        const text = speicher()?.getItem(schluessel);
        return text ? JSON.parse(text) as T : undefined;
    } catch {
        return undefined;
    }
}

function herunterladen(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function zwei(zahl: number): string {
    return String(zahl).padStart(2, "0");
}

function heute(): string {
    const jetzt = new Date();
    return `${zwei(jetzt.getDate())}.${zwei(jetzt.getMonth() + 1)}.${jetzt.getFullYear()}`;
}

function uhrzeit(): string {
    const jetzt = new Date();
    return `${zwei(jetzt.getHours())}:${zwei(jetzt.getMinutes())}`;
}

// ---- Kurzmeldung mit Zurücknehmen ---------------------------------------------

let kurzUhr: ReturnType<typeof setTimeout> | undefined;
let kurzRueckgaengig: (() => void) | undefined;

function kurzmeldung(text: string, rueckgaengig?: () => void, dauer = rueckgaengig ? 12_000 : 5_000): void {
    const kasten = el("kurzmeldung");
    el("kurzmeldung-text").textContent = text;
    kurzRueckgaengig = rueckgaengig;
    kasten.classList.toggle("mit-knopf", Boolean(rueckgaengig));
    kasten.hidden = false;
    clearTimeout(kurzUhr);
    kurzUhr = setTimeout(() => {
        kasten.hidden = true;
        kurzRueckgaengig = undefined;
    }, dauer);
}

el("kurzmeldung-rueckgaengig").addEventListener("click", ereignis => {
    ereignis.stopPropagation();
    kurzRueckgaengig?.();
    kurzRueckgaengig = undefined;
    el("kurzmeldung").hidden = true;
});
el("kurzmeldung").addEventListener("click", () => {
    if (!kurzRueckgaengig) {
        el("kurzmeldung").hidden = true;
    }
});
el("kurzmeldung-schliessen").addEventListener("click", ereignis => {
    ereignis.stopPropagation();
    el("kurzmeldung").hidden = true;
    kurzRueckgaengig = undefined;
});

// ---- Einstellungen: Kopf, Logo, Schrift ---------------------------------------

const EINSTELLUNGEN = "ea.einstellungen.v1";
const LOGO = "ea.logo.v1";

interface Einstellungen {
    kennung: string;
    organisation: string;
    schrift: "auto" | "10";
}

const einstellungen: Einstellungen = { kennung: "", organisation: "", schrift: "auto", ...lies<Partial<Einstellungen>>(EINSTELLUNGEN) };
let logo = lies<EinsatzauftragLogo>(LOGO);

function optionen(): EinsatzauftragOptionen {
    const ergebnis: EinsatzauftragOptionen = { logo, schriftgroesse: einstellungen.schrift === "10" ? 10 : undefined };
    if (einstellungen.kennung.trim()) {
        ergebnis.kennung = einstellungen.kennung.trim();
    }
    if (einstellungen.organisation.trim()) {
        ergebnis.organisation = einstellungen.organisation.trim();
    }
    return ergebnis;
}

function zeigeEinstellungen(): void {
    el<HTMLInputElement>("kennung").value = einstellungen.kennung;
    el<HTMLTextAreaElement>("organisation").value = einstellungen.organisation;
    for (const knopf of document.querySelectorAll<HTMLInputElement>('input[name="schrift"]')) {
        knopf.checked = knopf.value === einstellungen.schrift;
    }
    el("logo-stand").textContent = logo
        ? `Eigenes Logo, ${logo.breite} × ${logo.hoehe} Pixel. Es bleibt nur auf diesem Gerät.`
        : "Kein Logo. Ein eigenes Bild (PNG, JPEG, SVG) bleibt nur auf diesem Gerät.";
    el("logo-entfernen").hidden = !logo;
    const teile = [
        einstellungen.kennung.trim() || "Fb Fü 3",
        einstellungen.organisation.trim().replace(/\s*\n\s*/g, " ") || "Technisches Hilfswerk",
        logo ? "mit Logo" : "",
        einstellungen.schrift === "10" ? "immer 10 pt" : "Schrift automatisch"
    ];
    el("einstellungen-stand").textContent = teile.filter(Boolean).join(" · ");
}

function einstellungenGeaendert(): void {
    merke(EINSTELLUNGEN, einstellungen);
    zeigeEinstellungen();
    vorschauBald();
    if (tabelle) {
        zeigeTabelle();
    }
}

el<HTMLInputElement>("kennung").addEventListener("input", ereignis => {
    einstellungen.kennung = (ereignis.target as HTMLInputElement).value;
    einstellungenGeaendert();
});
el<HTMLTextAreaElement>("organisation").addEventListener("input", ereignis => {
    einstellungen.organisation = (ereignis.target as HTMLTextAreaElement).value;
    einstellungenGeaendert();
});
for (const knopf of document.querySelectorAll<HTMLInputElement>('input[name="schrift"]')) {
    knopf.addEventListener("change", () => {
        einstellungen.schrift = knopf.value === "10" ? "10" : "auto";
        einstellungenGeaendert();
    });
}
el<HTMLInputElement>("logo-datei").addEventListener("change", async ereignis => {
    const eingabe = ereignis.target as HTMLInputElement;
    const datei = eingabe.files?.[0];
    eingabe.value = "";
    if (!datei) {
        return;
    }
    try {
        const vorher = logo;
        logo = await leseLogo(datei);
        merke(LOGO, logo);
        einstellungenGeaendert();
        kurzmeldung("Logo übernommen.", () => {
            logo = vorher;
            merke(LOGO, logo);
            einstellungenGeaendert();
        });
    } catch (fehler) {
        kurzmeldung(fehler instanceof Error ? fehler.message : String(fehler));
    }
});
el("logo-entfernen").addEventListener("click", () => {
    const vorher = logo;
    logo = undefined;
    merke(LOGO, undefined);
    einstellungenGeaendert();
    kurzmeldung("Logo entfernt.", () => {
        logo = vorher;
        merke(LOGO, logo);
        einstellungenGeaendert();
    });
});

// ---- Eingabemaske --------------------------------------------------------------

const ENTWURF = "ea.entwurf.v1";
const maske = el<HTMLFormElement>("maske");

/** Karten der Maske in der Reihenfolge des Vordrucks. */
function baueMaske(): void {
    const ziel = el("maske-felder");
    const karte = (titel: string, erlaeuterung?: string) => {
        const abschnitt = document.createElement("section");
        abschnitt.className = "karte";
        const kopf = document.createElement("h3");
        kopf.textContent = titel;
        abschnitt.appendChild(kopf);
        if (erlaeuterung) {
            const hinweis = document.createElement("p");
            hinweis.className = "hinweis abschnitt-hinweis";
            hinweis.textContent = erlaeuterung;
            abschnitt.appendChild(hinweis);
        }
        ziel.appendChild(abschnitt);
        return abschnitt;
    };
    const eingabe = (behaelter: HTMLElement, schluessel: Feldschluessel, beschriftung: string, art: "input" | "textarea", klasse = "", platzhalter = "") => {
        const label = document.createElement("label");
        label.className = `feld ${klasse}`.trim();
        const text = document.createElement("span");
        text.textContent = beschriftung;
        label.appendChild(text);
        const steuer = document.createElement(art);
        steuer.name = schluessel;
        if (steuer instanceof HTMLTextAreaElement) {
            steuer.rows = 1;
        }
        if (platzhalter) {
            steuer.placeholder = platzhalter;
        }
        label.appendChild(steuer);
        behaelter.appendChild(label);
        return steuer;
    };
    const zeile = (behaelter: HTMLElement) => {
        const div = document.createElement("div");
        div.className = "zeile";
        behaelter.appendChild(div);
        return div;
    };

    const kopf = karte("Kopf");
    let reihe = zeile(kopf);
    eingabe(reihe, "absender", "Absender", "input", "", "z. B. ZTr TZ OV Oldenburg");
    eingabe(reihe, "laufendeNummer", "Lfd. Nr.", "input", "schmal").setAttribute("inputmode", "numeric");
    reihe = zeile(kopf);
    eingabe(reihe, "einsatz", "Für den Einsatz", "input", "", "z. B. Hochwasser Hunte 2026");
    eingabe(reihe, "empfaenger", "Empfänger", "input", "", "z. B. B-Gruppe 1. TZ");

    for (const abschnitt of ABSCHNITTE) {
        const behaelter = karte(`${abschnitt.nummer}. ${abschnitt.titel}`, abschnitt.unterpunkte.length > 0 ? undefined : abschnitt.erlaeuterung);
        if (abschnitt.unterpunkte.length > 0) {
            for (const punkt of abschnitt.unterpunkte) {
                eingabe(behaelter, punkt.kennung, `${punkt.kennung} · ${punkt.bedeutung}`, "textarea");
            }
        } else if (abschnitt.nummer === 2) {
            (eingabe(behaelter, "auftrag", "Erhaltener Auftrag", "textarea") as HTMLTextAreaElement).rows = 3;
        } else {
            // Eine Eingabe je Formularzeile; der Text dazu steht verborgen in „fuehrung“.
            const verborgen = document.createElement("input");
            verborgen.type = "hidden";
            verborgen.name = "fuehrung";
            behaelter.appendChild(verborgen);
            const liste = document.createElement("div");
            liste.id = "fuehrung-zeilen";
            behaelter.appendChild(liste);
            const weitere = knopf("Weitere Zeile", "fuehrung-weitere", "Weitere Zeile in Abschnitt 5 hinzufügen");
            weitere.classList.add("weitere-zeile");
            behaelter.appendChild(weitere);
        }
    }

    const ende = karte("Unterschrift und Absendung");
    reihe = zeile(ende);
    eingabe(reihe, "ortDatum", "Ort, Datum", "input", "", "z. B. Oldenburg, 27.10.2026");
    reihe.appendChild(knopf("Heute", "heute", "Datum von heute hinter den Ort setzen"));
    reihe = zeile(ende);
    eingabe(reihe, "unterschrift", "Unterschrift (Name, optional)", "input");
    eingabe(reihe, "dienststelle", "Dienststelle", "input");
    reihe = zeile(ende);
    eingabe(reihe, "abgesandtAm", "Abgesandt am", "input", "schmal");
    eingabe(reihe, "abgesandtUm", "um", "input", "schmal");
    eingabe(reihe, "abgesandtVon", "von", "input");
    reihe.appendChild(knopf("Jetzt", "jetzt", "Datum und Uhrzeit der Absendung jetzt eintragen"));
}

function knopf(text: string, id: string, beschreibung: string): HTMLButtonElement {
    const neu = document.createElement("button");
    neu.type = "button";
    neu.id = id;
    neu.textContent = text;
    neu.setAttribute("aria-label", beschreibung);
    return neu;
}

/** Die Eingaben von Abschnitt 5, mindestens zwei wie im Vordruck, oder `anzahl`. */
function fuehrungFelder(zeilen: readonly string[], anzahl = Math.max(2, zeilen.length)): void {
    const liste = el("fuehrung-zeilen");
    liste.replaceChildren(...Array.from({ length: anzahl }, (_, index) => {
        const label = document.createElement("label");
        label.className = "feld";
        label.appendChild(Object.assign(document.createElement("span"), { textContent: `Zeile ${index + 1}` }));
        const feldElement = document.createElement("textarea");
        feldElement.rows = 1;
        feldElement.className = "fuehrung-zeile";
        feldElement.value = zeilen[index] ?? "";
        label.appendChild(feldElement);
        return label;
    }));
    for (const feldElement of liste.querySelectorAll("textarea")) {
        anpassen(feldElement);
    }
}

function fuehrungAusFeldern(): void {
    const felder = [...el("fuehrung-zeilen").querySelectorAll<HTMLTextAreaElement>("textarea")];
    (maske.elements.namedItem("fuehrung") as HTMLInputElement).value = fuehrungText(felder.map(feldElement => feldElement.value));
}

function steuerelemente(): (HTMLInputElement | HTMLTextAreaElement)[] {
    return FELDER.map(eintrag => maske.elements.namedItem(eintrag.schluessel) as HTMLInputElement | HTMLTextAreaElement);
}

function werteDerMaske(): Werte {
    const werte: Werte = {};
    for (const steuer of steuerelemente()) {
        if (steuer.value) {
            werte[steuer.name as Feldschluessel] = steuer.value;
        }
    }
    return werte;
}

function setzeWerte(werte: Werte): void {
    for (const steuer of steuerelemente()) {
        steuer.value = werte[steuer.name as Feldschluessel] ?? "";
        if (steuer instanceof HTMLTextAreaElement) {
            anpassen(steuer);
        }
    }
    fuehrungFelder(fuehrungZeilen(werte.fuehrung ?? ""));
    geaendert();
}

/** Textfelder wachsen mit dem Text, damit nichts versteckt bleibt. */
function anpassen(feldElement: HTMLTextAreaElement): void {
    feldElement.style.height = "auto";
    feldElement.style.height = `${feldElement.scrollHeight + 2}px`;
}

let entwurfUhr: ReturnType<typeof setTimeout> | undefined;

function geaendert(): void {
    // Ein angezeigter Link gilt nur für den Stand, aus dem er entstand.
    el("link-ausgabe").hidden = true;
    clearTimeout(entwurfUhr);
    entwurfUhr = setTimeout(() => {
        const werte = werteDerMaske();
        merke(ENTWURF, hatInhalt(werte) ? { werte, zeit: Date.now() } : undefined);
        el("entwurf-stand").textContent = hatInhalt(werte)
            ? `Entwurf auf diesem Gerät gespeichert, ${uhrzeit()} Uhr.`
            : "";
    }, 400);
    vorschauBald();
}

maske.addEventListener("input", ereignis => {
    if (ereignis.target instanceof HTMLTextAreaElement) {
        anpassen(ereignis.target);
        if (ereignis.target.classList.contains("fuehrung-zeile")) {
            fuehrungAusFeldern();
        }
    }
    geaendert();
});
maske.addEventListener("submit", ereignis => ereignis.preventDefault());

// ---- Vorschau -------------------------------------------------------------------

/** Nur zum Messen der Textbreiten; gezeichnet wird in eine eigene PDF. */
const messPdf = new jsPDF({ unit: "mm", format: "a4" });
let vorschauUhr: ReturnType<typeof setTimeout> | undefined;

function vorschauBald(): void {
    clearTimeout(vorschauUhr);
    vorschauUhr = setTimeout(vorschauJetzt, 200);
}

function vorschauJetzt(): void {
    const satz = setzeEinsatzauftrag(messPdf, zuDaten(werteDerMaske()), { fusszeile: HERKUNFT, ...optionen() });
    zeigeSeiten(el("vorschau-seiten"), satz.seiten);
    const seiten = satz.seiten.length;
    el("vorschau-stand").textContent = `${seiten === 1 ? "1 Seite" : `${seiten} Seiten`}, Schrift ${String(satz.schriftgroesse).replace(".", ",")} pt`;
    const hinweis = el("seiten-hinweis");
    if (seiten > 1) {
        hinweis.textContent = einstellungen.schrift === "10"
            ? `Der Auftrag braucht ${seiten} Seiten. Mit „Schrift automatisch“ (unter „Kopf und Schrift“) wird bis 8 pt verkleinert, wenn er dann auf weniger Seiten passt; sonst Text kürzen.`
            : `Der Auftrag passt auch mit 8 pt nicht auf eine Seite und wird auf ${seiten} Seiten gesetzt. Jede Seite trägt Kopf, lfd. Nr. und Seitenzahl.`;
        hinweis.hidden = false;
    } else {
        hinweis.hidden = true;
    }
}

// ---- Aktionen der Maske ------------------------------------------------------------

async function pdfEinzeln(): Promise<{ blob: Blob; name: string }> {
    const werte = werteDerMaske();
    const { pdf } = await erzeugePdf([werte], optionen());
    return { blob: pdf.output("blob"), name: dateiname(1, new Date(), werte.laufendeNummer ?? "") };
}

function fehlertext(fehler: unknown): string {
    return fehler instanceof Error ? fehler.message : String(fehler);
}

el("einzeln-pdf").addEventListener("click", async () => {
    try {
        const { blob, name } = await pdfEinzeln();
        herunterladen(blob, name);
        kurzmeldung(`${name} heruntergeladen.`);
    } catch (fehler) {
        kurzmeldung(`Die PDF ließ sich nicht erzeugen: ${fehlertext(fehler)}`);
    }
});

el("einzeln-drucken").addEventListener("click", async () => {
    // Das Fenster sofort im Klick öffnen; erst danach entsteht die PDF
    // asynchron. Sonst sperren manche Browser das Fenster als Popup.
    const fenster = window.open("", "_blank");
    try {
        const { blob, name } = await pdfEinzeln();
        const url = URL.createObjectURL(blob);
        if (fenster && !fenster.closed) {
            fenster.location.href = url;
        } else {
            // Kein neues Fenster erlaubt (Popup-Sperre): dann eben herunterladen.
            herunterladen(blob, name);
            kurzmeldung("Der Browser hat das neue Fenster gesperrt; die PDF wurde stattdessen heruntergeladen.");
        }
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (fehler) {
        fenster?.close();
        kurzmeldung(`Die PDF ließ sich nicht erzeugen: ${fehlertext(fehler)}`);
    }
});

// ---- Als Link teilen ------------------------------------------------------------

/**
 * Schreibt den Link in die Zwischenablage. Geht das nicht (kein sicherer
 * Kontext, verweigert), steht er markiert in einem Textfeld.
 */
async function kopiereLink(link: Promise<string>): Promise<void> {
    let kopiert = false;
    try {
        // Mit ClipboardItem beginnt das Schreiben noch im Klick, während der
        // Link entsteht; Safari erlaubt die Zwischenablage nur so.
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": link.then(text => new Blob([text], { type: "text/plain" })) })]);
        kopiert = true;
    } catch {
        try {
            await navigator.clipboard.writeText(await link);
            kopiert = true;
        } catch {
            kopiert = false;
        }
    }
    let text: string;
    try {
        text = await link;
    } catch (fehler) {
        kurzmeldung(`Der Link ließ sich nicht erzeugen: ${fehlertext(fehler)}`);
        return;
    }
    const lang = text.length > LANGER_LINK ? " Achtung: Manche Messenger kürzen so lange Links; dann besser die PDF schicken." : "";
    if (kopiert) {
        el("link-ausgabe").hidden = true;
        kurzmeldung(`Link kopiert, ${tausender(text.length)} Zeichen. Die Daten stecken im Link, kein Server erhält sie.${lang}`, undefined, lang ? 12_000 : 5_000);
        return;
    }
    const feld = el<HTMLInputElement>("link-feld");
    feld.value = text;
    el("link-ausgabe").hidden = false;
    feld.focus();
    feld.select();
    kurzmeldung(`Der Browser lässt nicht in die Zwischenablage schreiben. Der Link (${tausender(text.length)} Zeichen) steht markiert unter den Knöpfen zum Kopieren.${lang}`, undefined, 12_000);
}

el("einzeln-link").addEventListener("click", () => {
    const werte = werteDerMaske();
    if (!hatInhalt(werte)) {
        kurzmeldung("Die Maske ist leer, es gibt noch nichts zu teilen.");
        return;
    }
    void kopiereLink(kodiereWerte(werte).then(kodiert => linkMitDaten(location.origin + location.pathname, kodiert)));
});

el<HTMLInputElement>("link-feld").addEventListener("focus", ereignis => (ereignis.target as HTMLInputElement).select());

/**
 * Steht `#a=…` in der Adresse, kommt der Auftrag in die Maske. Das Fragment
 * fällt danach aus der Adresse, damit ein Neuladen ihn nicht noch einmal setzt.
 */
async function auftragAusLink(): Promise<void> {
    const kodiert = datenAusFragment(location.hash);
    if (kodiert === undefined) {
        return;
    }
    history.replaceState(history.state, "", location.pathname + location.search);
    try {
        uebernimmAuftraege(await dekodiereWerte(kodiert), "Link", "Auftrag aus Link übernommen.");
    } catch (fehler) {
        kurzmeldung(`Der Link ließ sich nicht übernehmen. ${fehlertext(fehler)} Vielleicht wurde er beim Weitergeben gekürzt. Der Entwurf bleibt unverändert.`, undefined, 12_000);
    }
}

/** „Nächster Auftrag“ und „Auftrag kopieren“: neue Werte setzen, Fokus auf Empfänger. */
function folgeauftrag(neuAus: (werte: Werte) => Werte, meldung: string, zusatz = ""): void {
    const vorher = werteDerMaske();
    const neu = neuAus(vorher);
    setzeWerte(neu);
    (maske.elements.namedItem("empfaenger") as HTMLInputElement).focus();
    kurzmeldung(`${meldung}${neu.laufendeNummer ? `, lfd. Nr. ${neu.laufendeNummer}` : ""}.${zusatz}`, () => setzeWerte(vorher));
}

el("einzeln-naechster").addEventListener("click", () => folgeauftrag(naechsterAuftrag, "Nächster Auftrag"));
el("einzeln-kopieren").addEventListener("click", () => folgeauftrag(auftragKopieren, "Auftrag kopiert", " Jetzt den Empfänger eintragen."));

el("einzeln-leeren").addEventListener("click", () => {
    const vorher = werteDerMaske();
    if (!hatInhalt(vorher)) {
        return;
    }
    setzeWerte({});
    kurzmeldung("Alle Felder geleert.", () => setzeWerte(vorher));
});

maske.addEventListener("click", ereignis => {
    const ziel = ereignis.target;
    if (!(ziel instanceof HTMLButtonElement)) {
        return;
    }
    if (ziel.id === "heute") {
        const steuer = maske.elements.namedItem("ortDatum") as HTMLInputElement;
        const ort = steuer.value.replace(/,?\s*\d{1,2}\.\d{1,2}\.(\d{2,4})?\s*$/, "").trim();
        steuer.value = ort ? `${ort}, ${heute()}` : heute();
        geaendert();
    } else if (ziel.id === "fuehrung-weitere") {
        const felder = [...el("fuehrung-zeilen").querySelectorAll<HTMLTextAreaElement>("textarea")];
        fuehrungFelder(felder.map(feldElement => feldElement.value), felder.length + 1);
        el("fuehrung-zeilen").querySelector<HTMLTextAreaElement>("label:last-child textarea")?.focus();
    } else if (ziel.id === "jetzt") {
        (maske.elements.namedItem("abgesandtAm") as HTMLInputElement).value = heute();
        (maske.elements.namedItem("abgesandtUm") as HTMLInputElement).value = uhrzeit();
        geaendert();
    }
});

el("zur-vorschau").addEventListener("click", () => {
    el("vorschau").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---- Reiter -----------------------------------------------------------------------

const REITER = [
    { knopf: el("reiter-einzeln"), ansicht: el("ansicht-einzeln") },
    { knopf: el("reiter-tabelle"), ansicht: el("ansicht-tabelle") }
];

function waehleReiter(index: number, fokus = false): void {
    REITER.forEach((reiter, i) => {
        const aktiv = i === index;
        reiter.knopf.setAttribute("aria-selected", String(aktiv));
        reiter.knopf.tabIndex = aktiv ? 0 : -1;
        reiter.ansicht.hidden = !aktiv;
        if (aktiv && fokus) {
            reiter.knopf.focus();
        }
    });
}

REITER.forEach((reiter, index) => {
    reiter.knopf.addEventListener("click", () => waehleReiter(index));
    reiter.knopf.addEventListener("keydown", ereignis => {
        if (ereignis.key === "ArrowRight" || ereignis.key === "ArrowLeft") {
            waehleReiter((index + 1) % REITER.length, true);
            ereignis.preventDefault();
        }
    });
});

// ---- Tabelle ----------------------------------------------------------------------

let tabelle: { name: string; zeilen: Tabellenzeile[]; hinweise: string[] } | undefined;

el("vorlage-xlsx").addEventListener("click", async () => {
    try {
        const { erzeugeVorlage } = await import("./excel.js");
        herunterladen(await erzeugeVorlage(), "einsatzauftraege_vorlage.xlsx");
    } catch (fehler) {
        kurzmeldung(`Die Excel-Vorlage ließ sich nicht erzeugen: ${fehler instanceof Error ? fehler.message : String(fehler)}. Ohne Netz geht die CSV-Vorlage.`);
    }
});

el("vorlage-csv").addEventListener("click", () => {
    herunterladen(new Blob([schreibeCsv(vorlageTabelle())], { type: "text/csv;charset=utf-8" }), "einsatzauftraege_vorlage.csv");
});

/** Eingelesene Aufträge übernehmen: einer kommt in die Maske, mehrere wie eine Tabelle. */
function uebernimmAuftraege(auftraege: readonly Werte[], quelle: string, meldung: string): void {
    const [einziger] = auftraege;
    if (auftraege.length === 1 && einziger) {
        const vorher = werteDerMaske();
        setzeWerte(einziger);
        waehleReiter(0);
        kurzmeldung(meldung, () => setzeWerte(vorher));
        return;
    }
    tabelle = {
        name: quelle,
        zeilen: auftraege.map((werte, index) => ({ zeile: index + 1, werte })),
        hinweise: ["Mit dieser App erzeugte Aufträge, wieder eingelesen. „Zeile“ ist hier ihre Reihenfolge."]
    };
    el("tabelle-fehler").hidden = true;
    zeigeTabelle();
    waehleReiter(1);
}

/**
 * Liest eine Tabelle (Excel, CSV) oder eine PDF dieser App ein. `fehler` ist
 * die Stelle, an der ein Fehler erscheint: beim Ziel, auf das die Datei fiel.
 */
async function leseDatei(datei: File, fehler = el("tabelle-fehler")): Promise<void> {
    el("tabelle-fehler").hidden = true;
    el("einzeln-fehler").hidden = true;
    let pdf = false;
    try {
        const hinweise: string[] = [];
        const bytes = await datei.arrayBuffer();
        if (istPdf(datei.name, datei.type, bytes)) {
            pdf = true;
            uebernimmAuftraege(await leseAusPdf(bytes), datei.name, `Auftrag aus ${datei.name} übernommen.`);
            return;
        }
        let roh: string[][];
        if (/\.xlsx$/i.test(datei.name) || datei.type.includes("spreadsheetml")) {
            const { leseExcel } = await import("./excel.js");
            roh = await leseExcel(bytes, hinweise);
        } else {
            roh = leseCsv(dekodiereCsv(bytes), undefined, hinweise);
        }
        const gelesen = leseTabelle(roh);
        if (gelesen.unbekannt.length > 0) {
            hinweise.push(`Nicht erkannte Spalten, ignoriert: ${gelesen.unbekannt.map(kopf => `„${kopf}“`).join(", ")}.`);
        }
        if (gelesen.zeilen.length === 0) {
            throw new Error("Die Datei hat Spaltenköpfe, aber keine ausgefüllte Zeile.");
        }
        tabelle = { name: datei.name, zeilen: gelesen.zeilen, hinweise };
        zeigeTabelle();
        waehleReiter(1);
    } catch (grund) {
        // Eine PDF ohne Daten verwirft keine schon eingelesene Tabelle.
        if (!pdf) {
            tabelle = undefined;
            el("ergebnis").hidden = true;
        }
        fehler.textContent = fehlertext(grund);
        fehler.hidden = false;
    }
}

function zeigeTabelle(): void {
    if (!tabelle) {
        return;
    }
    const satzOptionen = { fusszeile: HERKUNFT, ...optionen() };
    const seiten = tabelle.zeilen.map(zeile => setzeEinsatzauftrag(messPdf, zuDaten(zeile.werte), satzOptionen).seiten.length);
    const summe = seiten.reduce((a, b) => a + b, 0);
    const anzahl = tabelle.zeilen.length;
    el("ergebnis-zusammenfassung").textContent = `${tabelle.name}: ${anzahl === 1 ? "1 Einsatzauftrag" : `${anzahl} Einsatzaufträge`} auf ${summe === 1 ? "1 Seite" : `${summe} Seiten`}. Jeder Auftrag beginnt auf einer neuen Seite.`;
    const mehrseitig = seiten.filter(zahl => zahl > 1).length;
    const warnungen = [...tabelle.hinweise];
    if (mehrseitig > 0) {
        warnungen.push(`${mehrseitig === 1 ? "Ein Auftrag braucht" : `${mehrseitig} Aufträge brauchen`} mehr als eine Seite (in der Übersicht markiert).`);
    }
    const warnung = el("ergebnis-warnung");
    warnung.replaceChildren(...warnungen.map(text => Object.assign(document.createElement("p"), { textContent: text })));
    warnung.hidden = warnungen.length === 0;

    const koerper = el<HTMLTableElement>("ergebnis-tabelle").tBodies[0] as HTMLTableSectionElement;
    koerper.replaceChildren(...tabelle.zeilen.map((zeile, index) => {
        const tr = document.createElement("tr");
        const zelle = (text: string, klasse = "") => {
            const td = document.createElement("td");
            td.textContent = text;
            if (klasse) {
                td.className = klasse;
            }
            tr.appendChild(td);
        };
        zelle(String(zeile.zeile));
        zelle(zeile.werte.laufendeNummer ?? "–", zeile.werte.laufendeNummer ? "" : "ohne");
        zelle(zeile.werte.empfaenger ?? "–", zeile.werte.empfaenger ? "" : "ohne");
        const auftrag = (zeile.werte.auftrag ?? "").replace(/\s+/g, " ");
        zelle(auftrag ? (auftrag.length > 80 ? `${auftrag.slice(0, 79)}…` : auftrag) : "–", auftrag ? "" : "ohne");
        zelle(String(seiten[index]), (seiten[index] ?? 1) > 1 ? "mehrseitig" : "");
        const td = document.createElement("td");
        const bearbeiten = document.createElement("button");
        bearbeiten.type = "button";
        bearbeiten.className = "link";
        bearbeiten.textContent = "In Maske";
        bearbeiten.setAttribute("aria-label", `Zeile ${zeile.zeile} in die Eingabemaske übernehmen`);
        bearbeiten.addEventListener("click", () => {
            const vorher = werteDerMaske();
            setzeWerte(zeile.werte);
            waehleReiter(0);
            window.scrollTo({ top: 0 });
            kurzmeldung(`Zeile ${zeile.zeile} in die Maske übernommen.`, hatInhalt(vorher) ? () => setzeWerte(vorher) : undefined);
        });
        td.appendChild(bearbeiten);
        tr.appendChild(td);
        return tr;
    }));
    el("ergebnis").hidden = false;
}

/** Dateiauswahl und Drop-Ziel; ein Fehler erscheint in `fehler` beim Ziel. */
function dateiZiel(eingabe: HTMLInputElement, ziel: HTMLElement, fehler: HTMLElement): void {
    eingabe.addEventListener("change", () => {
        const datei = eingabe.files?.[0];
        eingabe.value = "";
        if (datei) {
            void leseDatei(datei, fehler);
        }
    });
    ziel.addEventListener("dragover", ereignis => {
        ereignis.preventDefault();
        ziel.classList.add("ueber");
    });
    ziel.addEventListener("dragleave", () => ziel.classList.remove("ueber"));
    ziel.addEventListener("drop", ereignis => {
        ereignis.preventDefault();
        ereignis.stopPropagation();
        ziel.classList.remove("ueber");
        const datei = ereignis.dataTransfer?.files[0];
        if (datei) {
            void leseDatei(datei, fehler);
        }
    });
}

dateiZiel(el<HTMLInputElement>("datei"), el("datei-ziel"), el("tabelle-fehler"));
dateiZiel(el<HTMLInputElement>("einzeln-datei"), el("einzeln-ziel"), el("einzeln-fehler"));

// Eine Datei neben das Ziel fallen gelassen: nicht die Seite verlassen und die
// Datei öffnen, sondern genauso einlesen. Gezogener Text bleibt unberührt.
const mitDatei = (ereignis: DragEvent) => Boolean(ereignis.dataTransfer?.types.includes("Files"));
document.addEventListener("dragover", ereignis => {
    if (mitDatei(ereignis)) {
        ereignis.preventDefault();
    }
});
document.addEventListener("drop", ereignis => {
    if (!mitDatei(ereignis)) {
        return;
    }
    ereignis.preventDefault();
    const datei = ereignis.dataTransfer?.files[0];
    if (datei) {
        void leseDatei(datei, el("ansicht-einzeln").hidden ? el("tabelle-fehler") : el("einzeln-fehler"));
    }
});

el("tabelle-pdf").addEventListener("click", async () => {
    if (!tabelle) {
        return;
    }
    try {
        const { pdf } = await erzeugePdf(tabelle.zeilen.map(zeile => zeile.werte), optionen());
        const name = dateiname(tabelle.zeilen.length, new Date(), tabelle.zeilen[0]?.werte.laufendeNummer ?? "");
        herunterladen(pdf.output("blob"), name);
        kurzmeldung(`${name} heruntergeladen.`);
    } catch (fehler) {
        kurzmeldung(`Die PDF ließ sich nicht erzeugen: ${fehlertext(fehler)}`);
    }
});

// ---- Start ------------------------------------------------------------------------

baueMaske();
fuehrungFelder([]);
zeigeEinstellungen();
const entwurf = lies<{ werte: Werte; zeit: number }>(ENTWURF);
if (entwurf?.werte && hatInhalt(entwurf.werte)) {
    setzeWerte(entwurf.werte);
    const zeit = new Date(entwurf.zeit);
    el("entwurf-stand").textContent = `Entwurf vom ${zwei(zeit.getDate())}.${zwei(zeit.getMonth() + 1)}. um ${zwei(zeit.getHours())}:${zwei(zeit.getMinutes())} Uhr wiederhergestellt.`;
}
vorschauJetzt();
void auftragAusLink();
addEventListener("hashchange", () => void auftragAusLink());
for (const steuer of steuerelemente()) {
    if (steuer instanceof HTMLTextAreaElement) {
        anpassen(steuer);
    }
}
el("fassung").textContent = `Fassung ${__FASSUNG__}.`;

if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register("./sw.js").then(() => {
        el("offline-stand").hidden = false;
    }).catch(() => undefined);
}
