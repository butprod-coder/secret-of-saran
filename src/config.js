// Réglages globaux. La simulation n'importe que les constantes de temps.
export const GAME_W = 384;
export const GAME_H = 216;
export const TILE = 16;

export const TICK_HZ = 60;
export const STEP_MS = 1000 / TICK_HZ;
export const DAY_TICKS = TICK_HZ * 60 * 8; // une journée dure 8 minutes réelles

export const VERSION = '0.2.0-jalon-4';

// Cartes chargées au démarrage (assets/maps/<id>.tmj).
export const MAPS = ['prairie', 'clairiere'];
