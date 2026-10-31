// Outils de dessin pixel par pixel sur canvas (aucun lissage).
import { C } from './palette.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function rect(g, x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
}

export function dot(g, x, y, col) {
  g.fillStyle = col;
  g.fillRect(x, y, 1, 1);
}

export function line(g, x0, y0, x1, y1, col) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    dot(g, x0, y0, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export const inEllipse = (x, y, cx, cy, rx, ry) => {
  const nx = (x + 0.5 - cx) / rx;
  const ny = (y + 0.5 - cy) / ry;
  return nx * nx + ny * ny <= 1;
};

// Ellipse pleine avec ombre en bas à droite et reflet en haut à gauche.
export function ellipse(g, cx, cy, rx, ry, base, shade = null, light = null) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      let col = base;
      if (shade && nx * 0.45 + ny * 0.9 > 0.5) col = shade;
      else if (light && nx * 0.5 + ny * 0.8 < -0.45 && d < 0.75) col = light;
      dot(g, x, y, col);
    }
  }
}

const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

// Contour d'un pixel autour de tout ce qui est opaque.
export function outline(c, col = C.ink) {
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  const img = g.getImageData(0, 0, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  const [r, gg, b] = rgb(col);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] !== 0) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        out[i] = r; out[i + 1] = gg; out[i + 2] = b; out[i + 3] = 255;
      }
    }
  }
  img.data.set(out);
  g.putImageData(img, 0, 0);
  return c;
}

// Bruit déterministe 0..1 pour les textures.
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Ombre au sol semi-transparente (jamais contourée).
export function groundShadow(g, cx, cy, rx, ry, alpha = 0.28) {
  g.save();
  g.globalAlpha = alpha;
  ellipse(g, cx, cy, rx, ry, '#000000');
  g.restore();
}

// Assemble des cadres nommés en une planche et l'enregistre comme texture Phaser.
export function addSheet(scene, key, frames, cw, ch, cols = 8) {
  const rows = Math.ceil(frames.length / cols);
  const [c, g] = makeCanvas(cw * cols, ch * rows);
  frames.forEach((f, i) => g.drawImage(f.canvas, (i % cols) * cw, Math.floor(i / cols) * ch));
  const tex = scene.textures.addCanvas(key, c);
  frames.forEach((f, i) => tex.add(f.name, 0, (i % cols) * cw, Math.floor(i / cols) * ch, f.canvas.width, f.canvas.height));
  return tex;
}
