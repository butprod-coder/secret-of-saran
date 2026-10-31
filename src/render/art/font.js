// Police bitmap 5x8 dessinée ici, à chasse variable, avec accents français.
// Deux variantes : « pix » (simple) et « pixo » (contour sombre, pour le texte sur le décor).
import { makeCanvas, outline } from './pixel.js';

// Une ligne par rangée, séparées par « / ». Rangées 0-6 : corps, rangée 7 : jambage.
const GLYPHS = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###', J: '..###/...#./...#./...#./#..#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
  a: '//.###./....#/.####/#...#/.####', b: '#..../#..../####./#...#/#...#/#...#/####.',
  c: '//.###./#..../#..../#..../.###.', d: '....#/....#/.####/#...#/#...#/#...#/.####',
  e: '//.###./#...#/#####/#..../.###.', f: '..##/.#../###./.#../.#../.#../.#..',
  g: '//.####/#...#/#...#/.####/....#/.###.', h: '#..../#..../####./#...#/#...#/#...#/#...#',
  i: '.#./.../##./.#./.#./.#./###', j: '..#/.../.##/..#/..#/..#/#.#/.#.',
  k: '#.../#.../#..#/#.#./##../#.#./#..#', l: '##./.#./.#./.#./.#./.#./###',
  m: '//##.#./#.#.#/#.#.#/#.#.#/#...#', n: '//####./#...#/#...#/#...#/#...#',
  o: '//.###./#...#/#...#/#...#/.###.', p: '//####./#...#/#...#/####./#..../#....',
  q: '//.####/#...#/#...#/.####/....#/....#', r: '//#.##./##.../#..../#..../#....',
  s: '//.####/#..../.###./....#/####.', t: '.#../.#../###./.#../.#../.#../..##',
  u: '//#...#/#...#/#...#/#...#/.####', v: '//#...#/#...#/#...#/.#.#./..#..',
  w: '//#...#/#...#/#.#.#/#.#.#/.#.#.', x: '//#...#/.#.#./..#../.#.#./#...#',
  y: '//#...#/#...#/#...#/.####/....#/.###.', z: '//#####/...#./..#../.#.../#####',
  'ı': '//##./.#./.#./.#./###',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '.#./##./.#./.#./.#./.#./###',
  2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '####./....#/....#/.###./....#/....#/####.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/....#/.###.',
  '.': '//////#', ',': '//////.#/#.', '!': '#/#/#/#/#//#', '?': '.###./#...#/....#/...#./..#..//..#..',
  ':': '//#///#', ';': '//.#///.#/#.', "'": '#/#', '"': '#.#/#.#', '-': '///###',
  '+': '//.#./###/.#.', '/': '....#/...#./...#./..#../.#.../.#.../#....', '(': '.#/#./#./#./#./#./.#',
  ')': '#./.#/.#/.#/.#/.#/#.', '%': '##..#/##.#./...#./..#../.#.../.#.##/#..##', '*': '/#.#./.#./#.#.',
  '<': '/..#/.#./#../.#./..#', '>': '/#../.#./..#/.#./#..', '=': '//###//###', '_': '//////#####',
  '·': '///.#.', '~': '///.#.#/#.#.',
};
const ACCENTS = { acute: '...#./..#..', grave: '.#.../..#..', circ: '..#../.#.#.', trema: '/.#.#.', circ3: '.#./#.#', trema3: '/#.#' };
const COMPOSE = {
  'é': ['e', 'acute'], 'è': ['e', 'grave'], 'ê': ['e', 'circ'], 'ë': ['e', 'trema'],
  'à': ['a', 'grave'], 'â': ['a', 'circ'], 'ä': ['a', 'trema'], 'ô': ['o', 'circ'], 'ö': ['o', 'trema'],
  'ù': ['u', 'grave'], 'û': ['u', 'circ'], 'ü': ['u', 'trema'], 'î': ['ı', 'circ3'], 'ï': ['ı', 'trema3'],
  'ç': ['c', 'cedil'],
};
const FALLBACK = {
  'É': 'E', 'È': 'E', 'Ê': 'E', 'À': 'A', 'Â': 'A', 'Ç': 'C', 'Ô': 'O', 'Î': 'I', 'Û': 'U', 'Ù': 'U',
  '’': "'", '‘': "'", '«': '"', '»': '"', '“': '"', '”': '"', '—': '-', '–': '-', '×': 'x', ' ': ' ',
};

const CW = 6; // cellule de 6 x 9
const CH = 9;

function rowsOf(code) {
  const rows = code.split('/');
  while (rows.length < 8) rows.push('');
  return rows;
}

function buildGlyphs() {
  const out = {};
  for (const [ch, code] of Object.entries(GLYPHS)) out[ch] = rowsOf(code);
  for (const [ch, [base, acc]] of Object.entries(COMPOSE)) {
    const rows = out[base].slice();
    if (acc === 'cedil') rows[7] = '..#..';
    else ACCENTS[acc].split('/').forEach((r, i) => { if (r) rows[i] = r; });
    out[ch] = rows;
  }
  return out;
}

const glyphs = buildGlyphs();
export const CHARS = ' ' + Object.keys(glyphs).filter((c) => c !== 'ı').join('');
const widths = {};
for (const [ch, rows] of Object.entries(glyphs)) widths[ch] = Math.max(1, ...rows.map((r) => r.lastIndexOf('#') + 1));
widths[' '] = 2;

export function sanitize(text) {
  let s = '';
  for (const ch of String(text)) {
    if (ch === '\n' || ch === ' ' || glyphs[ch]) s += ch;
    else if (ch === 'œ') s += 'oe';
    else if (ch === '…') s += '...';
    else if (FALLBACK[ch]) s += FALLBACK[ch];
    else if (glyphs[ch.toLowerCase()]) s += ch.toLowerCase();
  }
  return s;
}

export function measure(text) {
  let w = 0;
  for (const ch of sanitize(text)) w += (widths[ch] ?? 3) + 1;
  return Math.max(0, w - 1);
}

// Coupe un texte en lignes d'au plus maxW pixels.
export function wrap(text, maxW) {
  const lines = [];
  for (const para of sanitize(text).split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) {
      const next = cur ? cur + ' ' + word : word;
      if (cur && measure(next) > maxW) { lines.push(cur); cur = word; } else cur = next;
    }
    lines.push(cur);
  }
  return lines;
}

function buildSheet(outlined) {
  const pad = outlined ? 1 : 0;
  const cw = CW + pad * 2;
  const ch = CH + pad * 2;
  const perRow = 16;
  const list = [...CHARS];
  const [c, g] = makeCanvas(cw * perRow, ch * Math.ceil(list.length / perRow));
  list.forEach((char, i) => {
    const rows = glyphs[char];
    if (!rows) return;
    const [gc, gg] = makeCanvas(cw, ch);
    gg.fillStyle = '#ffffff';
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') gg.fillRect(x + pad, y + pad, 1, 1); });
    if (outlined) outline(gc, '#1c1018');
    g.drawImage(gc, (i % perRow) * cw, Math.floor(i / perRow) * ch);
  });
  return { canvas: c, cw, ch, perRow };
}

export function buildFonts(scene) {
  for (const [key, outlined] of [['pix', false], ['pixo', true]]) {
    const sheet = buildSheet(outlined);
    scene.textures.addCanvas(key + '_img', sheet.canvas);
    const data = Phaser.GameObjects.RetroFont.Parse(scene, {
      image: key + '_img', width: sheet.cw, height: sheet.ch, chars: CHARS,
      charsPerRow: sheet.perRow, spacing: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, lineSpacing: outlined ? -1 : 1,
    });
    for (const char of CHARS) {
      const entry = data.data.chars[char.charCodeAt(0)];
      if (entry) entry.xAdvance = (widths[char] ?? 3) + 1;
    }
    scene.cache.bitmapFont.add(key, data);
  }
}
