// Fenêtre de choix vertical (emplacements de sauvegarde, confirmations).
// handle(m) renvoie true tant que la fenêtre reste ouverte.
import { GAME_H, GAME_W } from '../../config.js';
import { measure } from '../art/font.js';
import { drawWindow, setText, text } from './widgets.js';

const ROW = 11;

export class ListWindow {
  // entries : [{ label, detail?, disabled?, value }] ; onPick(value) ; onCancel()
  constructor(ui, { title, entries = [], onPick, onCancel = null, width = 200 }) {
    this.ui = ui;
    this.title = title;
    this.onPick = onPick;
    this.onCancel = onCancel;
    this.width = width;
    this.sel = 0;
    this.g = ui.add.graphics().setDepth(14);
    this.titleText = text(ui, 0, 0, title, { tint: 0xf2c244 }).setDepth(15);
    this.footer = text(ui, 0, 0, '', { tint: 0xc8d0f0 }).setDepth(15);
    this.cursor = text(ui, 0, 0, '>', { tint: 0xf2c244 }).setDepth(15);
    this.rows = [];
    this.setEntries(entries);
  }

  setEntries(entries) {
    for (const r of this.rows) { r.label.destroy(); r.detail.destroy(); }
    this.entries = entries;
    this.sel = Math.min(this.sel, Math.max(0, entries.length - 1));
    this.rows = entries.map((e) => ({
      label: text(this.ui, 0, 0, e.label).setDepth(15),
      detail: text(this.ui, 0, 0, e.detail ?? '', { tint: 0xa8b0d0, origin: 1 }).setDepth(15),
    }));
  }

  setFooter(str) { setText(this.footer, str); }

  handle(m) {
    const n = this.entries.length;
    if (m.pressed.cancel || m.pressed.menu) { this.destroy(); this.onCancel?.(); return false; }
    if (!n) return true;
    if (m.repeat.up) this.sel = (this.sel + n - 1) % n;
    if (m.repeat.down) this.sel = (this.sel + 1) % n;
    if (m.pressed.attack || m.pressed.start) {
      const e = this.entries[this.sel];
      if (e.disabled) { this.ui.buzz(); return true; }
      this.destroy();
      this.onPick(e.value);
      return false;
    }
    return true;
  }

  draw(time) {
    const w = Math.max(this.width, measure(this.footer.text) + 20, measure(this.title) + 20);
    const h = 26 + Math.max(1, this.entries.length) * ROW + (this.footer.text ? 10 : 0);
    const x = Math.round((GAME_W - w) / 2);
    const y = Math.round((GAME_H - h) / 2) - 10;
    this.g.clear();
    drawWindow(this.g, x, y, w, h, 0.97);
    this.titleText.setPosition(x + 10, y + 6);
    this.rows.forEach((r, i) => {
      const e = this.entries[i];
      r.label.setPosition(x + 18, y + 20 + i * ROW).setTint(e.disabled ? 0x8890b0 : 0xffffff);
      r.detail.setPosition(x + w - 10, y + 20 + i * ROW);
    });
    this.cursor.setPosition(x + 9 + (Math.floor(time / 300) % 2), y + 20 + this.sel * ROW).setVisible(this.entries.length > 0);
    this.footer.setPosition(x + 10, y + h - 13);
  }

  destroy() {
    for (const o of [this.g, this.titleText, this.footer, this.cursor]) o.destroy();
    for (const r of this.rows) { r.label.destroy(); r.detail.destroy(); }
    this.rows = [];
  }
}
