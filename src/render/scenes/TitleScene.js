import { GAME_W, VERSION } from '../../config.js';
import { input } from '../../input/InputManager.js';
import { SaveError } from '../../save/format.js';
import { SLOT_LABELS, onFileDrop, pickFile, readFile, saves } from '../../save/SaveStore.js';
import { net } from '../../net/Net.js';
import { joinGame } from '../../net/RemoteSession.js';
import { describeSave } from '../ui/RingMenu.js';
import { CodeWindow } from '../ui/CodeWindow.js';
import { ListWindow } from '../ui/ListWindow.js';
import { drawWindow, setText, text } from '../ui/widgets.js';

const ITEMS = [
  { label: 'Continuer', action: 'continue' },
  { label: 'Nouvelle partie (solo)', action: 'solo' },
  { label: 'Charger une sauvegarde', action: 'load' },
  { label: 'Importer un fichier .json', action: 'import' },
  { label: 'Co-op en ligne', action: 'coop' },
];
const MENU_X = 112;
const MENU_Y = 120;
const newSeed = () => (Date.now() & 0x7fffffff) | 1;

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  // data.message : raison du retour au titre (hôte parti, etc.).
  create(data = {}) {
    if (net.online) net.close(); // quitter une partie en ligne ferme la salle ou la connexion
    this.add.image(0, 0, 'title_bg').setOrigin(0);
    const logo = text(this, GAME_W / 2, 26, 'SECRET OF SARAN', { tint: 0xf2c244, outlined: true, origin: 0.5 }).setScale(3);
    this.tweens.add({ targets: logo, y: 29, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    text(this, GAME_W / 2, 58, '~ La légende du Grand Chêne ~', { tint: 0xfff0d0, outlined: true, origin: 0.5 });

    const g = this.add.graphics();
    drawWindow(g, MENU_X - 10, MENU_Y - 8, 180, ITEMS.length * 12 + 12, 0.92);
    this.items = ITEMS.map((it, i) => text(this, MENU_X + 8, MENU_Y + i * 12, it.label, { tint: 0x8890b0 }));
    this.cursor = text(this, MENU_X - 2, MENU_Y, '>', { tint: 0xf2c244 });
    this.message = text(this, GAME_W / 2, 190, '', { tint: 0xd8c8b0, outlined: true, origin: 0.5 });
    text(this, 4, 205, VERSION, { tint: 0x9080a0, outlined: true });
    if (data.message) this.say(data.message);
    else this.info('Entrée / J / A : valider. On peut aussi glisser une sauvegarde .json ici.');

    this.sel = 1;
    this.enabled = { solo: true, load: false, import: true, continue: false, coop: true };
    this.win = null;
    this.joining = false;
    this.started = false; // la scène est réutilisée par Phaser : on remet l'état à zéro
    this.slots = {};
    saves.list().then((all) => {
      this.slots = all;
      const any = Object.values(all).some(Boolean);
      this.enabled.continue = any;
      this.enabled.load = any;
      if (any && this.sel === 1) this.sel = 0;
      this.refresh();
    });
    this.refresh();

    // Glisser-déposer : fonctionne quelle que soit la manette ; retiré en quittant l'écran.
    const off = onFileDrop((res) => (res instanceof Error ? this.say(res) : this.begin({ save: res })));
    this.events.once('shutdown', off);

    // Lien d'invitation : ?room=ABCD ouvre directement la saisie du code.
    const room = new URLSearchParams(location.search).get('room');
    if (room && !data.message) { this.sel = 4; this.openJoin(room.toUpperCase()); }
  }

  refresh() {
    this.items.forEach((t, i) => t.setTint(this.enabled[ITEMS[i].action] ? 0xffffff : 0x8890b0));
  }

  info(str) { setText(this.message, str).setTint(0xd8c8b0); }

  say(err) {
    const msg = typeof err === 'string' ? err : err instanceof SaveError || err instanceof Error ? err.message : 'Fichier illisible.';
    setText(this.message, msg).setTint(0xff9080);
  }

  buzz() { this.cameras.main.shake(80, 0.004); }

  begin(data) {
    if (this.started) return;
    this.started = true;
    this.scene.start('World', data);
  }

  update(time) {
    input.poll();
    const m = input.all();
    if (this.win) {
      this.win.draw(time);
      if (!this.win.handle(m)) this.win = null;
      return;
    }
    if (this.joining) return;
    if (m.repeat.down || m.repeat.up) this.sel = (this.sel + (m.repeat.down ? 1 : ITEMS.length - 1)) % ITEMS.length;
    this.cursor.y = MENU_Y + this.sel * 12;
    this.cursor.x = MENU_X - 2 + (Math.floor(time / 300) % 2);
    if (!(m.pressed.attack || m.pressed.start)) return;
    const action = ITEMS[this.sel].action;
    if (!this.enabled[action]) return this.buzz();
    if (action === 'solo') this.begin({ seed: newSeed(), intro: true });
    else if (action === 'continue') saves.latest().then((save) => save && this.begin({ save }));
    else if (action === 'load') this.openLoad();
    else if (action === 'import') this.importFile((save) => this.begin({ save }));
    else if (action === 'coop') this.openCoop();
  }

  openLoad() {
    this.win = new ListWindow(this, {
      title: 'Charger...',
      width: 250,
      entries: Object.keys(SLOT_LABELS).map((s) => ({ label: SLOT_LABELS[s], detail: describeSave(this.slots[s]), value: s, disabled: !this.slots[s] })),
      onPick: (slot) => this.begin({ save: this.slots[slot] }),
    });
  }

  // --- Co-op en ligne ------------------------------------------------------------
  openCoop() {
    const latest = Object.values(this.slots).filter(Boolean).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
    this.win = new ListWindow(this, {
      title: 'Co-op en ligne (3 joueurs)',
      width: 260,
      entries: [
        { label: 'Héberger une nouvelle partie', value: 'new' },
        { label: 'Héberger la dernière sauvegarde', detail: latest ? latest.summary.map : 'aucune', value: 'latest', disabled: !latest },
        { label: 'Héberger un fichier .json', detail: 'clavier', value: 'file' },
        { label: 'Rejoindre avec un code', value: 'join' },
      ],
      onPick: (v) => {
        if (v === 'new') this.begin({ seed: newSeed(), intro: true, host: true });
        else if (v === 'latest') this.begin({ save: latest, host: true });
        else if (v === 'file') this.importFile((save) => this.begin({ save, host: true }));
        else this.openJoin();
      },
    });
  }

  openJoin(initial = '') {
    this.win = new CodeWindow(this, { initial, onPick: (code) => this.join(code) });
  }

  join(code) {
    this.joining = true;
    this.info(`Connexion à la salle ${code}...`);
    joinGame(code)
      .then((guest) => this.begin({ guest }))
      .catch((e) => this.say(e))
      .finally(() => { this.joining = false; });
  }

  importFile(then) {
    // Le navigateur n'ouvre le sélecteur de fichiers qu'après une touche ou un clic.
    const kb = input.device('kb');
    if (!(kb.pressed.attack || kb.pressed.start)) {
      setText(this.message, 'Au clavier : Entrée. À la manette : glisser le .json sur cette page.').setTint(0xffe080);
      return;
    }
    pickFile()
      .then((file) => (file ? readFile(file) : null))
      .then((save) => { if (save) then(save); })
      .catch((err) => this.say(err));
  }
}
