import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

const OEFFENTLICH = new URL("./public/", import.meta.url);

/**
 * Fassung zum Anzeigen: Bauzeit in UTC und, wenn vorhanden, der Commit. Zwei
 * Auslieferungen am selben Tag lassen sich so unterscheiden.
 */
function fassung(): string {
    let commit = "";
    try {
        commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
        // Gebaut aus einem geänderten Arbeitsbaum: Das soll die Fassung zeigen.
        if (execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()) {
            commit += ", geändert";
        }
    } catch {
        commit = "";
    }
    const zeit = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
    return commit ? `${zeit} (${commit})` : zeit;
}
const FASSUNG = fassung();

/**
 * Setzt in jede Seite eine Content Security Policy. GitHub Pages lässt keine
 * eigenen Header zu, deshalb als <meta>. Die kurzen Inline-Skripte und das
 * Inline-Stylesheet im Kopf werden über ihren Hash freigegeben, nicht über
 * „unsafe-inline“. Fremd ist nur das Zählskript von gc.zgo.at; es darf
 * ausschließlich zu einsatzauftrag.goatcounter.com senden.
 */
function sicherheit(): Plugin {
    const hash = (inhalt: string) => `'sha256-${createHash("sha256").update(inhalt).digest("base64")}'`;
    return {
        name: "ea-csp",
        apply: "build",
        transformIndexHtml: {
            order: "post",
            handler(html) {
                const inline = (muster: RegExp) => [...html.matchAll(muster)].map(treffer => hash(treffer[1] ?? ""));
                const skripte = inline(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g);
                const formate = inline(/<style[^>]*>([\s\S]*?)<\/style>/g);
                const regeln = [
                    "default-src 'none'",
                    `script-src 'self' https://gc.zgo.at ${skripte.join(" ")}`.trim(),
                    `style-src 'self' ${formate.join(" ")}`.trim(),
                    "img-src 'self' data: blob: https://einsatzauftrag.goatcounter.com",
                    "font-src 'self' data:",
                    "connect-src 'self' https://einsatzauftrag.goatcounter.com",
                    "manifest-src 'self'",
                    "worker-src 'self'",
                    "base-uri 'self'",
                    "form-action 'self'",
                    "object-src 'none'"
                ].join("; ");
                return html.replace(/(<meta charset[^>]*>)/, `$1\n  <meta http-equiv="Content-Security-Policy" content="${regeln}" />`);
            }
        }
    };
}

/**
 * Legt beim Bauen sw.js an: die Vorlage aus web/offline/ mit der Liste aller
 * erzeugten Dateien und einer Version aus deren Inhalt. Ändert sich eine
 * Datei, ändert sich die Version, und der Browser holt die neue Fassung.
 * Ohne Abhängigkeit, damit die App nichts nachlädt, was sie nicht braucht.
 */
function offline(): Plugin {
    return {
        name: "ea-offline",
        apply: "build",
        enforce: "post",
        generateBundle(_, bundle) {
            const hash = createHash("sha256");
            const dateien = Object.values(bundle)
                .filter(datei => !datei.fileName.endsWith(".map"))
                .sort((a, b) => a.fileName.localeCompare(b.fileName))
                .map(datei => {
                    hash.update(datei.fileName);
                    hash.update(datei.type === "chunk" ? datei.code : datei.source);
                    return datei.fileName;
                });
            const oeffentlich = readdirSync(OEFFENTLICH).sort().map(name => {
                hash.update(name);
                hash.update(readFileSync(new URL(name, OEFFENTLICH)));
                return name;
            });
            const liste = ["./", ...[...dateien, ...oeffentlich].map(name => `./${name}`)];
            const vorlage = readFileSync(new URL("./offline/sw.js", import.meta.url), "utf8");
            this.emitFile({
                type: "asset",
                fileName: "sw.js",
                source: vorlage
                    .replace("__VERSION__", hash.digest("hex").slice(0, 16))
                .replace("__FASSUNG__", FASSUNG)
                    .replace("__DATEIEN__", JSON.stringify(liste, null, 4))
            });
        }
    };
}

// Die Web-App liegt in web/ und nutzt die Bibliothek direkt aus src/.
// Relative Basis: läuft unter einer eigenen Domain genauso wie unter
// <name>.github.io/einsatzauftrag/.
export default defineConfig({
    root: "web",
    base: "./",
    plugins: [sicherheit(), offline()],
    // Fassung zum Anzeigen im Fuß, dieselbe steht im Dienst.
    define: { __FASSUNG__: JSON.stringify(FASSUNG) },
    build: {
        outDir: "../dist-web",
        emptyOutDir: true,
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            input: {
                app: "web/index.html",
                impressum: "web/impressum.html",
                datenschutz: "web/datenschutz.html"
            }
        }
    }
});
