// Ring menu façon Secret of Mana : les icônes tournent autour du héros, haut/bas change
// d'anneau, gauche/droite tourne, valider choisit puis désigne une cible. Le jeu est en pause.
import { GAME_H, GAME_W } from '../../config.js';
import { BTN } from '../../sim/input.js';
import { HEROES, TACTICS, TACTIC_NAMES } from '../../sim/data/heroes.js';
import { ITEMS, ITEM_ORDER } from '../../sim/data/items.js';
import { SPELLS, spellKnown } from '../../sim/data/spells.js';
import { drawWindow, setText, text } from './widgets.js';
import { measure } from '../art/font.js';
import { ListWindow } from './ListWindow.js';
import { StatusWindow } from './StatusWindow.js';
import { SaveError } from '../../save/format.js';
import { SLOT_LABELS, exportFile, pickFile, readFile, saves } from '../../save/SaveStore.js';

const RINGS = ['Objets', 'Magie', 'Équipement', 'Tactique', 'Système'];
const RX = 32;
const RY = 22;

const SYSTEM = [
  { action: 'save', icon: 'sauver', label: 'Sauvegarder', detail: 'Choisir un emplacement (1 à 3)' },
  { action: 'load', icon: 'charger', label: 'Charger', detail: 'Reprendre une sauvegarde' },
  { action: 'export', icon: 'exporter', label: 'Exporter', detail: 'Télécharger la partie en .json' },
  { action: 'import', icon: 'importer', label: 'Importer', detail: 'Ouvrir un .json (clavier, ou glisser sur le titre)' },
  { action: 'title', icon: 'titre', label: 'Écran titre', detail: 'Quitter la partie' },
];
const HOST_ONLY = ['save', 'load', 'import'];

// Résumé d'une sauvegarde pour les listes : « Prairie de Saran  Nv 4  0h12 ».
export function describeSave(save) {
  if (!save) return 'vide';
  const min = Math.floor(save.summary.tick / 3600);
  return `${save.summary.map}  Nv ${save.summary.lv}  ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

export class RingMenu {
  constructor(ui, player) {
    this.ui = ui;
    this.player = player;
    this.open = false;
    this.g = ui.add.graphics().setDepth(10);
    this.icons = [];
    this.title = text(ui, 0, 0, '', { origin: 0.5 }).setDepth(11);
    this.label = text(ui, 0, 0, '', { origin: 0.5 }).setDepth(11);
    this.detail = text(ui, 0, 0, '', { tint: 0xc8d0f0, origin: 0.5 }).setDepth(11);
    this.cursor = ui.add.image(0, 0, 'fx', 'cursor').setDepth(12);
    this.setVisible(false);
  }

  get session() { return this.ui.session; }
  get world() { return this.session.world; }

  setVisible(v) {
    for (const o of [this.g, this.title, this.label, this.detail, ...this.icons]) o.setVisible(v);
    this.cursor.setVisible(false);
  }

  openMenu() {
    this.open = true;
    this.ring = 0;
    this.mode = 'ring';
    this.buildIcons(0);
    this.setVisible(true);
  }

  close() {
    this.sub?.destroy();
    this.sub = null;
    this.open = false;
    this.setVisible(false);
    this.player.suppress |= BTN.ATTACK;
  }

  destroy() {
    this.sub?.destroy();
    for (const o of [this.g, this.title, this.label, this.detail, this.cursor, ...this.icons]) o.destroy();
  }

  entries() {
    const w = this.world;
    if (this.ring === 0) {
      const list = ITEM_ORDER.filter((id) => w.s.inventory[id] > 0).map((id) => ({
        kind: 'item', id, icon: id, label: ITEMS[id].name, detail: `x${w.s.inventory[id]}  ${ITEMS[id].desc}`,
      }));
      return list.length ? list : [{ kind: 'none', icon: 'vide', label: 'Sac vide', detail: 'Même pas une miette.' }];
    }
    if (this.ring === 1) {
      const list = [];
      for (const h of w.heroes()) {
        for (const sp of HEROES[h.hero].spells.filter((id) => spellKnown(w.s.flags, id))) {
          const s = SPELLS[sp];
          list.push({
            kind: 'spell', id: sp, caster: h.id, icon: sp, label: s.name,
            detail: `${HEROES[h.hero].name} · ${s.mp} PM (${h.mp}/${h.maxMp})`,
            disabled: h.state === 'ko' || h.mp < s.mp,
          });
        }
      }
      return list;
    }
    if (this.ring === 2) {
      const bag = Object.entries(w.s.gear).filter(([, n]) => n > 0).length;
      return w.heroes().map((h) => ({
        kind: 'status', hero: h.id, sprite: 'hero_' + h.hero,
        label: `${HEROES[h.hero].name}  Nv ${h.lv}`,
        detail: `For ${h.stats.str}  Déf ${h.stats.def}  Mag ${h.stats.mag}${bag ? `  (${bag} pièce(s) au sac)` : ''}`,
      }));
    }
    if (this.ring === 3) {
      return w.heroes().map((h) => ({
        kind: 'tactic', hero: h.id, icon: 'tac_' + h.tactic,
        label: `${HEROES[h.hero].name} : ${TACTIC_NAMES[h.tactic]}`,
        detail: h.controller === 'ai' ? 'Valider pour changer de tactique' : '(contrôlé par un joueur)',
      }));
    }
    // Invité en ligne : seul l'hôte sauvegarde et charge ; l'export reste possible (pour devenir hôte).
    const guest = this.session.isGuest;
    return SYSTEM.map((s) => ({
      kind: 'system', ...s,
      ...(guest && HOST_ONLY.includes(s.action) ? { disabled: true, detail: "Réservé à l'hôte de la partie" } : {}),
      ...(guest && s.action === 'title' ? { label: 'Quitter la partie' } : {}),
    }));
  }

  buildIcons(sel) {
    for (const i of this.icons) i.destroy();
    this.list = this.entries();
    this.sel = Math.min(sel, this.list.length - 1);
    this.rot = this.sel;
    // Les héros sont représentés par leur tête (haut du sprite 32x32).
    this.icons = this.list.map((e) => (e.sprite
      ? this.ui.add.image(0, 0, e.sprite, 'down_idle').setCrop(8, 3, 16, 16).setDepth(11)
      : this.ui.add.image(0, 0, 'ico', e.icon).setDepth(11)));
  }

  handle(m) {
    if (this.sub) {
      if (!this.sub.handle(m)) { this.sub = null; this.buildIcons(this.sel); }
      return;
    }
    if (this.busy) return;
    if (this.mode === 'target') return this.handleTarget(m);
    if (m.pressed.menu || m.pressed.cancel) return this.close();
    const n = this.list.length;
    if (m.repeat.left) this.sel = (this.sel + n - 1) % n;
    if (m.repeat.right) this.sel = (this.sel + 1) % n;
    if (m.pressed.up || m.pressed.down) {
      this.ring = (this.ring + (m.pressed.down ? 1 : RINGS.length - 1)) % RINGS.length;
      this.buildIcons(0);
    }
    if (m.pressed.attack || m.pressed.start) this.confirm();
  }

  confirm() {
    const e = this.list[this.sel];
    const w = this.world;
    if (!e || e.kind === 'none' || e.disabled) return this.ui.buzz();
    if (e.kind === 'tactic') {
      const h = w.get(e.hero);
      const next = TACTICS[(TACTICS.indexOf(h.tactic) + 1) % TACTICS.length];
      this.session.applyNow({ type: 'tactic', hero: h.id, tactic: next });
      this.buildIcons(this.sel);
      return;
    }
    if (e.kind === 'status') { this.sub = new StatusWindow(this.ui, this.session, e.hero); return; }
    if (e.kind === 'system') return this.system(e.action);
    let candidates;
    if (e.kind === 'item') {
      candidates = ITEMS[e.id].target === 'ko' ? w.heroes().filter((h) => h.state === 'ko') : w.heroesAlive();
    } else {
      const caster = w.get(e.caster);
      if (SPELLS[e.id].target === 'self') {
        this.session.queueCommand({ type: 'cast', actor: e.caster, spell: e.id, target: e.caster });
        return this.close();
      }
      candidates = SPELLS[e.id].target === 'foe'
        ? w.foes().filter((f) => Math.hypot(f.x - caster.x, f.y - caster.y) < 200).sort((a, b) => Math.hypot(a.x - caster.x, a.y - caster.y) - Math.hypot(b.x - caster.x, b.y - caster.y))
        : w.heroesAlive();
    }
    if (!candidates.length) return this.ui.buzz();
    this.mode = 'target';
    this.choice = e;
    this.targets = candidates.map((c) => c.id);
    const self = this.targets.indexOf(this.player.hero);
    this.tsel = self >= 0 ? self : 0;
  }

  // --- Anneau Système : sauvegardes ----------------------------------------------
  // Seul l'hôte sauvegarde : en local c'est toujours le cas ; en ligne (jalon 5) les
  // invités n'auront pas ces commandes.
  system(action) {
    const scene = this.ui.world;
    if (action === 'save' || action === 'load') {
      const slots = action === 'save' ? ['1', '2', '3'] : ['auto', '1', '2', '3'];
      const win = new ListWindow(this.ui, {
        title: action === 'save' ? 'Sauvegarder dans...' : 'Charger...',
        width: 250,
        entries: slots.map((s) => ({ label: SLOT_LABELS[s], detail: '...', value: s, disabled: true })),
        onPick: (slot) => (action === 'save' ? this.saveSlot(slot) : this.loadSlot(slot)),
      });
      this.sub = win;
      saves.list().then((all) => {
        if (this.sub !== win) return;
        win.setEntries(slots.map((s) => ({
          label: SLOT_LABELS[s], detail: describeSave(all[s]), value: s, disabled: action === 'load' && !all[s],
        })));
        if (!saves.persistent) win.setFooter('IndexedDB indisponible : sauvegardes en mémoire');
      });
      return;
    }
    if (action === 'export') {
      // Un invité peut exporter la partie commune : il pourra la reprendre en tant qu'hôte.
      exportFile(scene.currentSave());
      this.ui.toast('Partie exportée (.json)', 0xa8c8ff);
      return;
    }
    if (action === 'import') {
      // Le navigateur n'ouvre le sélecteur de fichiers qu'après une touche ou un clic, pas une manette.
      if (![...this.player.devices].includes('kb')) {
        this.ui.toast("Import : au clavier, ou glisser le .json sur l'écran titre", 0xffe080);
        return;
      }
      pickFile()
        .then((file) => (file ? readFile(file) : null))
        .then((save) => { if (save) this.resume(save); })
        .catch((err) => this.ui.toast(err instanceof SaveError ? err.message : 'Import impossible', 0xff8070));
      return;
    }
    if (action === 'title') {
      this.sub = new ListWindow(this.ui, {
        title: 'Quitter ? La progression non sauvegardée sera perdue.',
        width: 260,
        entries: [{ label: 'Non, je reste', value: false }, { label: "Oui, retour à l'écran titre", value: true }],
        onPick: (yes) => { if (yes) scene.leaveToTitle(); },
      });
    }
  }

  async saveSlot(slot) {
    this.busy = true;
    try {
      const { durable } = await this.ui.world.saveTo(slot);
      this.ui.toast(durable ? `${SLOT_LABELS[slot]} : sauvegardé` : `${SLOT_LABELS[slot]} : gardé en mémoire seulement`, 0xa8c8ff);
    } catch (e) {
      console.error(e);
      this.ui.toast('Échec de la sauvegarde', 0xff8070);
    }
    this.busy = false;
  }

  async loadSlot(slot) {
    const save = await saves.read(slot);
    if (save) this.resume(save);
    else this.ui.toast('Emplacement illisible', 0xff8070);
  }

  resume(save) {
    const scene = this.ui.world;
    scene.scene.restart({ save, players: scene.session.playersSnapshot() });
  }

  handleTarget(m) {
    if (m.pressed.cancel || m.pressed.menu) { this.mode = 'ring'; return; }
    const n = this.targets.length;
    if (m.repeat.left || m.repeat.up) this.tsel = (this.tsel + n - 1) % n;
    if (m.repeat.right || m.repeat.down) this.tsel = (this.tsel + 1) % n;
    if (m.pressed.attack || m.pressed.start) {
      const e = this.choice;
      const target = this.targets[this.tsel];
      if (e.kind === 'item') this.session.queueCommand({ type: 'item', actor: this.player.hero, item: e.id, target });
      else this.session.queueCommand({ type: 'cast', actor: e.caster, spell: e.id, target });
      this.close();
    }
  }

  draw(time) {
    if (!this.open) return;
    this.sub?.draw(time);
    const hero = this.ui.world.screenPos(this.player.hero) ?? { x: GAME_W / 2, y: GAME_H / 2 };
    const cx = Math.max(64, Math.min(GAME_W - 64, hero.x));
    const cy = Math.max(52, Math.min(GAME_H - 66, hero.y - 12));
    const n = this.list.length;
    let diff = this.sel - this.rot;
    if (diff > n / 2) diff -= n;
    if (diff < -n / 2) diff += n;
    this.rot = (this.rot + diff * 0.35 + n) % n;

    const g = this.g;
    g.clear();
    this.list.forEach((e, k) => {
      const a = -Math.PI / 2 + ((k - this.rot) * Math.PI * 2) / n;
      const x = Math.round(cx + Math.cos(a) * RX);
      const y = Math.round(cy + Math.sin(a) * RY);
      const icon = this.icons[k];
      icon.setPosition(x, e.sprite ? y + 5 : y).setAlpha(e.disabled ? 0.45 : 1);
      if (k === this.sel && this.mode === 'ring') {
        g.fillStyle(0xf2c244, 1);
        g.fillRect(x - 10, y - 10, 20, 1); g.fillRect(x - 10, y + 9, 20, 1);
        g.fillRect(x - 10, y - 10, 1, 20); g.fillRect(x + 9, y - 10, 1, 20);
      }
    });

    const cur = this.list[this.sel];
    const titleW = measure(RINGS[this.ring]) + 18;
    drawWindow(g, cx - Math.round(titleW / 2), cy - RY - 26, titleW, 14, 0.95);
    setText(this.title, RINGS[this.ring]).setPosition(cx, cy - RY - 23);

    let label = cur.label;
    let detail = cur.detail;
    this.cursor.setVisible(false);
    if (this.mode === 'target') {
      const t = this.world.get(this.targets[this.tsel]);
      label = `${cur.label} > ${t?.type === 'hero' ? HEROES[t.hero].name : 'ennemi'}`;
      detail = 'Choisir la cible, valider ou annuler';
      const p = t && this.ui.world.screenPos(t.id);
      if (p) this.cursor.setVisible(true).setPosition(p.x, p.y - 30 + (Math.floor(time / 150) % 2));
    }
    const shortDetail = measure(detail) > 200 ? detail.slice(0, 40) + '...' : detail;
    const lw = Math.max(measure(label), measure(shortDetail)) + 16;
    const lx = Math.max(2, Math.min(GAME_W - lw - 2, cx - Math.round(lw / 2)));
    drawWindow(g, lx, cy + RY + 12, lw, 24, 0.95);
    setText(this.label, label).setPosition(lx + Math.round(lw / 2), cy + RY + 15);
    setText(this.detail, shortDetail).setPosition(lx + Math.round(lw / 2), cy + RY + 25);
  }
}
