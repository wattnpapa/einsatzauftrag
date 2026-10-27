// Dienst für den Start ohne Netz. Vorlage: web/vite.config.ts setzt beim Bauen
// VERSION und DATEIEN ein und legt das Ergebnis als sw.js neben index.html.
//
// Seiten: erst das Netz (damit eine neue Fassung ankommt), ohne Netz, bei
// Fehlerantwort oder nach drei Sekunden die gespeicherte. Alles andere hat
// einen Inhalts-Hash im Namen und kommt aus dem Speicher.
//
// Eine neue Fassung übernimmt sofort; die vorige bleibt als Speicher erhalten,
// damit ein noch offener Tab der alten Fassung seine Programmteile (etwa den
// Excel-Teil) auch ohne Netz findet.

const VERSION = "__VERSION__";
const FASSUNG = "__FASSUNG__";
const DATEIEN = __DATEIEN__;
const SPEICHER = `bnv-${VERSION}`;
const NETZ_WARTEN_MS = 3000;
// Steht erst im Speicher, wenn alle Dateien darin sind. Ein halb gefüllter
// Speicher aus einem gescheiterten Einrichten gilt nie als vorige Fassung.
const VOLLSTAENDIG = "./__vollstaendig__";
/** Wann zuletzt eine Seite aus dem Speicher statt vom Server kam. */
let ersatzSeit = 0;

self.addEventListener("install", ereignis => {
    // cache: "reload" geht am HTTP-Cache vorbei. Sonst könnte eine dort noch
    // liegende alte Startseite neben den neuen Programmteilen landen und die
    // App ohne Netz nie fertig laden.
    ereignis.waitUntil(caches.open(SPEICHER)
        .then(speicher => speicher.addAll(DATEIEN.map(datei => new Request(datei, { cache: "reload" })))
            .then(() => speicher.put(VOLLSTAENDIG, new Response(FASSUNG))))
        .then(() => self.skipWaiting())
        .catch(fehler => caches.delete(SPEICHER).then(() => {
            throw fehler;
        })));
});

self.addEventListener("activate", ereignis => {
    // Die aktuelle und die letzte vollständige vorige Fassung bleiben, alles andere fällt weg.
    ereignis.waitUntil(caches.keys()
        .then(namen => Promise.all(namen
            .filter(name => name.startsWith("bnv-") && name !== SPEICHER)
            .map(name => caches.open(name)
                .then(speicher => speicher.match(VOLLSTAENDIG))
                .then(marke => ({ name, vollstaendig: Boolean(marke) })))))
        .then(andere => {
            const vorige = andere.filter(eintrag => eintrag.vollstaendig).at(-1)?.name;
            return Promise.all(andere.filter(eintrag => eintrag.name !== vorige).map(eintrag => caches.delete(eintrag.name)));
        })
        .then(() => self.clients.claim()));
});

/** Erst in der aktuellen Fassung suchen, dann in der vorigen. */
function ausSpeicher(anfrage) {
    return caches.open(SPEICHER)
        .then(speicher => speicher.match(anfrage, { ignoreSearch: true }))
        .then(gefunden => gefunden ?? caches.match(anfrage, { ignoreSearch: true }));
}

function seite(anfrage) {
    const ersatz = () => (ersatzSeit = Date.now(), ausSpeicher(anfrage))
        .then(gefunden => gefunden ?? ausSpeicher(new URL("./index.html", self.registration.scope).href))
        .then(gefunden => gefunden ?? Response.error());
    return new Promise(fertig => {
        let erledigt = false;
        const ende = antwort => {
            if (!erledigt) {
                erledigt = true;
                fertig(antwort);
            }
        };
        // Bei schwachem Netz nicht ewig warten: nach drei Sekunden die gespeicherte Seite.
        const uhr = setTimeout(() => ende(ersatz()), NETZ_WARTEN_MS);
        // no-cache: beim Server nachfragen, statt eine alte Seite aus dem HTTP-Cache zu nehmen.
        fetch(anfrage.url, { cache: "no-cache", credentials: "same-origin" })
            .then(antwort => {
                clearTimeout(uhr);
                // Eine Fehlerseite des Servers (404, 503 …) soll die gespeicherte App nicht verdrängen.
                if (antwort.ok && !erledigt) {
                    ersatzSeit = 0;
                }
                ende(antwort.ok ? antwort : ersatz().then(gespeichert => gespeichert.type === "error" ? antwort : gespeichert));
            })
            .catch(() => {
                clearTimeout(uhr);
                ende(ersatz());
            });
    });
}

function programmteil(anfrage) {
    return ausSpeicher(anfrage).then(gefunden => gefunden ?? fetch(anfrage).then(antwort => {
        // Was nachgeladen werden musste, für den nächsten Start ohne Netz merken.
        if (antwort.ok && antwort.type === "basic") {
            const kopie = antwort.clone();
            caches.open(SPEICHER).then(speicher => speicher.put(anfrage, kopie));
        }
        return antwort;
    }));
}

self.addEventListener("fetch", ereignis => {
    const anfrage = ereignis.request;
    if (anfrage.method !== "GET" || new URL(anfrage.url).origin !== self.location.origin) {
        return;
    }
    ereignis.respondWith(anfrage.mode === "navigate" ? seite(anfrage) : programmteil(anfrage));
});

// Die Seite fragt nach dem Start, welche Fassung der Dienst hat und ob sie
// selbst aus dem Speicher kam.
self.addEventListener("message", ereignis => {
    if (ereignis.data === "stand?") {
        ereignis.source?.postMessage({ art: "stand", fassung: FASSUNG, ausSpeicher: Date.now() - ersatzSeit < 30_000 });
    }
});
