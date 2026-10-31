// Ennemis 24x24, tournés vers la droite (miroir pour la gauche). Pieds sur la rangée 21.
import { C } from './palette.js';
import { addSheet, dot, ellipse, line, makeCanvas, outline, rect } from './pixel.js';

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

// Monticule de terre fraîche (taupe ou gnome qui file sous le sol).
function mound(g, cx, cy, rx, ry) {
  ellipse(g, cx, cy, rx, ry, C.dirtS, C.brownS, C.dirt);
  for (const [dx, dy] of [[-rx * 0.5, -1], [rx * 0.3, -ry * 0.4], [rx * 0.7, 1]]) dot(g, Math.round(cx + dx), Math.round(cy + dy), C.dirtL);
}

// Taupinarde : taupe en salopette, griffes en avant, lunettes de chantier.
function taupe(name) {
  const [c, g] = makeCanvas(24, 24);
  if (name === 'mound') { mound(g, 12, 19, 7, 3.5); return outline(c); }
  const low = name === 'dig' ? 6 : 0;
  const bite = name === 'windup';
  ellipse(g, 11, 14 + low, 7, 6.5, C.suit, C.suitS, C.suitL);
  rect(g, 6, 15 + low, 10, 5, C.navy); rect(g, 8, 14 + low, 1, 3, C.navyS); rect(g, 14, 14 + low, 1, 3, C.navyS);
  ellipse(g, 17, 13 + low, 3.5, 2.6, C.suitL);
  dot(g, 20, 12 + low, C.pink); dot(g, 21, 13 + low, C.pink);
  if (name === 'hurt') { dot(g, 15, 10 + low, C.ink); dot(g, 17, 10 + low, C.ink); dot(g, 16, 11 + low, C.ink); }
  else { rect(g, 14, 9 + low, 5, 2, C.gold); dot(g, 15, 9 + low, C.goldL); rect(g, 14, 11 + low, 5, 1, C.goldS); }
  const claw = bite ? -3 : 0;
  for (const [x, y] of [[18, 16], [5, 16]]) {
    ellipse(g, x + (x > 10 ? -claw : 0), y + low, 2.4, 2, C.pink);
    for (let k = 0; k < 3; k++) dot(g, x + (x > 10 ? 2 - claw : -2), y - 1 + k + low, C.white);
  }
  if (low) { const [mc, mg] = makeCanvas(24, 24); mound(mg, 12, 20, 9, 3.5); g.drawImage(mc, 0, 0); }
  return outline(c);
}

// Gnomard, 40 x 40 : bonnet rouge, barbe blanche, pelle. Pieds sur la rangée 37.
function gnome(name) {
  const [c, g] = makeCanvas(40, 40);
  if (name === 'mound') {
    mound(g, 20, 35, 14, 5);
    for (let k = 0; k < 5; k++) rect(g, 18 - Math.floor(k / 2), 26 + k, 3 + Math.floor(k / 2) * 2, 1, k < 2 ? C.redL : C.red);
    return outline(c);
  }
  const bob = name === 'idle1' ? 1 : 0;
  const crouch = name === 'windup' || name === 'throw' ? 2 : 0;
  const y0 = bob + crouch;
  // Pelle (derrière ou devant selon la pose).
  const shovel = (x0, y1, x1, y2, bx, by, horizontal) => {
    line(g, x0, y1, x1, y2, C.wood); line(g, x0 + 1, y1, x1 + 1, y2, C.woodS);
    if (horizontal) { rect(g, bx, by, 6, 5, C.steel); rect(g, bx, by, 6, 1, C.steelL); }
    else { rect(g, bx, by, 5, 6, C.steel); rect(g, bx, by, 1, 6, C.steelL); dot(g, bx + 4, by + 5, C.steelS); }
  };
  if (name === 'windup') shovel(26, 28, 34, 6, 32, 1, false);
  // Bottes et tunique.
  if (name !== 'dig') { rect(g, 13, 34, 6, 3, C.brownS); rect(g, 22, 34, 6, 3, C.brownS); rect(g, 13, 34, 6, 1, C.brown); rect(g, 22, 34, 6, 1, C.brown); }
  ellipse(g, 20, 29 + y0 * 0.5, 9, 6.5, C.navy, C.navyS, C.navyL);
  rect(g, 12, 30 + y0, 17, 2, C.brownS); rect(g, 19, 30 + y0, 3, 2, C.gold);
  // Barbe, visage, nez.
  ellipse(g, 21, 26 + y0, 7, 6.5, C.white, C.creamS);
  ellipse(g, 21, 19 + y0, 6.5, 5, C.skin, C.skinS, C.skinL);
  ellipse(g, 25, 21 + y0, 2.4, 2, C.blush, C.skinS);
  if (name === 'hurt') {
    dot(g, 21, 17 + y0, C.ink); dot(g, 23, 17 + y0, C.ink); dot(g, 22, 18 + y0, C.ink);
  } else {
    rect(g, 22, 17 + y0, 2, 2, C.ink); dot(g, 22, 17 + y0, C.white);
    rect(g, 19, 15 + y0, 5, 1, C.white); // sourcils froncés
  }
  // Bonnet pointu, légèrement penché en arrière.
  for (let k = 0; k < 15; k++) {
    const half = Math.round(7.5 - k * 0.48);
    const cx = 19 - Math.round(k * 0.35);
    rect(g, cx - half, 14 + y0 - k, half * 2 + 1, 1, k < 2 ? C.redS : k > 11 ? C.redL : C.red);
  }
  // Bras et pelle selon la pose.
  if (name === 'idle0' || name === 'idle1' || name === 'hurt' || name === 'statue') {
    shovel(31, 12 + y0, 31, 31 + y0, 29, 31 + y0, false);
    ellipse(g, 29, 25 + y0, 2.5, 2.5, C.skin, C.skinS);
  } else if (name === 'slam') {
    shovel(24, 28, 33, 33, 33, 31, true);
    ellipse(g, 26, 28, 2.5, 2.5, C.skin, C.skinS);
  } else if (name === 'windup') {
    ellipse(g, 27, 23 + y0, 2.5, 2.5, C.skin, C.skinS);
  } else if (name === 'throw') {
    ellipse(g, 30, 14, 2.5, 2.5, C.skin, C.skinS);
    ellipse(g, 32, 10, 3.5, 3, C.stone, C.stoneS, C.stoneL);
  }
  if (name === 'dig') {
    // À moitié enfoncé : on redessine le gnome 12 px plus bas, coupé au ras du monticule.
    shovel(28, 14, 30, 33, 28, 31, false);
    const [dc, dg] = makeCanvas(40, 40);
    dg.drawImage(c, 0, 12);
    dg.clearRect(0, 33, 40, 7);
    mound(dg, 20, 34, 15, 4.5);
    return outline(dc);
  }
  if (name === 'statue') {
    // Gnome de jardin en pierre : tout en niveaux de gris.
    const img = g.getImageData(0, 0, 40, 40);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const l = (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) * 0.75 + 30;
      d[i] = l; d[i + 1] = l * 0.98; d[i + 2] = l * 0.95;
    }
    g.putImageData(img, 0, 0);
  }
  return outline(c);
}

export function buildMonsters(scene) {
  const frames = [];
  for (const p of ['idle', 'hop', 'squash', 'hurt']) frames.push({ name: 'lapinfou_' + p, canvas: lapin(p) });
  for (const p of ['walk0', 'walk1', 'windup', 'hurt']) frames.push({ name: 'champignard_' + p, canvas: champi(p) });
  for (const p of ['mound', 'up', 'windup', 'dig', 'hurt']) frames.push({ name: 'taupinarde_' + p, canvas: taupe(p) });
  addSheet(scene, 'mobs', frames, 24, 24, 8);
  const boss = ['statue', 'idle0', 'idle1', 'windup', 'slam', 'throw', 'dig', 'mound', 'hurt'];
  addSheet(scene, 'boss', boss.map((p) => ({ name: 'gnomard_' + p, canvas: gnome(p) })), 40, 40, 8);
}
