// Stockage des sauvegardes dans IndexedDB : un emplacement automatique et trois manuels.
// Chaque écriture est un seul `put` dans une transaction : IndexedDB garantit qu'on lit
// ensuite soit l'ancienne sauvegarde entière, soit la nouvelle, jamais un mélange.
// Si IndexedDB est indisponible (navigation privée), les sauvegardes restent en mémoire.
import { migrate } from './format.js';

export const SLOTS = ['auto', '1', '2', '3'];
export const SLOT_LABELS = { auto: 'Auto', 1: 'Emplacement 1', 2: 'Emplacement 2', 3: 'Emplacement 3' };

const DB_NAME = 'secret-of-saran';
const STORE = 'saves';

class SaveStore {
  constructor() {
    this.memory = new Map();
    this.dbPromise = null;
  }

  get persistent() { return typeof indexedDB !== 'undefined'; }

  db() {
    if (!this.persistent) return Promise.resolve(null);
    this.dbPromise ??= new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return this.dbPromise;
  }

  async request(mode, fn) {
    const db = await this.db();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      let result;
      req.onsuccess = () => { result = req.result; };
      // On ne rend la main qu'une fois la transaction validée sur disque.
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB'));
      tx.onabort = () => reject(tx.error ?? new Error('Écriture annulée'));
    });
  }

  async write(slot, save) {
    if (!SLOTS.includes(slot)) throw new Error('Emplacement inconnu : ' + slot);
    // Aller-retour de contrôle avant écriture : on n'enregistre jamais un état illisible.
    const clean = migrate(JSON.parse(JSON.stringify(save)));
    try {
      if (await this.db()) { await this.request('readwrite', (st) => st.put(clean, slot)); return true; }
    } catch (e) {
      console.warn('Sauvegarde IndexedDB impossible, conservée en mémoire', e);
    }
    this.memory.set(slot, clean);
    return false;
  }

  async read(slot) {
    let raw = this.memory.get(slot) ?? null;
    try { raw = (await this.request('readonly', (st) => st.get(slot))) ?? raw; } catch { /* mémoire seule */ }
    if (!raw) return null;
    try { return migrate(raw); } catch (e) { console.warn(`Emplacement ${slot} illisible`, e); return null; }
  }

  // Résumé de chaque emplacement, pour les menus.
  async list() {
    const out = {};
    for (const slot of SLOTS) out[slot] = await this.read(slot);
    return out;
  }

  async latest() {
    const all = Object.values(await this.list()).filter(Boolean);
    return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
  }
}

export const saves = new SaveStore();

// --- Fichiers .json ---------------------------------------------------------
export function exportFile(save) {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `secret-of-saran-${save.savedAt.slice(0, 16).replace(/[T:]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Ouvre le sélecteur de fichiers. Le navigateur ne l'autorise qu'en réponse à une touche
// ou un clic : une manette ne suffit pas, d'où le glisser-déposer proposé en plus.
export function pickFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => resolve(inp.files[0] ?? null);
    inp.oncancel = () => resolve(null);
    inp.click();
  });
}

export async function readFile(file) {
  return migrate(await file.text());
}

// Glisser-déposer d'un .json sur la page : appelle `onSave(save | error)`.
export function onFileDrop(onSave) {
  const over = (e) => { e.preventDefault(); };
  const drop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try { onSave(await readFile(file)); } catch (err) { onSave(err); }
  };
  window.addEventListener('dragover', over);
  window.addEventListener('drop', drop);
  return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
}
