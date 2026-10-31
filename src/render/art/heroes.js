// Sprites des héros, dessinés « en poupée » (jambes, torse, bras, tête, cheveux, visage)
// sur des cadres 32x32, pieds sur la rangée 29. Style chibi façon Secret of Mana.
import { C } from './palette.js';
import { addSheet, dot, ellipse, inEllipse, line, makeCanvas, outline, rect } from './pixel.js';

const GROUND = 29;

export const LOOKS = {
  gus: {
    skin: [C.skin, C.skinS, C.skinL], hair: [C.hairD, C.hairDS, C.hairDL], hairStyle: 'slick', shades: true,
    top: [C.suit, C.suitS, C.suitL], legs: [C.brownS, C.hairDS], boots: [C.brown, C.brownS],
    wide: true, weapon: 'sword',
    detail(g, { dir, top, l, r }) {
      // Cape rouge, épaulières d'acier, chemise blanche ouverte et chaîne en or.
      if (dir === 'up') { rect(g, l, top, r - l + 1, 7, C.red); rect(g, r - 1, top, 2, 7, C.redS); rect(g, l + 1, top + 6, r - l - 1, 1, C.redS); }
      if (dir === 'right') { rect(g, l - 2, top + 1, 2, 7, C.red); dot(g, l - 2, top + 7, C.redS); }
      rect(g, l - 1, top, 3, 2, C.steel); dot(g, l - 1, top, C.steelL);
      rect(g, r - 1, top, 3, 2, C.steel); dot(g, r + 1, top + 1, C.steelS);
      if (dir === 'down') {
        rect(g, 15, top, 3, 2, C.white); dot(g, 16, top + 2, C.white);
        for (const [x, y] of [[14, 1], [15, 2], [16, 3], [17, 2], [18, 1]]) dot(g, x, top + y, C.gold);
        rect(g, l + 2, top, 2, 1, C.red); rect(g, r - 3, top, 2, 1, C.red);
      }
      if (dir === 'right') { rect(g, r - 1, top, 2, 2, C.white); dot(g, r, top + 2, C.gold); }
      rect(g, l, top + 5, r - l + 1, 1, C.brown);
      if (dir !== 'up') dot(g, dir === 'right' ? r - 1 : 16, top + 5, C.gold);
    },
  },
  karonux: {
    skin: [C.skin, C.skinS, C.skinL], hair: [C.brown, C.brownS, C.brownL], hairStyle: 'messy', shades: true,
    top: [C.navy, C.navyS, C.navyL], legs: [C.navyS, C.navyS], boots: [C.brownS, C.hairDS],
    robe: true, weapon: 'staff',
    detail(g, { dir, top, l, r }) {
      // Robe de mage : col, ceinture dorée, ourlet clair.
      rect(g, l, top + 4, r - l + 1, 1, C.gold);
      if (dir === 'down') { rect(g, 15, top, 3, 1, C.navyL); dot(g, 16, top + 5, C.goldL); }
      for (let x = l - 2; x <= r + 2; x++) if (x >= 0) dot(g, x, 27, C.navyL);
    },
  },
  lorenzo: {
    skin: [C.skin, C.skinS, C.skinL], hair: [C.hairD, C.hairDS, C.hairDL], hairStyle: 'bald', beard: true,
    top: [C.red, C.redS, C.redL], legs: [C.black, C.hairDS], boots: [C.black, C.hairDS], weapon: 'bow',
    detail(g, { dir, top, l, r }) {
      // Chemise rouge sous une veste noire, ceinture et carquois.
      if (dir === 'down') {
        rect(g, l, top, 2, 6, C.black); rect(g, r - 1, top, 2, 6, C.black); dot(g, l + 1, top, C.hairDL);
        dot(g, 15, top, C.white); dot(g, 17, top, C.white);
      } else if (dir === 'up') {
        rect(g, l, top, r - l + 1, 6, C.black); rect(g, 15, top, 3, 1, C.red);
        line(g, l + 1, top + 5, r - 2, top - 1, C.brown);
      } else {
        rect(g, l, top, 3, 6, C.black); rect(g, r - 1, top + 1, 1, 4, C.redS);
      }
      rect(g, l, top + 5, r - l + 1, 1, C.brownS);
    },
  },
};

// --- Parties du corps -----------------------------------------------------------
function leg(g, L, x, top, lift) {
  const bottom = GROUND - lift;
  const [p, ps] = L.legs;
  const [b, bs] = L.boots;
  for (let y = top; y <= bottom; y++) {
    const boot = y > bottom - 3;
    rect(g, x, y, 3, 1, boot ? b : p);
    dot(g, x + 2, y, boot ? bs : ps);
  }
}

function torso(g, L, l, r, top) {
  const [c, cs, cl] = L.top;
  const bottom = L.robe ? 27 : top + 6;
  for (let y = top; y <= bottom; y++) {
    let a = l;
    let b = r;
    if (L.robe && y > top + 4) {
      const flare = Math.min(2, Math.floor((y - top - 3) / 2));
      a -= flare;
      b += flare;
    }
    rect(g, a, y, b - a + 1, 1, c);
    dot(g, b, y, cs);
    dot(g, a, y, cl);
  }
  rect(g, l + 1, bottom, r - l - 1, 1, cs);
}

function arm(g, L, x, top, dy, up) {
  const [c, cs] = L.top;
  if (up) {
    rect(g, x, top - 6, 2, 7, c);
    dot(g, x + 1, top - 3, cs);
    rect(g, x, top - 8, 2, 2, L.skin[0]);
  } else {
    rect(g, x, top + 1 + dy, 2, 4, c);
    dot(g, x + 1, top + 3 + dy, cs);
    rect(g, x, top + 5 + dy, 2, 1, L.skin[0]);
    dot(g, x + 1, top + 5 + dy, L.skin[1]);
  }
}

function hairMask(style, view, x, y, cx, top) {
  const yy = y - top;
  if (style === 'slick') {
    if (view === 'back') return yy < 8.5;
    if (view === 'side') return yy < 3.2 || (x < cx - 0.5 && yy < 7.5);
    return yy < 3.2 || ((x < cx - 4.3 || x > cx + 3.3) && yy < 6.5);
  }
  if (style === 'messy') {
    if (view === 'back') return yy < 9;
    if (view === 'side') return yy < 3.8 || (x < cx - 1 && yy < 8) || (x > cx + 3 && yy < 5);
    return yy < 3.6 || (yy < 4.6 && x % 3 !== 0) || ((x < cx - 4 || x > cx + 3) && yy < 7);
  }
  return false;
}

function head(g, L, view, by) {
  const cx = view === 'side' ? 16.5 : 16;
  const cy = 12.5 + by;
  const rx = view === 'side' ? 5.4 : 5.6;
  const ry = 5.2;
  const top = Math.floor(cy - ry);
  const [h, hs, hl] = L.hair;
  ellipse(g, cx, cy, rx, ry, L.skin[0], L.skin[1], view === 'back' ? null : L.skin[2]);
  for (let y = top; y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (!inEllipse(x, y, cx, cy, rx + 0.2, ry + 0.2) || !hairMask(L.hairStyle, view, x, y, cx, top)) continue;
      dot(g, x, y, x > cx + 2 || y > cy + 2 ? hs : h);
    }
  }
  if (L.hairStyle === 'slick') { dot(g, Math.floor(cx) - 3, top + 1, hl); dot(g, Math.floor(cx) - 2, top, hl); }
  if (L.hairStyle === 'messy') {
    for (const [x, y] of view === 'side' ? [[12, -1], [15, -1], [10, 2]] : [[12, -1], [15, -2], [19, -1]]) dot(g, x, top + y, h);
    dot(g, 15, top - 1, hl);
  }
  if (L.hairStyle === 'bald') {
    if (view !== 'back') { dot(g, 13, top + 1, C.white); dot(g, 14, top + 1, L.skin[2]); }
    else { dot(g, 10, top + 5, L.skin[1]); dot(g, 22, top + 5, L.skin[1]); }
  }
  if (view === 'back') return;

  const ey = Math.round(cy + 0.5);
  if (view === 'front') {
    if (L.shades) {
      rect(g, 12, ey - 1, 9, 2, C.black);
      dot(g, 13, ey - 1, C.steelL); dot(g, 18, ey - 1, C.steelL);
    } else {
      rect(g, 14, ey - 1, 1, 2, C.ink); rect(g, 18, ey - 1, 1, 2, C.ink);
    }
    dot(g, 12, ey + 2, C.blush); dot(g, 20, ey + 2, C.blush);
    if (L.beard) { rect(g, 14, ey + 2, 5, 1, h); rect(g, 15, ey + 3, 3, 2, h); }
  } else {
    if (L.shades) { rect(g, 17, ey - 1, 5, 2, C.black); dot(g, 20, ey - 1, C.steelL); }
    else rect(g, 19, ey - 1, 1, 2, C.ink);
    dot(g, 21, ey + 2, C.blush);
    dot(g, 15, ey, L.skin[1]);
    if (L.beard) { rect(g, 19, ey + 2, 3, 1, h); rect(g, 19, ey + 3, 2, 2, h); }
  }
}

// --- Armes ----------------------------------------------------------------------
const WEAPON_LINES = {
  down: [[[21, 14], [25, 5]], [[17, 22], [17, 31]]],
  right: [[[13, 15], [9, 6]], [[20, 20], [31, 20]]],
  up: [[[21, 17], [25, 25]], [[17, 12], [17, 1]]],
};

function weapon(g, L, dir, phase) {
  const [[x0, y0], [x1, y1]] = WEAPON_LINES[dir][phase];
  const vertical = Math.abs(x1 - x0) < Math.abs(y1 - y0);
  if (L.weapon === 'bow') return bow(g, dir, phase);
  const [main, edge] = L.weapon === 'sword' ? [C.steelL, C.steel] : [C.woodL, C.wood];
  line(g, x0, y0, x1, y1, main);
  line(g, x0 + (vertical ? 1 : 0), y0 + (vertical ? 0 : 1), x1 + (vertical ? 1 : 0), y1 + (vertical ? 0 : 1), edge);
  if (L.weapon === 'sword') {
    if (vertical) rect(g, x0 - 1, y0, 4, 1, C.gold); else rect(g, x0, y0 - 1, 1, 4, C.gold);
  } else {
    rect(g, x1 - 1, y1 - 1, 3, 3, C.purpleL); dot(g, x1 - 1, y1 - 1, C.white);
  }
}

function bow(g, dir, phase) {
  const pull = phase === 0 ? 2 : 0;
  if (dir === 'right') {
    for (let y = 14; y <= 25; y++) dot(g, y === 14 || y === 25 ? 22 : 23, y, C.wood);
    dot(g, 24, 19, C.woodS); dot(g, 24, 20, C.woodS);
    line(g, 22, 14, 21 - pull, 19, C.steelL); line(g, 21 - pull, 20, 22, 25, C.steelL);
  } else if (dir === 'down') {
    for (let x = 10; x <= 22; x++) dot(g, x, x === 10 || x === 22 ? 23 : 24, C.wood);
    line(g, 10, 23, 16, 22 - pull, C.steelL); line(g, 16, 22 - pull, 22, 23, C.steelL);
  } else {
    for (let x = 10; x <= 22; x++) dot(g, x, x === 10 || x === 22 ? 7 : 6, C.wood);
    line(g, 10, 7, 16, 8 + pull, C.steelL); line(g, 16, 8 + pull, 22, 7, C.steelL);
  }
}

// --- Poses ----------------------------------------------------------------------
// walk : 0 pas gauche, 1 passage, 2 pas droit, 3 passage (avec léger rebond).
function pose(L, dir, name) {
  const [c, g] = makeCanvas(32, 32);
  const walk = name.startsWith('walk') ? Number(name[4]) : -1;
  const bob = walk === 1 || walk === 3 ? -1 : 0;
  const up = name === 'cast';
  const phase = name === 'atk0' ? 0 : name === 'atk1' ? 1 : -1;
  const behind = phase === 0 || (phase === 1 && dir === 'up' && L.weapon !== 'bow');
  if (phase >= 0 && behind) weapon(g, L, dir, phase);

  if (dir === 'right') {
    const l = L.wide ? 12 : 13;
    const r = L.wide ? 20 : 19;
    const stride = walk === 0 || walk === 2 ? 2 : 0;
    if (!L.robe) {
      leg(g, { ...L, legs: [L.legs[1], L.legs[1]], boots: [L.boots[1], L.boots[1]] }, 14 - stride, 24, walk === 2 ? 1 : 0);
      leg(g, L, 15 + stride, 24, walk === 0 ? 1 : 0);
      dot(g, 18 + stride, GROUND - (walk === 0 ? 1 : 0), L.boots[0]);
    } else {
      rect(g, 13 - stride, 28, 3, 2, L.boots[1]);
      rect(g, 16 + stride, 28, 3, 2, L.boots[0]);
    }
    torso(g, L, l, r, 17 + bob);
    L.detail(g, { dir, top: 17 + bob, l, r });
    if (up) arm(g, L, 17, 17 + bob, 0, true);
    else arm(g, L, 15 + (walk === 0 ? 1 : walk === 2 ? -1 : 0) + (phase === 1 ? 3 : 0), 17 + bob, phase === 1 ? -1 : 0, false);
    head(g, L, 'side', bob);
  } else {
    const back = dir === 'up';
    const l = L.wide ? 11 : 12;
    const r = L.wide ? 21 : 20;
    if (!L.robe) {
      leg(g, L, 13, 24, walk === 0 ? 1 : 0);
      leg(g, L, 17, 24, walk === 2 ? 1 : 0);
    } else {
      rect(g, 13, 28, 3, walk === 0 ? 1 : 2, L.boots[0]);
      rect(g, 17, 28, 3, walk === 2 ? 1 : 2, L.boots[0]);
    }
    torso(g, L, l, r, 17 + bob);
    L.detail(g, { dir, top: 17 + bob, l, r });
    const swing = walk === 0 ? 1 : walk === 2 ? -1 : 0;
    arm(g, L, l - 2, 17 + bob, swing, up);
    arm(g, L, r + 1, 17 + bob, -swing, up);
    head(g, L, back ? 'back' : 'front', bob);
  }
  if (phase >= 0 && !behind) weapon(g, L, dir, phase);
  if (up) for (const [x, y] of [[10, 7], [22, 7], [16, 3]]) dot(g, x, y, C.goldL);
  return c;
}

function koPose(L) {
  const src = pose(L, 'right', 'idle');
  const [c, g] = makeCanvas(32, 32);
  g.translate(16, 24);
  g.rotate(-Math.PI / 2);
  g.drawImage(src, -16, -18);
  return c;
}

export const HERO_POSES = ['idle', 'walk0', 'walk1', 'walk2', 'walk3', 'atk0', 'atk1', 'cast'];

export function buildHeroes(scene) {
  for (const [id, L] of Object.entries(LOOKS)) {
    const frames = [];
    for (const dir of ['down', 'up', 'right']) {
      for (const p of HERO_POSES) frames.push({ name: `${dir}_${p}`, canvas: outline(pose(L, dir, p)) });
    }
    frames.push({ name: 'ko', canvas: outline(koPose(L)) });
    addSheet(scene, 'hero_' + id, frames, 32, 32, 8);
  }
}
