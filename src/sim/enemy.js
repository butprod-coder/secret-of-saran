// Ennemis et leurs comportements.
// `hidden` : on ne peut pas le viser (sous terre, en l'air, endormi). `ghost` : il ne bouscule personne.
import { ENEMIES } from './data/enemies.js';
import { randInt, randRange } from './rng.js';
import { applyDamage, physical } from './combat.js';
import { blockedAt } from './physics.js';

export function makeEnemy(w, kind, x, y, spawn) {
  const d = ENEMIES[kind];
  const e = {
    id: w.newId(), type: 'enemy', kind, team: 'foe',
    x, y, px: x, py: y, z: 0, vx: 0, vy: 0, kx: 0, ky: 0, r: d.r ?? 6,
    fx: 1, fy: 0, dir: 3, state: 'idle', t: 0, wait: randInt(w.s, 20, 80),
    hp: d.hp, maxHp: d.hp, invul: 0, frozen: 0, cd: 0, bit: false, spawn,
    hidden: false, ghost: false, flash: 0,
  };
  if (d.ai === 'fouisseur') Object.assign(e, { state: 'under', hidden: true, ghost: true });
  if (d.boss) Object.assign(e, { state: 'sleep', hidden: true, phase: 1, act: 0 });
  return e;
}

export function wakeBoss(w, e) {
  Object.assign(e, { state: 'idle', t: 0, wait: 70, hidden: false });
  say(w, e, 'Qui piétine mes bégonias ?!');
}

function say(w, e, text) { w.emit({ type: 'say', id: e.id, text }); }

export function enemyHit(w, e, hero, mult) {
  const { amount, crit } = physical(w, ENEMIES[e.kind].str, hero, mult);
  applyDamage(w, hero, amount, { crit, from: e, kb: 2.5 });
}

// Frappe tous les héros dans un cercle (onde de choc, coup de pelle).
function blast(w, e, x, y, radius, mult) {
  for (const h of w.heroesAlive()) if (Math.hypot(h.x - x, h.y - y) < radius + h.r) enemyHit(w, e, h, mult);
}

export function updateEnemy(w, e) {
  const d = ENEMIES[e.kind];
  if (e.invul > 0) e.invul--;
  if (e.cd > 0) e.cd--;
  if (e.flash > 0) e.flash--;
  e.t++;
  if (e.frozen > 0) { e.frozen--; e.vx = e.vy = 0; e.z = 0; return; }
  if (e.state === 'hurt') {
    e.vx = e.vy = 0;
    if (e.t >= 16) { e.state = 'idle'; e.t = 0; e.wait = 10; }
    return;
  }
  BEHAVIOURS[d.ai](w, e, d, w.nearestHero(e, d.sight));
  if (e.vx) { e.fx = Math.sign(e.vx); e.dir = e.vx < 0 ? 2 : 3; }
}

const toward = (e, target, speed) => {
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dd = Math.hypot(dx, dy) || 1;
  e.vx = (dx / dd) * speed;
  e.vy = (dy / dd) * speed;
  return dd;
};

const BEHAVIOURS = {
  // Lapinfou : petits bonds, puis un bond rapide qui mord quand il est proche.
  sauteur(w, e, d, target) {
    if (e.state === 'idle') {
      e.vx = e.vy = 0;
      if (e.t < e.wait) return;
      let dx;
      let dy;
      let speed;
      if (target) {
        const tx = target.x - e.x;
        const ty = target.y - e.y;
        const dd = Math.hypot(tx, ty) || 1;
        const j = randRange(w.s, -0.35, 0.35);
        dx = (tx / dd) * Math.cos(j) - (ty / dd) * Math.sin(j);
        dy = (tx / dd) * Math.sin(j) + (ty / dd) * Math.cos(j);
        speed = dd < 50 ? 1.9 : 1.25;
      } else {
        const a = w.rand() * Math.PI * 2;
        dx = Math.cos(a);
        dy = Math.sin(a);
        speed = 0.7;
      }
      e.vx = dx * speed;
      e.vy = dy * speed;
      e.state = 'hop';
      e.t = 0;
      e.bit = false;
    } else if (e.state === 'hop') {
      const len = 22;
      e.z = Math.sin((Math.PI * e.t) / len) * 7;
      if (target && !e.bit && Math.hypot(target.x - e.x, target.y - e.y) < 12) {
        e.bit = true;
        enemyHit(w, e, target, 1);
      }
      if (e.t >= len) {
        e.state = 'idle';
        e.t = 0;
        e.z = 0;
        e.vx = e.vy = 0;
        e.wait = target ? randInt(w.s, 16, 34) : randInt(w.s, 40, 110);
      }
    }
  },

  // Champignard : avance lentement, gonfle son chapeau puis libère des spores autour de lui.
  marcheur(w, e, d, target) {
    if (e.state === 'windup') {
      e.vx = e.vy = 0;
      if (e.t >= 28) {
        w.emit({ type: 'fx', name: 'spores', x: e.x, y: e.y });
        blast(w, e, e.x, e.y, 20, 1.1);
        e.state = 'idle';
        e.t = 0;
        e.cd = 110;
      }
      return;
    }
    if (target) {
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dd = Math.hypot(dx, dy) || 1;
      if (dd < 22 && e.cd === 0) {
        e.state = 'windup';
        e.t = 0;
        e.vx = e.vy = 0;
        w.emit({ type: 'telegraph', id: e.id });
        return;
      }
      e.vx = (dx / dd) * d.speed;
      e.vy = (dy / dd) * d.speed;
    } else if (e.t % 90 === 0) {
      if (w.rand() < 0.5) {
        e.vx = e.vy = 0;
      } else {
        const a = w.rand() * Math.PI * 2;
        e.vx = Math.cos(a) * d.speed * 0.6;
        e.vy = Math.sin(a) * d.speed * 0.6;
      }
    }
    e.state = e.vx || e.vy ? 'walk' : 'idle';
  },

  // Taupinarde : file sous terre (intouchable) jusqu'à un héros, surgit, mord, replonge.
  fouisseur(w, e, d, target) {
    const go = (state, extra = {}) => Object.assign(e, { state, t: 0, vx: 0, vy: 0, ...extra });
    switch (e.state) {
      case 'under':
        if (target) {
          const dd = toward(e, target, d.speed);
          if (dd < 10 || e.t > 300) go('rise');
        } else if (e.t % 80 === 1) {
          const a = w.rand() * Math.PI * 2;
          e.vx = Math.cos(a) * d.speed * 0.5;
          e.vy = Math.sin(a) * d.speed * 0.5;
        }
        return;
      case 'rise':
        if (e.t === 1) w.emit({ type: 'telegraph', id: e.id });
        if (e.t >= 22) go('up', { hidden: false, ghost: false, cd: 12 });
        return;
      case 'idle': go('up', { t: 30 }); return; // après un coup encaissé
      case 'up':
        if (target && e.cd === 0 && Math.hypot(target.x - e.x, target.y - e.y) < 20) {
          e.fx = Math.sign(target.x - e.x) || e.fx;
          go('windup');
          return;
        }
        if (e.t >= 100) go('dig');
        return;
      case 'windup':
        if (e.t >= 16) {
          blast(w, e, e.x + e.fx * 8, e.y, 10, 1.2);
          go('up', { t: 40, cd: 50 });
        }
        return;
      case 'dig':
        if (e.t >= 16) go('under', { hidden: true, ghost: true });
    }
  },

  // Gnomard : bond écrasant, coup de pelle, jets de cailloux, et il creuse pour surgir sous
  // vos pieds. Sous la moitié de ses PV, il appelle deux Champignards et accélère.
  gnome(w, e, d, target) {
    // `pose` : ce que le rendu doit montrer pendant la récupération (coup de pelle, lancer).
    const go = (state, extra = {}) => Object.assign(e, { state, t: 0, vx: 0, vy: 0, pose: null, ...extra });
    const fast = e.phase === 2;
    const face = (t) => { if (t && t.x !== e.x) e.fx = Math.sign(t.x - e.x); };
    switch (e.state) {
      case 'sleep': e.vx = e.vy = 0; return;
      case 'idle': {
        if (e.phase === 1 && e.hp <= e.maxHp / 2) { enrage(w, e); return; }
        if (!target) { e.vx = e.vy = 0; return; }
        face(target);
        const dd = toward(e, target, 0.35); // il se dandine vers vous
        if (e.t < e.wait) return;
        e.act++;
        if (e.act % 4 === 0) { go('dig'); return; }
        const r = w.rand();
        const next = dd > 64 ? (r < 0.55 ? 'leapWind' : 'throwWind') : (r < 0.6 ? 'slamWind' : 'leapWind');
        go(next, { tx: target.x, ty: target.y });
        w.emit({ type: 'telegraph', id: e.id });
        return;
      }
      case 'leapWind':
        if (target) { e.tx = target.x; e.ty = target.y; face(target); }
        if (e.t >= (fast ? 14 : 20)) go('leap', { sx: e.x, sy: e.y, hidden: true, ghost: true });
        return;
      case 'leap': {
        const len = 40;
        const k = Math.min(1, e.t / len);
        e.x = e.sx + (e.tx - e.sx) * k;
        e.y = e.sy + (e.ty - e.sy) * k;
        e.z = Math.sin(Math.PI * k) * 34;
        if (e.t >= len) {
          e.z = 0;
          w.emit({ type: 'fx', name: 'quake', x: e.x, y: e.y });
          blast(w, e, e.x, e.y, 26, 1.3);
          go('recover', { hidden: false, ghost: false, wait: fast ? 26 : 40 });
        }
        return;
      }
      case 'slamWind':
        face(target);
        if (e.t >= (fast ? 18 : 24)) {
          w.emit({ type: 'fx', name: 'slam', x: e.x + e.fx * 16, y: e.y });
          blast(w, e, e.x + e.fx * 16, e.y, 20, 1.6);
          go('recover', { wait: fast ? 26 : 36, pose: 'slam' });
        }
        return;
      case 'throwWind':
        face(target);
        if (e.t >= 16) {
          const aim = target ?? { x: e.x + e.fx * 40, y: e.y };
          const base = Math.atan2(aim.y - e.y, aim.x - e.x);
          const spread = fast ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.28, 0, 0.28];
          for (const s of spread) {
            w.spawnProjectile({
              kind: 'caillou', owner: e.id, team: 'foe', x: e.x + e.fx * 8, y: e.y - 1,
              vx: Math.cos(base + s) * 2.1, vy: Math.sin(base + s) * 2.1, life: 110, atk: d.str, mult: 0.9,
            });
          }
          go('recover', { wait: 30, pose: 'throw' });
        }
        return;
      case 'dig':
        if (e.t >= 20) go('under', { hidden: true, ghost: true });
        return;
      case 'under':
        if (target) toward(e, target, fast ? 1.5 : 1.25);
        if (e.t >= (fast ? 55 : 75)) { go('erupt'); w.emit({ type: 'telegraph', id: e.id }); }
        return;
      case 'erupt':
        if (e.t >= 26) {
          w.emit({ type: 'fx', name: 'quake', x: e.x, y: e.y });
          blast(w, e, e.x, e.y, 22, 1.5);
          go('recover', { hidden: false, ghost: false, wait: 54 }); // le moment de cogner
        }
        return;
      case 'recover':
        if (e.t >= e.wait) go('idle', { wait: fast ? 30 : 52 });
    }
  },
};

function enrage(w, e) {
  e.phase = 2;
  say(w, e, 'Les champignons ! À moi !');
  for (const ox of [-30, 30]) {
    const free = !blockedAt(w.map, e.x + ox, e.y + 10);
    const m = makeEnemy(w, 'champignard', free ? e.x + ox : e.x, free ? e.y + 10 : e.y, null);
    m.minion = true;
    w.s.ents.push(m);
    w.emit({ type: 'fx', name: 'poof', x: m.x, y: m.y });
  }
  Object.assign(e, { state: 'recover', t: 0, wait: 40 });
}
