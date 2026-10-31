// Ennemis et leurs comportements.
import { ENEMIES } from './data/enemies.js';
import { randInt, randRange } from './rng.js';
import { applyDamage, physical } from './combat.js';

export function makeEnemy(w, kind, x, y, spawn) {
  const d = ENEMIES[kind];
  return {
    id: w.newId(), type: 'enemy', kind, team: 'foe',
    x, y, px: x, py: y, z: 0, vx: 0, vy: 0, kx: 0, ky: 0, r: 6,
    fx: 1, fy: 0, dir: 3, state: 'idle', t: 0, wait: randInt(w.s, 20, 80),
    hp: d.hp, maxHp: d.hp, invul: 0, frozen: 0, cd: 0, bit: false, spawn,
  };
}

export function enemyHit(w, e, hero, mult) {
  const { amount, crit } = physical(w, ENEMIES[e.kind].str, hero, mult);
  applyDamage(w, hero, amount, { crit, from: e, kb: 2.5 });
}

export function updateEnemy(w, e) {
  const d = ENEMIES[e.kind];
  if (e.invul > 0) e.invul--;
  if (e.cd > 0) e.cd--;
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
        for (const h of w.heroesAlive()) if (Math.hypot(h.x - e.x, h.y - e.y) < 26) enemyHit(w, e, h, 1.1);
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
};
