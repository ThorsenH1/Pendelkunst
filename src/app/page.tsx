'use client';

import { useState, useRef, useCallback, useEffect, Component, ReactNode } from 'react';
import PaintCanvas from '@/components/PaintCanvas';
import ControlPanel from '@/components/ControlPanel';
import ExportDialog from '@/components/ExportDialog';
import GalleryPanel from '@/components/GalleryPanel';
import { SimulationSettings, SimulationState, PaintPoint } from '@/lib/types';
import { createDefaultSettings, randomSettings } from '@/lib/presets';
import { savePainting } from '@/lib/gallery';

// Error boundary — a runtime error should never leave a blank white screen.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('Pendelkunst:', error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 bg-gray-950 text-center p-6">
          <p className="text-2xl">🎨</p>
          <p className="text-gray-300">Beklager — noe gikk galt.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            Last siden på nytt
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function HomeInner() {
  const [settings, setSettings] = useState<SimulationSettings>(createDefaultSettings);
  const [simState, setSimState] = useState<SimulationState>('idle');
  const [showExport, setShowExport] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadImage, setLoadImage] = useState<Blob | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const pointsRef = useRef<PaintPoint[]>([]);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const undoStack = useRef<Array<{ image: Blob; pointCount: number }>>([]);

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

  // Snapshot the canvas before a new layer so it can be undone.
  const snapshotLayer = useCallback(async () => {
    const c = offscreenRef.current;
    if (!c) return;
    try {
      const blob = await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), 'image/png'));
      if (blob) {
        undoStack.current.push({ image: blob, pointCount: pointsRef.current.length });
        if (undoStack.current.length > 10) undoStack.current.shift();
        setCanUndo(true);
      }
    } catch { /* snapshotting is best-effort */ }
  }, []);

  // Start a fresh run or a new layer (snapshots first so it is undoable).
  const handleStartLayer = useCallback(async () => {
    await snapshotLayer();
    setSimState('running');
  }, [snapshotLayer]);

  const handleUndo = useCallback(() => {
    const snap = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (!snap) return;
    pointsRef.current = pointsRef.current.slice(0, snap.pointCount);
    if (snap.pointCount > 0) {
      setLoadImage(snap.image);
      setSimState('done');
    } else {
      setSimState('idle');
    }
  }, []);

  const handleNewPainting = useCallback(() => {
    undoStack.current = [];
    setCanUndo(false);
    setSimState('idle');
  }, []);

  const handleRandomize = useCallback(() => {
    undoStack.current = [];
    setCanUndo(false);
    setSimState('idle');
    setSettings(randomSettings());
  }, []);

  const handleLoadFromGallery = useCallback((image: Blob, points: PaintPoint[], savedSettings: SimulationSettings) => {
    undoStack.current = [];
    setCanUndo(false);
    setLoadImage(image);
    pointsRef.current = points;
    setSettings(savedSettings);
    setSimState('done');
    setShowGallery(false);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (showExport || showGallery) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (canUndo) { e.preventDefault(); handleUndo(); }
        return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (simState === 'idle' || simState === 'done') handleStartLayer();
          else if (simState === 'running') setSimState('paused');
          else if (simState === 'paused') setSimState('running');
          break;
        case 'e': case 'E':
          if (simState === 'paused' || simState === 'done') setShowExport(true);
          break;
        case 's': case 'S':
          if (simState === 'paused' || simState === 'done') handleSave();
          break;
        case 'g': case 'G': setShowGallery(true); break;
        case 'r': case 'R':
          if (simState === 'idle' || simState === 'done') handleRandomize();
          break;
        case 'n': case 'N': handleNewPainting(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [simState, showExport, showGallery, canUndo, handleStartLayer, handleSave, handleRandomize, handleNewPainting, handleUndo]);

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
          aria-label="Vis eller skjul kontroller">
          {showPanel ? '✕' : '☰'}
        </button>

        {/* Status */}
        {simState === 'running' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-gray-900/80 backdrop-blur rounded-full px-3 py-1.5" role="status">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-300">Maler...</span>
          </div>
        )}
        {simState === 'paused' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-gray-900/80 backdrop-blur rounded-full px-3 py-1.5" role="status">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs text-gray-300">Pauset</span>
          </div>
        )}
        {simState === 'done' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-gray-900/80 backdrop-blur rounded-full px-3 py-1.5" role="status">
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
          onStartLayer={handleStartLayer}
          onExport={() => setShowExport(true)}
          onSave={handleSave}
          onShowGallery={() => setShowGallery(true)}
          onRandomize={handleRandomize}
          onNewPainting={handleNewPainting}
          onUndo={handleUndo}
          canUndo={canUndo}
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

export default function Home() {
  return (
    <ErrorBoundary>
      <HomeInner />
    </ErrorBoundary>
  );
}
