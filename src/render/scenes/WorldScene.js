// Scène de jeu : affiche la carte et les entités, et pilote la boucle locale
// (entrées -> menus -> simulation à pas fixe -> rendu interpolé).
import { DAY_TICKS, GAME_H, GAME_W } from '../../config.js';
import { input } from '../../input/InputManager.js';
import { Session } from '../../game/Session.js';
import { net, netError } from '../../net/Net.js';
import { HostLink } from '../../net/HostLink.js';
import { RemoteSession } from '../../net/RemoteSession.js';
import { BackgroundTicker } from '../../net/BackgroundTicker.js';
import { HEROES } from '../../sim/data/heroes.js';
import { WEAPONS } from '../../sim/data/weapons.js';
import { lootName } from '../../sim/data/items.js';
import { SPELLS } from '../../sim/data/spells.js';
import { ENEMIES } from '../../sim/data/enemies.js';
import { makeSave } from '../../save/format.js';
import { saves } from '../../save/SaveStore.js';
import { createView } from '../views.js';
import { text } from '../ui/widgets.js';

// Teinte jour/nuit par heure (multipliée sur le décor).
const SKY = [[0, 0x4a5890], [5, 0x4a5890], [6.5, 0xffc8a0], [8, 0xffffff], [17, 0xffffff], [18.5, 0xffa878], [20, 0x7a78b8], [21.5, 0x4a5890], [24, 0x4a5890]];

function skyTint(hour) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, c0] = SKY[i];
    const [h1, c1] = SKY[i + 1];
    if (hour < h0 || hour > h1) continue;
    const t = (hour - h0) / (h1 - h0 || 1);
    const ch = (s) => Math.round(((c0 >> s) & 255) + (((c1 >> s) & 255) - ((c0 >> s) & 255)) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  }
  return 0xffffff;
}

export class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  // data : { seed, intro } pour une nouvelle partie, { save } pour reprendre une sauvegarde,
  // plus { host: true } pour ouvrir une salle en ligne, ou { guest: { selfId, snap } } pour un invité.
  // { players } : joueurs à garder quand la scène est relancée (chargement, game over).
  create(data) {
    const loadMap = (id) => this.cache.tilemap.get(id).data;
    this.link = null;
    if (data.guest) {
      this.session = new RemoteSession({ loadMap, ...data.guest });
      this.session.onReset = () => this.scene.restart({ guest: { selfId: this.session.selfId, snap: this.session.lastSnap } });
    } else {
      this.session = new Session({ loadMap, seed: data.seed ?? 1, save: data.save ?? null });
      this.session.restorePlayers(data.players);
      if (data.host || net.role === 'host') this.startHosting(data);
    }
    window.__session = this.session;
    this.views = new Map();
    this.renderPos = new Map();
    this.warping = false;
    this.leaving = false;
    this.night = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff).setOrigin(0).setScrollFactor(0).setDepth(200000);
    this.night.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.buildMap();

    if (this.scene.isActive('UI')) this.scene.stop('UI');
    this.scene.launch('UI', { world: this, intro: data.intro });
    this.events.once('shutdown', () => this.scene.stop('UI'));
    this.renderWorld();
  }

  get ui() { return this.scene.get('UI'); }

  // Ouvre la salle (ou garde celle déjà ouverte si la scène est relancée).
  startHosting(data) {
    this.link = new HostLink(this.session, data.save?.coop?.guests ?? {});
    // Onglet caché : Phaser s'arrête, mais la partie doit continuer pour les invités.
    this.ticker = new BackgroundTicker((now, dt) => this.update(now, dt));
    this.events.once('shutdown', () => { this.ticker?.destroy(); this.ticker = null; });
    if (net.role === 'host') { this.link.announceReset(); return; }
    net.host(data.save?.coop?.code).then(
      (code) => this.session.notices.push(`Salle ouverte : code ${code}`),
      (e) => { this.link = null; net.close(); this.ui?.toast(netError(e), 0xff8070); },
    );
  }

  // Retour au titre (invité qui perd l'hôte, ou fin de partie en ligne).
  leaveToTitle(message) {
    if (this.leaving) return;
    this.leaving = true;
    if (this.session.isGuest) this.session.leave();
    this.scene.start('Title', { message });
  }

  // (Re)crée les calques de la carte courante et oublie les vues de l'ancienne.
  buildMap() {
    this.tilemap?.destroy();
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.renderPos.clear();
    const id = this.session.map.id;
    const map = this.make.tilemap({ key: id });
    const ts = map.addTilesetImage('saran', 'tiles');
    map.createLayer('ground', ts, 0, 0).setDepth(-20);
    this.deco = map.createLayer('deco', ts, 0, 0).setDepth(-10);
    map.createLayer('above', ts, 0, 0).setDepth(100000);
    this.tilemap = map;
    const gid = (name, v) => this.cache.json.get('tiledefs').groups.find((g) => g.name === name).start + v + 1;
    this.gid = gid;
    const flags = this.session.world.s.flags;
    for (const c of this.session.map.chests) if (flags[c.key]) this.deco.putTileAt(gid('chest', 1), c.tx, c.ty);
    for (const l of this.session.map.levers) if (flags[l.key]) this.deco.putTileAt(gid('lever', 1), l.tx, l.ty);
    this.doorShown = new Map();
    this.syncDoorTiles();
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  // Grilles et ronces suivent l'état du monde (levier tiré, boss réveillé ou vaincu).
  syncDoorTiles() {
    const w = this.session.world;
    for (const d of this.session.map.doors) {
      const closed = w.doorClosed(d);
      if (this.doorShown.get(d.key) === closed) continue;
      const changed = this.doorShown.has(d.key); // sinon : premier affichage de la carte
      this.doorShown.set(d.key, closed);
      for (const c of d.cells) {
        this.deco.putTileAt(this.gid(d.look, closed ? 0 : 1), c.tx, c.ty);
        if (changed && !closed) this.puff(c.tx * 16 + 8, c.ty * 16 + 8);
      }
      if (changed && closed) this.cameras.main.shake(140, 0.005); // la grille retombe
    }
  }

  update(time, delta) {
    input.poll();
    const ui = this.ui;
    this.session.updatePlayers(input);
    const blocked = ui?.ready ? ui.handleInput(input) : new Set();
    // Avec des invités connectés, les menus d'un joueur ne figent pas le monde des autres.
    const online = this.link && this.session.remotePlayers.length > 0;
    this.session.paused = this.warping || (!online && ui?.ready ? ui.isPausing() : false);
    this.session.update(delta, input, blocked);
    this.link?.update();
    if (this.session.mapChanged) { // invité : l'hôte a changé de carte
      this.session.mapChanged = false;
      this.buildMap();
      ui?.banner(this.session.map.name);
    }
    this.renderWorld();
    this.handleEvents(this.session.drainEvents());
    if (this.session.pendingWarp && !this.warping) this.warp(this.session.pendingWarp);
    if (this.session.lost) this.leaveToTitle(this.session.lost);
  }

  // Fondu au noir, changement de carte, sauvegarde automatique, fondu retour.
  warp({ map, entry }) {
    this.warping = true;
    const cam = this.cameras.main;
    const go = () => {
      this.session.changeMap(map, entry);
      this.buildMap();
      this.renderWorld();
      this.ui?.banner(this.session.map.name);
      this.autosave();
      this.warping = false;
    };
    // Onglet caché (hôte qui a réduit sa fenêtre) : pas d'animation, elle ne finirait jamais.
    if (document.hidden) { go(); return; }
    cam.fadeOut(220, 8, 4, 16);
    cam.once('camerafadeoutcomplete', () => { go(); cam.fadeIn(260, 8, 4, 16); });
  }

  // En ligne, la sauvegarde retient aussi le code de salle et le héros de chaque invité.
  currentSave() {
    const coop = this.link && net.code ? { code: net.code, guests: this.link.reservations() } : null;
    return makeSave(this.session.world, this.session.map.name, coop);
  }

  async saveTo(slot) {
    const save = this.currentSave();
    const durable = await saves.write(slot, save);
    return { save, durable };
  }

  async autosave() {
    try {
      const { durable } = await this.saveTo('auto');
      this.ui?.toast(durable ? 'Sauvegarde automatique' : 'Sauvegarde auto (en mémoire seulement)', 0xa8c8ff);
    } catch (e) {
      console.error(e);
      this.ui?.toast('Échec de la sauvegarde automatique', 0xff8070);
    }
  }

  // --- Rendu ------------------------------------------------------------------
  renderWorld() {
    const s = this.session.world.s;
    const a = this.session.paused ? 1 : Math.min(1, this.session.alpha);
    const seen = new Set();
    for (const e of s.ents) {
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = createView(this, e);
        if (!v) continue;
        this.views.set(e.id, v);
      }
      const x = e.px + (e.x - e.px) * a;
      const y = e.py + (e.y - e.py) * a;
      this.renderPos.set(e.id, { x, y });
      v.update(e, x, y, s.tick);
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      v.destroy();
      this.views.delete(id);
      this.renderPos.delete(id);
    }

    // Caméra : centrée sur les héros joueurs, un peu au-dessus à cause du HUD.
    const humans = this.session.players.filter((p) => !p.remote).map((p) => this.renderPos.get(p.hero)).filter(Boolean);
    if (humans.length) {
      let cx = humans.reduce((t, p) => t + p.x, 0) / humans.length;
      let cy = humans.reduce((t, p) => t + p.y, 0) / humans.length;
      // Combat de boss : on recule la caméra vers lui pour garder tout le monde à l'écran.
      const boss = this.session.world.bossAwake() && this.renderPos.get(this.session.world.boss().id);
      if (boss) { cx = cx * 0.6 + boss.x * 0.4; cy = cy * 0.6 + (boss.y - 16) * 0.4; }
      this.cameras.main.setScroll(Math.round(cx - GAME_W / 2), Math.round(cy - GAME_H / 2 + 6));
    }
    // Sous terre, ni jour ni nuit : une pénombre constante.
    this.night.fillColor = this.session.map.dark ? 0x9a90c0 : skyTint((s.clock / DAY_TICKS) * 24);
    this.syncDoorTiles();
  }

  screenPos(id) {
    const p = this.renderPos.get(id);
    if (!p) return null;
    const cam = this.cameras.main;
    return { x: Math.round(p.x - cam.scrollX), y: Math.round(p.y - cam.scrollY) };
  }

  // --- Effets visuels déclenchés par la simulation ---------------------------
  handleEvents(events) {
    const world = this.session.world;
    for (const ev of events) {
      switch (ev.type) {
        case 'dmg': {
          const color = { heal: 0x90ff90, mp: 0x90d0ff, magic: 0xffc0ff }[ev.kind] ?? (ev.crit ? 0xffe040 : 0xffffff);
          this.floatText(ev.x, ev.y - 24, String(ev.amount), color);
          if (ev.kind === 'phys' || ev.kind === 'magic') {
            this.flash(ev.x, ev.y - 8, 'spark');
            this.session.rumble(ev.id, input, 0.55, 0.3, 140);
          }
          break;
        }
        case 'swing': this.swingFx(world.get(ev.id), ev); break;
        case 'die': this.puff(ev.x, ev.y - 6); break;
        case 'chargelvl': {
          const h = world.get(ev.id);
          if (h) this.fade(this.add.image(h.x, h.y - 10, 'fx', 'chargering'), 250, h.y + 1);
          this.session.rumble(ev.id, input, 0, 0.35, 70);
          break;
        }
        case 'fx': this.namedFx(ev); break;
        case 'lvl': {
          const h = world.get(ev.id);
          if (h) this.floatText(h.x, h.y - 34, 'NIVEAU ' + ev.lv + ' !', 0xffe040, 1100);
          this.ui?.toast(`${HEROES[h?.hero]?.name ?? ''} passe au niveau ${ev.lv} !`);
          break;
        }
        case 'wlvl': this.ui?.toast(`${WEAPONS[ev.weapon].name} : niveau ${ev.lv}`); break;
        case 'pickup':
          this.floatText(ev.x, ev.y - 14, ev.item ? lootName(ev.item) : `+${ev.gold} écus`, ev.item ? 0x90ff90 : 0xffe080);
          break;
        case 'lever':
          this.deco.putTileAt(this.gid('lever', 1), ev.tx, ev.ty);
          this.ui?.toast('Clac ! Une grille grince quelque part.', 0xffe080);
          this.cameras.main.shake(100, 0.003);
          break;
        case 'say': {
          const e = world.get(ev.id);
          if (e) this.floatText(e.x, e.y - 46, '!', 0xff6060, 500);
          this.ui?.toast(`${ENEMIES[e?.kind]?.name.split(',')[0] ?? ''} : « ${ev.text} »`, 0xffb0a0);
          break;
        }
        case 'boss':
          this.ui?.banner(ENEMIES[ev.kind].name);
          this.cameras.main.shake(300, 0.006);
          break;
        case 'bossdown':
          this.cameras.main.shake(500, 0.01);
          for (let i = 0; i < 6; i++) this.time.delayedCall(i * 90, () => this.puff(ev.x - 14 + (i % 3) * 14, ev.y - 8 - Math.floor(i / 3) * 12));
          this.ui?.victory(ev.kind);
          break;
        case 'chest': {
          this.deco.putTileAt(this.gid('chest', 1), ev.tx, ev.ty);
          const what = [ev.item && lootName(ev.item), ev.gold && `${ev.gold} écus`].filter(Boolean).join(' et ');
          this.ui?.toast(`${HEROES[world.get(ev.id)?.hero]?.name} trouve : ${what || 'rien. Une toile d\'araignée.'}`, 0xffe080);
          this.puff(ev.tx * 16 + 8, ev.ty * 16 + 4);
          break;
        }
        case 'chestfull': this.ui?.toast(`Plus de place pour : ${lootName(ev.item)}`, 0xff8070); break;
        case 'ko':
          this.ui?.toast(`${HEROES[world.get(ev.id)?.hero]?.name} est K.O. !`);
          this.session.rumble(ev.id, input, 1, 1, 320);
          break;
        case 'revive': this.ui?.toast(`${HEROES[world.get(ev.id)?.hero]?.name} se relève !`); break;
        case 'cast': this.ui?.toast(SPELLS[ev.spell].name, 0xffd0ff); break;
        case 'telegraph': {
          const e = world.get(ev.id);
          if (e) this.floatText(e.x, e.y - 28, '!', 0xff6060, 400);
          break;
        }
        case 'gameover': this.ui?.showGameOver(); break;
      }
    }
  }

  floatText(x, y, str, tint, life = 650) {
    const t = text(this, Math.round(x), Math.round(y), str, { tint, outlined: true, origin: 0.5 }).setDepth(150000);
    this.tweens.add({ targets: t, y: y - 12, duration: life * 0.6, ease: 'Quad.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: life * 0.6, duration: life * 0.4, onComplete: () => t.destroy() });
  }

  fade(obj, duration, depth) {
    obj.setDepth(depth);
    this.tweens.add({ targets: obj, alpha: 0, duration, onComplete: () => obj.destroy() });
    return obj;
  }

  flash(x, y, base) {
    const img = this.add.image(Math.round(x), Math.round(y), 'fx', base + '0').setDepth(140000);
    this.time.delayedCall(60, () => img.active && img.setFrame(base + '1'));
    this.time.delayedCall(130, () => img.destroy());
  }

  puff(x, y) {
    const img = this.add.image(Math.round(x), Math.round(y), 'fx', 'puff0').setDepth(140000);
    [1, 2].forEach((i) => this.time.delayedCall(i * 80, () => img.active && img.setFrame('puff' + i)));
    this.time.delayedCall(260, () => img.destroy());
  }

  swingFx(h, ev) {
    if (!h) return;
    const wpn = WEAPONS[ev.weapon];
    if (wpn.kind !== 'melee') return;
    if (ev.level) {
      const ring = this.add.image(Math.round(h.x), Math.round(h.y - 8), 'fx', 'spin');
      this.tweens.add({ targets: ring, angle: 360, duration: 400 });
      this.fade(ring, 420, h.y + 1);
      return;
    }
    const ang = Math.round(Math.atan2(ev.fy, ev.fx) / (Math.PI / 4)) * (Math.PI / 4);
    const img = this.add.image(Math.round(h.x + ev.fx * 4), Math.round(h.y - 8 + ev.fy * 4), 'fx', 'slash').setOrigin(6 / 24, 0.5).setRotation(ang);
    this.time.delayedCall(70, () => this.fade(img, 90, h.y + 1));
    img.setDepth(h.y + 1).setAlpha(0.95);
  }

  namedFx(ev) {
    switch (ev.name) {
      case 'flamme': case 'poof': {
        if (ev.name === 'poof') { this.puff(ev.x, ev.y - 6); break; }
        this.fade(this.add.image(Math.round(ev.x), Math.round(ev.y - 9), 'fx', 'flamme'), 300, 140000);
        break;
      }
      case 'gel': {
        const img = this.add.image(Math.round(ev.x), Math.round(ev.y - 6), 'fx', 'gel').setDepth(ev.y + 2);
        this.time.delayedCall(500, () => this.fade(img, 300, ev.y + 2));
        break;
      }
      case 'soin':
        for (let i = 0; i < 5; i++) {
          const s = this.add.image(Math.round(ev.x - 8 + i * 4), Math.round(ev.y - 4 - (i % 2) * 6), 'fx', 'soin').setDepth(140000);
          this.tweens.add({ targets: s, y: s.y - 14, alpha: 0, delay: i * 50, duration: 600, onComplete: () => s.destroy() });
        }
        break;
      case 'bouclier': {
        const s = this.add.image(Math.round(ev.x), Math.round(ev.y - 12), 'fx', 'bouclier').setDepth(140000);
        this.tweens.add({ targets: s, alpha: 0, duration: 700, delay: 200, onComplete: () => s.destroy() });
        break;
      }
      case 'quake': case 'seisme': {
        const s = this.add.image(Math.round(ev.x), Math.round(ev.y), 'fx', ev.name).setDepth(ev.y - 1).setScale(0.5);
        this.tweens.add({ targets: s, scale: ev.name === 'seisme' ? 2 : 1.3, alpha: 0, duration: 420, onComplete: () => s.destroy() });
        this.cameras.main.shake(180, ev.name === 'seisme' ? 0.006 : 0.008);
        break;
      }
      case 'slam': {
        const s = this.add.image(Math.round(ev.x), Math.round(ev.y - 4), 'fx', 'slam').setDepth(ev.y + 2);
        this.tweens.add({ targets: s, alpha: 0, y: s.y - 5, duration: 380, onComplete: () => s.destroy() });
        this.cameras.main.shake(120, 0.006);
        break;
      }
      case 'spores': {
        const s = this.add.image(Math.round(ev.x), Math.round(ev.y - 6), 'fx', 'spores').setDepth(ev.y + 3);
        this.tweens.add({ targets: s, alpha: 0, y: s.y - 6, duration: 550, onComplete: () => s.destroy() });
        break;
      }
    }
  }
}
