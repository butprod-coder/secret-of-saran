// Boîte de dialogue avec effet machine à écrire. Met le jeu en pause.
import { wrap } from '../art/font.js';
import { drawWindow, setText, text } from './widgets.js';

const X = 4;
const Y = 150;
const W = 376;
const H = 62;
const LINES = 4;

export class Dialogue {
  constructor(ui) {
    this.ui = ui;
    this.active = false;
    this.g = ui.add.graphics().setDepth(30);
    this.name = text(ui, X + 9, Y + 6, '', { tint: 0xf2c244 }).setDepth(31);
    this.lines = Array.from({ length: LINES }, (_, i) => text(ui, X + 9, Y + 18 + i * 10, '').setDepth(31));
    this.more = text(ui, X + W - 12, Y + H - 11, '>', { tint: 0xf2c244 }).setDepth(31);
    this.setVisible(false);
  }

  setVisible(v) {
    for (const o of [this.g, this.name, this.more, ...this.lines]) o.setVisible(v);
  }

  start(pages, onEnd = null) {
    this.pages = pages;
    this.page = 0;
    this.onEnd = onEnd;
    this.active = true;
    this.setVisible(true);
    this.show();
  }

  show() {
    const p = this.pages[this.page];
    this.wrapped = wrap(p.text, W - 24).slice(0, LINES);
    this.total = this.wrapped.reduce((t, l) => t + l.length, 0);
    this.shown = 0;
    setText(this.name, p.who ?? '');
    const g = this.g;
    g.clear();
    drawWindow(g, X, Y, W, H, 0.96);
  }

  handle(m) {
    if (!(m.pressed.attack || m.pressed.start || m.pressed.cancel)) return;
    if (this.shown < this.total) { this.shown = this.total; return; }
    if (++this.page < this.pages.length) return this.show();
    this.active = false;
    this.setVisible(false);
    this.onEnd?.();
  }

  update(time) {
    if (!this.active) return;
    this.shown = Math.min(this.total, this.shown + 1.5);
    let left = Math.floor(this.shown);
    this.wrapped.forEach((l, i) => {
      setText(this.lines[i], l.slice(0, Math.max(0, left)));
      left -= l.length;
    });
    for (let i = this.wrapped.length; i < LINES; i++) setText(this.lines[i], '');
    this.more.setVisible(this.shown >= this.total && Math.floor(time / 300) % 2 === 0);
  }
}
