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
    plugins: [offline()],
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
