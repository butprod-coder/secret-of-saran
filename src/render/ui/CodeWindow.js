// Saisie d'un code de salle, au clavier comme à la manette : gauche/droite choisit la lettre,
// haut/bas la fait défiler, valider rejoint. Même interface que ListWindow.
import { GAME_H, GAME_W } from '../../config.js';
import { CODE_LENGTH, CODE_LETTERS } from '../../net/config.js';
import { drawWindow, setText, text } from './widgets.js';

const W = 200;
const H = 64;

export class CodeWindow {
  constructor(ui, { initial = '', onPick, onCancel = null }) {
    this.ui = ui;
    this.onPick = onPick;
    this.onCancel = onCancel;
    this.idx = Array.from({ length: CODE_LENGTH }, (_, i) => Math.max(0, CODE_LETTERS.indexOf(initial[i] ?? 'A')));
    this.pos = 0;
    this.x = Math.round((GAME_W - W) / 2);
    this.y = Math.round((GAME_H - H) / 2) - 10;
    this.g = ui.add.graphics().setDepth(14);
    this.title = text(ui, this.x + 10, this.y + 6, 'Code de la salle', { tint: 0xf2c244 }).setDepth(15);
    this.letters = this.idx.map((_, i) => text(ui, this.x + 70 + i * 16, this.y + 24, '', { origin: 0.5 }).setDepth(15).setScale(2));
    this.help = text(ui, this.x + 10, this.y + H - 13, 'Haut/bas : lettre   Valider : rejoindre', { tint: 0xa8b0d0 }).setDepth(15);
  }

  get code() { return this.idx.map((i) => CODE_LETTERS[i]).join(''); }

  handle(m) {
    const n = CODE_LETTERS.length;
    if (m.pressed.cancel || m.pressed.menu) { this.destroy(); this.onCancel?.(); return false; }
    if (m.repeat.left) this.pos = (this.pos + CODE_LENGTH - 1) % CODE_LENGTH;
    if (m.repeat.right) this.pos = (this.pos + 1) % CODE_LENGTH;
    if (m.repeat.up) this.idx[this.pos] = (this.idx[this.pos] + 1) % n;
    if (m.repeat.down) this.idx[this.pos] = (this.idx[this.pos] + n - 1) % n;
    if (m.pressed.attack || m.pressed.start) {
      const code = this.code;
      this.destroy();
      this.onPick(code);
      return false;
    }
    return true;
  }

  draw(time) {
    const g = this.g;
    g.clear();
    drawWindow(g, this.x, this.y, W, H, 0.97);
    this.letters.forEach((t, i) => {
      setText(t, CODE_LETTERS[this.idx[i]]).setTint(i === this.pos ? 0xffe080 : 0xffffff);
    });
    // Curseur souligné sous la lettre active, clignotant.
    if (Math.floor(time / 300) % 2 === 0) {
      g.fillStyle(0xf2c244, 1);
      g.fillRect(this.x + 70 + this.pos * 16 - 5, this.y + 42, 10, 2);
    }
  }

  destroy() {
    for (const o of [this.g, this.title, this.help, ...this.letters]) o.destroy();
  }
}
