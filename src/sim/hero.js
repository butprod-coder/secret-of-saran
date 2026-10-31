// Héros : déplacement, jauge de charge, attaques.
import { BTN } from './input.js';
import { HEROES, statsAt } from './data/heroes.js';
import { WEAPONS, MAX_WEAPON_LV } from './data/weapons.js';
import { GEAR, START_EQUIP } from './data/equipment.js';
import { applyDamage, bodyY, gainWeaponXp, heroAttack, physical, powerMult } from './combat.js';
import { startCast, stepCast } from './magic.js';

export const DIR = { DOWN: 0, UP: 1, LEFT: 2, RIGHT: 3 };

export function makeHero(id, x, y, lv = 1) {
  const d = HEROES[id];
  const st = statsAt(id, lv);
  const e = {
    id, type: 'hero', hero: id, team: 'ally',
    x, y, px: x, py: y, z: 0, vx: 0, vy: 0, kx: 0, ky: 0, r: 6,
    fx: 0, fy: 1, dir: DIR.DOWN, state: 'idle', t: 0,
    lv, xp: 0, hp: st.hp, maxHp: st.hp, mp: st.mp, maxMp: st.mp, stats: st,
    weapon: d.weapon, wlv: 1, wxp: 0, equip: { ...START_EQUIP[id] },
    gauge: 100, charge: 0, prevHeld: 0, invul: 0, buffs: {},
    controller: 'ai', tactic: d.tactic,
    ai: { stuck: 0, detour: 0, detourSide: 1, castCd: 60, lastX: x, lastY: y },
    atk: null, cast: null, queued: null,
  };
  refreshStats(e);
  return e;
}

// Statistiques effectives = niveau + équipement. À rappeler après un niveau ou un changement d'équipement.
export function refreshStats(e) {
  const st = statsAt(e.hero, e.lv);
  e.maxHp = st.hp;
  e.maxMp = st.mp;
  for (const id of Object.values(e.equip)) {
    const g = GEAR[id];
    if (!g) continue;
    for (const k of ['str', 'def', 'mag']) st[k] += g[k] ?? 0;
  }
  e.stats = st;
  e.hp = Math.min(e.hp, e.maxHp);
  e.mp = Math.min(e.mp, e.maxMp);
}

export const maxCharge = (e) => Math.min(MAX_WEAPON_LV, e.wlv + HEROES[e.hero].chargeBonus);

// 8 directions de déplacement, 4 directions de sprite. En diagonale on garde
// la direction de sprite actuelle si elle fait partie du mouvement (pas de clignotement).
export function setFacing(e, mx, my) {
  const n = Math.hypot(mx, my) || 1;
  e.fx = mx / n;
  e.fy = my / n;
  if (mx && my) {
    const d = e.dir;
    if ((d === DIR.LEFT && mx < 0) || (d === DIR.RIGHT && mx > 0) || (d === DIR.DOWN && my > 0) || (d === DIR.UP && my < 0)) return;
  }
  if (Math.abs(mx) >= Math.abs(my) && mx) e.dir = mx < 0 ? DIR.LEFT : DIR.RIGHT;
  else e.dir = my < 0 ? DIR.UP : DIR.DOWN;
}

const isFree = (e) => e.state === 'idle' || e.state === 'walk';

export function updateHero(w, e, inp) {
  if (e.invul > 0) e.invul--;
  for (const k in e.buffs) if (e.buffs[k] > 0) e.buffs[k]--;
  const held = inp.buttons | 0;
  if (e.state === 'ko') { e.vx = e.vy = 0; e.prevHeld = held; return; }

  const wpn = WEAPONS[e.weapon];
  const pressed = held & ~e.prevHeld;
  const released = e.prevHeld & ~held;
  e.prevHeld = held;
  e.t++;

  if (e.state !== 'attack' && e.gauge < 100) e.gauge = Math.min(100, e.gauge + 100 / wpn.recovery);

  if (e.state === 'hurt') {
    if (e.t >= 16) toIdle(e);
  } else if (e.state === 'attack') {
    stepAttack(w, e, wpn);
    if (e.t >= e.atk.len) { toIdle(e); e.atk = null; }
  } else if (e.state === 'cast') {
    stepCast(w, e);
  }

  if (!isFree(e)) { e.vx = e.vy = 0; return; }
  if (e.queued) {
    const q = e.queued;
    e.queued = null;
    if (startCast(w, e, q.spell, q.target)) return;
  }

  const atkHeld = held & BTN.ATTACK;
  if (pressed & BTN.ATTACK) { startAttack(w, e, wpn, e.gauge / 100, 0); return; }
  if ((released & BTN.ATTACK) && e.charge >= 100) { startAttack(w, e, wpn, 1, Math.floor(e.charge / 100)); return; }

  // Maintenir l'attaque une fois la jauge pleine charge un coup spécial.
  if (atkHeld && e.gauge >= 100 && maxCharge(e) > 0) {
    const before = Math.floor(e.charge / 100);
    e.charge = Math.min(maxCharge(e) * 100, e.charge + (100 * HEROES[e.hero].chargeRate) / wpn.chargeTicks);
    const now = Math.floor(e.charge / 100);
    if (now > before) w.emit({ type: 'chargelvl', id: e.id, lv: now });
  } else if (!atkHeld) {
    e.charge = 0;
  }

  const run = (held & BTN.RUN) && e.charge === 0;
  const speed = HEROES[e.hero].speed * (run ? 1.5 : 1) * (e.charge > 0 ? 0.55 : 1);
  if (inp.mx || inp.my) {
    const n = inp.mx && inp.my ? Math.SQRT1_2 : 1;
    e.vx = inp.mx * speed * n;
    e.vy = inp.my * speed * n;
    setFacing(e, inp.mx, inp.my);
    e.state = 'walk';
  } else {
    e.vx = e.vy = 0;
    e.state = 'idle';
  }
}

function toIdle(e) {
  e.state = 'idle';
  e.t = 0;
}

function startAttack(w, e, wpn, power, level) {
  e.gauge = 0;
  e.charge = 0;
  e.vx = e.vy = 0;
  e.atk = { power, level, len: level ? wpn.chargedLen : wpn.swing, hits: [], fx: e.fx, fy: e.fy };
  e.state = 'attack';
  e.t = 0;
  w.emit({ type: 'swing', id: e.id, weapon: wpn.id, level, dir: e.dir, fx: e.fx, fy: e.fy });
}

function stepAttack(w, e, wpn) {
  const a = e.atk;
  const t = e.t;
  const mult = a.level ? 1 + 0.8 * a.level : powerMult(a.power);

  if (wpn.kind === 'ranged') {
    if (t !== wpn.active[0]) return;
    const spread = a.level ? [-0.3, 0, 0.3] : [0];
    for (const s of spread) {
      const c = Math.cos(s);
      const sn = Math.sin(s);
      const vx = a.fx * c - a.fy * sn;
      const vy = a.fx * sn + a.fy * c;
      w.spawnProjectile({
        kind: 'arrow', owner: e.id, team: 'ally',
        x: e.x + vx * 6, y: e.y + vy * 6,
        vx: vx * wpn.arrowSpeed, vy: vy * wpn.arrowSpeed,
        life: wpn.arrowLife, mult, atk: heroAttack(e),
      });
    }
    return;
  }

  if (a.level) {
    // Coup chargé : attaque circulaire.
    if (t < 6 || t > a.len - 4) return;
    for (const f of w.foes()) if (Math.hypot(f.x - e.x, f.y - e.y) < wpn.spinR + f.r) hit(w, e, f, mult, 3.5);
  } else if (t >= wpn.active[0] && t <= wpn.active[1]) {
    const cx = e.x + a.fx * wpn.reach;
    const cy = bodyY(e) + a.fy * wpn.reach;
    for (const f of w.foes()) if (Math.hypot(f.x - cx, bodyY(f) - cy) < wpn.hitR + f.r) hit(w, e, f, mult, 2.2);
  }
}

function hit(w, e, f, mult, kb) {
  if (e.atk.hits.includes(f.id)) return;
  e.atk.hits.push(f.id);
  const { amount, crit } = physical(w, heroAttack(e), f, mult);
  if (applyDamage(w, f, amount, { crit, from: e, kb })) gainWeaponXp(w, e);
}
