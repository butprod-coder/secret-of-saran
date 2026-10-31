// Générateur mulberry32. Son état (un entier 32 bits) vit dans l'état du monde :
// il est sauvegardé et la simulation reste rejouable à l'identique.
export function nextRandom(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randRange = (s, a, b) => a + (b - a) * nextRandom(s);
export const randInt = (s, a, b) => a + Math.floor(nextRandom(s) * (b - a + 1));
