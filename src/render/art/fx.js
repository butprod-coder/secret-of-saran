// Effets, projectiles, objets au sol et icônes du ring menu.
import { C } from './palette.js';
import { addSheet, dot, ellipse, groundShadow, line, makeCanvas, outline, rect } from './pixel.js';

function canvasOf(w, h, draw, withOutline = true) {
  const [c, g] = makeCanvas(w, h);
  draw(g);
  return withOutline ? outline(c) : c;
}

// Croissant de lame, orienté vers la droite, pivot à (6, 12).
function slash() {
  return canvasOf(24, 24, (g) => {
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const dx = x + 0.5 - 6;
      const dy = y + 0.5 - 12;
      const r = Math.hypot(dx, dy);
      const a = Math.abs(Math.atan2(dy, dx));
      if (a > 1.25) continue;
      const inner = 7.5 + (a / 1.25) * 3.5;
      if (r >= inner && r <= 11.5) dot(g, x, y, r > 10.5 ? C.ice : C.white);
    }
  }, false);
}

function ring(size, r0, r1, colA, colB) {
  return canvasOf(size, size, (g) => {
    const m = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - m, y + 0.5 - m);
      const a = Math.atan2(y + 0.5 - m, x + 0.5 - m);
      if (r >= r0 && r <= r1 && Math.sin(a * 3) > -0.4) dot(g, x, y, r > (r0 + r1) / 2 ? colB : colA);
    }
  }, false);
}

const star = (g, cx, cy, s, a, b) => {
  line(g, cx - s, cy, cx + s, cy, a); line(g, cx, cy - s, cx, cy + s, a);
  dot(g, cx - 1, cy - 1, b); dot(g, cx + 1, cy + 1, b); dot(g, cx + 1, cy - 1, b); dot(g, cx - 1, cy + 1, b);
  dot(g, cx, cy, C.white);
};

function fxFrames() {
  const f = [];
  const add = (name, canvas) => f.push({ name, canvas });
  add('shadow', canvasOf(12, 5, (g) => groundShadow(g, 6, 2.5, 6, 2.5, 0.32), false));
  add('slash', slash());
  add('spin', ring(48, 15, 20, C.white, C.ice));
  add('chargering', ring(24, 8, 11, C.goldL, C.gold));
  add('spark0', canvasOf(12, 12, (g) => star(g, 6, 6, 4, C.white, C.goldL), false));
  add('spark1', canvasOf(12, 12, (g) => star(g, 6, 6, 5, C.goldL, C.gold), false));
  for (let i = 0; i < 3; i++) {
    add('puff' + i, canvasOf(16, 16, (g) => {
      const r = 3 + i * 2;
      for (const [x, y] of [[8, 8], [8 - r / 2, 9], [8 + r / 2, 7], [8, 8 - r / 2]]) ellipse(g, x, y, r / 2 + 1, r / 2 + 1, i === 2 ? C.creamS : C.cream);
    }, i < 2));
  }
  for (let i = 0; i < 2; i++) {
    add('feu' + i, canvasOf(14, 12, (g) => {
      ellipse(g, 6 - i, 6, 4.5, 3.5 + i * 0.5, C.orange, C.red, C.orangeL);
      ellipse(g, 7, 6, 2.2, 1.8, C.goldL);
      dot(g, 11, 4 + i * 3, C.orange); dot(g, 12, 6, C.red);
    }));
  }
  add('flamme', canvasOf(18, 18, (g) => {
    ellipse(g, 9, 9, 7, 7, C.red, null, C.orange);
    ellipse(g, 9, 9, 4.5, 4.5, C.orange, null, C.goldL);
    ellipse(g, 9, 9, 2, 2, C.white);
  }));
  add('gel', canvasOf(28, 24, (g) => {
    for (const [x, y, h] of [[8, 14, 8], [14, 10, 12], [20, 14, 8], [11, 18, 5], [18, 19, 5]]) {
      for (let k = 0; k < h; k++) {
        const w = Math.max(0, Math.round((k < h / 2 ? k : h - k) / 2));
        rect(g, x - w, y - h + k + 4, w * 2 + 1, 1, k < h / 2 ? C.ice : C.iceS);
      }
      dot(g, x, y - h + 5, C.white);
    }
  }));
  add('soin', canvasOf(9, 9, (g) => { star(g, 4, 4, 3, C.greenL, C.white); }, false));
  add('bouclier', canvasOf(20, 22, (g) => {
    for (let y = 0; y < 22; y++) {
      const half = y < 12 ? 9 : Math.max(0, Math.round(9 - (y - 12) * 0.95));
      if (half > 0) { dot(g, 10 - half, y, C.ice); dot(g, 9 + half, y, C.ice); }
    }
    rect(g, 1, 0, 18, 1, C.ice);
    line(g, 5, 4, 8, 4, C.white);
  }, false));
  add('spores', canvasOf(36, 24, (g) => {
    for (const [x, y, r] of [[10, 12, 6], [18, 9, 7], [26, 12, 6], [14, 16, 5], [23, 16, 5]]) ellipse(g, x, y, r, r * 0.8, C.purpleL, C.purple);
    for (const [x, y] of [[6, 6], [30, 5], [18, 2]]) dot(g, x, y, C.purpleL);
  }));
  add('arrow', canvasOf(13, 5, (g) => {
    rect(g, 1, 2, 9, 1, C.woodL); rect(g, 10, 1, 2, 3, C.steel); dot(g, 12, 2, C.steelL);
    dot(g, 1, 1, C.red); dot(g, 2, 1, C.red); dot(g, 1, 3, C.red); dot(g, 2, 3, C.red);
  }));
  add('cursor', canvasOf(9, 8, (g) => {
    for (let y = 0; y < 5; y++) rect(g, y, y + 1, 9 - y * 2, 1, y < 2 ? C.goldL : C.gold);
  }));
  add('pk_coin', canvasOf(8, 8, (g) => { ellipse(g, 4, 4, 3, 3, C.gold, C.goldS, C.goldL); rect(g, 4, 2, 1, 4, C.goldS); }));
  return f;
}

// --- Icônes 16x16 (ring menu et objets au sol) -------------------------------------
const ICONS = {
  chocolatine(g) {
    rect(g, 2, 6, 12, 7, C.orange); rect(g, 2, 6, 12, 1, C.orangeL); rect(g, 2, 12, 12, 1, C.orangeS);
    rect(g, 1, 7, 1, 5, C.orangeS); rect(g, 14, 7, 1, 5, C.orangeS);
    for (const x of [4, 8, 11]) rect(g, x, 7, 1, 5, C.brownS);
    dot(g, 5, 7, C.goldL); dot(g, 9, 7, C.goldL);
  },
  eauloire(g) {
    rect(g, 6, 1, 4, 2, C.brown); rect(g, 6, 3, 4, 3, C.glass);
    ellipse(g, 8, 10, 5, 5, C.glass, C.iceS);
    ellipse(g, 8, 11, 4, 3, C.water, C.waterS, C.waterL);
    dot(g, 6, 7, C.white);
  },
  amitie(g) {
    for (let y = 2; y < 8; y++) rect(g, 3 + Math.floor((y - 2) / 3), y, 10 - 2 * Math.floor((y - 2) / 3), 1, y < 4 ? C.glass : C.redS);
    rect(g, 5, 8, 6, 1, C.redS); rect(g, 7, 9, 2, 4, C.glass); rect(g, 4, 13, 8, 1, C.glass);
    dot(g, 4, 3, C.white);
  },
  feu(g) {
    ellipse(g, 8, 10, 5, 4.5, C.red, null, C.orange);
    for (let k = 0; k < 6; k++) rect(g, 7 - Math.floor(k / 3), 2 + k, 2 + Math.floor(k / 3) * 2, 1, C.orange);
    ellipse(g, 8, 10, 2.5, 2.5, C.goldL);
  },
  gel(g) {
    line(g, 8, 1, 8, 15, C.ice); line(g, 1, 8, 15, 8, C.ice); line(g, 3, 3, 13, 13, C.iceS); line(g, 13, 3, 3, 13, C.iceS);
    dot(g, 8, 8, C.white); for (const [x, y] of [[8, 1], [8, 15], [1, 8], [15, 8]]) dot(g, x, y, C.white);
  },
  soin(g) {
    ellipse(g, 8, 9, 5.5, 5.5, C.water, C.waterS, C.waterL);
    rect(g, 7, 3, 2, 2, C.water); dot(g, 8, 2, C.water);
    rect(g, 7, 6, 2, 6, C.white); rect(g, 5, 8, 6, 2, C.white);
  },
  bouclier(g) {
    for (let y = 2; y < 15; y++) {
      const half = y < 9 ? 6 : Math.max(1, 6 - (y - 9));
      rect(g, 8 - half, y, half * 2, 1, y < 4 ? C.stoneL : C.stone);
      dot(g, 7 + half, y, C.stoneS);
    }
    rect(g, 7, 3, 2, 10, C.green); rect(g, 4, 6, 8, 2, C.green);
  },
  tac_agressif(g) {
    line(g, 3, 13, 12, 4, C.steelL); line(g, 4, 13, 13, 4, C.steel); dot(g, 13, 3, C.white);
    line(g, 2, 10, 6, 14, C.gold); rect(g, 1, 14, 2, 2, C.brown);
  },
  tac_defensif(g) {
    for (let y = 2; y < 15; y++) {
      const half = y < 9 ? 6 : Math.max(1, 6 - (y - 9));
      rect(g, 8 - half, y, half * 2, 1, C.navyL);
      dot(g, 7 + half, y, C.navy);
    }
    rect(g, 7, 4, 2, 8, C.gold);
  },
  tac_suivre(g) {
    for (const [x, y] of [[3, 9], [9, 3]]) {
      ellipse(g, x + 2, y + 3, 2.2, 3, C.brown, C.brownS);
      for (let k = 0; k < 3; k++) dot(g, x + k + 1, y - 1, C.brown);
    }
  },
  vide(g) { ellipse(g, 8, 8, 5, 5, C.stoneS); line(g, 4, 12, 12, 4, C.stone); ellipse(g, 8, 8, 3, 3, C.stone); },

  // --- Équipement ---
  bandana(g) {
    ellipse(g, 8, 9, 6, 4, C.red, C.redS, C.redL);
    rect(g, 2, 9, 12, 2, C.redS);
    for (const x of [4, 8, 11]) dot(g, x, 7, C.white);
    line(g, 13, 10, 15, 13, C.red); line(g, 12, 11, 13, 14, C.redS);
  },
  casquette(g) {
    ellipse(g, 7, 8, 5.5, 4.5, C.green, C.greenS, C.greenL);
    rect(g, 2, 10, 13, 2, C.greenS); rect(g, 9, 11, 6, 1, C.green);
    rect(g, 5, 6, 4, 2, C.white); dot(g, 6, 7, C.red);
  },
  casque(g) {
    ellipse(g, 8, 9, 6.5, 5.5, C.red, C.redS, C.redL);
    rect(g, 1, 11, 14, 2, C.gold); rect(g, 1, 12, 14, 1, C.goldS);
    rect(g, 7, 3, 2, 8, C.gold); dot(g, 5, 6, C.white);
  },
  tshirt(g) {
    rect(g, 4, 4, 8, 10, C.white); rect(g, 1, 4, 3, 4, C.white); rect(g, 12, 4, 3, 4, C.white);
    rect(g, 6, 3, 4, 2, C.creamS); rect(g, 4, 13, 8, 1, C.creamS);
    rect(g, 6, 7, 4, 3, C.red); dot(g, 7, 7, C.redL);
  },
  gilet(g) {
    rect(g, 3, 3, 4, 11, C.green); rect(g, 9, 3, 4, 11, C.green);
    rect(g, 7, 3, 2, 11, C.navy);
    for (const [x, y] of [[4, 6], [10, 6], [4, 10], [10, 10]]) { rect(g, x, y, 2, 2, C.greenS); dot(g, x, y, C.greenL); }
  },
  cotte(g) {
    rect(g, 3, 3, 10, 11, C.steel); rect(g, 1, 4, 2, 5, C.steel); rect(g, 13, 4, 2, 5, C.steel);
    for (let y = 4; y < 14; y += 2) for (let x = 3 + (y % 4 ? 1 : 0); x < 13; x += 2) dot(g, x, y, C.steelS);
    for (const [x, y] of [[5, 8], [10, 11], [8, 5]]) dot(g, x, y, C.orangeS);
  },
  robe(g) {
    for (let y = 2; y < 15; y++) { const w = 3 + Math.floor(y / 3); rect(g, 8 - w, y, w * 2, 1, C.purple); }
    rect(g, 7, 2, 2, 13, C.purpleS); rect(g, 3, 9, 10, 1, C.goldS);
    dot(g, 5, 5, C.purpleL); dot(g, 10, 12, C.purpleL);
  },
  gants(g) {
    for (const x of [2, 9]) {
      rect(g, x, 6, 5, 7, C.orange); rect(g, x, 12, 5, 1, C.orangeS);
      for (let k = 0; k < 4; k++) rect(g, x + k, 3 + (k % 2), 1, 3, C.orange);
      rect(g, x, 10, 5, 1, C.green);
    }
  },
  bracelet(g) {
    for (let a = 0; a < 16; a++) {
      const x = Math.round(8 + Math.cos((a / 16) * Math.PI * 2) * 5);
      const y = Math.round(8 + Math.sin((a / 16) * Math.PI * 2) * 3);
      dot(g, x, y, [C.red, C.gold, C.green, C.navyL][a % 4]);
    }
    rect(g, 12, 9, 1, 4, C.red); rect(g, 13, 10, 1, 4, C.gold);
  },
  montre(g) {
    rect(g, 6, 1, 4, 14, C.goldS); ellipse(g, 8, 8, 4, 4, C.gold, C.goldS, C.goldL);
    ellipse(g, 8, 8, 2.5, 2.5, C.white); line(g, 8, 6, 8, 8, C.black); line(g, 8, 8, 9, 8, C.black);
  },
  // --- Ring Système / statut ---
  sauver(g) {
    rect(g, 2, 2, 12, 12, C.navyL); rect(g, 4, 2, 8, 5, C.white); rect(g, 9, 3, 2, 3, C.navy);
    rect(g, 4, 9, 8, 5, C.navy); rect(g, 5, 10, 6, 1, C.navyL); rect(g, 2, 13, 12, 1, C.navyS);
  },
  charger(g) {
    rect(g, 2, 5, 12, 9, C.goldS); rect(g, 2, 3, 5, 2, C.goldS); rect(g, 3, 7, 12, 7, C.gold); dot(g, 4, 8, C.goldL);
  },
  exporter(g) {
    rect(g, 3, 2, 9, 12, C.white); rect(g, 4, 4, 6, 1, C.stone); rect(g, 4, 6, 5, 1, C.stone);
    rect(g, 9, 9, 6, 2, C.green); line(g, 12, 7, 15, 10, C.green); line(g, 12, 13, 15, 10, C.green);
  },
  importer(g) {
    rect(g, 3, 2, 9, 12, C.white); rect(g, 4, 4, 6, 1, C.stone); rect(g, 4, 6, 5, 1, C.stone);
    rect(g, 6, 9, 6, 2, C.orange); line(g, 6, 10, 9, 7, C.orange); line(g, 6, 10, 9, 13, C.orange);
  },
  titre(g) {
    rect(g, 3, 3, 10, 10, C.cream); rect(g, 3, 3, 10, 2, C.red);
    for (const y of [7, 9, 11]) rect(g, 5, y, 6, 1, C.stoneS);
  },
};

export function buildFx(scene) {
  addSheet(scene, 'fx', fxFrames(), 48, 48, 8);
  const icons = Object.entries(ICONS).map(([name, draw]) => ({ name, canvas: canvasOf(16, 16, draw) }));
  addSheet(scene, 'ico', icons, 16, 16, 8);
}
