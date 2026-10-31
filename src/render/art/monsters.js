// Ennemis 24x24, tournés vers la droite (miroir pour la gauche). Pieds sur la rangée 21.
import { C } from './palette.js';
import { addSheet, dot, ellipse, makeCanvas, outline, rect } from './pixel.js';

// Lapinfou : boule de poils orange, grandes oreilles, foulard rouge de la fanfare de Saran.
function lapin(name) {
  const [c, g] = makeCanvas(24, 24);
  const hop = name === 'hop';
  const squash = name === 'squash';
  const cy = hop ? 14 : squash ? 17 : 16;
  const ry = hop ? 6.5 : squash ? 4.6 : 5.8;
  const rx = squash ? 8.4 : 7.4;
  const earTilt = hop ? -2 : 0;
  for (const [ex, h] of [[9, 5], [13, 5.5]]) {
    ellipse(g, ex + earTilt, cy - 8, 1.8, h, C.orange, C.orangeS);
    rect(g, ex + earTilt, cy - 10, 1, 4, C.pink);
  }
  ellipse(g, 12, cy, rx, ry, C.orange, C.orangeS, C.orangeL);
  ellipse(g, 4.5, cy + 1, 2, 2, C.white);
  rect(g, 8, cy + 3, 7, 1, C.red); dot(g, 9, cy + 4, C.redS);
  if (name === 'hurt') {
    dot(g, 15, cy - 2, C.ink); dot(g, 17, cy - 2, C.ink); dot(g, 16, cy - 1, C.ink); dot(g, 15, cy, C.ink); dot(g, 17, cy, C.ink);
  } else {
    rect(g, 15, cy - 2, 2, 2, C.ink); dot(g, 15, cy - 2, C.white);
  }
  rect(g, 17, cy + 1, 3, 1, C.ink); dot(g, 18, cy + 2, C.white);
  if (!hop) { rect(g, 8, cy + ry - 1, 3, 1, C.orangeS); rect(g, 14, cy + ry - 1, 3, 1, C.orangeS); }
  return outline(c);
}

// Champignard : champignon des sous-bois au sale caractère.
function champi(name) {
  const [c, g] = makeCanvas(24, 24);
  const windup = name === 'windup';
  const step = name === 'walk1' ? 1 : 0;
  rect(g, 7 + step, 19, 4, 2, C.brown); rect(g, 13 - step, 19, 4, 2, C.brownS);
  rect(g, 8, 12, 9, 8, C.cream); rect(g, 15, 12, 2, 8, C.creamS);
  if (name === 'hurt') {
    dot(g, 12, 15, C.ink); dot(g, 14, 15, C.ink); dot(g, 13, 16, C.ink);
  } else {
    rect(g, 11, 14, 1, 2, C.ink); rect(g, 14, 14, 1, 2, C.ink);
    dot(g, 10, 13, C.ink); dot(g, 15, 13, C.ink);
    rect(g, 12, 17, 2, 1, C.redS);
  }
  const rx = windup ? 10.5 : 9.2;
  const ry = windup ? 5.2 : 6;
  ellipse(g, 12, 9 + (windup ? 1 : 0), rx, ry, C.red, C.redS, C.redL);
  for (const [x, y] of [[8, 6], [14, 5], [17, 9], [10, 10]]) { rect(g, x, y + (windup ? 1 : 0), 2, 2, C.white); }
  if (windup) for (const [x, y] of [[3, 3], [20, 2], [12, 0]]) dot(g, x, y, C.purpleL);
  return outline(c);
}

export function buildMonsters(scene) {
  const frames = [];
  for (const p of ['idle', 'hop', 'squash', 'hurt']) frames.push({ name: 'lapinfou_' + p, canvas: lapin(p) });
  for (const p of ['walk0', 'walk1', 'windup', 'hurt']) frames.push({ name: 'champignard_' + p, canvas: champi(p) });
  addSheet(scene, 'mobs', frames, 24, 24, 8);
}
