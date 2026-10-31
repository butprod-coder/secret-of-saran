// Armes. Durées en pas de simulation (1/60 s).
// recovery : temps pour que la jauge remonte de 0 à 100 %.
// chargeTicks : temps pour gagner un niveau de charge en maintenant l'attaque.
export const WEAPONS = {
  epee: {
    id: 'epee', name: 'Épée de Saran', kind: 'melee',
    power: 9, reach: 15, hitR: 11, swing: 18, active: [5, 10], recovery: 48,
    chargeTicks: 45, chargedLen: 26, spinR: 26,
  },
  baton: {
    id: 'baton', name: 'Bâton de noisetier', kind: 'melee',
    power: 4, reach: 13, hitR: 9, swing: 18, active: [5, 10], recovery: 56,
    chargeTicks: 60, chargedLen: 24, spinR: 22,
  },
  arc: {
    id: 'arc', name: 'Arc du Bourg', kind: 'ranged',
    power: 6, swing: 18, active: [8, 8], recovery: 58,
    chargeTicks: 55, chargedLen: 22, arrowSpeed: 3.4, arrowLife: 42,
  },
};

export const weaponXpToNext = (lv) => 25 * lv;
export const MAX_WEAPON_LV = 8;
