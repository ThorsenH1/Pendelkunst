'use client';

import { SimulationSettings, SimulationState, HoleConfig, CanvasMotionMode, ThrowMode, BrushType } from '@/lib/types';
import { presets, createDefaultSettings, newSeed } from '@/lib/presets';

interface Props {
  settings: SimulationSettings;
  onSettingsChange: (s: SimulationSettings) => void;
  simState: SimulationState;
  onSimStateChange: (state: SimulationState) => void;
  onStartLayer: () => void;
  onExport: () => void;
  onSave: () => void;
  onShowGallery: () => void;
  onRandomize: () => void;
  onNewPainting: () => void;
  onUndo: () => void;
  onShowHelp: () => void;
  onShare: () => void;
  canUndo: boolean;
  saveMsg?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-800 pb-4 mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, formatValue, disabled }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; formatValue?: (v: number) => string; disabled?: boolean;
}) {
  return (
    <label className={`block mb-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-500 font-mono text-xs">
          {formatValue ? formatValue(value) : value.toFixed(step < 1 ? (step < 0.01 ? 4 : 2) : 0)}
        </span>
      </div>
      <input type="range" className="w-full" value={value} min={min} max={max} step={step} disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export default function ControlPanel({
  settings, onSettingsChange, simState, onSimStateChange,
  onStartLayer, onExport, onSave, onShowGallery, onRandomize, onNewPainting, onUndo, onShowHelp, onShare, canUndo, saveMsg,
}: Props) {
  const canEdit = simState === 'idle' || simState === 'done';

  function update(partial: Partial<SimulationSettings>) {
    onSettingsChange({ ...settings, ...partial });
  }

  function updatePendulum(field: string, val: number) {
    update({ pendulum: { ...settings.pendulum, [field]: val } });
  }

  function applyPreset(i: number) {
    if (!canEdit) return;
    const p = presets[i];
    const base = createDefaultSettings();
    onSettingsChange({
      ...base,
      ...p.settings,
      pendulum: p.settings.pendulum || base.pendulum,
      paint: p.settings.paint || base.paint,
      symmetry: p.settings.symmetry || base.symmetry,
      canvasMotion: p.settings.canvasMotion || base.canvasMotion,
      dropPosition: p.settings.dropPosition || base.dropPosition,
      throwMode: p.settings.throwMode || base.throwMode,
      throwSpeed: p.settings.throwSpeed ?? base.throwSpeed,
    });
  }

  function setHoleCount(count: number) {
    if (!canEdit) return;
    const cur = settings.paint.holes;
    const colors = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#ff006e', '#7209b7', '#f77f00', '#d62828'];
    const holes: HoleConfig[] = [];
    const aStep = (2 * Math.PI) / count;
    const r = count > 1 ? 0.025 : 0;
    for (let i = 0; i < count; i++) {
      holes.push(i < cur.length
        ? { ...cur[i], offsetX: count > 1 ? Math.cos(aStep * i) * r : 0, offsetY: count > 1 ? Math.sin(aStep * i) * r : 0 }
        : { offsetX: count > 1 ? Math.cos(aStep * i) * r : 0, offsetY: count > 1 ? Math.sin(aStep * i) * r : 0, color: colors[i % colors.length], thickness: 1 }
      );
    }
    update({ paint: { ...settings.paint, holes } });
  }

  function updateHoleColor(i: number, color: string) {
    const holes = [...settings.paint.holes];
    holes[i] = { ...holes[i], color };
    update({ paint: { ...settings.paint, holes } });
  }

  function updateHoleThickness(i: number, thickness: number) {
    const holes = [...settings.paint.holes];
    holes[i] = { ...holes[i], thickness };
    update({ paint: { ...settings.paint, holes } });
  }

  const dropDist = Math.sqrt(settings.dropPosition.x ** 2 + settings.dropPosition.y ** 2);

  return (
    <div className="p-4 text-sm">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🎨</span> Pendelkunst
        </h1>
        <div className="flex gap-1.5">
          <button
            onClick={onShowHelp}
            className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
            aria-label="Slik gjør du det hjemme"
          >
            ❓
          </button>
          <button
            onClick={onShowGallery}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
          >
            🖼️ Galleri
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-xs mb-4">Lag ditt eget pendelmaleri med ekte fysikk</p>

      {/* Surprise me */}
      <button
        onClick={onRandomize}
        disabled={!canEdit}
        className="w-full mb-4 py-2.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        🎲 Overrask meg
      </button>

      {/* Presets */}
      <Section title="Forhåndsinnstillinger">
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p, i) => (
            <button key={p.name} onClick={() => applyPreset(i)} disabled={!canEdit}
              className="text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <span className="text-base mr-1" aria-hidden>{p.emoji}</span>
              <span className="text-gray-200 text-xs font-medium">{p.name}</span>
              <p className="text-[10px] text-gray-500 mt-0.5">{p.description}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* Drop / Throw mode */}
      <Section title="Slipp / Kast pendelen">
        <p className="text-[10px] text-gray-500 mb-2">Slipp = ekte rett slipp (smal vifte som sakte roterer). Kast = sirkelbevegelse som fyller lerretet med rosetter (som i de virale videoene).</p>
        <div className="grid grid-cols-3 gap-1.5 mb-3" role="group" aria-label="Slipp eller kast">
          {([
            ['drop', 'Slipp', '📍'],
            ['throw-ccw', 'Kast ↺', '🌀'],
            ['throw-cw', 'Kast ↻', '🔄'],
          ] as [ThrowMode, string, string][]).map(([mode, label, icon]) => (
            <button key={mode}
              onClick={() => update({ throwMode: mode })}
              disabled={!canEdit}
              aria-pressed={settings.throwMode === mode}
              className={`px-2 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                settings.throwMode === mode
                  ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
              <span className="text-sm" aria-hidden>{icon}</span>
              <span className="block">{label}</span>
            </button>
          ))}
        </div>

        {(settings.throwMode === 'throw-cw' || settings.throwMode === 'throw-ccw') && (
          <Slider label="Kasthastighet"
            value={settings.throwSpeed} min={0.3} max={3} step={0.1}
            formatValue={(v) => `${v.toFixed(1)}x`}
            onChange={(v) => update({ throwSpeed: v })} />
        )}

        <div className="bg-gray-800 rounded-lg p-3 mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Posisjon</span>
            <span>Energi: <strong className="text-indigo-400">{Math.round(dropDist / 1.5 * 100)}%</strong></span>
          </div>
          <p className="text-[10px] text-gray-500">Klikk på lerretet for å plassere pendelen.</p>
        </div>
        <Slider label="Energi (manuell)"
          value={dropDist} min={0.1} max={1.5} step={0.05}
          formatValue={(v) => `${Math.round(v / 1.5 * 100)}%`}
          onChange={(v) => {
            const angle = Math.atan2(settings.dropPosition.y, settings.dropPosition.x) || 0;
            update({ dropPosition: { x: Math.cos(angle) * v, y: Math.sin(angle) * v } });
          }}
        />
      </Section>

      {/* Pendulum physics */}
      <Section title="Pendelfysikk">
        <Slider label="Snorlengde"
          value={settings.pendulum.stringLength}
          min={0.3} max={3.0} step={0.05}
          formatValue={(v) => `${v.toFixed(2)} m`}
          onChange={(v) => updatePendulum('stringLength', v)} />
        <p className="text-[10px] text-gray-500 -mt-2 mb-3">Kortere snor = raskere svingninger. Lengre = saktere, mer grasiøst.</p>
        <Slider label="Frekvensforhold (Y-snor)"
          value={settings.pendulum.frequencyRatio}
          min={0.5} max={2.0} step={0.001}
          formatValue={(v) => {
            if (Math.abs(v - 1.0) < 0.005) return '1.000 (rosett)';
            if (Math.abs(v - 1.5) < 0.01) return '3:2 (Lissajous)';
            if (Math.abs(v - 5/3) < 0.01) return '5:3 (blomst)';
            if (Math.abs(v - 2.0) < 0.01) return '2:1 (figur-8)';
            return v.toFixed(3);
          }}
          onChange={(v) => updatePendulum('frequencyRatio', v)} />
        <p className="text-[10px] text-gray-500 -mt-2 mb-3">Nær 1.0 = rund, presesserende rosett (mest realistisk). Høyere = vevd moiré. 3:2 / 5:3 = Lissajous.</p>
        <Slider label="Demping (friksjon)"
          value={settings.pendulum.damping}
          min={0.0005} max={0.02} step={0.0005}
          formatValue={(v) => v < 0.002 ? 'Minimal' : v < 0.005 ? 'Lav' : v < 0.01 ? 'Moderat' : 'Høy'}
          onChange={(v) => updatePendulum('damping', v)} />
        <Slider label="Hastighet" value={settings.speed} min={0.1} max={5} step={0.1}
          formatValue={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => update({ speed: v })} />
      </Section>

      {/* Canvas Motion */}
      <Section title="Underlag-bevegelse">
        <p className="text-[10px] text-gray-500 mb-2">Velg hvordan lerretet beveger seg under pendelen. Bevegelsen avtar realistisk over tid.</p>
        <div className="grid grid-cols-3 gap-1.5 mb-3" role="group" aria-label="Underlag-bevegelse">
          {([
            ['still', 'Stille', '⬜'],
            ['circular', 'Sirkel', '🔄'],
            ['linear-x', 'V–H', '↔️'],
            ['linear-y', 'O–N', '↕️'],
            ['figure8', 'Figur-8', '♾️'],
          ] as const).map(([mode, label, icon]) => (
            <button key={mode}
              onClick={() => update({ canvasMotion: { ...settings.canvasMotion, mode: mode as CanvasMotionMode } })}
              disabled={!canEdit}
              aria-pressed={settings.canvasMotion.mode === mode}
              className={`px-2 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                settings.canvasMotion.mode === mode
                  ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
              <span className="text-sm" aria-hidden>{icon}</span>
              <span className="block">{label}</span>
            </button>
          ))}
        </div>
        {settings.canvasMotion.mode !== 'still' && (
          <>
            <Slider label="Bevegelseshastighet" value={settings.canvasMotion.speed}
              min={0.1} max={5} step={0.1} formatValue={(v) => `${v.toFixed(1)}x`}
              onChange={(v) => update({ canvasMotion: { ...settings.canvasMotion, speed: v } })} />
            <Slider label="Bevegelsesamplitude" value={settings.canvasMotion.amplitude}
              min={0.05} max={1} step={0.05} formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update({ canvasMotion: { ...settings.canvasMotion, amplitude: v } })} />
            <Slider label="Demping (avtar over tid)" value={settings.canvasMotion.damping}
              min={0} max={0.02} step={0.001}
              formatValue={(v) => v === 0 ? 'Ingen' : v < 0.005 ? 'Svak' : v < 0.01 ? 'Moderat' : 'Sterk'}
              onChange={(v) => update({ canvasMotion: { ...settings.canvasMotion, damping: v } })} />
          </>
        )}
      </Section>

      {/* Paint settings */}
      <Section title="Maling">
        <div className="mb-3">
          <span className="text-gray-300 text-sm block mb-2">Verktøy</span>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Penseltype">
            {([
              ['bucket', '🪣', 'Bøtte', 'Tykt, blobaktig, renner'],
              ['fine-brush', '🖌️', 'Fin pensel', 'Tynn, elegant, trykkvar'],
              ['flat-brush', '🖼️', 'Flat pensel', 'Bred, synlige bust'],
              ['marker', '🖊️', 'Tusj', 'Ren, jevn, heldekkende'],
              ['drip-stick', '🥢', 'Dryppepinne', 'Ujevn, klatter og striper'],
              ['squeeze', '🧴', 'Klemflaske', 'Glatt, hevet, jevn'],
              ['spray', '🎨', 'Spray', 'Finfordelt, sprøytet'],
            ] as [BrushType, string, string, string][]).map(([type, icon, label, desc]) => (
              <button key={type}
                onClick={() => update({ paint: { ...settings.paint, brushType: type } })}
                disabled={!canEdit}
                aria-pressed={settings.paint.brushType === type}
                className={`px-2 py-2 rounded-lg text-left transition-colors ${
                  settings.paint.brushType === type
                    ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}>
                <span className="text-sm" aria-hidden>{icon}</span>
                <span className="block text-[11px] font-medium">{label}</span>
                <span className="block text-[9px] opacity-60">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <span className="text-gray-300 text-sm block mb-2">Antall hull</span>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Antall hull">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button key={n} onClick={() => setHoleCount(n)} disabled={!canEdit}
                aria-pressed={settings.paint.holes.length === n}
                className={`w-9 h-9 rounded-lg font-bold text-sm transition-colors ${
                  settings.paint.holes.length === n ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <span className="text-gray-300 text-sm block mb-2">Farger og tykkelse</span>
          <div className="flex gap-2 flex-wrap">
            {settings.paint.holes.map((hole, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <input type="color" value={hole.color} onChange={(e) => updateHoleColor(i, e.target.value)} aria-label={`Farge for hull ${i + 1}`} />
                <input type="range" className="w-9" min={0.3} max={2} step={0.1} value={hole.thickness}
                  onChange={(e) => updateHoleThickness(i, parseFloat(e.target.value))}
                  aria-label={`Tykkelse for hull ${i + 1}`}
                  title={`Tykkelse: ${hole.thickness.toFixed(1)}`} />
                <span className="text-[10px] text-gray-500">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <Slider label="Tykkelse" value={settings.paint.baseThickness} min={0.5} max={8} step={0.1}
          onChange={(v) => update({ paint: { ...settings.paint, baseThickness: v } })} />
        <Slider label="Fargestyrke" value={settings.paint.opacity} min={0.1} max={1} step={0.05}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update({ paint: { ...settings.paint, opacity: v } })} />

        <label className="flex items-center gap-2 text-gray-300 mb-2 cursor-pointer">
          <input type="checkbox" checked={settings.paint.splashEnabled}
            onChange={(e) => update({ paint: { ...settings.paint, splashEnabled: e.target.checked } })}
            className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500" />
          <span className="text-sm">Sprut-effekt</span>
        </label>

        {settings.paint.splashEnabled && (
          <Slider label="Sprutintensitet" value={settings.paint.splashIntensity} min={0.1} max={1} step={0.05}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update({ paint: { ...settings.paint, splashIntensity: v } })} />
        )}

        <Slider label="Viskositet" value={settings.paint.viscosity} min={0} max={1} step={0.05}
          formatValue={(v) => v < 0.25 ? 'Vann' : v < 0.5 ? 'Akryl' : v < 0.75 ? 'Olje' : 'Honning'}
          onChange={(v) => update({ paint: { ...settings.paint, viscosity: v } })} />

        <Slider label="Mengde maling" value={settings.paint.bucketCapacity} min={10} max={100} step={5}
          formatValue={(v) => `${v}%`}
          onChange={(v) => update({ paint: { ...settings.paint, bucketCapacity: v } })} />
      </Section>

      {/* Realism */}
      <Section title="Realisme">
        <Slider label="Lerretstekstur" value={settings.paperTexture ?? 0} min={0} max={1} step={0.05}
          disabled={simState !== 'idle'}
          formatValue={(v) => v === 0 ? 'Av' : `${Math.round(v * 100)}%`}
          onChange={(v) => update({ paperTexture: v })} />
        <p className="text-[10px] text-gray-500 -mt-2 mb-3">Subtil korn og vev i underlaget — følger med i eksporten. Velges før du maler.</p>

        <label className="flex items-center gap-2 text-gray-300 mb-1 cursor-pointer">
          <input type="checkbox" checked={settings.paint.wetBlend === true}
            disabled={!canEdit}
            onChange={(e) => update({ paint: { ...settings.paint, wetBlend: e.target.checked } })}
            className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500" />
          <span className="text-sm">Våt-i-våt fargeblanding</span>
        </label>
        <p className="text-[10px] text-gray-500 mb-3 ml-6">Overlappende strøk blandes som ekte pigment. Best på lys bakgrunn.</p>

        <label className="flex items-center gap-2 text-gray-300 mb-1 cursor-pointer">
          <input type="checkbox" checked={settings.showRig !== false}
            onChange={(e) => update({ showRig: e.target.checked })}
            className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500" />
          <span className="text-sm">Vis pendel og snor</span>
        </label>
        <p className="text-[10px] text-gray-500 mb-1 ml-6">Tegner den svingende malingsbeholderen over lerretet mens den maler.</p>
      </Section>

      {/* Reproducibility & sharing */}
      <Section title="Frø og deling">
        <p className="text-[10px] text-gray-500 mb-2">Appen er 100 % deterministisk: samme innstillinger + samme frø gir nøyaktig samme maleri, hver eneste gang. Frøet styrer bare de bittesmå naturlige tilfeldighetene (skjelv og sprut) — bytt frø for en ny variant av samme oppsett.</p>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={1}
            max={999999}
            value={settings.seed ?? 1}
            disabled={!canEdit}
            onChange={(e) => {
              const v = Math.max(1, Math.min(999999, Math.round(parseFloat(e.target.value) || 1)));
              update({ seed: v });
            }}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-gray-200 font-mono text-sm border border-gray-700 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            aria-label="Frø for reproduserbart maleri"
          />
          <button
            onClick={() => update({ seed: newSeed() })}
            disabled={!canEdit}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Nytt tilfeldig frø"
            title="Nytt tilfeldig frø"
          >
            🎲
          </button>
        </div>
        <button
          onClick={onShare}
          className="w-full mt-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
          aria-label="Del eller kopier lenke til dette oppsettet"
        >
          🔗 Del oppsettet
        </button>
        <p className="text-[10px] text-gray-500 mt-1.5">
          Lenken inneholder alle innstillinger og frøet — den som åpner den kan gjenskape
          maleriet ditt nøyaktig.
        </p>
      </Section>

      {/* Symmetry */}
      <Section title="Symmetri">
        <div className="grid grid-cols-2 gap-2 mb-3" role="group" aria-label="Symmetri">
          {([['none', 'Ingen'], ['mirror-x', 'Speil ↔'], ['mirror-y', 'Speil ↕'], ['mirror-both', 'Speil ✚'], ['rotational', 'Rotasjon']] as const).map(([mode, label]) => (
            <button key={mode}
              onClick={() => update({ symmetry: { ...settings.symmetry, mode } })}
              disabled={!canEdit}
              aria-pressed={settings.symmetry.mode === mode}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                settings.symmetry.mode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
              {label}
            </button>
          ))}
        </div>
        {settings.symmetry.mode === 'rotational' && (
          <Slider label="Antall akser" value={settings.symmetry.rotationalOrder} min={2} max={12} step={1}
            onChange={(v) => update({ symmetry: { ...settings.symmetry, rotationalOrder: v } })} />
        )}
      </Section>

      {/* Background */}
      <Section title="Bakgrunn">
        <div className="flex items-center gap-3">
          <input type="color" value={settings.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })} disabled={!canEdit} aria-label="Lerretsfarge" />
          <span className="text-gray-400 text-xs">Lerretsfarge</span>
        </div>
      </Section>

      {/* Action buttons */}
      <div className="space-y-2 mt-2 pb-2">
        {simState === 'idle' && (
          <button onClick={onStartLayer}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors text-base">
            ▶ Start maleriet
          </button>
        )}
        {simState === 'running' && (
          <button onClick={() => onSimStateChange('paused')}
            className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors">
            ⏸ Pause
          </button>
        )}
        {simState === 'paused' && (
          <button onClick={() => onSimStateChange('running')}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors">
            ▶ Fortsett
          </button>
        )}
        {simState === 'done' && (
          <div className="text-center py-2 text-emerald-400 font-medium">✓ Maleriet er ferdig!</div>
        )}
        {simState === 'done' && (
          <button onClick={onStartLayer}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
            🎨 Nytt lag — mal videre
          </button>
        )}
        {(simState === 'paused' || simState === 'done') && (
          <button onClick={onSave}
            className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors">
            💾 Lagre maleri
          </button>
        )}
        {saveMsg && (
          <div className="text-center py-1 text-teal-400 text-xs animate-pulse" role="status">{saveMsg}</div>
        )}
        {canUndo && simState !== 'running' && (
          <button onClick={onUndo}
            className="w-full py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors">
            ↶ Angre siste lag
          </button>
        )}
        {(simState === 'paused' || simState === 'done' || simState === 'running') && (
          <button onClick={onNewPainting}
            className="w-full py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors">
            ⟲ Nytt maleri
          </button>
        )}
        {(simState === 'paused' || simState === 'done') && (
          <button onClick={onExport}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors">
            ⬇ Eksporter i høy oppløsning
          </button>
        )}
      </div>

      <p className="text-[10px] text-gray-600 pb-4 leading-relaxed">
        Snarveier: <kbd className="text-gray-400">Mellomrom</kbd> start/pause · <kbd className="text-gray-400">R</kbd> overrask · <kbd className="text-gray-400">N</kbd> nytt · <kbd className="text-gray-400">E</kbd> eksport · <kbd className="text-gray-400">Ctrl+Z</kbd> angre · <kbd className="text-gray-400">?</kbd> hjelp
      </p>
    </div>
  );
}
