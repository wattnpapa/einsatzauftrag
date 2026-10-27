import "@fontsource-variable/archivo";
import "./stil.css";

// Gemeinsam für App und Rechtsseiten: Schrift, Gestaltung, Anzeigemodus und
// Sprungmarke. Die Rechtsseiten laden nur dieses Modul.

function speicher(): Storage | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

// ---- Anzeigemodus --------------------------------------------------------

const MODUS_SCHLUESSEL = "ea.anzeigemodus.v1";
const MODI = ["standard", "dunkel", "feld", "nacht"] as const;
type Modus = (typeof MODI)[number];

function aktuellerModus(): Modus {
    const klassen = document.documentElement.classList;
    return MODI.find(modus => klassen.contains(`${modus}-modus`)) ?? "standard";
}

// Der title-Hinweis erscheint beim Antippen nicht; die Erklärung steht deshalb sichtbar unter dem Schalter.
const ERKLAERUNG: Record<Modus, string> = {
    standard: "Feld: große Knöpfe, hoher Kontrast für draußen. Nacht: gedimmt, schont die Augen im Dunkeln.",
    dunkel: "Dunkel: heller Text auf dunklem Grund. Für Einsätze im Dunkeln ist „Nacht“ noch gedämpfter.",
    feld: "Feld: große Knöpfe und hoher Kontrast für draußen und Handschuhe.",
    nacht: "Nacht: gedimmt und warm, schont die Dunkelanpassung der Augen."
};

function erklaeren(modus: Modus): void {
    const zeile = document.getElementById("modus-erklaerung");
    if (zeile) {
        zeile.textContent = ERKLAERUNG[modus];
    }
}

function setzeModus(modus: Modus): void {
    for (const andere of MODI) {
        document.documentElement.classList.toggle(`${andere}-modus`, andere === modus && modus !== "standard");
    }
    speicher()?.setItem(MODUS_SCHLUESSEL, modus);
    for (const knopf of document.querySelectorAll<HTMLButtonElement>(".anzeige-schalter button")) {
        knopf.setAttribute("aria-pressed", String(knopf.dataset["modus"] === modus));
    }
    const farbe = modus === "nacht" ? "#221f16" : modus === "dunkel" ? "#0f1116" : "#12275e";
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", farbe);
    erklaeren(modus);
    // Am Telefon steht die Erklärung erst nach einer Wahl: Beim ersten Besuch schiebt sie sonst die Maske unter den Bildschirm.
    // Am Telefon nach einigen Sekunden wieder weg, damit die Maske nicht dauerhaft tiefer rückt.
    const zeile = document.getElementById("modus-erklaerung");
    zeile?.classList.add("gewechselt");
    clearTimeout(erklaerungUhr);
    erklaerungUhr = setTimeout(() => zeile?.classList.remove("gewechselt"), 8_000);
}
let erklaerungUhr: ReturnType<typeof setTimeout> | undefined;

for (const knopf of document.querySelectorAll<HTMLButtonElement>(".anzeige-schalter button")) {
    knopf.addEventListener("click", () => setzeModus(knopf.dataset["modus"] as Modus));
}
for (const knopf of document.querySelectorAll<HTMLButtonElement>(".anzeige-schalter button")) {
    knopf.setAttribute("aria-pressed", String(knopf.dataset["modus"] === aktuellerModus()));
}
erklaeren(aktuellerModus());

document.getElementById("sprungmarke")?.addEventListener("click", () => {
    const inhalt = document.getElementById("inhalt");
    if (!inhalt) {
        return;
    }
    inhalt.focus();
    inhalt.scrollIntoView();
});


// ---- Widerspruch gegen die Reichweitenmessung ----------------------------

// GoatCounter zählt nicht, solange localStorage „skipgc" auf „t" steht.
const nichtZaehlen = document.getElementById("nicht-zaehlen");
if (nichtZaehlen instanceof HTMLInputElement) {
    nichtZaehlen.checked = speicher()?.getItem("skipgc") === "t";
    nichtZaehlen.addEventListener("change", () => {
        if (nichtZaehlen.checked) {
            speicher()?.setItem("skipgc", "t");
        } else {
            speicher()?.removeItem("skipgc");
        }
    });
}
