'use client';

import { MutableRefObject, useState } from 'react';
import { PaintPoint, SimulationSettings } from '@/lib/types';
import { renderPointsHighResAsync } from '@/lib/painter';

interface Props {
  pointsRef: MutableRefObject<PaintPoint[]>;
  settings: SimulationSettings;
  onClose: () => void;
}

const SIZES = [
  { label: 'Web (1024px)', size: 1024, desc: 'Sosiale medier, nettbruk' },
  { label: 'A4 (2048px)', size: 2048, desc: 'A4-utskrift 300 DPI' },
  { label: 'A3 (4096px)', size: 4096, desc: 'A3 / plakat' },
  { label: 'Veggmaleri (6144px)', size: 6144, desc: 'Stort veggmaleri' },
  { label: 'Maks (8192px)', size: 8192, desc: 'Profesjonell utskrift' },
];

export default function ExportDialog({ pointsRef, settings, onClose }: Props) {
  const [size, setSize] = useState(2048);
  const [fmt, setFmt] = useState<'png' | 'jpeg'>('png');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState(0);

  async function doExport() {
    setBusy(true);
    setProgress(0);
    setMsg('Forbereder eksport...');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas error');

      setMsg(`Tegner ${pointsRef.current.length.toLocaleString('no-NO')} strøk...`);
      await renderPointsHighResAsync(
        ctx,
        pointsRef.current,
        size,
        settings.symmetry,
        settings.backgroundColor,
        (f) => setProgress(f),
        undefined,
        settings.paperTexture ?? 0,
      );

      setMsg('Konverterer...');
      await new Promise((r) => setTimeout(r, 30));
      const blob: Blob | null = await new Promise((res) =>
        c.toBlob((b) => res(b), fmt === 'png' ? 'image/png' : 'image/jpeg', fmt === 'jpeg' ? 0.95 : undefined),
      );
      if (!blob) throw new Error('Blob error');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pendelkunst-${size}px.${fmt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMsg('Ferdig!');
      setTimeout(() => { setBusy(false); onClose(); }, 700);
    } catch {
      setMsg('Feil — prøv en mindre størrelse');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Eksporter maleri">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-md w-full p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-1">Eksporter maleri</h2>
        <p className="text-gray-400 text-sm mb-5">Eksporten gjengir nøyaktig det du ser på skjermen, i valgt oppløsning.</p>

        <div className="space-y-2 mb-5">
          {SIZES.map((s) => (
            <button key={s.size} onClick={() => setSize(s.size)} disabled={busy}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors disabled:opacity-50 ${
                size === s.size
                  ? 'bg-indigo-600/20 border border-indigo-500 text-indigo-300'
                  : 'bg-gray-800 border border-transparent text-gray-300 hover:bg-gray-700'
              }`}>
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 mb-5">
          {(['png', 'jpeg'] as const).map((f) => (
            <button key={f} onClick={() => setFmt(f)} disabled={busy}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                fmt === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {f === 'png' ? 'PNG (beste kvalitet)' : 'JPEG (mindre fil)'}
            </button>
          ))}
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 mb-5 text-xs text-gray-400">
          <strong className="text-gray-300">Tips:</strong> For veggmaleri, bruk minst 4096px.
          {pointsRef.current.length > 0 && (
            <span className="block mt-1">Maleriet: {pointsRef.current.length.toLocaleString('no-NO')} malingsstrøk.</span>
          )}
        </div>

        {busy && (
          <div className="mb-4">
            <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            {msg && <div className="mt-2 text-sm text-indigo-300 text-center">{msg} {progress > 0 && progress < 1 ? `${Math.round(progress * 100)}%` : ''}</div>}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors disabled:opacity-50">
            Avbryt
          </button>
          <button onClick={doExport} disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors disabled:opacity-50">
            {busy ? 'Eksporterer...' : 'Last ned'}
          </button>
        </div>
      </div>
    </div>
  );
}
