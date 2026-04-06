'use client';

import { useState, useRef, useCallback } from 'react';
import PaintCanvas from '@/components/PaintCanvas';
import ControlPanel from '@/components/ControlPanel';
import ExportDialog from '@/components/ExportDialog';
import GalleryPanel from '@/components/GalleryPanel';
import { SimulationSettings, SimulationState, PaintPoint } from '@/lib/types';
import { createDefaultSettings } from '@/lib/presets';
import { savePainting } from '@/lib/gallery';

export default function Home() {
  const [settings, setSettings] = useState<SimulationSettings>(createDefaultSettings);
  const [simState, setSimState] = useState<SimulationState>('idle');
  const [showExport, setShowExport] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadImage, setLoadImage] = useState<Blob | null>(null);
  const pointsRef = useRef<PaintPoint[]>([]);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const handleSimState = useCallback((s: SimulationState) => setSimState(s), []);
  const handleSettings = useCallback((s: SimulationSettings) => setSettings(s), []);
  const handleImageLoaded = useCallback(() => setLoadImage(null), []);

  const handleSave = useCallback(async () => {
    const canvas = offscreenRef.current;
    if (!canvas) return;
    setSaveMsg('Lagrer...');
    try {
      await savePainting(canvas, pointsRef.current, settings);
      setSaveMsg('Lagret!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Feil ved lagring');
      setTimeout(() => setSaveMsg(''), 2000);
    }
  }, [settings]);

  const handleLoadFromGallery = useCallback((image: Blob, points: PaintPoint[], savedSettings: SimulationSettings) => {
    setLoadImage(image);
    pointsRef.current = points;
    setSettings(savedSettings);
    setSimState('done');
    setShowGallery(false);
  }, []);

  return (
    <main className="flex flex-col lg:flex-row h-[100dvh] bg-gray-950 overflow-hidden">
      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center min-h-0 min-w-0 relative p-2 lg:p-4">
        <PaintCanvas
          settings={settings}
          onSettingsChange={handleSettings}
          simState={simState}
          onSimStateChange={handleSimState}
          pointsRef={pointsRef}
          offscreenCanvasRef={offscreenRef}
          loadImage={loadImage}
          onImageLoaded={handleImageLoaded}
        />

        {/* Mobile toggle */}
        <button onClick={() => setShowPanel(!showPanel)}
          className="lg:hidden absolute top-3 right-3 w-10 h-10 rounded-full bg-gray-800/80 backdrop-blur text-white flex items-center justify-center z-30"
          aria-label="Vis kontroller">
          {showPanel ? '✕' : '☰'}
        </button>

        {/* Status */}
        {simState === 'running' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-gray-900/80 backdrop-blur rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-300">Maler...</span>
          </div>
        )}
        {simState === 'done' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-gray-900/80 backdrop-blur rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-xs text-gray-300">Ferdig</span>
          </div>
        )}
      </div>

      {/* Side panel */}
      <aside className={`${showPanel ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 fixed lg:static right-0 top-0 h-full w-80 bg-gray-900 overflow-y-auto border-l border-gray-800 transition-transform duration-300 z-20 lg:z-auto`}>
        <ControlPanel
          settings={settings}
          onSettingsChange={handleSettings}
          simState={simState}
          onSimStateChange={handleSimState}
          onExport={() => setShowExport(true)}
          onSave={handleSave}
          onShowGallery={() => setShowGallery(true)}
          saveMsg={saveMsg}
        />
      </aside>

      {/* Mobile overlay */}
      {showPanel && <div className="lg:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setShowPanel(false)} />}

      {/* Export */}
      {showExport && <ExportDialog pointsRef={pointsRef} settings={settings} onClose={() => setShowExport(false)} />}

      {/* Gallery */}
      {showGallery && <GalleryPanel onClose={() => setShowGallery(false)} onLoad={handleLoadFromGallery} />}
    </main>
  );
}
