// L'état du monde et son pas de simulation fixe (1/60 s).
// Aucune dépendance à Phaser ni au DOM : l'hôte fait tourner ce code, le rendu le lit.
// Tout l'état mutable est dans `this.s`, un objet JSON sérialisable.
import { DAY_TICKS } from '../config.js';
import { NO_INPUT } from './input.js';
import { nextRandom, randInt } from './rng.js';
import { HEROES, HERO_ORDER, TACTICS, statsAt, xpToNext } from './data/heroes.js';
import { ENEMIES } from './data/enemies.js';
import { ITEMS, MAX_STACK, START_INVENTORY } from './data/items.js';
import { GEAR, SLOTS, START_GEAR, canWear } from './data/equipment.js';
import { MAX_WEAPON_LV } from './data/weapons.js';
import { blockedAt, moveBody, separate } from './physics.js';
import { makeHero, refreshStats, updateHero } from './hero.js';
import { makeEnemy, updateEnemy } from './enemy.js';
import { updateProjectile } from './projectile.js';
import { startCast, useItem } from './magic.js';
import { allyThink } from './ai/ally.js';

export const STATE_VERSION = 1;
const RESPAWN_TICKS = 60 * 25;

export class World {
  constructor({ map, seed = 1, state = null }) {
    this.map = map;
    if (state) {
      this.s = state;
      return;
    }
    this.s = {
      version: STATE_VERSION,
      mapId: map.id,
      tick: 0,
      rng: seed >>> 0,
      clock: Math.round((DAY_TICKS * 9) / 24),
      day: 0,
      nextId: 1,
      ents: [],
      inventory: { ...START_INVENTORY },
      gear: { ...START_GEAR },
      gold: 0,
      flags: {},
      spawns: map.spawns.map((sp) => ({ x: sp.x, y: sp.y, kind: sp.kind, ent: null, timer: 0 })),
      events: [],
      gameOver: false,
      warp: null,
    };
    this.createParty(map.start);
    this.s.spawns.forEach((_, i) => this.spawnFromPoint(i));
  }

  // --- Sauvegarde -------------------------------------------------------------
  // Ce qui survit à un changement de carte ou à une sauvegarde : le groupe, pas les ennemis.
  toSave() {
    const s = this.s;
    const lead = this.leader() ?? this.heroes()[0];
    return {
      mapId: s.mapId,
      pos: { x: Math.round(lead.x), y: Math.round(lead.y) },
      tick: s.tick, clock: s.clock, day: s.day, rng: s.rng,
      gold: s.gold,
      inventory: { ...s.inventory },
      gear: { ...s.gear },
      flags: { ...s.flags },
      heroes: Object.fromEntries(this.heroes().map((h) => [h.hero, {
        lv: h.lv, xp: h.xp, hp: h.hp, mp: h.mp, wlv: h.wlv, wxp: h.wxp, tactic: h.tactic, equip: { ...h.equip },
      }])),
    };
  }

  // Recrée un monde sur `map` à partir d'une sauvegarde. Le groupe apparaît à l'entrée `entry`
  // (changement de carte), sinon à la position sauvegardée, sinon au départ de la carte.
  static fromSave({ map, game, entry = null }) {
    const w = new World({ map, seed: game.rng });
    const s = w.s;
    Object.assign(s, {
      tick: game.tick, clock: game.clock, day: game.day, rng: game.rng | 0, gold: game.gold,
      inventory: { ...game.inventory }, gear: { ...game.gear }, flags: { ...game.flags },
    });
    const at = (entry && map.entries[entry]) || (game.mapId === map.id && game.pos && !blockedAt(map, game.pos.x, game.pos.y) ? game.pos : map.start);
    w.placeParty(at);
    for (const h of w.heroes()) {
      const d = game.heroes[h.hero];
      if (!d) continue;
      Object.assign(h, {
        lv: d.lv, xp: d.xp, hp: d.hp, mp: d.mp, wlv: Math.min(MAX_WEAPON_LV, d.wlv), wxp: d.wxp,
        tactic: TACTICS.includes(d.tactic) ? d.tactic : HEROES[h.hero].tactic,
      });
      for (const slot of SLOTS) h.equip[slot] = canWear(h.hero, d.equip?.[slot]) ? d.equip[slot] : null;
      refreshStats(h);
      if (h.hp <= 0) Object.assign(h, { hp: 0, state: 'ko' });
    }
    return w;
  }

  // --- Outils ---------------------------------------------------------------
  rand() { return nextRandom(this.s); }
  newId() { return 'e' + this.s.nextId++; }
  emit(ev) { this.s.events.push(ev); }
  get(id) { return id == null ? null : this.s.ents.find((e) => e.id === id) ?? null; }
  heroes() { return this.s.ents.filter((e) => e.type === 'hero'); }
  heroesAlive() { return this.s.ents.filter((e) => e.type === 'hero' && e.state !== 'ko'); }
  foes() { return this.s.ents.filter((e) => e.type === 'enemy' && !e.dead); }

  nearest(list, from, range) {
    let best = null;
    let bd = range;
    for (const e of list) {
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  nearestHero(from, range) { return this.nearest(this.heroesAlive(), from, range); }
  nearestFoe(from, range) { return this.nearest(this.foes(), from, range); }

  // Le meneur que suivent les compagnons : le premier héros joueur encore debout.
  leader() {
    const hs = this.heroes();
    return hs.find((h) => h.controller !== 'ai' && h.state !== 'ko') ?? hs.find((h) => h.state !== 'ko') ?? null;
  }

  setController(heroId, controller) {
    const h = this.get(heroId);
    if (!h) return;
    h.controller = controller;
    h.prevHeld = 0;
    h.charge = 0;
  }

  // --- Création -------------------------------------------------------------
  createParty(start) {
    for (const id of HERO_ORDER) this.s.ents.push(makeHero(id, start.x, start.y));
    this.placeParty(start);
  }

  placeParty(start) {
    const offsets = [[0, 0], [-14, -8], [-14, 8]];
    this.heroes().forEach((h, i) => {
      let x = start.x + offsets[i][0];
      let y = start.y + offsets[i][1];
      if (blockedAt(this.map, x, y)) { x = start.x; y = start.y; }
      Object.assign(h, { x, y, px: x, py: y });
      Object.assign(h.ai, { lastX: x, lastY: y });
    });
  }

  spawnFromPoint(i) {
    const sp = this.s.spawns[i];
    const e = makeEnemy(this, sp.kind, sp.x, sp.y, i);
    this.s.ents.push(e);
    sp.ent = e.id;
  }

  spawnProjectile(p) {
    this.s.ents.push({ id: this.newId(), type: 'proj', px: p.x, py: p.y, ...p });
  }

  dropPickup(x, y, what) {
    this.s.ents.push({ id: this.newId(), type: 'pickup', x, y, px: x, py: y, life: 60 * 30, item: null, gold: 0, ...what });
  }

  // --- Événements de jeu ----------------------------------------------------
  knockOut(h) {
    Object.assign(h, { state: 'ko', t: 0, vx: 0, vy: 0, charge: 0, atk: null, cast: null, queued: null });
    this.emit({ type: 'ko', id: h.id });
  }

  killEnemy(e) {
    if (e.dead) return;
    const d = ENEMIES[e.kind];
    e.dead = true;
    this.emit({ type: 'die', id: e.id, kind: e.kind, x: e.x, y: e.y });
    for (const h of this.heroesAlive()) this.gainXp(h, d.xp);
    this.dropPickup(e.x, e.y, { gold: randInt(this.s, d.gold[0], d.gold[1]) });
    for (const [item, chance] of d.drops) {
      if (this.rand() < chance) { this.dropPickup(e.x + 7, e.y + 2, { item }); break; }
    }
    const sp = this.s.spawns[e.spawn];
    if (sp) { sp.ent = null; sp.timer = RESPAWN_TICKS; }
  }

  gainXp(h, amount) {
    h.xp += amount;
    while (h.xp >= xpToNext(h.lv) && h.lv < 99) {
      h.xp -= xpToNext(h.lv);
      h.lv++;
      const st = statsAt(h.hero, h.lv);
      h.hp += st.hp - h.maxHp;
      h.mp += st.mp - h.maxMp;
      refreshStats(h);
      this.emit({ type: 'lvl', id: h.id, lv: h.lv });
    }
  }

  // Range un butin (objet ou équipement) dans le sac commun. Faux si la pile est pleine.
  addLoot(id) {
    const bag = ITEMS[id] ? this.s.inventory : GEAR[id] ? this.s.gear : null;
    if (!bag || (bag[id] ?? 0) >= MAX_STACK) return false;
    bag[id] = (bag[id] ?? 0) + 1;
    return true;
  }

  // Change une pièce d'équipement ; l'ancienne retourne dans le sac.
  equip(heroId, slot, gearId) {
    const h = this.get(heroId);
    if (!h || h.type !== 'hero' || !SLOTS.includes(slot)) return false;
    if (gearId != null && (GEAR[gearId]?.slot !== slot || !canWear(h.hero, gearId) || !(this.s.gear[gearId] > 0))) return false;
    const old = h.equip[slot];
    if (old === gearId) return true;
    if (gearId != null) this.s.gear[gearId]--;
    if (old) this.s.gear[old] = (this.s.gear[old] ?? 0) + 1;
    h.equip[slot] = gearId ?? null;
    refreshStats(h);
    this.emit({ type: 'equip', id: h.id, slot, gear: gearId ?? null });
    return true;
  }

  openChest(actorId, key) {
    const h = this.get(actorId);
    const c = this.map.chests.find((ch) => ch.key === key);
    if (!h || h.state === 'ko' || !c || this.s.flags[key]) return false;
    if (Math.hypot(h.x - c.x, h.y - c.y) > 28) return false;
    if (c.item && !this.addLoot(c.item)) { this.emit({ type: 'chestfull', id: h.id, item: c.item }); return false; }
    this.s.flags[key] = true;
    this.s.gold += c.gold;
    this.emit({ type: 'chest', id: h.id, key, tx: c.tx, ty: c.ty, item: c.item, gold: c.gold });
    return true;
  }

  // --- Commandes (menus, IA) : passent aussi par le réseau plus tard --------
  command(c) {
    switch (c.type) {
      case 'cast': return startCast(this, this.get(c.actor), c.spell, c.target);
      case 'item': return useItem(this, this.get(c.actor), c.item, c.target);
      case 'tactic': {
        const h = this.get(c.hero);
        if (h && TACTICS.includes(c.tactic)) h.tactic = c.tactic;
        return true;
      }
      case 'control': return this.setController(c.hero, c.controller);
      case 'equip': return this.equip(c.hero, c.slot, c.gear);
      case 'open': return this.openChest(c.actor, c.chest);
      default: return false;
    }
  }

  // --- Pas de simulation ----------------------------------------------------
  step(inputs = {}, commands = []) {
    const s = this.s;
    s.events = [];
    if (s.gameOver || s.warp) return;
    for (const e of s.ents) { e.px = e.x; e.py = e.y; }
    for (const c of commands) this.command(c);

    for (const h of this.heroes()) {
      let inp = NO_INPUT;
      if (h.controller === 'ai') {
        inp = allyThink(this, h);
        if (inp.cmd) this.command(inp.cmd);
      } else {
        inp = inputs[h.id] ?? NO_INPUT;
      }
      updateHero(this, h, inp);
    }
    for (const e of s.ents) if (e.type === 'enemy' && !e.dead) updateEnemy(this, e);
    for (const p of s.ents) if (p.type === 'proj' && !p.dead) updateProjectile(this, p);
    for (const p of s.ents) if (p.type === 'pickup' && !p.dead) this.updatePickup(p);

    this.integrate();
    s.ents = s.ents.filter((e) => !e.dead);
    this.updateSpawns();
    this.checkWarps();

    s.clock++;
    if (s.clock >= DAY_TICKS) { s.clock = 0; s.day++; }
    s.tick++;
    if (!this.heroes().some((h) => h.state !== 'ko')) {
      s.gameOver = true;
      this.emit({ type: 'gameover' });
    }
  }

  integrate() {
    for (const e of this.s.ents) {
      if (e.type !== 'hero' && e.type !== 'enemy') continue;
      const dx = e.vx + e.kx;
      const dy = e.vy + e.ky;
      if (dx || dy) moveBody(this.map, e, dx, dy);
      e.kx *= 0.72;
      e.ky *= 0.72;
      if (Math.abs(e.kx) < 0.05) e.kx = 0;
      if (Math.abs(e.ky) < 0.05) e.ky = 0;
    }
    separate(this.map, this.s.ents);
  }

  updatePickup(p) {
    if (--p.life <= 0) { p.dead = true; return; }
    for (const h of this.heroesAlive()) {
      if (Math.hypot(h.x - p.x, h.y - p.y) >= 12) continue;
      if (p.item && !this.addLoot(p.item)) continue;
      this.s.gold += p.gold;
      p.dead = true;
      this.emit({ type: 'pickup', item: p.item, gold: p.gold, id: h.id, x: p.x, y: p.y });
      return;
    }
  }

  updateSpawns() {
    this.s.spawns.forEach((sp, i) => {
      if (sp.ent && !this.get(sp.ent)) sp.ent = null;
      if (sp.ent) return;
      if (sp.timer > 0) { sp.timer--; return; }
      if (!this.heroes().some((h) => Math.hypot(h.x - sp.x, h.y - sp.y) < 150)) this.spawnFromPoint(i);
    });
  }

  // Un héros joueur qui entre dans une sortie fige le monde ; la session charge alors l'autre carte.
  checkWarps() {
    for (const h of this.heroes()) {
      if (h.controller === 'ai' || h.state === 'ko') continue;
      const wp = this.map.warpAt(h.x, h.y);
      if (!wp) continue;
      this.s.warp = { map: wp.map, entry: wp.entry };
      this.emit({ type: 'warp', map: wp.map, entry: wp.entry });
      return;
    }
  }
}
