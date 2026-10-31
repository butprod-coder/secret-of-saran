// Formules de dégâts et application des coups.
import { WEAPONS, weaponXpToNext, MAX_WEAPON_LV } from './data/weapons.js';
import { ENEMIES } from './data/enemies.js';

export const bodyY = (e) => e.y - 7; // centre du corps, au-dessus des pieds
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function heroAttack(e) {
  const w = WEAPONS[e.weapon];
  return e.stats.str + w.power * (1 + 0.15 * (e.wlv - 1));
}

export function defenseOf(e) {
  if (e.type === 'hero') return e.stats.def * (e.buffs.def > 0 ? 1.6 : 1);
  return ENEMIES[e.kind].def;
}

// Comme dans Secret of Mana : frapper avant que la jauge soit pleine fait peu de dégâts.
export function powerMult(power) {
  return power >= 1 ? 1 : 0.12 + 0.88 * power * power;
}

export function physical(w, atk, target, mult) {
  const crit = w.rand() < 0.06;
  const raw = atk * mult * (0.9 + 0.2 * w.rand()) * (crit ? 1.5 : 1) - defenseOf(target) * 0.5;
  return { amount: Math.max(1, Math.round(raw)), crit };
}

export function magical(w, caster, power, target) {
  const raw = (power + caster.stats.mag * 1.5) * (0.9 + 0.2 * w.rand()) - defenseOf(target) * 0.25;
  return Math.max(1, Math.round(raw));
}

export function applyDamage(w, target, amount, { kind = 'phys', crit = false, from = null, kb = 2 } = {}) {
  if (target.dead || target.state === 'ko' || target.invul > 0) return false;
  target.hp = Math.max(0, target.hp - amount);
  w.emit({ type: 'dmg', id: target.id, amount, kind, crit, x: target.x, y: target.y });
  if (from) {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    target.kx += (dx / d) * kb;
    target.ky += (dy / d) * kb;
  }
  if (target.type === 'hero') {
    target.invul = 45;
    if (target.hp === 0) w.knockOut(target);
    else if (target.state !== 'cast') { target.state = 'hurt'; target.t = 0; target.charge = 0; target.atk = null; }
  } else {
    target.invul = 8;
    if (target.hp === 0) w.killEnemy(target);
    else { target.state = 'hurt'; target.t = 0; target.z = 0; }
  }
  return true;
}

export function heal(w, target, amount) {
  if (target.dead || target.state === 'ko') return;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + Math.round(amount));
  w.emit({ type: 'dmg', id: target.id, amount: target.hp - before, kind: 'heal', x: target.x, y: target.y });
}

export function gainWeaponXp(w, hero) {
  if (hero.wlv >= MAX_WEAPON_LV) return;
  hero.wxp++;
  if (hero.wxp >= weaponXpToNext(hero.wlv)) {
    hero.wxp = 0;
    hero.wlv++;
    w.emit({ type: 'wlvl', id: hero.id, weapon: hero.weapon, lv: hero.wlv });
  }
}
