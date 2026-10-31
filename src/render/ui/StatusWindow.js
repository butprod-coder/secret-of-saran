// Fenêtre de statut d'un héros : statistiques, arme, et les trois emplacements d'équipement.
// Haut/bas choisit l'emplacement, gauche/droite change la pièce (commande « equip »).
import { GAME_W } from '../../config.js';
import { HEROES, xpToNext } from '../../sim/data/heroes.js';
import { WEAPONS, MAX_WEAPON_LV, weaponXpToNext } from '../../sim/data/weapons.js';
import { GEAR, GEAR_ORDER, SLOTS, SLOT_NAMES, canWear } from '../../sim/data/equipment.js';
import { drawWindow, setText, text } from './widgets.js';

const W = 260;
const H = 150;
const X = Math.round((GAME_W - W) / 2);
const Y = 18;

export class StatusWindow {
  constructor(ui, session, heroId) {
    this.ui = ui;
    this.session = session;
    this.heroId = heroId;
    this.sel = 0;
    const h = this.hero;
    this.g = ui.add.graphics().setDepth(14);
    this.portrait = ui.add.image(X + 22, Y + 26, 'hero_' + h.hero, 'down_idle').setDepth(15);
    const t = (x, y, opts) => text(ui, X + x, Y + y, '', opts).setDepth(15);
    this.name = t(40, 8, { tint: 0xf2c244 });
    this.level = t(W - 10, 8, { origin: 1 });
    this.lines = [t(40, 20), t(40, 30), t(40, 42), t(12, 56)];
    this.slotNames = SLOTS.map((_, i) => t(18, 76 + i * 12, { tint: 0xa8b0d0 }));
    this.slotItems = SLOTS.map((_, i) => t(62, 76 + i * 12));
    this.cursor = t(9, 76, { tint: 0xf2c244 });
    this.desc = t(12, 116, { tint: 0xc8d0f0 });
    this.help = t(12, 134, { tint: 0x8890b0 });
    setText(this.help, 'Haut/bas : choisir   Gauche/droite : changer');
  }

  get hero() { return this.session.world.get(this.heroId); }

  // Pièces possibles pour un emplacement : rien, celle portée, et celles du sac.
  choices(slot) {
    const h = this.hero;
    const bag = this.session.world.s.gear;
    return [null, ...GEAR_ORDER.filter((id) => GEAR[id].slot === slot && canWear(h.hero, id) && (bag[id] > 0 || h.equip[slot] === id))];
  }

  handle(m) {
    if (m.pressed.cancel || m.pressed.menu || m.pressed.attack || m.pressed.start) { this.destroy(); return false; }
    if (m.repeat.up) this.sel = (this.sel + SLOTS.length - 1) % SLOTS.length;
    if (m.repeat.down) this.sel = (this.sel + 1) % SLOTS.length;
    if (m.repeat.left || m.repeat.right) {
      const slot = SLOTS[this.sel];
      const list = this.choices(slot);
      if (list.length < 2) { this.ui.buzz(); return true; }
      const i = list.indexOf(this.hero.equip[slot] ?? null);
      const next = list[(i + (m.repeat.right ? 1 : list.length - 1)) % list.length];
      this.session.applyNow({ type: 'equip', hero: this.heroId, slot, gear: next });
    }
    return true;
  }

  draw(time) {
    const h = this.hero;
    if (!h) return;
    const d = HEROES[h.hero];
    const wpn = WEAPONS[h.weapon];
    const st = h.stats;
    this.g.clear();
    drawWindow(this.g, X, Y, W, H, 0.97);
    this.g.fillStyle(0xe8dcc0, 0.5).fillRect(X + 10, Y + 70, W - 20, 1).fillRect(X + 10, Y + 112, W - 20, 1);
    this.portrait.setFrame(h.state === 'ko' ? 'ko' : 'down_idle');
    setText(this.name, `${d.name} · ${d.role}`);
    setText(this.level, `Nv ${h.lv}`);
    setText(this.lines[0], `PV ${h.hp}/${h.maxHp}    PM ${h.mp}/${h.maxMp}`);
    setText(this.lines[1], `XP ${h.xp}/${xpToNext(h.lv)}`);
    setText(this.lines[2], `For ${st.str}   Déf ${st.def}   Mag ${st.mag}`);
    const wxp = h.wlv >= MAX_WEAPON_LV ? 'max' : `${h.wxp}/${weaponXpToNext(h.wlv)}`;
    setText(this.lines[3], `${wpn.name} : niveau ${h.wlv} (${wxp})`);
    SLOTS.forEach((slot, i) => {
      const id = h.equip[slot];
      const g = GEAR[id];
      setText(this.slotNames[i], SLOT_NAMES[slot]);
      const bonus = g ? ['str', 'def', 'mag'].filter((k) => g[k]).map((k) => `${{ str: 'For', def: 'Déf', mag: 'Mag' }[k]}+${g[k]}`).join(' ') : '';
      setText(this.slotItems[i], g ? `${g.name}  ${bonus}` : '-').setTint(i === this.sel ? 0xffffff : 0xd0d4e8);
    });
    const cur = GEAR[h.equip[SLOTS[this.sel]]];
    const more = this.choices(SLOTS[this.sel]).length - 1 - (cur ? 1 : 0);
    setText(this.desc, cur ? cur.desc : more > 0 ? `${more} pièce(s) disponible(s) dans le sac` : 'Rien à porter ici pour l\'instant.');
    this.cursor.setPosition(X + 9 + (Math.floor(time / 300) % 2), Y + 76 + this.sel * 12);
  }

  destroy() {
    for (const o of [this.g, this.portrait, this.name, this.level, this.cursor, this.desc, this.help, ...this.lines, ...this.slotNames, ...this.slotItems]) o.destroy();
  }
}
