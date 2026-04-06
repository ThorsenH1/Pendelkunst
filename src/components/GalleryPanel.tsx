'use client';

import { useEffect, useState, useCallback } from 'react';
import { listPaintings, loadPainting, deletePainting } from '@/lib/gallery';
import { SavedPainting, PaintPoint, SimulationSettings } from '@/lib/types';

interface GalleryItem {
  id: string;
  name: string;
  date: number;
  thumbnail: Blob;
  thumbUrl?: string;
}

interface Props {
  onClose: () => void;
  onLoad: (image: Blob, points: PaintPoint[], settings: SimulationSettings) => void;
}

export default function GalleryPanel({ onClose, onLoad }: Props) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listPaintings();
    const withUrls = list.map((item) => ({
      ...item,
      thumbUrl: URL.createObjectURL(item.thumbnail),
    }));
    setItems(withUrls);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      items.forEach((i) => i.thumbUrl && URL.revokeObjectURL(i.thumbUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoad(id: string) {
    setLoadingId(id);
    const painting = await loadPainting(id);
    if (painting) {
      onLoad(painting.fullImage, painting.points, painting.settings);
    }
    setLoadingId(null);
  }

  async function handleDelete(id: string) {
    await deletePainting(id);
    setItems((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed?.thumbUrl) URL.revokeObjectURL(removed.thumbUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">Galleri</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              {items.length} {items.length === 1 ? 'maleri' : 'malerier'} lagret
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Laster...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3">🖼️</span>
              <p className="text-gray-400">Ingen malerier lagret ennå</p>
              <p className="text-gray-500 text-sm mt-1">Lag et maleri og trykk &quot;Lagre&quot; for å legge det til her</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-indigo-500/50 transition-colors"
                >
                  {/* Thumbnail */}
                  {item.thumbUrl && (
                    <div className="aspect-square">
                      <img
                        src={item.thumbUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-gray-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(item.date).toLocaleDateString('no-NO')}
                    </p>
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleLoad(item.id)}
                      disabled={loadingId === item.id}
                      className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {loadingId === item.id ? 'Laster...' : 'Åpne'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-medium transition-colors"
                    >
                      Slett
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
