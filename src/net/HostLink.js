// Côté hôte : branche les invités sur la Session. L'hôte fait autorité ; les invités
// envoient leurs entrées et leurs commandes de menu, et reçoivent l'état du monde.
//
// Messages invité -> hôte : hello { token }, in { mx, my, b }, cmd { c }, ping { ts }, bye
// Messages hôte -> invité : welcome { id, code }, snap { s, ev, roster }, notice { text },
//                            pong { ts }, reset, refused { reason }
import { HEROES } from '../sim/data/heroes.js';
import { BTN, NO_INPUT } from '../sim/input.js';
import { MAX_PLAYERS } from '../game/Session.js';
import { net } from './Net.js';
import { SNAPSHOT_MS } from './config.js';

const SILENCE_MS = 6000; // sans nouvelles d'un invité, on le considère parti
const COMMANDS = ['cast', 'item', 'open', 'equip', 'tactic', 'switch'];
const FIELDS = ['type', 'actor', 'item', 'target', 'spell', 'chest', 'hero', 'slot', 'gear', 'tactic'];
const clampAxis = (v) => Math.max(-1, Math.min(1, Math.round(Number(v) || 0)));

export class HostLink {
  // reserved : { token: heroId } tiré de la sauvegarde, pour rendre son héros à chaque invité.
  constructor(session, reserved = {}) {
    this.session = session;
    this.reserved = reserved;
    this.pendingEvents = [];
    this.lastTick = -1;
    this.lastSent = 0;
    session.onStep = (evs) => this.pendingEvents.push(...evs);
    net.handler = this;
  }

  playerByPeer(peerId) { return this.session.players.find((p) => p.remote === peerId) ?? null; }

  notice(text) {
    this.session.notices.push(text);
    net.broadcast({ t: 'notice', text });
  }

  // --- Messages des invités ------------------------------------------------------
  onGuestMessage(peerId, msg) {
    if (!msg || typeof msg !== 'object') return;
    const p = this.playerByPeer(peerId);
    if (p) p.lastSeen = performance.now();
    switch (msg.t) {
      case 'hello': return this.welcome(peerId, String(msg.token ?? ''));
      case 'in':
        if (p) p.netInput = { mx: clampAxis(msg.mx), my: clampAxis(msg.my), buttons: (msg.b | 0) & (BTN.ATTACK | BTN.RUN) };
        return;
      case 'cmd': return this.command(p, msg.c);
      case 'ping': return net.sendTo(peerId, { t: 'pong', ts: msg.ts });
      case 'bye': if (p) this.remove(p, 'a quitté la partie'); return;
    }
  }

  onGuestLeave(peerId) {
    const p = this.playerByPeer(peerId);
    if (p) this.lose(p);
  }

  welcome(peerId, token) {
    const s = this.session;
    // Un invité qui revient (même navigateur) reprend sa place et son héros.
    let p = token && s.players.find((q) => q.remote && q.token === token);
    if (p) {
      p.remote = peerId;
      p.lostSince = null;
      this.notice(`J${p.slot + 1} est de retour (${HEROES[p.hero].name})`);
    } else {
      if (s.players.length >= MAX_PLAYERS) return this.refuse(peerId, 'La partie est complète (3 joueurs).');
      const free = s.world.heroes().filter((h) => !s.playerOf(h.id));
      const hero = free.find((h) => h.id === this.reserved[token]) ?? free.find((h) => h.state !== 'ko') ?? free[0];
      if (!hero) return this.refuse(peerId, 'Plus aucun héros libre.');
      p = s.addPlayer([], hero.id, { remote: peerId, token });
      this.notice(`J${p.slot + 1} rejoint la partie : ${HEROES[hero.id].name}`);
    }
    p.netInput = NO_INPUT;
    p.lastSeen = performance.now();
    s.world.setController(p.hero, 'p' + p.slot);
    net.sendTo(peerId, { t: 'welcome', id: p.id, code: net.code });
    net.sendTo(peerId, this.snapshot([]));
  }

  refuse(peerId, reason) {
    net.sendTo(peerId, { t: 'refused', reason });
    net.kick(peerId);
  }

  // Coupure : le héros passe sous IA ; Session.updatePlayers libère la place après le délai de grâce.
  lose(p) {
    if (p.lostSince != null) return;
    p.lostSince = performance.now();
    p.netInput = NO_INPUT;
    this.session.world.setController(p.hero, 'ai');
    this.notice(`J${p.slot + 1} : connexion perdue, ${HEROES[p.hero].name} passe sous IA`);
  }

  remove(p, why) {
    const s = this.session;
    this.notice(`J${p.slot + 1} ${why}`);
    s.world.setController(p.hero, 'ai');
    s.players.splice(s.players.indexOf(p), 1);
    s.players.forEach((q, i) => { q.slot = i; });
    net.kick(p.remote);
  }

  // Les commandes d'un invité passent par les mêmes chemins que les menus de l'hôte ;
  // le monde les valide de toute façon (portée, inventaire, PM...).
  command(p, raw) {
    if (!p || p.lostSince != null || !raw || !COMMANDS.includes(raw.type)) return;
    const c = {};
    for (const k of FIELDS) if (raw[k] !== undefined) c[k] = raw[k];
    const s = this.session;
    if (c.type === 'switch') { s.switchHero(p); return; }
    if ((c.type === 'item' || c.type === 'open') && c.actor !== p.hero) return; // pas au nom d'un autre
    if (c.type === 'equip' || c.type === 'tactic') s.applyNow(c);
    else s.queueCommand(c);
  }

  // --- Vers les invités ------------------------------------------------------------
  // État complet allégé (sans la mémoire de l'IA), avec les événements depuis le dernier envoi.
  snapshot(events) {
    const s = this.session.world.s;
    return {
      t: 'snap',
      s: { ...s, events: [], ents: s.ents.map((e) => (e.type === 'hero' ? { ...e, ai: null } : e)) },
      ev: events,
      roster: this.session.players.map((p) => ({ id: p.id, slot: p.slot, hero: p.hero, lost: p.lostSince != null })),
    };
  }

  // Appelé à chaque image par la scène, après Session.update.
  update(now = performance.now()) {
    for (const p of this.session.remotePlayers) {
      if (p.lostSince == null && now - p.lastSeen > SILENCE_MS) this.lose(p);
    }
    if (!net.conns.size) { this.pendingEvents = []; return; }
    // 20 envois par seconde ; monde figé (game over, changement de carte) : 2 par seconde suffisent.
    const tick = this.session.world.s.tick;
    if (now - this.lastSent < SNAPSHOT_MS) return;
    if (tick === this.lastTick && !this.pendingEvents.length && now - this.lastSent < 500) return;
    this.lastTick = tick;
    this.lastSent = now;
    net.broadcast(this.snapshot(this.pendingEvents));
    this.pendingEvents = [];
  }

  // La scène va être relancée (chargement, game over) : les invités repartiront de l'état suivant.
  announceReset() { net.broadcast({ t: 'reset' }); }

  // Pour la sauvegarde : quel invité jouait quel héros.
  reservations() {
    const out = { ...this.reserved };
    for (const p of this.session.remotePlayers) out[p.token] = p.hero;
    return out;
  }
}
