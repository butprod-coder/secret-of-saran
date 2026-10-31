// Point d'entrée : rendu 384x216 agrandi d'un facteur entier, sans lissage.
import { GAME_H, GAME_W } from './config.js';
import { BootScene } from './render/scenes/BootScene.js';
import { TitleScene } from './render/scenes/TitleScene.js';
import { WorldScene } from './render/scenes/WorldScene.js';
import { UIScene } from './render/scenes/UIScene.js';

const zoomFor = () => Math.max(1, Math.floor(Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H)));

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#120c10',
  scale: { mode: Phaser.Scale.NONE, zoom: zoomFor() },
  input: { keyboard: false, gamepad: false },
  banner: false,
  scene: [BootScene, TitleScene, WorldScene, UIScene],
});

window.addEventListener('resize', () => game.scale.setZoom(zoomFor()));
window.__sos = game; // pour le débogage depuis la console
