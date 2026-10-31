// Données statiques d'une carte, lues depuis un fichier Tiled (.tmj) déjà parsé.
// Ne fait pas partie de l'état sauvegardé : seul l'identifiant de carte l'est.
export class MapData {
  constructor({ id, name, width, height, tile, solid, low, start, spawns, signs, chests = [], warps = [], entries = {} }) {
    Object.assign(this, { id, name, width, height, tile, solid, low, start, spawns, signs, chests, warps, entries });
    this.pixelWidth = width * tile;
    this.pixelHeight = height * tile;
  }

  static fromTiled(id, json) {
    const { width, height, tilewidth: tile } = json;
    const solidGids = new Set();
    const lowGids = new Set();
    for (const ts of json.tilesets) {
      for (const t of ts.tiles ?? []) {
        const props = t.properties ?? [];
        if (props.some((p) => p.name === 'solid' && p.value)) solidGids.add(ts.firstgid + t.id);
        if (props.some((p) => p.name === 'low' && p.value)) lowGids.add(ts.firstgid + t.id);
      }
    }
    const solid = new Uint8Array(width * height);
    const low = new Uint8Array(width * height);
    const objects = [];
    for (const layer of json.layers) {
      if (layer.type === 'tilelayer') {
        layer.data.forEach((raw, i) => {
          const gid = raw & 0x1fffffff;
          if (solidGids.has(gid)) {
            solid[i] = 1;
            // Une case ne laisse passer les projectiles que si tout ce qui bloque y est « bas » (eau).
            low[i] = lowGids.has(gid) && low[i] !== 2 ? 1 : 2;
          }
        });
      } else if (layer.type === 'objectgroup') {
        objects.push(...layer.objects);
      }
    }
    const prop = (o, name, fallback = null) => (o.properties ?? []).find((p) => p.name === name)?.value ?? fallback;
    const center = (o) => ({ x: o.x + (o.width || tile) / 2, y: o.y + (o.height || tile) / 2 });
    const typeOf = (o) => o.type ?? o.class;

    const startObj = objects.find((o) => typeOf(o) === 'start');
    return new MapData({
      id,
      name: prop(json, 'name', id),
      width,
      height,
      tile,
      solid,
      low,
      start: startObj ? center(startObj) : { x: (width * tile) / 2, y: (height * tile) / 2 },
      spawns: objects.filter((o) => typeOf(o) === 'spawn').map((o) => ({ ...center(o), kind: prop(o, 'enemy') })),
      signs: objects.filter((o) => typeOf(o) === 'sign').map((o) => ({ ...center(o), text: prop(o, 'text', '') })),
      // Coffre : sa clé (carte + id d'objet Tiled) sert de drapeau « déjà ouvert » dans la sauvegarde.
      chests: objects.filter((o) => typeOf(o) === 'chest').map((o) => ({
        ...center(o), key: `${id}:${o.id}`, tx: Math.floor(o.x / tile), ty: Math.floor(o.y / tile),
        item: prop(o, 'item'), gold: Number(prop(o, 'gold', 0)),
      })),
      // Sortie : rectangle qui mène à l'entrée `entry` de la carte `map`.
      warps: objects.filter((o) => typeOf(o) === 'warp').map((o) => ({
        x: o.x, y: o.y, w: o.width || tile, h: o.height || tile, map: prop(o, 'map'), entry: prop(o, 'entry'),
      })),
      entries: Object.fromEntries(objects.filter((o) => typeOf(o) === 'entry').map((o) => [prop(o, 'entry'), center(o)])),
    });
  }

  warpAt(px, py) {
    return this.warps.find((w) => px >= w.x && px < w.x + w.w && py >= w.y && py < w.y + w.h) ?? null;
  }

  cell(px, py) {
    const tx = Math.floor(px / this.tile);
    const ty = Math.floor(py / this.tile);
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return -1;
    return ty * this.width + tx;
  }

  isSolidAt(px, py) {
    const i = this.cell(px, py);
    return i < 0 || this.solid[i] === 1;
  }

  blocksProjectileAt(px, py) {
    const i = this.cell(px, py);
    return i < 0 || this.low[i] === 2;
  }
}
