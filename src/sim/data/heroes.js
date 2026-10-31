// Les trois héros. Les valeurs « growth » sont ajoutées à chaque niveau.
export const HERO_ORDER = ['gus', 'karonux', 'lorenzo'];

export const HEROES = {
  gus: {
    name: 'Gus',
    role: 'Bretteur',
    bio: "Fils du forgeron de Saran. Lunettes noires par tous les temps, chaîne en or « héritée de tonton ». Frappe d'abord, réfléchit au goûter.",
    base: { hp: 74, mp: 0, str: 12, def: 9, mag: 2 },
    growth: { hp: 14, mp: 0, str: 3, def: 2, mag: 0 },
    speed: 1.2,
    weapon: 'epee',
    spells: [],
    chargeRate: 1.25, // remplit la jauge de charge plus vite
    chargeBonus: 1, // un niveau de charge de plus que les autres
    tactic: 'agressif',
  },
  karonux: {
    name: 'Karonux',
    role: 'Mage',
    bio: "Apprenti de l'Ondine de Loire, ancien livreur en Golf. Fragile, myope derrière ses lunettes noires, mais ses boules de feu ne ratent jamais un barbecue.",
    base: { hp: 42, mp: 36, str: 5, def: 4, mag: 13 },
    growth: { hp: 7, mp: 5, str: 1, def: 1, mag: 3 },
    speed: 1.15,
    weapon: 'baton',
    spells: ['feu', 'gel'],
    chargeRate: 0.8,
    chargeBonus: 0,
    tactic: 'defensif',
  },
  lorenzo: {
    name: 'Lorenzo',
    role: 'Soigneur',
    bio: "Moine défroqué de l'abbaye de Saran, reconverti dans les tisanes « à base de plantes ». Soigne tout le monde en soupirant.",
    base: { hp: 52, mp: 28, str: 7, def: 6, mag: 10 },
    growth: { hp: 9, mp: 4, str: 2, def: 1.5, mag: 2 },
    speed: 1.15,
    weapon: 'arc',
    spells: ['soin', 'bouclier'],
    chargeRate: 0.9,
    chargeBonus: 0,
    tactic: 'defensif',
  },
};

export const TACTICS = ['agressif', 'defensif', 'suivre'];
export const TACTIC_NAMES = { agressif: 'Agressif', defensif: 'Défensif', suivre: 'Suivre' };

export function statsAt(id, lv) {
  const d = HEROES[id];
  const out = {};
  for (const k of Object.keys(d.base)) out[k] = Math.round(d.base[k] + d.growth[k] * (lv - 1));
  return out;
}

export const xpToNext = (lv) => Math.round(14 * Math.pow(lv, 1.55));
