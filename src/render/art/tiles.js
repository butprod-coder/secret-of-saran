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

// --- Galeries souterraines -----------------------------------------------------------
function cave(g, v) {
  rect(g, 0, 0, T, T, C.cave);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const h = hash2(x, y, 40 + v);
    if (h < 0.09) dot(g, x, y, C.caveS); else if (h > 0.95) dot(g, x, y, C.caveL);
  }
  if (v === 1) { ellipse(g, 5, 10, 2, 1.2, C.caveS); dot(g, 4, 9, C.caveL); }
  if (v === 2) { for (const [x, y] of [[3, 4], [11, 12], [12, 3]]) { dot(g, x, y, C.rockL); dot(g, x + 1, y + 1, C.rockS); } }
}

// Paroi : 0 = masse rocheuse vue de dessus, 1 = front du rocher (au-dessus d'un sol).
function cavewall(g, v) {
  if (v === 0) {
    rect(g, 0, 0, T, T, C.caveD);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (hash2(x, y, 52) > 0.9) dot(g, x, y, C.rockS);
    return;
  }
  rect(g, 0, 0, T, T, C.rock);
  rect(g, 0, 0, T, 2, C.rockL);
  for (const x of [4, 9, 13]) rect(g, x, 3 + (x % 3), 1, 7, C.rockS);
  for (let y = 3; y < 13; y++) for (let x = 0; x < T; x++) if (hash2(x, y, 53) > 0.92) dot(g, x, y, C.rockL);
  rect(g, 0, 13, T, 3, C.rockS); rect(g, 0, 15, T, 1, C.caveD);
}

function ladder(g) {
  rect(g, 2, 1, 12, 14, C.caveD);
  for (const x of [4, 10]) { rect(g, x, 0, 2, 16, C.wood); dot(g, x, 0, C.woodL); }
  for (let y = 2; y < 16; y += 4) { rect(g, 4, y, 8, 1, C.woodL); rect(g, 4, y + 1, 8, 1, C.woodS); }
}

function hole(g) {
  ellipse(g, 8, 9, 7.5, 5.5, C.dirtS);
  ellipse(g, 8, 9.5, 6, 4.2, C.caveD);
  rect(g, 3, 5, 3, 1, C.dirtL); dot(g, 12, 5, C.dirtL);
  for (const [x, y] of [[1, 12], [14, 11], [2, 6]]) dot(g, x, y, C.dirt);
}

// Grille : 0 fermée (bloque), 1 relevée dans le plafond (on ne voit plus que les pointes).
function gate(g, v) {
  const draw = (r) => {
    if (v === 0) {
      for (const x of [1, 5, 9, 13]) { rect(r, x, 0, 2, 15, C.steelS); rect(r, x, 0, 1, 15, C.steel); dot(r, x, 14, C.steelL); }
      rect(r, 0, 3, T, 2, C.steelS); rect(r, 0, 10, T, 2, C.steelS); rect(r, 0, 3, T, 1, C.steel);
    } else {
      for (const x of [1, 5, 9, 13]) { rect(r, x, 0, 2, 3, C.steelS); dot(r, x, 3, C.steel); }
      rect(r, 0, 0, T, 1, C.steelS);
    }
  };
  g.drawImage(withOutline(T, T, draw), 0, 0);
}

// Ronces : 0 haie infranchissable, 1 tiges coupées.
function ronces(g, v) {
  g.drawImage(withOutline(T, T, (r) => {
    if (v === 0) {
      ellipse(r, 8, 9, 7.5, 6.5, C.leafS, C.leafD, C.leaf);
      for (const [x0, y0, x1, y1] of [[1, 12, 9, 3], [6, 14, 15, 6], [2, 5, 12, 13]]) line(r, x0, y0, x1, y1, C.brownS);
      for (const [x, y] of [[4, 9], [10, 5], [12, 11], [7, 12], [8, 7]]) dot(r, x, y, C.redL);
    } else {
      for (const x of [3, 7, 12]) { rect(r, x, 11, 1, 4, C.brownS); dot(r, x, 11, C.leafL); }
      rect(r, 2, 14, 12, 1, C.leafS);
    }
  }), 0, 0);
}

// Levier sur socle de pierre : 0 au repos, 1 abaissé.
function lever(g, v) {
  groundShadow(g, 8, 14, 6, 2);
  g.drawImage(withOutline(T, T, (r) => {
    if (v === 0) { line(r, 8, 9, 4, 2, C.wood); dot(r, 4, 1, C.red); rect(r, 3, 1, 2, 2, C.red); }
    else { line(r, 8, 9, 12, 2, C.wood); rect(r, 11, 1, 2, 2, C.greenL); }
    rect(r, 3, 9, 10, 5, C.stone); rect(r, 3, 9, 10, 1, C.stoneL); rect(r, 3, 13, 10, 1, C.stoneS);
    dot(r, 8, 10, C.stoneS);
  }), 0, 0);
}

function roots(g) {
  groundShadow(g, 8, 13, 7, 2.5);
  g.drawImage(withOutline(T, T, (r) => {
    for (const [x0, y0, x1, y1] of [[1, 13, 7, 4], [7, 4, 14, 12], [3, 9, 12, 8], [10, 14, 6, 6]]) {
      line(r, x0, y0, x1, y1, C.wood); line(r, x0 + 1, y0, x1 + 1, y1, C.woodS);
    }
    dot(r, 7, 4, C.woodL); dot(r, 4, 8, C.woodL);
  }), 0, 0);
}

function shroom(g) {
  for (const [x, y, s] of [[5, 11, 3], [11, 9, 4], [9, 14, 2]]) {
    rect(g, x, y, 1, s, C.cream);
    ellipse(g, x + 0.5, y, s, s * 0.6, C.glowS, null, C.glow);
    dot(g, x, y - 1, C.white);
  }
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

// Le Grand Chêne de Saran : 6 x 6 tuiles, feuillage au-dessus des personnages, racines qui bloquent.
let oakImg = null;
function oakImage() {
  if (oakImg) return oakImg;
  const [c, g] = makeCanvas(96, 96);
  groundShadow(g, 48, 88, 40, 7, 0.32);
  const body = withOutline(96, 96, (r) => {
    // Racines et tronc.
    for (const [x0, x1] of [[20, 34], [62, 76], [30, 40], [56, 66]]) for (let x = x0; x < x1; x++) {
      const top = 74 + Math.abs(x - (x0 + x1) / 2) * 0.6;
      rect(r, x, Math.round(top), 1, 92 - Math.round(top), C.wood);
    }
    rect(r, 34, 50, 28, 42, C.wood); rect(r, 52, 50, 10, 42, C.woodS);
    for (const [x, y, h] of [[38, 56, 22], [45, 62, 18], [57, 54, 26]]) rect(r, x, y, 1, h, C.woodS);
    ellipse(r, 47, 74, 5, 6, C.caveD); // le creux qui mène aux galeries de Gnomard
    rect(r, 36, 52, 2, 3, C.woodL);
    // Feuillage en grappes.
    for (const [x, y, rx, ry] of [[48, 30, 44, 26], [20, 40, 18, 14], [76, 40, 18, 14], [48, 12, 28, 12], [30, 20, 16, 12], [66, 20, 16, 12]]) {
      ellipse(r, x, y, rx, ry, C.leaf, C.leafS);
    }
    for (const [x, y, rx, ry] of [[40, 14, 10, 5], [64, 18, 8, 4], [24, 30, 7, 4], [52, 28, 12, 6]]) ellipse(r, x, y, rx, ry, C.leafL);
    for (let y = 2; y < 64; y++) for (let x = 2; x < 94; x++) {
      if (hash2(x, y, 91) > 0.94 && r.getImageData(x, y, 1, 1).data[3]) dot(r, x, y, C.leafD);
    }
    for (const [x, y] of [[18, 44], [70, 30], [44, 40], [80, 46], [30, 26]]) { rect(r, x, y, 2, 2, C.brownL); dot(r, x, y, C.goldL); }
  });
  g.drawImage(body, 0, 0);
  oakImg = c;
  return c;
}

function slice(g, img, cols, v) {
  g.drawImage(img, -(v % cols) * T, -Math.floor(v / cols) * T);
}

const DRAW = {
  grass, flowers, dirt, water, path, bridge, rock, bush, sign, fence, chest,
  cave, cavewall, ladder, hole, gate, ronces, lever, roots, shroom,
  block: () => {},
  oak: (g, v) => slice(g, oakImage(), 6, v),
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
