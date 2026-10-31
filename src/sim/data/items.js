// Objets de l'inventaire commun du groupe.
import { GEAR } from './equipment.js';

export const ITEMS = {
  chocolatine: { name: 'Chocolatine', kind: 'heal', amount: 100, target: 'ally', desc: 'Rend 100 PV. Ne dites pas « pain au chocolat ».' },
  eauloire: { name: 'Eau de Loire', kind: 'mp', amount: 20, target: 'ally', desc: 'Rend 20 PM. Filtrée, promis.' },
  amitie: { name: "Verre de l'amitié", kind: 'revive', amount: 0.5, target: 'ko', desc: 'Relève un héros K.O.' },
};

export const ITEM_ORDER = ['chocolatine', 'eauloire', 'amitie'];
export const MAX_STACK = 9;
export const START_INVENTORY = { chocolatine: 4, eauloire: 2, amitie: 1 };

// Nom d'un butin (objet ou pièce d'équipement).
export const lootName = (id) => ITEMS[id]?.name ?? GEAR[id]?.name ?? id;
