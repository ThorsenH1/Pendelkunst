# Pendelkunst 🎨

En interaktiv pendelmaleri-simulator som gjenskaper kunsten bak ekte pendelmaleri — med realistisk fysikk, lagvis maling og høyoppløst eksport som er identisk med det du ser på skjermen.

**Live:** [pendelkunst.vercel.app](https://pendelkunst.vercel.app)

## Funksjoner

- **Realistisk pendelfysikk** — dempet svingebevegelse fra ω = √(g/L). Et naturlig, lite sidespark ved slipp åpner svingen til en presesserende ellipse (den klassiske rosetten), akkurat som en ekte hånd-slipp aldri er helt radiell.
- **Slipp eller kast** — mykt slipp (rosett) eller sirkelkast med justerbar fart og retning (ring/spiral).
- **Lagvis maling** — mal flere lag oppå hverandre; angre siste lag når som helst.
- **7 penseltyper** — bøtte, fin/flat pensel, tusj, dryppepinne, klemflaske og spray, med realistisk flyt, pølping, drypp og sprut.
- **Klikkplassering** — klikk på lerretet for å velge slipp-punkt og energi.
- **8 forhåndsinnstillinger** + **«Overrask meg»** for tilfeldige, smakfulle motiver.
- **Underlag-bevegelse** — roter eller oscillér lerretet mens du maler.
- **Symmetri** — speiling og 3–12-fold rotasjonssymmetri.
- **Galleri** — lagre og last inn malerier (IndexedDB, lokalt i nettleseren).
- **Identisk eksport (WYSIWYG)** — hvert strøk har et deterministisk frø, så PNG/JPEG-eksporten gjengir nøyaktig skjermbildet, opp til 8192 × 8192 px. Eksporten er ikke-blokkerende med fremdriftsvisning.
- **Tastatursnarveier** — `Mellomrom` start/pause, `R` overrask, `N` nytt, `E` eksport, `S` lagre, `G` galleri, `Ctrl/⌘+Z` angre.
- **Installerbar (PWA)** og delbar med OpenGraph-forhåndsvisning.

## Teknologi

- Next.js 14 (App Router) + TypeScript (strict)
- Canvas 2D med 2048 px offscreen-malelerret
- Deterministisk mulberry32-RNG for WYSIWYG-eksport
- Tailwind CSS · Vercel-deploy

## Kjør lokalt

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # produksjonsbygg
```

## Lisens

**Alle rettigheter forbeholdt.** Se [LICENSE](LICENSE).
