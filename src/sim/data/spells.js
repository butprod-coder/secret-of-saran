// Esprits élémentaires et sorts qu'ils accordent.
export const SPIRITS = {
  ondine: { name: 'Ondine de Loire', element: 'eau' },
  salamandre: { name: 'Salamandre du Barbecue', element: 'feu' },
  gnomard: { name: 'Gnomard, gnome de jardin', element: 'terre' },
};

export const SPELLS = {
  feu: { name: 'Boule de feu', spirit: 'salamandre', mp: 4, kind: 'projectile', power: 16, target: 'foe' },
  gel: { name: 'Gel de Loire', spirit: 'ondine', mp: 6, kind: 'area', power: 14, radius: 28, freeze: 70, target: 'foe' },
  soin: { name: "Remède d'Ondine", spirit: 'ondine', mp: 3, kind: 'heal', power: 28, target: 'ally' },
  bouclier: { name: 'Rempart de Gnomard', spirit: 'gnomard', mp: 4, kind: 'buff', stat: 'def', duration: 60 * 20, target: 'ally' },
};
