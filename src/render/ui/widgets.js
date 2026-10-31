// Fenêtres bleues façon Mana et texte bitmap.
import { sanitize } from '../art/font.js';

const TOP = [0x4a, 0x6a, 0xd8];
const BOTTOM = [0x16, 0x20, 0x6a];

// Fenêtre à coins arrondis : contour sombre, cadre clair, dégradé bleu.
export function drawWindow(g, x, y, w, h, alpha = 1) {
  g.fillStyle(0x100818, alpha);
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle(0xe8dcc0, alpha);
  g.fillRect(x + 2, y + 1, w - 4, h - 2);
  g.fillRect(x + 1, y + 2, w - 2, h - 4);
  const ih = h - 4;
  for (let i = 0; i < ih; i++) {
    const t = ih > 1 ? i / (ih - 1) : 0;
    const col = (Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t) << 16) | (Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t) << 8) | Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t);
    g.fillStyle(col, alpha);
    g.fillRect(x + 2, y + 2 + i, w - 4, 1);
  }
}

export function bar(g, x, y, w, h, ratio, col, back = 0x10081a) {
  g.fillStyle(back, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(col, 1);
  g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, ratio))), h);
}

export function text(scene, x, y, str, { tint = 0xffffff, outlined = false, origin = 0 } = {}) {
  const t = scene.add.bitmapText(x, y, outlined ? 'pixo' : 'pix', sanitize(str));
  t.setTint(tint);
  if (origin) t.setOrigin(origin, 0);
  return t;
}

export function setText(t, str) {
  const s = sanitize(str);
  if (t.text !== s) t.setText(s);
  return t;
}
