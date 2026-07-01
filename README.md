# Pendelkunst 🎨

En interaktiv pendelmaleri-simulator som gjenskaper kunsten bak ekte pendelmaleri — med realistisk fysikk, lagvis maling og høyoppløst eksport som er identisk med det du ser på skjermen.

**Live:** [pendelkunst.vercel.app](https://pendelkunst.vercel.app)

## Funksjoner

- **Realistisk pendelfysikk** — dempet svingebevegelse fra ω = √(g/L) **med ekte Airy-presesjon**: den elliptiske banen roterer sakte i sirkulasjonsretningen (Ω = ⅜·ω·a·b/L²), slik en ekte sfærisk pendel gjør. Det er dette som tegner de runde rosettene fra virale pendelmaleri-videoer.
- **Slipp eller kast** — mykt slipp (rosett) eller sirkelkast med justerbar fart og retning (ring/spiral).
- **Lerretstekstur** — subtil, deterministisk korn og vev i underlaget (følger med i eksporten).
- **Våt-i-våt fargeblanding** — overlappende strøk multipliseres som ekte pigment.
- **Pendel-rigg** — se snoren og malingsbeholderen svinge over lerretet mens den maler.
- **Videoopptak** — ta opp maleprosessen og last ned som video (WebM/MP4).
- **Reproduserbare frø** — samme frø + samme innstillinger gir nøyaktig samme maleri. Del frøet, del kunsten.
- **«Slik gjør du det hjemme»** — innebygd guide som kobler hver innstilling til ekte pendelmaleri på kjøkkengulvet.
- **Lagvis maling** — mal flere lag oppå hverandre; angre siste lag når som helst.
- **7 penseltyper** — bøtte, fin/flat pensel, tusj, dryppepinne, klemflaske og spray, med realistisk flyt, pølping, drypp og sprut.
- **Klikkplassering** — klikk på lerretet for å velge slipp-punkt og energi.
- **8 forhåndsinnstillinger** + **«Overrask meg»** for tilfeldige, smakfulle motiver.
- **Underlag-bevegelse** — roter eller oscillér lerretet mens du maler.
- **Symmetri** — speiling og 3–12-fold rotasjonssymmetri.
- **Galleri** — lagre og last inn malerier (IndexedDB, lokalt i nettleseren).
- **Identisk eksport (WYSIWYG)** — hvert strøk har et deterministisk frø, så PNG/JPEG-eksporten gjengir nøyaktig skjermbildet, opp til 8192 × 8192 px. Eksporten er ikke-blokkerende med fremdriftsvisning.
- **Tastatursnarveier** — `Mellomrom` start/pause, `R` overrask, `N` nytt, `E` eksport, `S` lagre, `G` galleri, `Ctrl/⌘+Z` angre, `?` hjelp.
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
