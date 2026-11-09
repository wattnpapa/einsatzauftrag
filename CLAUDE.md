# CLAUDE.md

Bibliothek, die den Einsatzauftrag (Fb Fü 3, THW) mit jsPDF als PDF setzt, dazu
eine Web-App in `web/`. Aufbau und Gestaltung folgen `wattnpapa/bos-nachrichtenvordruck`.

## Befehle

```bash
npm install
npm test             # Vitest (watch)
npx vitest run --coverage
npm run typecheck
npm run build        # tsc → dist/
npm run beispiel     # Beispiel-PDFs → ausgabe/
npm run web          # Web-App im Entwicklungsserver
npm run web:build    # Web-App → dist-web/, GitHub Pages
```

## Regeln

- `src/satz.ts` rechnet den Satz als Liste von Zeichenelementen, `src/zeichnen.ts`
  zeichnet sie. Die Web-Vorschau (`web/src/vorschau.ts`) nutzt dieselbe Liste;
  nichts im Satz darf vom Zeichnen abhängen.
- Ziel ist eine A4-Seite: automatische Schrift 10–8 pt, dann Fortsetzungsseiten.
  Text wird nie abgeschnitten, nur einzeilige Felder (am, um, von, lfd. Nr.) kürzen mit „…“.
- `jspdf` bleibt Peer-Abhängigkeit, keine Laufzeit-Abhängigkeiten dazunehmen.
- Auszeichnungen in Markdown wie auf GitHub (`**fett**`, `*kursiv*`, `~~durch~~`,
  Tabellen mit `|`, `\` maskiert) liest `src/format.ts`; der Text bleibt reiner Text.
  Keine eigene Schreibweise außerhalb von Markdown (deshalb keine Farben). Text ohne Auszeichnung wird genau wie
  vorher gesetzt (jsPDF-Umbruch), das soll so bleiben.
- Die Zeichenreihenfolge ist festgeschrieben: gleiche Eingabe, gleiche PDF.
- Kein THW-Zeichen im Repository; Logos bringt der Nutzer selbst mit.
- Felder der Maske und Spalten der Tabelle kommen beide aus `web/src/felder.ts`.
- Relative Imports mit `.js`-Endung (ESM für Node).
- Die Web-App ist Anwendung, nicht Bibliothek: ihre Abhängigkeiten (Vite, ExcelJS,
  Archivo) bleiben devDependencies und landen nie in `dist/`. Gestaltung nach dem
  Design-System von erfassungsbogen.app (`web/src/stil.css`: Rollen-Token, Radius 0,
  Anzeigemodi Standard/Dunkel/Feld/Nacht).
- Commits: Conventional Commits, z. B. `feat(einsatzauftrag): …`.
