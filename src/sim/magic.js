// Sorts et objets.
import { HEROES } from './data/heroes.js';
import { SPELLS, spellKnown } from './data/spells.js';
import { ITEMS } from './data/items.js';
import { ENEMIES } from './data/enemies.js';
import { applyDamage, heal, magical } from './combat.js';

const CAST_APPLY = 22;
const CAST_LEN = 34;

export function canCast(w, e, spellId) {
  const sp = SPELLS[spellId];
  return !!sp && !!e && e.type === 'hero' && e.state !== 'ko' && HEROES[e.hero].spells.includes(spellId)
    && spellKnown(w.s.flags, spellId) && e.mp >= sp.mp;
}

// Si le lanceur est occupé (coup, recul), le sort part dès qu'il est libre.
export function startCast(w, e, spellId, targetId) {
  if (!canCast(w, e, spellId)) return false;
  if (e.state !== 'idle' && e.state !== 'walk') { e.queued = { spell: spellId, target: targetId }; return true; }
  e.mp -= SPELLS[spellId].mp;
  e.cast = { spell: spellId, target: targetId };
  e.state = 'cast';
  e.t = 0;
  e.vx = e.vy = 0;
  e.charge = 0;
  w.emit({ type: 'cast', id: e.id, spell: spellId });
  return true;
}

export function stepCast(w, e) {
  if (e.t === CAST_APPLY) applySpell(w, e, SPELLS[e.cast.spell], e.cast.target);
  if (e.t >= CAST_LEN) { e.state = 'idle'; e.t = 0; e.cast = null; }
}

function applySpell(w, e, sp, targetId) {
  let tgt = w.get(targetId);
  if (sp.target === 'foe') {
    if (!tgt || tgt.dead || tgt.hidden) tgt = w.nearestFoe(e, 200);
    if (!tgt) return;
  } else if (sp.target === 'self' || !tgt || tgt.state === 'ko') {
    tgt = e;
  }
  switch (sp.kind) {
    case 'projectile': {
      const dx = tgt.x - e.x;
      const dy = tgt.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      w.spawnProjectile({
        kind: 'feu', owner: e.id, team: 'ally',
        x: e.x + (dx / d) * 6, y: e.y + (dy / d) * 6,
        vx: (dx / d) * 2.6, vy: (dy / d) * 2.6, life: 90, homing: tgt.id,
      });
      break;
    }
    case 'area':
      w.emit({ type: 'fx', name: 'gel', x: tgt.x, y: tgt.y });
      for (const f of w.foes()) {
        if (Math.hypot(f.x - tgt.x, f.y - tgt.y) >= sp.radius) continue;
        applyDamage(w, f, magical(w, e, sp.power, f), { kind: 'magic', from: { x: tgt.x, y: tgt.y - 1 }, kb: 1 });
        if (!f.dead && !ENEMIES[f.kind].heavy) f.frozen = sp.freeze;
      }
      break;
    case 'quake':
      w.emit({ type: 'fx', name: 'seisme', x: e.x, y: e.y });
      for (const f of w.foes()) {
        if (Math.hypot(f.x - e.x, f.y - e.y) >= sp.radius + f.r) continue;
        applyDamage(w, f, magical(w, e, sp.power, f), { kind: 'magic', from: e, kb: 3 });
      }
      break;
    case 'heal':
      heal(w, tgt, sp.power + e.stats.mag * 2);
      w.emit({ type: 'fx', name: 'soin', x: tgt.x, y: tgt.y });
      break;
    case 'buff':
      tgt.buffs[sp.stat] = sp.duration;
      w.emit({ type: 'fx', name: 'bouclier', x: tgt.x, y: tgt.y, id: tgt.id });
      break;
  }
}

export function useItem(w, actor, itemId, targetId) {
  const it = ITEMS[itemId];
  if (!it || !(w.s.inventory[itemId] > 0)) return false;
  if (actor && actor.state === 'ko') return false;
  const tgt = w.get(targetId);
  if (!tgt || tgt.type !== 'hero') return false;
  if (it.target === 'ko' ? tgt.state !== 'ko' : tgt.state === 'ko') return false;

  w.s.inventory[itemId]--;
  if (it.kind === 'heal') {
    heal(w, tgt, it.amount);
  } else if (it.kind === 'mp') {
    const before = tgt.mp;
    tgt.mp = Math.min(tgt.maxMp, tgt.mp + it.amount);
    w.emit({ type: 'dmg', id: tgt.id, amount: tgt.mp - before, kind: 'mp', x: tgt.x, y: tgt.y });
  } else if (it.kind === 'revive') {
    tgt.state = 'idle';
    tgt.t = 0;
    tgt.hp = Math.max(1, Math.round(tgt.maxHp * it.amount));
    tgt.invul = 90;
    w.emit({ type: 'revive', id: tgt.id });
  }
  w.emit({ type: 'fx', name: 'soin', x: tgt.x, y: tgt.y });
  w.emit({ type: 'item', item: itemId, actor: actor?.id ?? null, target: tgt.id });
  return true;
}
