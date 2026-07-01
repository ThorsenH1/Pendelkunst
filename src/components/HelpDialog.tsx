'use client';

interface Props {
  onClose: () => void;
}

const STEPS: Array<{ emoji: string; title: string; text: string }> = [
  {
    emoji: '🪜',
    title: '1. Bygg riggen',
    text: 'Legg et kosteskaft mellom to stolrygger (eller bruk et stativ/en trefot). Heng en snor fra midten. En Y-oppheng (to snorer som møtes i én) gir de fineste rosettene — akkurat som «Frekvensforhold»-glidebryteren i appen.',
  },
  {
    emoji: '🥤',
    title: '2. Lag malingsbeholderen',
    text: 'Ta en plastkopp eller flaske og lag et lite hull i bunnen (start med 2–3 mm). Tape gjerne noen mynter eller muttere rundt koppen — ekstra vekt gir jevnere, roligere baner. Dette tilsvarer «Tykkelse» og «Mengde maling» i appen.',
  },
  {
    emoji: '🎨',
    title: '3. Bland malingen riktig',
    text: 'Konsistensen er alfa og omega: som tykk fløte. En god start er 2 deler akrylmaling + 1 del vann. For tykk = drypper ikke; for tynn = renner ut og spruter. Dette er «Viskositet» i appen (Akryl-området fungerer best).',
  },
  {
    emoji: '🖼️',
    title: '4. Klargjør underlaget',
    text: 'Legg lerret eller papir på gulvet under pendelen, med plast eller aviser godt utover — det spruter mer enn du tror! Lys bakgrunn får fargene til å synge.',
  },
  {
    emoji: '🤲',
    title: '5. Slipp eller kast',
    text: 'Hold fingeren over hullet, trekk koppen ut til siden og slipp rett — da tegnes en smal vifte som sakte roterer («Slipp» i appen). Gi den et lite dytt sidelengs, så åpner banen seg til de klassiske runde rosettene («Kast»). Jo lenger ut du starter, jo mer energi og større mønster.',
  },
  {
    emoji: '⏳',
    title: '6. La fysikken male',
    text: 'Pendelen tegner selv: banen krymper sakte innover mens den roterer (presesjon) — det er dette som lager rosetten. Ikke rør! Bytt farge og slipp på nytt for flere lag, akkurat som «Nytt lag» i appen.',
  },
];

export default function HelpDialog({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog" aria-modal="true" aria-label="Slik gjør du det hjemme"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full p-6 shadow-2xl max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-white">Slik gjør du det hjemme</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors"
            aria-label="Lukk"
          >
            ✕
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-5">
          Alt i denne appen er hentet fra ekte pendelmaleri. Slik lager du det samme
          på kjøkkengulvet — og hva hver innstilling tilsvarer i virkeligheten.
        </p>

        <div className="space-y-4">
          {STEPS.map((s) => (
            <div key={s.title} className="flex gap-3">
              <span className="text-2xl shrink-0" aria-hidden>{s.emoji}</span>
              <div>
                <h3 className="text-sm font-semibold text-gray-200">{s.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{s.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
          <strong className="text-gray-300">Tips:</strong> Øv i appen først! Finn en kombinasjon
          du liker (snorlengde, energi, farger), noter frøet — og gjenskap oppsettet fysisk.
          Kortere snor svinger raskere, lengre snor gir roligere, større buer. Lykke til! 🎨
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          Skjønner — la meg male!
        </button>
      </div>
    </div>
  );
}
