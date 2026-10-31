// Côté invité : remplace Session pour les scènes (mêmes propriétés et méthodes utilisées).
// Le monde ne tourne pas ici : on affiche les instantanés de l'hôte, interpolés entre deux
// réceptions, et on lui envoie entrées et commandes.
import { BTN } from '../sim/input.js';
import { MapData } from '../sim/MapData.js';
import { World } from '../sim/World.js';
import { inFront, usableInFront } from '../game/Session.js';
import { browserToken, net, netError } from './Net.js';
import { INPUT_KEEPALIVE_MS, PING_EVERY_MS, SNAPSHOT_MS } from './config.js';

const HOST_SILENCE_MS = 8000;

// Rejoint la salle `code` : résout avec ce qu'il faut pour lancer la scène, ou rejette avec
// un message lisible.
export async function joinGame(code) {
  try {
    await net.join(code);
  } catch (e) {
    throw new Error(netError(e));
  }
  return new Promise((resolve, reject) => {
    let selfId = null;
    const timer = setTimeout(() => fail("L'hôte n'a pas répondu."), 10000);
    const fail = (reason) => { clearTimeout(timer); net.close(); reject(new Error(reason)); };
    net.handler = {
      onHostMessage(msg) {
        if (msg.t === 'refused') fail(msg.reason);
        else if (msg.t === 'welcome') selfId = msg.id;
        else if (msg.t === 'snap' && selfId) { clearTimeout(timer); resolve({ selfId, snap: msg }); }
      },
      onHostLost() { fail("L'hôte a fermé la partie."); },
    };
    net.sendToHost({ t: 'hello', token: browserToken() });
  });
}

export class RemoteSession {
  constructor({ loadMap, selfId, snap }) {
    this.isGuest = true;
    this.loadMap = loadMap;
    this.mapCache = new Map();
    this.selfId = selfId;
    this.players = [{ id: selfId, slot: 0, devices: new Set(['kb']), hero: null, suppress: BTN.ATTACK }];
    this.roster = [];
    this.events = [];
    this.notices = [];
    this.paused = false; // ignoré : le monde de l'hôte ne s'arrête pas pour nos menus
    this.mapChanged = false;
    this.lost = null; // message si l'hôte disparaît
    this.ping = null;
    this.snapGap = SNAPSHOT_MS;
    this.lastSent = { mx: 0, my: 0, b: 0, at: 0 };
    this.lastPing = 0;
    this.applySnapshot(snap);
    net.handler = this;
  }

  get pendingWarp() { return null; }
  get remotePlayers() { return []; }
  get alpha() { return Math.min(1, (performance.now() - this.snapAt) / this.snapGap); }

  mapData(id) {
    if (!this.mapCache.has(id)) this.mapCache.set(id, MapData.fromTiled(id, this.loadMap(id)));
    return this.mapCache.get(id);
  }

  // --- Réception -----------------------------------------------------------------
  onHostMessage(msg) {
    this.lastHeard = performance.now();
    switch (msg.t) {
      case 'snap': return this.applySnapshot(msg);
      case 'notice': this.notices.push(msg.text); return;
      case 'pong': this.ping = Math.round(performance.now() - msg.ts); return;
      case 'reset': this.onReset?.(); return;
      case 'refused': this.lost = msg.reason; return;
    }
  }

  onHostLost() { this.lost ??= "Connexion à l'hôte perdue."; }

  applySnapshot(msg) {
    const now = performance.now();
    if (this.snapAt) this.snapGap = Math.max(30, Math.min(150, this.snapGap * 0.8 + (now - this.snapAt) * 0.2));
    // Chaque entité part de sa position affichée et glisse vers la nouvelle d'ici le prochain envoi.
    const a = this.world ? this.alpha : 1;
    const prev = new Map((this.world?.s.ents ?? []).map((e) => [e.id, e]));
    const s = msg.s;
    for (const e of s.ents) {
      const o = prev.get(e.id);
      e.px = o ? o.px + (o.x - o.px) * a : e.x;
      e.py = o ? o.py + (o.y - o.py) * a : e.y;
    }
    if (!this.world || s.mapId !== this.map.id) {
      if (this.world) this.mapChanged = true;
      this.map = this.mapData(s.mapId);
      this.world = new World({ map: this.map, state: s });
      for (const e of s.ents) { e.px = e.x; e.py = e.y; }
    } else {
      this.world.s = s;
    }
    this.snapAt = now;
    this.lastSnap = msg;
    this.events.push(...(msg.ev ?? []));
    this.roster = msg.roster ?? [];
    const me = this.roster.find((r) => r.id === this.selfId);
    const p = this.players[0];
    if (me) {
      if (me.hero !== p.hero) { p.hero = me.hero; p.suppress = BTN.ATTACK; }
      p.slot = me.slot;
    }
  }

  // --- Joueurs ---------------------------------------------------------------------
  // HUD : qui contrôle quel héros (d'après la liste de l'hôte).
  playerOf(heroId) {
    const r = this.roster.find((q) => q.hero === heroId);
    return r ? { slot: r.slot, hero: r.hero, lostSince: r.lost ? 1 : null } : null;
  }

  // Une seule personne par navigateur invité : les manettes s'ajoutent au clavier.
  updatePlayers(input) {
    for (const ev of input.drainPadEvents()) if (ev.type === 'connect') this.notices.push(`Manette détectée : ${ev.name}`);
    const p = this.players[0];
    for (const d of [...p.devices]) if (d !== 'kb' && !input.device(d)) p.devices.delete(d);
    for (const id of input.padIds()) if (!p.devices.has(id) && input.device(id).any) p.devices.add(id);
  }

  playersSnapshot() { return []; }
  restorePlayers() {}
  freeHeroes() { return []; }

  rumble(heroId, input, strong, weak, ms) {
    const p = this.players[0];
    if (heroId === p.hero) input.rumble([...p.devices], strong, weak, ms);
  }

  // --- Envoi -------------------------------------------------------------------------
  switchHero() { this.queueCommand({ type: 'switch' }); return true; }
  queueCommand(c) { net.sendToHost({ t: 'cmd', c }); }
  applyNow(c) { this.queueCommand(c); return true; }

  update(dtMs, input, blockedPlayers = new Set()) {
    const now = performance.now();
    const p = this.players[0];
    const m = input.merged([...p.devices]);
    let b = (m.held.attack ? BTN.ATTACK : 0) | (m.held.run ? BTN.RUN : 0);
    if (!m.held.attack) p.suppress &= ~BTN.ATTACK;
    b &= ~p.suppress;
    const inp = blockedPlayers.has(p) ? { mx: 0, my: 0, b: 0 } : { mx: m.mx, my: m.my, b };
    const last = this.lastSent;
    if (inp.mx !== last.mx || inp.my !== last.my || inp.b !== last.b || now - last.at > INPUT_KEEPALIVE_MS) {
      net.sendToHost({ t: 'in', ...inp });
      this.lastSent = { ...inp, at: now };
    }
    if (now - this.lastPing > PING_EVERY_MS) { this.lastPing = now; net.sendToHost({ t: 'ping', ts: now }); }
    this.lastHeard ??= now;
    if (now - this.lastHeard > HOST_SILENCE_MS) this.onHostLost();
  }

  // Quitter proprement : l'hôte libère la place tout de suite.
  leave() {
    net.sendToHost({ t: 'bye' });
    setTimeout(() => net.close(), 200);
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  signInFront(hero) { return inFront(hero, this.map.signs); }
  chestInFront(hero) { return usableInFront(hero, this.map, this.world.s.flags); }
}
