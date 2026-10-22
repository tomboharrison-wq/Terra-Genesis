/** IndexedDB world slots. Each record stores gzipped .tgw bytes (see format.ts). */
const DB_NAME = 'terra-genesis';
const STORE = 'worlds';
export const AUTOSAVE_ID = '__autosave';

export interface SlotInfo {
  id: string;
  name: string;
  savedAtIso: string;
  width: number;
  height: number;
  presetId: string;
  byteLength: number;
}

interface SlotRecord extends SlotInfo {
  bytes: Uint8Array;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable in this browser'));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Could not open IndexedDB'));
    };
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        // Resolve on transaction completion so writes are durable (atomic: all or nothing).
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error ?? req.error);
        t.onabort = () => reject(t.error ?? new Error('Storage transaction aborted (quota?)'));
      }),
  );
}

export async function saveSlot(info: Omit<SlotInfo, 'byteLength' | 'savedAtIso'>, bytes: Uint8Array): Promise<SlotInfo> {
  const rec: SlotRecord = { ...info, savedAtIso: new Date().toISOString(), byteLength: bytes.byteLength, bytes };
  await tx('readwrite', (s) => s.put(rec));
  const { bytes: _omit, ...meta } = rec;
  void _omit;
  return meta;
}

export async function loadSlot(id: string): Promise<Uint8Array | null> {
  const rec = (await tx('readonly', (s) => s.get(id))) as SlotRecord | undefined;
  return rec?.bytes ?? null;
}

export async function listSlots(): Promise<SlotInfo[]> {
  const all = (await tx('readonly', (s) => s.getAll())) as SlotRecord[];
  return all
    .map(({ bytes: _b, ...m }) => (void _b, m))
    .sort((a, b) => b.savedAtIso.localeCompare(a.savedAtIso));
}

export async function deleteSlot(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  const est = await navigator.storage?.estimate?.();
  return est ? { usage: est.usage ?? 0, quota: est.quota ?? 0 } : null;
}
