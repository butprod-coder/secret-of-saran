// Format des sauvegardes : JSON versionné, identique en solo et en co-op.
// { format, version, savedAt, summary, game } où `game` vient de World.toSave().
// Toute évolution du format incrémente SAVE_VERSION et ajoute une migration ci-dessous.
import { HEROES, HERO_ORDER } from '../sim/data/heroes.js';

export const SAVE_FORMAT = 'secret-of-saran';
export const SAVE_VERSION = 1;

// MIGRATIONS[v] transforme une sauvegarde de version v en version v + 1. Exemple pour la suite :
//   1: (d) => { d.game.quests = {}; },
const MIGRATIONS = {};

export class SaveError extends Error {}

export function makeSave(world, mapName) {
  const game = world.toSave();
  const lead = HERO_ORDER.map((id) => game.heroes[id]).filter(Boolean);
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    summary: { map: mapName, lv: Math.max(...lead.map((h) => h.lv)), tick: game.tick, gold: game.gold },
    game,
  };
}

// Vérifie, met à jour et renvoie une sauvegarde lue d'IndexedDB ou d'un fichier importé.
export function migrate(raw) {
  const d = typeof raw === 'string' ? parseJson(raw) : structuredClone(raw);
  if (!d || typeof d !== 'object' || d.format !== SAVE_FORMAT) throw new SaveError("Ce fichier n'est pas une sauvegarde de Secret of Saran.");
  if (!Number.isInteger(d.version) || d.version < 1) throw new SaveError('Version de sauvegarde illisible.');
  if (d.version > SAVE_VERSION) throw new SaveError('Sauvegarde faite avec une version plus récente du jeu.');
  while (d.version < SAVE_VERSION) {
    const step = MIGRATIONS[d.version];
    if (!step) throw new SaveError(`Pas de migration depuis la version ${d.version}.`);
    step(d);
    d.version++;
  }
  validate(d.game);
  return d;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { throw new SaveError('Fichier JSON invalide.'); }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isBag = (b) => b && typeof b === 'object' && Object.values(b).every((n) => Number.isInteger(n) && n >= 0);

function validate(g) {
  const fail = (what) => { throw new SaveError(`Sauvegarde abîmée (${what}).`); };
  if (!g || typeof g !== 'object') fail('contenu');
  if (typeof g.mapId !== 'string') fail('carte');
  for (const k of ['tick', 'clock', 'day', 'gold']) if (!isNum(g[k]) || g[k] < 0) fail(k);
  if (!Number.isInteger(g.rng)) fail('rng'); // entier 32 bits signé
  if (!isBag(g.inventory) || !isBag(g.gear)) fail('sac');
  if (!g.flags || typeof g.flags !== 'object') fail('drapeaux');
  if (!g.heroes || typeof g.heroes !== 'object') fail('héros');
  for (const [id, h] of Object.entries(g.heroes)) {
    if (!HEROES[id]) fail('héros inconnu ' + id);
    for (const k of ['lv', 'xp', 'hp', 'mp', 'wlv', 'wxp']) if (!isNum(h[k]) || h[k] < 0) fail(`${id}.${k}`);
    if (h.lv < 1 || h.lv > 99 || h.wlv < 1) fail(`${id}.niveau`);
  }
}
