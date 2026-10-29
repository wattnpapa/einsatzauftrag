import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { istFett, leseSchrift, schriftname } from "../../web/src/schriftdatei.js";

const normal = readFileSync(new URL("../fixtures/RedHatMono-Regular.ttf", import.meta.url));
const fett = readFileSync(new URL("../fixtures/RedHatMono-Bold.ttf", import.meta.url));

function datei(name: string, inhalt: Uint8Array | string): File {
    return new File([inhalt as BlobPart], name, { type: "font/ttf" });
}

describe("schriftname", () => {
    it("leitet den Namen aus dem Dateinamen ab", () => {
        expect(schriftname("Aptos.ttf")).toBe("Aptos");
        expect(schriftname("aptos-bold.ttf")).toBe("Aptos");
        expect(schriftname("Carlito_Regular.TTF")).toBe("Carlito");
        expect(schriftname(".ttf")).toBe("Eigene");
    });

    it("erkennt den fetten Schnitt am Namen", () => {
        expect(istFett("Aptos-Bold.ttf")).toBe(true);
        expect(istFett("aptosbold.ttf")).toBe(true);
        expect(istFett("Aptos.ttf")).toBe(false);
    });
});

describe("leseSchrift", () => {
    it("liest normal und fett zu einer Schriftart", async () => {
        const schrift = await leseSchrift([datei("Aptos.ttf", normal), datei("Aptos-Bold.ttf", fett)]);
        expect(schrift.name).toBe("Aptos");
        expect(schrift.normal).toBe(normal.toString("base64"));
        expect(schrift.fett).toBe(fett.toString("base64"));
    });

    it("ergänzt einen fetten Schnitt zur vorhandenen Schrift, ersetzt mit neuem normalen aber alles", async () => {
        const bisher = { name: "Aptos", normal: normal.toString("base64") };
        const ergaenzt = await leseSchrift([datei("Aptos-Bold.ttf", fett)], bisher);
        expect(ergaenzt).toEqual({ name: "Aptos", normal: bisher.normal, fett: fett.toString("base64") });
        const neu = await leseSchrift([datei("Carlito.ttf", normal)], ergaenzt);
        expect(neu.name).toBe("Carlito");
        expect(neu.fett).toBeUndefined();
    });

    it("weist falsche Dateien ab", async () => {
        await expect(leseSchrift([datei("Aptos-Bold.ttf", fett)])).rejects.toThrow(/normale Schnitt/);
        await expect(leseSchrift([datei("Aptos.otf", normal)])).rejects.toThrow(/keine TrueType-Datei/);
        await expect(leseSchrift([datei("Aptos.ttf", "kein font")])).rejects.toThrow(/keine TrueType-Schrift/);
    });
});
