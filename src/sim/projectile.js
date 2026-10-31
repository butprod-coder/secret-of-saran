// Flèches, boules de feu et cailloux de Gnomard. Ils passent au-dessus de l'eau mais pas des murs.
import { SPELLS } from './data/spells.js';
import { applyDamage, gainWeaponXp, magical, physical } from './combat.js';

export function updateProjectile(w, p) {
  if (p.homing) {
    const t = w.get(p.homing);
    if (t && !t.dead) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.hypot(p.vx, p.vy);
      p.vx += ((dx / d) * sp - p.vx) * 0.12;
      p.vy += ((dy / d) * sp - p.vy) * 0.12;
    }
  }
  p.x += p.vx;
  p.y += p.vy;
  p.life--;
  if (p.life <= 0 || w.map.blocksProjectileAt(p.x, p.y)) {
    p.dead = true;
    w.emit({ type: 'fx', name: p.kind === 'feu' ? 'flamme' : 'poof', x: p.x, y: p.y });
    return;
  }
  const targets = p.team === 'ally' ? w.foes() : w.heroesAlive();
  for (const t of targets) {
    if (Math.hypot(t.x - p.x, t.y - p.y) >= t.r + 5) continue;
    const owner = w.get(p.owner);
    if (p.kind === 'caillou') {
      const { amount, crit } = physical(w, p.atk, t, p.mult);
      applyDamage(w, t, amount, { crit, from: p, kb: 1.6 });
    } else if (p.kind === 'arrow') {
      const { amount, crit } = physical(w, p.atk, t, p.mult);
      if (applyDamage(w, t, amount, { crit, from: p, kb: 1.6 }) && owner) gainWeaponXp(w, owner);
    } else if (p.kind === 'feu') {
      const caster = owner ?? { stats: { mag: 0 } };
      applyDamage(w, t, magical(w, caster, SPELLS.feu.power, t), { kind: 'magic', from: p, kb: 2 });
      w.emit({ type: 'fx', name: 'flamme', x: p.x, y: p.y });
    }
    p.dead = true;
    return;
  }
}
