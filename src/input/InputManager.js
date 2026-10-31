// Clavier + manettes. Un seul jeu de listeners clavier, posé une fois pour toute la page ;
// les manettes sont lues par polling (navigator.getGamepads) à chaque image, sans aucun
// listener par manette : impossible d'en empiler en relançant une scène.
export const ACTIONS = ['up', 'down', 'left', 'right', 'attack', 'menu', 'cancel', 'switch', 'run', 'start'];

// event.code = touche physique : ZQSD sur AZERTY correspond à KeyW/KeyA/KeyS/KeyD.
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyJ: 'attack', Space: 'attack', KeyK: 'menu', KeyE: 'menu',
  KeyL: 'cancel', Escape: 'cancel', Backspace: 'cancel',
  Tab: 'switch', ShiftLeft: 'run', ShiftRight: 'run', Enter: 'start',
};

// Mapping « standard » des navigateurs : la plupart des manettes Bluetooth (Xbox, DualSense,
// Switch Pro) y sont présentées par Chrome/Edge.
const PAD_BUTTONS = { 0: 'attack', 1: 'cancel', 2: 'run', 3: 'menu', 4: 'switch', 8: 'switch', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
// Mappings « non standard » (Firefox, certains pilotes Bluetooth DirectInput), reconnus à l'id.
const PROFILES = [
  // Sony (DualShock 4, DualSense) : 0 carré, 1 croix, 2 rond, 3 triangle.
  { test: /054c/i, buttons: { 0: 'run', 1: 'attack', 2: 'cancel', 3: 'menu', 4: 'switch', 8: 'switch', 9: 'start' } },
];
const GENERIC_BUTTONS = PAD_BUTTONS;
// Croix directionnelle codée sur un seul axe (« hat ») : 8 positions de -1 à 1, neutre au-delà.
const HAT_DIRS = [['up'], ['up', 'right'], ['right'], ['down', 'right'], ['down'], ['down', 'left'], ['left'], ['up', 'left']];
const DEADZONE = 0.4;
const REPEAT_DELAY = 18;
const REPEAT_EVERY = 5;

class Device {
  constructor(id) {
    this.id = id;
    this.held = {};
    this.pressed = {};
    this.repeat = {};
    this.holdT = {};
    this.mx = 0;
    this.my = 0;
    this.any = false;
  }

  commit(raw) {
    this.any = false;
    for (const a of ACTIONS) {
      const h = !!raw[a];
      this.pressed[a] = h && !this.held[a];
      this.holdT[a] = h ? (this.holdT[a] ?? 0) + 1 : 0;
      const t = this.holdT[a];
      this.repeat[a] = this.pressed[a] || (t > REPEAT_DELAY && (t - REPEAT_DELAY) % REPEAT_EVERY === 0);
      this.held[a] = h;
      if (this.pressed[a]) this.any = true;
    }
    this.mx = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    this.my = (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0);
  }
}

// Nom lisible : « Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e ...) » ou
// « 045e-0b13-Xbox Wireless Controller » deviennent « Xbox Wireless Controller ».
export function padName(id) {
  return id.replace(/\s*\(.*\)\s*/g, ' ').replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '').trim() || 'Manette';
}

function readPad(gp) {
  const raw = {};
  const standard = gp.mapping === 'standard';
  const map = standard ? PAD_BUTTONS : (PROFILES.find((p) => p.test.test(gp.id))?.buttons ?? GENERIC_BUTTONS);
  gp.buttons.forEach((b, i) => { if (b.pressed && map[i]) raw[map[i]] = true; });
  if (!standard && gp.axes.length >= 10) {
    const v = gp.axes[9];
    if (Math.abs(v) <= 1.05) for (const d of HAT_DIRS[Math.round(((v + 1) / 2) * 7) % 8]) raw[d] = true;
  }
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  if (ax < -DEADZONE) raw.left = true;
  if (ax > DEADZONE) raw.right = true;
  if (ay < -DEADZONE) raw.up = true;
  if (ay > DEADZONE) raw.down = true;
  return raw;
}

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.latched = new Set(); // touches appuyées puis relâchées entre deux images
    this.devices = new Map([['kb', new Device('kb')]]);
    this.padEvents = [];
    this.onDown = (e) => {
      if (!KEYMAP[e.code]) return;
      e.preventDefault();
      this.keys.add(e.code);
      this.latched.add(e.code);
    };
    this.onUp = (e) => { this.keys.delete(e.code); };
    this.onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  // Appelé une fois par image, avant toute lecture.
  poll() {
    const raw = {};
    for (const code of this.keys) raw[KEYMAP[code]] = true;
    for (const code of this.latched) raw[KEYMAP[code]] = true;
    this.latched.clear();
    this.devices.get('kb').commit(raw);

    const seen = new Set(['kb']);
    for (const gp of this.gamepads()) {
      if (!gp || !gp.connected) continue;
      const id = 'pad' + gp.index;
      seen.add(id);
      let d = this.devices.get(id);
      // Une manette Bluetooth qui se reconnecte peut reprendre le même index sous un autre modèle.
      if (d && d.raw !== gp.id) { this.padEvents.push({ type: 'disconnect', id, name: d.name }); d = null; }
      if (!d) {
        d = new Device(id);
        d.raw = gp.id;
        d.name = padName(gp.id);
        this.devices.set(id, d);
        this.padEvents.push({ type: 'connect', id, name: d.name });
      }
      d.commit(readPad(gp));
    }
    for (const [id, d] of [...this.devices]) {
      if (seen.has(id)) continue;
      this.devices.delete(id);
      this.padEvents.push({ type: 'disconnect', id, name: d.name });
    }
  }

  gamepads() {
    try { return navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch { return []; }
  }

  // Connexions/déconnexions depuis le dernier appel.
  drainPadEvents() {
    const ev = this.padEvents;
    this.padEvents = [];
    return ev;
  }

  // Vibration (manettes qui l'exposent : Xbox et DualSense sous Chrome/Edge, y compris en Bluetooth).
  rumble(ids, strong, weak, ms) {
    const pads = this.gamepads();
    for (const id of ids) {
      if (!id.startsWith('pad')) continue;
      const act = pads[Number(id.slice(3))]?.vibrationActuator;
      if (!act?.playEffect) continue;
      act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    }
  }

  device(id) { return this.devices.get(id) ?? null; }
  padIds() { return [...this.devices.keys()].filter((id) => id !== 'kb'); }

  // Fusionne plusieurs périphériques (clavier + manette du joueur 1).
  merged(ids) {
    const out = { mx: 0, my: 0, held: {}, pressed: {}, repeat: {} };
    for (const id of ids) {
      const d = this.devices.get(id);
      if (!d) continue;
      for (const a of ACTIONS) {
        out.held[a] ||= d.held[a];
        out.pressed[a] ||= d.pressed[a];
        out.repeat[a] ||= d.repeat[a];
      }
    }
    out.mx = (out.held.right ? 1 : 0) - (out.held.left ? 1 : 0);
    out.my = (out.held.down ? 1 : 0) - (out.held.up ? 1 : 0);
    return out;
  }

  // Tous les périphériques confondus (écran titre, game over).
  all() { return this.merged([...this.devices.keys()]); }
}

export const input = new InputManager();
