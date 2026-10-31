// Tileset 16x16 généré à partir de assets/tilesets/saran.json (mêmes index que la carte Tiled).
// Les tuiles des calques « deco » et « above » ont un fond transparent : l'herbe vient du sol.
import { C } from './palette.js';
import { dot, ellipse, groundShadow, hash2, line, makeCanvas, outline, rect } from './pixel.js';

const T = 16;

function grass(g, v) {
  rect(g, 0, 0, T, T, C.grass);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const h = hash2(x, y, 11 + v);
      if (h < 0.06) dot(g, x, y, C.grassS);
      else if (h > 0.965) dot(g, x, y, C.grassL);
    }
  }
  const tufts = v === 1 ? [[3, 4], [10, 10], [12, 3]] : v === 2 ? [[6, 7]] : [[11, 12]];
  for (const [x, y] of tufts) {
    dot(g, x, y + 1, C.grassD); dot(g, x + 1, y, C.grassD); dot(g, x + 2, y + 1, C.grassD);
    dot(g, x + 1, y - 1, C.grassL);
  }
  if (v === 2) { dot(g, 3, 12, C.white); dot(g, 12, 6, C.white); dot(g, 4, 12, C.goldL); }
}

function flowers(g, v) {
  grass(g, 0);
  const petal = v === 0 ? C.redL : C.gold;
  const heart = v === 0 ? C.goldL : C.white;
  for (const [x, y] of [[3, 3], [10, 5], [6, 10], [12, 12], [1, 13]]) {
    dot(g, x, y - 1, petal); dot(g, x - 1, y, petal); dot(g, x + 1, y, petal); dot(g, x, y + 1, petal);
    dot(g, x, y, heart);
    dot(g, x, y + 2, C.grassD);
  }
}

function dirt(g) {
  rect(g, 0, 0, T, T, C.dirt);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const h = hash2(x, y, 5);
    if (h < 0.08) dot(g, x, y, C.dirtS); else if (h > 0.94) dot(g, x, y, C.dirtL);
  }
}

// Bord herbeux irrégulier sur les côtés où le voisin n'est pas du même terrain.
function edges(g, mask, seed, lip) {
  const sides = [[1, 'n'], [2, 'e'], [4, 's'], [8, 'w']];
  for (const [bit, side] of sides) {
    if (mask & bit) continue;
    for (let i = 0; i < T; i++) {
      const depth = 2 + (hash2(i, bit, seed) > 0.55 ? 1 : 0);
      for (let k = 0; k < depth; k++) {
        const [x, y] = side === 'n' ? [i, k] : side === 's' ? [i, T - 1 - k] : side === 'w' ? [k, i] : [T - 1 - k, i];
        dot(g, x, y, k === depth - 1 ? C.grassS : C.grass);
      }
      const [lx, ly] = side === 'n' ? [i, depth] : side === 's' ? [i, T - 1 - depth] : side === 'w' ? [depth, i] : [T - 1 - depth, i];
      if (lip && hash2(i, bit, seed + 3) > 0.3) dot(g, lx, ly, lip);
    }
  }
}

function water(g, mask) {
  rect(g, 0, 0, T, T, C.water);
  for (let y = 1; y < T; y += 4) {
    const x = Math.floor(hash2(y, mask, 2) * 10) + ((y / 4) % 2) * 3;
    rect(g, x % 13, y, 3, 1, C.waterL);
    dot(g, (x + 7) % 15, y + 2, C.waterS);
  }
  edges(g, mask, 21, C.foam);
}

function path(g, mask) {
  dirt(g);
  edges(g, mask, 33, null);
}

function bridge(g) {
  rect(g, 0, 0, T, T, C.wood);
  for (let x = 3; x < T; x += 4) rect(g, x, 3, 1, 10, C.woodS);
  for (let x = 0; x < T; x += 4) dot(g, x + 1, 5 + (x % 8 === 0 ? 4 : 0), C.woodL);
  rect(g, 0, 0, T, 3, C.woodS); rect(g, 0, 1, T, 1, C.woodL);
  rect(g, 0, 13, T, 3, C.woodS); rect(g, 0, 14, T, 1, C.woodL);
  for (const x of [1, 9]) { rect(g, x, 0, 2, 3, C.brownS); rect(g, x, 13, 2, 3, C.brownS); }
}

function withOutline(w, h, draw) {
  const [c, g] = makeCanvas(w, h);
  draw(g);
  return outline(c);
}

function rock(g) {
  groundShadow(g, 8, 13, 7, 2.5);
  g.drawImage(withOutline(T, T, (r) => {
    ellipse(r, 8, 9.5, 6.5, 5, C.stone, C.stoneS, C.stoneL);
    line(r, 6, 8, 8, 10, C.stoneS); dot(r, 9, 10, C.stoneS);
    dot(r, 5, 6, C.white);
  }), 0, 0);
}

function bush(g) {
  groundShadow(g, 8, 13, 7, 2.5);
  g.drawImage(withOutline(T, T, (r) => {
    ellipse(r, 8, 9, 6.8, 5.6, C.leaf, C.leafS, C.leafL);
    ellipse(r, 5, 7, 3, 2.5, C.leaf, null, C.leafL);
    ellipse(r, 11, 7.5, 3, 2.5, C.leaf, C.leafS, C.leafL);
    for (const [x, y] of [[5, 10], [10, 11], [8, 7]]) dot(r, x, y, C.redL);
  }), 0, 0);
}

function sign(g) {
  groundShadow(g, 8, 14, 4, 1.5);
  g.drawImage(withOutline(T, T, (r) => {
    rect(r, 7, 9, 2, 6, C.wood); dot(r, 8, 10, C.woodS);
    rect(r, 2, 3, 12, 7, C.wood); rect(r, 2, 3, 12, 1, C.woodL); rect(r, 2, 9, 12, 1, C.woodS);
    rect(r, 4, 5, 8, 1, C.woodS); rect(r, 4, 7, 6, 1, C.woodS);
  }), 0, 0);
}

function fence(g) {
  g.drawImage(withOutline(T, T, (r) => {
    rect(r, 0, 6, T, 2, C.wood); rect(r, 0, 6, T, 1, C.woodL);
    rect(r, 0, 10, T, 2, C.wood); rect(r, 0, 11, T, 1, C.woodS);
    for (const x of [2, 11]) { rect(r, x, 4, 3, 10, C.wood); rect(r, x + 2, 4, 1, 10, C.woodS); dot(r, x, 4, C.woodL); }
  }), 0, 0);
}

// Coffre en bois cerclé d'or : 0 fermé, 1 ouvert (vide).
function chest(g, v) {
  groundShadow(g, 8, 14, 7, 2);
  g.drawImage(withOutline(T, T, (r) => {
    rect(r, 2, 7, 12, 7, C.wood); rect(r, 2, 13, 12, 1, C.woodS);
    for (const x of [2, 13]) rect(r, x, 7, 1, 7, C.goldS);
    if (v === 0) {
      rect(r, 2, 3, 12, 4, C.woodL); rect(r, 3, 2, 10, 1, C.woodL); rect(r, 2, 6, 12, 1, C.woodS);
      rect(r, 2, 6, 12, 1, C.gold); rect(r, 2, 3, 1, 4, C.goldS); rect(r, 13, 3, 1, 4, C.goldS);
      rect(r, 7, 6, 2, 3, C.goldL); dot(r, 7, 8, C.goldS);
      dot(r, 4, 3, C.goldL);
    } else {
      rect(r, 3, 7, 10, 2, C.brownS); // intérieur
      rect(r, 2, 1, 12, 4, C.woodS); rect(r, 2, 4, 12, 1, C.gold); rect(r, 3, 2, 10, 1, C.wood);
    }
  }), 0, 0);
}

// --- Gros objets découpés en plusieurs tuiles ----------------------------------
let treeImg = null;
function treeImage() {
  if (treeImg) return treeImg;
  const [c, g] = makeCanvas(32, 32);
  groundShadow(g, 16, 29, 11, 3, 0.3);
  const body = withOutline(32, 32, (r) => {
    rect(r, 13, 22, 6, 9, C.wood); rect(r, 17, 22, 2, 9, C.woodS); dot(r, 14, 25, C.woodL);
    dot(r, 12, 30, C.wood); dot(r, 19, 30, C.woodS);
    ellipse(r, 16, 14, 14.5, 10.5, C.leaf, C.leafS);
    ellipse(r, 8, 16, 7, 6, C.leaf, C.leafS);
    ellipse(r, 24, 16, 7, 6, C.leaf, C.leafS);
    ellipse(r, 16, 8, 9.5, 6.5, C.leaf, C.leafS, C.leafL);
    ellipse(r, 11, 7, 3.5, 2.5, C.leafL);
    ellipse(r, 21, 9, 2.5, 1.8, C.leafL);
    for (let y = 4; y < 25; y++) for (let x = 2; x < 30; x++) {
      if (hash2(x, y, 77) > 0.93 && r.getImageData(x, y, 1, 1).data[3]) dot(r, x, y, C.leafD);
    }
  });
  g.drawImage(body, 0, 0);
  treeImg = c;
  return c;
}

const houseImgs = {};
function houseImage(kind) {
  if (houseImgs[kind]) return houseImgs[kind];
  const [c, g] = makeCanvas(80, 64);
  const wall = kind === 'bakery' ? C.cream : C.plaster;
  // Toit en tuiles, faîtage en haut, débord sur les murs.
  for (let y = 2; y <= 30; y++) {
    const left = Math.round(8 - ((y - 2) * 8) / 28);
    for (let x = left; x < 80 - left; x++) {
      const row = Math.floor((y - 2) / 4);
      let col = C.roof;
      if ((y - 2) % 4 === 3) col = C.roofS;
      else if ((x + (row % 2) * 3) % 6 === 0) col = C.roofS;
      else if (y < 5) col = C.roofL;
      dot(g, x, y, col);
    }
  }
  rect(g, 0, 30, 80, 2, C.roofS);
  // Cheminée.
  rect(g, 58, 0, 7, 12, C.stone); rect(g, 63, 0, 2, 12, C.stoneS); rect(g, 57, 0, 9, 2, C.stoneS);
  // Murs à colombages.
  rect(g, 3, 32, 74, 32, wall);
  rect(g, 3, 32, 74, 2, C.woodS);
  rect(g, 3, 47, 74, 2, C.woodS);
  rect(g, 3, 62, 74, 2, C.woodS);
  for (const x of [3, 28, 50, 75]) rect(g, x, 32, 2, 32, C.woodS);
  line(g, 5, 49, 26, 61, C.woodS); line(g, 52, 61, 73, 49, C.woodS);
  line(g, 5, 46, 26, 34, C.woodS); line(g, 52, 34, 73, 46, C.woodS);
  // Fenêtres et volets.
  for (const wx of [9, 56]) {
    rect(g, wx - 3, 36, 3, 10, C.green); rect(g, wx + 13, 36, 3, 10, C.green);
    rect(g, wx, 36, 13, 10, C.woodS); rect(g, wx + 1, 37, 11, 8, C.glass);
    rect(g, wx + 6, 37, 1, 8, C.woodS); rect(g, wx + 1, 41, 11, 1, C.woodS);
    dot(g, wx + 2, 38, C.white); dot(g, wx + 8, 38, C.white);
    if (kind === 'bakery') { for (const bx of [wx + 2, wx + 8]) { rect(g, bx, 43, 3, 2, C.orange); dot(g, bx + 1, 43, C.orangeL); } }
  }
  // Porte.
  rect(g, 33, 46, 14, 18, C.wood); rect(g, 34, 45, 12, 1, C.wood);
  for (const x of [36, 40, 44]) rect(g, x, 46, 1, 18, C.woodS);
  dot(g, 44, 55, C.gold); rect(g, 32, 63, 16, 1, C.stone);
  if (kind === 'bakery') {
    // Enseigne en forme de chocolatine (et non de pain au chocolat).
    rect(g, 50, 36, 6, 1, C.black);
    rect(g, 53, 37, 1, 2, C.black);
    rect(g, 49, 39, 10, 6, C.goldS); rect(g, 50, 40, 8, 4, C.orange);
    rect(g, 51, 41, 1, 2, C.brownS); rect(g, 54, 41, 1, 2, C.brownS); rect(g, 56, 41, 1, 2, C.brownS);
  }
  outline(c);
  houseImgs[kind] = c;
  return c;
}

function slice(g, img, cols, v) {
  g.drawImage(img, -(v % cols) * T, -Math.floor(v / cols) * T);
}

const DRAW = {
  grass, flowers, dirt, water, path, bridge, rock, bush, sign, fence, chest,
  block: () => {},
  tree: (g, v) => slice(g, treeImage(), 2, v),
  house: (g, v) => slice(g, houseImage('house'), 5, v),
  bakery: (g, v) => slice(g, houseImage('bakery'), 5, v),
};

export function buildTileset(scene, defs) {
  const [c, g] = makeCanvas(defs.columns * T, defs.rows * T);
  for (const grp of defs.groups) {
    for (let v = 0; v < grp.count; v++) {
      const id = grp.start + v;
      const [tc, tg] = makeCanvas(T, T);
      DRAW[grp.name](tg, v);
      g.drawImage(tc, (id % defs.columns) * T, Math.floor(id / defs.columns) * T);
    }
  }
  scene.textures.addCanvas('tiles', c);
  return c;
}
