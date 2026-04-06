import { PaintPoint, SimulationSettings, SavedPainting } from './types';

const DB_NAME = 'pendelkunst';
const DB_VERSION = 1;
const STORE_NAME = 'paintings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePainting(
  offscreenCanvas: HTMLCanvasElement,
  points: PaintPoint[],
  settings: SimulationSettings,
  name?: string,
): Promise<string> {
  const id = `painting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Create thumbnail (256px)
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 256;
  thumbCanvas.height = 256;
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(offscreenCanvas, 0, 0, 256, 256);
  const thumbnail = await new Promise<Blob>((res) =>
    thumbCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.8),
  );

  // Full image as PNG
  const fullImage = await new Promise<Blob>((res) =>
    offscreenCanvas.toBlob((b) => res(b!), 'image/png'),
  );

  const painting: SavedPainting = {
    id,
    name: name || `Maleri ${new Date().toLocaleDateString('no-NO')} ${new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}`,
    date: Date.now(),
    thumbnail,
    fullImage,
    points,
    settings,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(painting);
    tx.oncomplete = () => { db.close(); resolve(id); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function listPaintings(): Promise<Array<{ id: string; name: string; date: number; thumbnail: Blob }>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const all = (req.result as SavedPainting[])
        .sort((a, b) => b.date - a.date)
        .map(({ id, name, date, thumbnail }) => ({ id, name, date, thumbnail }));
      resolve(all);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function loadPainting(id: string): Promise<SavedPainting | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deletePainting(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function countPaintings(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
