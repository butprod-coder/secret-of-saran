// Équipement : trois emplacements par héros, comme dans Secret of Mana (tête, corps, bras).
// Les bonus s'ajoutent aux statistiques du niveau ; `who` limite les héros qui peuvent le porter.
export const SLOTS = ['head', 'body', 'arms'];
export const SLOT_NAMES = { head: 'Tête', body: 'Corps', arms: 'Bras' };

const ALL = ['gus', 'karonux', 'lorenzo'];

export const GEAR = {
  // Tête
  bandana: { name: 'Bandana de fanfare', slot: 'head', def: 2, who: ALL, desc: 'Celui des Lapinfous. Il sent le lapin.' },
  casquette: { name: 'Casquette du PMU', slot: 'head', def: 3, mag: 1, who: ALL, desc: 'Porte-bonheur, paraît-il.' },
  casque: { name: 'Casque de pompier', slot: 'head', def: 5, who: ['gus'], desc: 'Prêté par la caserne. À rendre lundi.' },
  bonnet: { name: 'Bonnet de Gnomard', slot: 'head', def: 4, mag: 4, who: ALL, desc: 'Pointu, rouge, et il ne le reverra jamais.' },
  // Corps
  tshirt: { name: 'T-shirt de Saran', slot: 'body', def: 2, who: ALL, desc: 'Taille unique. Trop grand pour tout le monde.' },
  gilet: { name: 'Gilet de pêche', slot: 'body', def: 4, who: ALL, desc: 'Vingt-deux poches, toutes vides.' },
  cotte: { name: 'Cotte de mailles rouillée', slot: 'body', def: 7, str: 1, who: ['gus'], desc: 'Grince à chaque pas.' },
  robe: { name: 'Robe de chambre', slot: 'body', def: 3, mag: 3, who: ['karonux', 'lorenzo'], desc: 'Confortable. Très confortable.' },
  // Bras
  gants: { name: 'Gants de jardinage', slot: 'arms', def: 2, who: ALL, desc: 'Ceux de Gnomard. Il les cherche.' },
  bracelet: { name: 'Bracelet brésilien', slot: 'arms', def: 1, mag: 2, who: ALL, desc: 'Un vœu par nœud.' },
  montre: { name: 'Montre en toc', slot: 'arms', def: 1, str: 2, who: ['gus'], desc: '« Héritée de tonton », elle aussi.' },
};

export const GEAR_ORDER = Object.keys(GEAR);

// Équipement de départ et sac commun du groupe.
export const START_EQUIP = {
  gus: { head: null, body: 'tshirt', arms: null },
  karonux: { head: null, body: 'robe', arms: null },
  lorenzo: { head: null, body: 'tshirt', arms: null },
};
export const START_GEAR = { bandana: 1 };

export const canWear = (heroId, gearId) => !!GEAR[gearId]?.who.includes(heroId);
