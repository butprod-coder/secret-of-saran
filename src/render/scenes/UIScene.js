// Interface par-dessus le monde : HUD des trois héros, ring menus (un par joueur),
// dialogues, messages et écran de K.O. Dispose de sa propre caméra, sans défilement.
import { DAY_TICKS, GAME_H, GAME_W } from '../../config.js';
import { BTN } from '../../sim/input.js';
import { HEROES, HERO_ORDER } from '../../sim/data/heroes.js';
import { measure } from '../art/font.js';
import { bar, drawWindow, setText, text } from '../ui/widgets.js';
import { RingMenu } from '../ui/RingMenu.js';
import { Dialogue } from '../ui/Dialogue.js';
import { saves } from '../../save/SaveStore.js';
import { net } from '../../net/Net.js';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const PANEL_W = 125;
const PANEL_H = 28;
const PANEL_Y = GAME_H - PANEL_H - 2;

const INTRO = [
  { who: 'Lorenzo', text: 'Bon. On devait juste aller chercher des chocolatines.' },
  { who: 'Karonux', text: "C'est lundi. La boulangerie est fermée. Comme tous les lundis depuis 1987." },
  { who: 'Gus', text: 'Alors on traverse la Loire. Il paraît que de l\'autre côté, les Lapinfous en cachent plein leurs terriers.' },
  { who: 'Lorenzo', text: 'Les lapins... ont des chocolatines ?' },
  { who: 'Gus', text: "Fais-moi confiance. J'ai une épée." },
  { who: '', text: 'J / Espace : attaquer (maintenir pour charger). K : ring menu. Tab : changer de héros. Maj : courir. Une manette rejoint la partie en appuyant sur un bouton.' },
];

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create(data) {
    this.world = data.world;
    this.session = this.world.session;
    this.ready = true;
    this.gameOver = false;
    this.restarting = false;
    this.rings = new Map();
    this.toasts = [];

    this.hud = this.add.graphics();
    this.panels = HERO_ORDER.map((id, i) => {
      const x = 2 + i * (PANEL_W + 2);
      return {
        id, x,
        name: text(this, x + 6, PANEL_Y + 4, HEROES[id].name),
        tag: text(this, x + PANEL_W - 6, PANEL_Y + 4, '', { origin: 1 }),
        hp: text(this, x + 6, PANEL_Y + 13, ''),
        mp: text(this, x + 66, PANEL_Y + 13, '', { tint: 0xa8c8ff }),
        pct: text(this, x + PANEL_W - 6, PANEL_Y + 13, '', { origin: 1 }),
      };
    });
    this.goldText = text(this, 8, 5, '', { tint: 0xffe080 });
    this.clockText = text(this, GAME_W - 7, 5, '', { origin: 1 });
    this.netText = text(this, GAME_W / 2, 5, '', { tint: 0xa8e0a8, origin: 0.5 });

    this.dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x080410, 0.35).setOrigin(0).setDepth(5).setVisible(false);
    this.toastG = this.add.graphics().setDepth(20);
    this.toastText = text(this, GAME_W / 2, 22, '', { origin: 0.5 }).setDepth(21);
    this.dialogue = new Dialogue(this);

    this.banner(this.session.map.name);
    if (data.intro) this.dialogue.start(INTRO, () => this.suppressAll());
  }

  suppressAll() { for (const p of this.session.players) p.suppress |= BTN.ATTACK; }

  ringFor(p) {
    if (!this.rings.has(p)) this.rings.set(p, new RingMenu(this, p));
    return this.rings.get(p);
  }

  isPausing() {
    return this.gameOver || this.dialogue.active || [...this.rings.values()].some((r) => r.open);
  }

  // Lit les entrées qui concernent l'interface. Renvoie les joueurs dont les entrées
  // ne doivent pas atteindre leur héros ce tour-ci.
  handleInput(input) {
    const players = this.session.players;
    for (const [p, ring] of this.rings) if (!players.includes(p)) { ring.destroy(); this.rings.delete(p); }
    const all = new Set(players);
    if (this.gameOver) {
      const m = input.all();
      if (this.session.isGuest) return all; // l'hôte décide de la reprise
      if ((m.pressed.attack || m.pressed.start) && !this.restarting) {
        this.restarting = true;
        saves.latest().then((save) => this.world.scene.restart(save ? { save, players: this.session.playersSnapshot() } : { seed: (Date.now() & 0x7fffffff) | 1, intro: false }));
      }
      return all;
    }
    if (this.dialogue.active) { this.dialogue.handle(input.all()); return all; }

    const blocked = new Set();
    const w = this.session.world;
    for (const p of players) {
      if (p.remote) continue; // les invités ont leurs menus chez eux
      const m = input.merged([...p.devices]);
      const ring = this.ringFor(p);
      const hero = w.get(p.hero);
      if (ring.open) { ring.handle(m); blocked.add(p); continue; }
      if (m.pressed.menu && hero.state !== 'ko') { ring.openMenu(); blocked.add(p); continue; }
      if (m.pressed.switch) { if (!this.session.switchHero(p)) this.buzz(); continue; }
      if (m.pressed.attack && (hero.state === 'idle' || hero.state === 'walk')) {
        const sign = this.session.signInFront(hero);
        const chest = !sign && this.session.chestInFront(hero);
        if (sign) {
          this.dialogue.start([{ who: '', text: sign.text }], () => this.suppressAll());
          blocked.add(p);
        } else if (chest) {
          this.session.queueCommand({ type: 'open', actor: hero.id, chest: chest.key });
          p.suppress |= BTN.ATTACK;
          blocked.add(p);
        }
      }
    }
    return blocked;
  }

  buzz() { this.cameras.main.shake(80, 0.004); }

  toast(msg, tint = 0xffffff) {
    this.toasts.push({ msg, tint });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  banner(name) {
    const g = this.add.graphics().setDepth(19);
    const w = measure(name) + 24;
    drawWindow(g, Math.round((GAME_W - w) / 2), 34, w, 16, 0.95);
    const t = text(this, GAME_W / 2, 38, name, { tint: 0xf2c244, origin: 0.5 }).setDepth(19);
    this.tweens.add({ targets: [g, t], alpha: 0, delay: 2600, duration: 600, onComplete: () => { g.destroy(); t.destroy(); } });
  }

  showGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x080410, 0.7).setOrigin(0).setDepth(40);
    text(this, GAME_W / 2, 84, "Toute l'équipe est K.O.", { tint: 0xff8070, outlined: true, origin: 0.5 }).setDepth(41).setScale(2);
    text(this, GAME_W / 2, 112, 'Même les Lapinfous ont un peu honte pour vous.', { outlined: true, origin: 0.5 }).setDepth(41);
    const hint = this.session.isGuest ? "En attente de l'hôte..." : 'Entrée / J / A : reprendre la dernière sauvegarde';
    text(this, GAME_W / 2, 132, hint, { tint: 0xf2c244, outlined: true, origin: 0.5 }).setDepth(41);
  }

  update(time, delta) {
    if (!this.session) return;
    this.drawHud(time);
    for (const ring of this.rings.values()) ring.draw(time);
    this.dim.setVisible([...this.rings.values()].some((r) => r.open));
    this.dialogue.update(time);
    for (const n of this.session.notices.splice(0)) this.toast(n, 0xf2c244);
    this.updateToast(delta);
  }

  updateToast(delta) {
    const g = this.toastG;
    if (!this.toasts.length) { g.clear(); this.toastText.setVisible(false); return; }
    const cur = this.toasts[0];
    cur.t = (cur.t ?? 0) + delta;
    if (cur.t > 1500) { this.toasts.shift(); return; }
    const w = measure(cur.msg) + 16;
    g.clear();
    drawWindow(g, Math.round((GAME_W - w) / 2), 18, w, 14, 0.92);
    setText(this.toastText, cur.msg).setTint(cur.tint).setVisible(true);
  }

  drawHud(time) {
    const w = this.session.world;
    const s = w.s;
    const g = this.hud;
    g.clear();
    if (this.dialogue.active) {
      for (const p of this.panels) for (const t of [p.name, p.tag, p.hp, p.mp, p.pct]) t.setVisible(false);
    } else {
      for (const p of this.panels) {
        const h = w.get(p.id);
        const player = this.session.playerOf(p.id);
        for (const t of [p.name, p.tag, p.hp, p.mp, p.pct]) t.setVisible(true);
        drawWindow(g, p.x, PANEL_Y, PANEL_W, PANEL_H, 0.9);
        const ko = h.state === 'ko';
        p.name.setTint(ko ? 0x9098b0 : player ? 0xffe080 : 0xffffff);
        const waiting = player?.lostSince != null; // manette perdue : l'IA assure l'intérim
        setText(p.tag, ko ? 'K.O.' : waiting ? `J${player.slot + 1}?` : player ? 'J' + (player.slot + 1) : 'IA').setTint(ko ? 0xff7060 : player ? 0xffe080 : 0xa8b0d0);
        setText(p.hp, `PV ${h.hp}/${h.maxHp}`).setTint(h.hp < h.maxHp * 0.25 ? 0xff8070 : 0xffffff);
        setText(p.mp, h.maxMp ? `PM ${h.mp}` : '');
        const lvl = Math.floor(h.charge / 100);
        setText(p.pct, lvl ? `Nv${lvl}` : `${Math.floor(h.gauge)}%`).setTint(lvl ? 0xfff070 : h.gauge >= 100 ? 0xffe080 : 0xc0c8e0);
        bar(g, p.x + 6, PANEL_Y + 22, PANEL_W - 12, 2, h.gauge / 100, h.gauge >= 100 ? 0xf2c244 : 0x7088c8);
        if (h.charge > 0) {
          const frac = (h.charge % 100) / 100;
          g.fillStyle(Math.floor(time / 80) % 2 ? 0xffffff : 0xfff070, 1);
          g.fillRect(p.x + 6, PANEL_Y + 22, Math.round((PANEL_W - 12) * (lvl && !frac ? 1 : frac)), 2);
        }
      }
    }
    const goldStr = `${s.gold} écus`;
    drawWindow(g, 2, 2, measure(goldStr) + 13, 14, 0.85);
    setText(this.goldText, goldStr);
    const minutes = Math.floor((s.clock / DAY_TICKS) * 24 * 60);
    const clock = `${DAYS[s.day % 7]} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const cw = measure(clock) + 13;
    drawWindow(g, GAME_W - cw - 2, 2, cw, 14, 0.85);
    setText(this.clockText, clock);

    // Partie en ligne : code de salle, et nombre d'invités (hôte) ou latence (invité).
    let netStr = '';
    if (net.role === 'host' && net.code) {
      const n = this.session.remotePlayers.filter((p) => p.lostSince == null).length;
      netStr = `Salle ${net.code} · ${n} invité${n > 1 ? 's' : ''}`;
    } else if (net.role === 'guest') {
      netStr = `Salle ${net.code} · ${this.session.ping ?? '...'} ms`;
    }
    this.netText.setVisible(!!netStr && this.toasts.length === 0);
    if (netStr && !this.toasts.length) {
      const nw = measure(netStr) + 13;
      drawWindow(g, Math.round((GAME_W - nw) / 2), 2, nw, 14, 0.85);
      setText(this.netText, netStr);
    }
  }
}
