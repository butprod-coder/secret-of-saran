// Vues des entités : lisent l'état de la simulation, ne le modifient jamais.
import { WEAPONS } from '../sim/data/weapons.js';

const DIR_NAMES = ['down', 'up', 'right', 'right']; // 2 = gauche, dessinée en miroir
const SPIN = [0, 3, 1, 2]; // ordre bas, droite, haut, gauche pour l'attaque tournoyante

class HeroView {
  constructor(scene, e) {
    this.shadow = scene.add.image(0, 0, 'fx', 'shadow');
    this.spr = scene.add.image(0, 0, 'hero_' + e.hero, 'down_idle').setOrigin(0.5, 30 / 32);
  }

  update(e, x, y, tick) {
    let dir = e.dir;
    let pose = 'idle';
    if (e.state === 'walk') pose = 'walk' + (Math.floor(tick / 7) % 4);
    else if (e.state === 'attack' && e.atk) {
      const wpn = WEAPONS[e.weapon];
      if (e.atk.level && wpn.kind === 'melee') { dir = SPIN[Math.floor(e.t / 4) % 4]; pose = 'atk1'; }
      else pose = e.t < wpn.active[0] ? 'atk0' : 'atk1';
    } else if (e.state === 'cast') pose = 'cast';
    const ko = e.state === 'ko';
    this.spr.setFrame(ko ? 'ko' : `${DIR_NAMES[dir]}_${pose}`);
    this.spr.setFlipX(!ko && dir === 2);
    const px = Math.round(x);
    const py = Math.round(y);
    this.spr.setPosition(px + (e.state === 'hurt' ? (tick % 4 < 2 ? -1 : 1) : 0), py);
    this.spr.setDepth(py);
    this.shadow.setPosition(px, py).setDepth(py - 0.5).setVisible(!ko);

    this.spr.setVisible(!(e.invul > 0 && !ko && Math.floor(tick / 3) % 2 === 1));
    if (e.state === 'hurt' && e.t < 4) this.spr.setTintFill(0xffffff);
    else if (e.charge > 0 && Math.floor(tick / 4) % 2 === 0) this.spr.setTint(e.charge >= 100 ? 0xfff070 : 0xffe0b0);
    else if (e.buffs.def > 0 && Math.floor(tick / 10) % 6 === 0) this.spr.setTint(0xb8e0ff);
    else this.spr.clearTint();
  }

  destroy() { this.spr.destroy(); this.shadow.destroy(); }
}

const MOB_FRAMES = {
  lapinfou(e, tick) {
    if (e.state === 'hurt') return 'hurt';
    if (e.state === 'hop') return e.z > 3 ? 'hop' : 'squash';
    return e.t < 5 ? 'squash' : 'idle';
  },
  champignard(e, tick) {
    if (e.state === 'hurt') return 'hurt';
    if (e.state === 'windup') return 'windup';
    if (e.state === 'walk') return 'walk' + (Math.floor(tick / 12) % 2);
    return 'walk0';
  },
  taupinarde(e) {
    return { under: 'mound', rise: 'dig', dig: 'dig', windup: 'windup', hurt: 'hurt' }[e.state] ?? 'up';
  },
  gnomard(e, tick) {
    switch (e.state) {
      case 'sleep': return 'statue';
      case 'leapWind': case 'slamWind': return 'windup';
      case 'throwWind': return 'throw';
      case 'leap': return 'idle1';
      case 'dig': return 'dig';
      case 'under': case 'erupt': return 'mound';
      case 'recover': if (e.pose && e.t < 16) return e.pose; return 'idle0';
      default: return 'idle' + (Math.floor(tick / 20) % 2);
    }
  },
};

// Sprites plus grands que les 24 x 24 habituels.
const BIG = { gnomard: { tex: 'boss', h: 40, feet: 37, shadow: 2.2 } };

class EnemyView {
  constructor(scene, e) {
    this.big = BIG[e.kind];
    this.shadow = scene.add.image(0, 0, 'fx', 'shadow').setScale(this.big?.shadow ?? 1);
    this.spr = this.big
      ? scene.add.image(0, 0, this.big.tex, e.kind + '_' + MOB_FRAMES[e.kind](e, 0)).setOrigin(0.5, this.big.feet / this.big.h)
      : scene.add.image(0, 0, 'mobs', e.kind + '_' + MOB_FRAMES[e.kind](e, 0)).setOrigin(0.5, 22 / 24);
  }

  update(e, x, y, tick) {
    this.spr.setFrame(e.kind + '_' + MOB_FRAMES[e.kind](e, tick));
    this.spr.setFlipX(e.fx < 0);
    const px = Math.round(x);
    const py = Math.round(y);
    // Un monticule qui va exploser tremble.
    const shake = (e.state === 'erupt' || e.state === 'rise') && tick % 4 < 2 ? 1 : 0;
    this.spr.setPosition(px + shake, py - Math.round(e.z));
    this.spr.setDepth(py);
    const underground = e.state === 'under' || e.state === 'erupt' || e.state === 'rise';
    this.shadow.setPosition(px, py).setDepth(py - 0.5).setVisible(!underground);
    if ((e.state === 'hurt' && e.t < 4) || e.flash > 0) this.spr.setTintFill(0xffffff);
    else if (e.frozen > 0) this.spr.setTint(0x90c8ff);
    else if ((e.state === 'windup' || e.state.endsWith('Wind')) && Math.floor(tick / 3) % 2) this.spr.setTint(0xffb0ff);
    else this.spr.clearTint();
  }

  destroy() { this.spr.destroy(); this.shadow.destroy(); }
}

class ProjectileView {
  constructor(scene, e) {
    this.shadow = scene.add.image(0, 0, 'fx', 'shadow').setScale(0.5);
    this.spr = scene.add.image(0, 0, 'fx', { arrow: 'arrow', caillou: 'caillou' }[e.kind] ?? 'feu0');
    if (e.kind === 'arrow') this.spr.setRotation(Math.round(Math.atan2(e.vy, e.vx) / (Math.PI / 4)) * (Math.PI / 4));
  }

  update(e, x, y, tick) {
    if (e.kind === 'feu') { this.spr.setFrame('feu' + (Math.floor(tick / 5) % 2)); this.spr.setFlipX(e.vx < 0); }
    const px = Math.round(x);
    const py = Math.round(y);
    this.spr.setPosition(px, py - 9).setDepth(py + 2);
    this.shadow.setPosition(px, py).setDepth(py - 0.5);
  }

  destroy() { this.spr.destroy(); this.shadow.destroy(); }
}

class PickupView {
  constructor(scene, e) {
    this.shadow = scene.add.image(0, 0, 'fx', 'shadow').setScale(0.6);
    this.spr = e.item ? scene.add.image(0, 0, 'ico', e.item) : scene.add.image(0, 0, 'fx', 'pk_coin');
  }

  update(e, x, y, tick) {
    const px = Math.round(x);
    const py = Math.round(y);
    this.spr.setPosition(px, py - 6 - Math.round(Math.abs(Math.sin(tick / 12)) * 2)).setDepth(py);
    this.spr.setVisible(e.life > 120 || Math.floor(tick / 4) % 2 === 0);
    this.shadow.setPosition(px, py).setDepth(py - 0.5);
  }

  destroy() { this.spr.destroy(); this.shadow.destroy(); }
}

const VIEWS = { hero: HeroView, enemy: EnemyView, proj: ProjectileView, pickup: PickupView };

export function createView(scene, e) {
  const V = VIEWS[e.type];
  return V ? new V(scene, e) : null;
}
