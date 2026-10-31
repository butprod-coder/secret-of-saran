// Fond de l'écran titre : coucher de soleil sur la Loire et le Grand Chêne de Saran.
import { GAME_H, GAME_W } from '../../config.js';
import { C } from './palette.js';
import { dot, ellipse, hash2, makeCanvas, rect } from './pixel.js';

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const mix = (c1, c2, t) => {
  const p = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${lerp(p(c1, 0), p(c2, 0), t)},${lerp(p(c1, 1), p(c2, 1), t)},${lerp(p(c1, 2), p(c2, 2), t)})`;
};

export function buildTitle(scene) {
  const [c, g] = makeCanvas(GAME_W, GAME_H);
  // Ciel en bandes (dithering léger entre deux couleurs voisines).
  const sky = ['#2a1c4a', '#5a2a5e', '#a8445a', '#e8805a', '#f6c070'];
  for (let y = 0; y < 150; y++) {
    const t = (y / 150) * (sky.length - 1);
    const i = Math.min(sky.length - 2, Math.floor(t));
    const f = t - i;
    for (let x = 0; x < GAME_W; x++) dot(g, x, y, (hash2(x, y, 4) < f ? sky[i + 1] : sky[i]));
  }
  for (let i = 0; i < 40; i++) dot(g, Math.floor(hash2(i, 1, 9) * GAME_W), Math.floor(hash2(i, 2, 9) * 70), C.goldL);
  ellipse(g, 300, 128, 22, 22, '#ffd890', null, '#fff2c0');
  // Collines lointaines puis proches.
  for (let x = 0; x < GAME_W; x++) {
    const h1 = 132 + Math.round(Math.sin(x / 37) * 6 + Math.sin(x / 13) * 2);
    rect(g, x, h1, 1, GAME_H - h1, '#6a3a5a');
    const h2 = 150 + Math.round(Math.sin(x / 53 + 1) * 5 + Math.sin(x / 17) * 2);
    rect(g, x, h2, 1, GAME_H - h2, '#3a2a40');
  }
  // La Loire.
  for (let y = 170; y < 182; y++) for (let x = 0; x < GAME_W; x++) dot(g, x, y, hash2(x, y, 3) > 0.92 ? '#f6c070' : '#4a3a6a');
  rect(g, 0, 182, GAME_W, GAME_H - 182, '#241828');
  // Le Grand Chêne, en silhouette.
  rect(g, 182, 96, 20, 80, '#1c1220');
  for (const [x, y, rx, ry] of [[192, 70, 60, 34], [150, 86, 30, 20], [236, 84, 32, 20], [192, 48, 38, 22]]) ellipse(g, x, y, rx, ry, '#1c1220');
  for (let i = 0; i < 26; i++) dot(g, 140 + Math.floor(hash2(i, 5, 2) * 110), 40 + Math.floor(hash2(i, 6, 2) * 70), mix('#f6c070', '#ffffff', hash2(i, 7, 2)));
  scene.textures.addCanvas('title_bg', c);
}
