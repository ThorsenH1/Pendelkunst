# Pendelkunst 🎨

En interaktiv pendulmaleri-simulator som gjenskaper kunsten bak ekte pendelmaleri — med realistisk fysikk, lagvis maling og eksport i høy oppløsning.

**Live demo:** [pendelkunst.vercel.app](https://pendelkunst.vercel.app)

## Funksjoner

- **Realistisk pendelfysikk** — dempet svingebevegelse basert på ω = √(g/L), Lissajous-mønstre, og kaotiske baner
- **Lagvis maling** — mal flere lag oppå hverandre med ulike farger, mønstre og innstillinger
- **Klikkplassering** — klikk på lerretet for å velge slipppunkt
- **8 forhåndsinnstillinger** — Rosett, Organisk, Lissajous, Kaotisk, Zen, Galakse, Blomst, Regnbue
- **Kastmodus** — slipp, kast, eller sirkulær startbevegelse
- **Lerretsbevegelse** — roter eller oscillér lerretet under maling
- **Symmetri** — speiling, 3–8-fold rotasjonssymmetri
- **Maleregenskaper** — viskositet, tykkelse, sprut, bøttekapasitet, flere hull
- **Galleri** — lagre og last inn malerier (IndexedDB)
- **Høyoppløselig eksport** — PNG i 4096 × 4096 px

## Teknologi

- Next.js 14 (App Router) + TypeScript
- Canvas API med 2048 px offscreen-malelerret
- Tailwind CSS
- Vercel-deploy

## Kjør lokalt

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

## Lisens

**Alle rettigheter forbeholdt.** Se [LICENSE](LICENSE) for detaljer.
