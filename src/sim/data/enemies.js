// Bestiaire. drops : [objet, probabilité] ; un seul objet au plus par ennemi.
export const ENEMIES = {
  lapinfou: {
    name: 'Lapinfou', hp: 26, str: 9, def: 2, xp: 6, gold: [2, 5],
    ai: 'sauteur', sight: 96,
    drops: [['chocolatine', 0.1], ['bandana', 0.03]],
  },
  champignard: {
    name: 'Champignard', hp: 46, str: 12, def: 5, xp: 11, gold: [4, 9],
    ai: 'marcheur', sight: 80, speed: 0.45,
    drops: [['eauloire', 0.15], ['amitie', 0.04], ['casquette', 0.04]],
  },
};
