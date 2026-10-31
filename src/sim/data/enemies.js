// Bestiaire. drops : [objet, probabilité] ; un seul objet au plus par ennemi.
// boss : ne réapparaît plus une fois vaincu (drapeau du même nom) et se réveille dans son arène.
// heavy : ni recul, ni étourdissement, ni gel (les coups le font seulement clignoter).
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
  taupinarde: {
    name: 'Taupinarde', hp: 58, str: 15, def: 6, xp: 16, gold: [6, 12],
    ai: 'fouisseur', sight: 110, speed: 0.75,
    drops: [['chocolatine', 0.12], ['eauloire', 0.1], ['montre', 0.03]],
  },
  gnomard: {
    name: 'Gnomard, gnome de jardin', hp: 1400, str: 27, def: 10, xp: 220, gold: [120, 150],
    ai: 'gnome', sight: 400, r: 11, boss: true, heavy: true,
    drops: [['bonnet', 1]],
  },
};
