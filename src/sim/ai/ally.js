// IA des compagnons. Elle produit exactement la même entrée qu'un joueur
// (direction + boutons), plus éventuellement une commande (sort).
import { BTN } from '../input.js';
import { HEROES } from '../data/heroes.js';
import { WEAPONS } from '../data/weapons.js';
import { SPELLS } from '../data/spells.js';
import { blockedAt } from '../physics.js';
import { setFacing } from '../hero.js';

const LEASH = 240; // au-delà, le compagnon rejoint le groupe hors champ

export function allyThink(w, e) {
  const out = { mx: 0, my: 0, buttons: 0, cmd: null };
  if (e.state === 'ko') return out;
  const ai = e.ai;
  const d = HEROES[e.hero];
  const wpn = WEAPONS[e.weapon];
  if (ai.castCd > 0) ai.castCd--;

  const leader = w.leader();
  const anchor = leader && leader !== e ? leader : e;
  if (anchor !== e && Math.hypot(anchor.x - e.x, anchor.y - e.y) > LEASH) {
    teleportNear(w, e, anchor);
    return out;
  }
  const free = e.state === 'idle' || e.state === 'walk';

  // 1. Soigner un allié en difficulté passe avant tout.
  if (free && d.spells.includes('soin') && ai.castCd === 0 && e.mp >= SPELLS.soin.mp) {
    const hurt = w.heroesAlive()
      .filter((h) => h.hp / h.maxHp < 0.5)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      ai.castCd = 150;
      out.cmd = { type: 'cast', actor: e.id, spell: 'soin', target: hurt.id };
      return out;
    }
  }

  // 2. Choisir une cible selon la tactique.
  const tac = e.tactic;
  const engage = tac === 'agressif' ? 110 : tac === 'defensif' ? 56 : 0;
  let target = null;
  let best = Infinity;
  for (const f of w.foes()) {
    const fromAnchor = Math.hypot(f.x - anchor.x, f.y - anchor.y);
    const fromSelf = Math.hypot(f.x - e.x, f.y - e.y);
    const ok = engage ? fromAnchor < engage : fromSelf < 18;
    if (ok && fromSelf < best) { best = fromSelf; target = f; }
  }

  // 3. Le mage lance parfois une boule de feu (en gardant une réserve s'il est prudent).
  if (target && free && d.spells.includes('feu') && tac !== 'suivre' && ai.castCd === 0) {
    const reserve = tac === 'agressif' ? 0 : 8;
    if (e.mp >= SPELLS.feu.mp + reserve && w.rand() < (tac === 'agressif' ? 0.03 : 0.012)) {
      ai.castCd = 140;
      out.cmd = { type: 'cast', actor: e.id, spell: 'feu', target: target.id };
      return out;
    }
  }

  if (target) {
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dd = Math.hypot(dx, dy) || 1;
    const want = wpn.kind === 'ranged' ? 64 : wpn.reach + 2;
    if (wpn.kind === 'ranged' && dd < 34) steer(w, e, -dx, -dy, out);
    else if (dd > want) steer(w, e, dx, dy, out);
    // Comme dans Mana, l'IA attend une jauge pleine avant de frapper.
    if (free && dd < want + 10 && e.gauge >= 100 && !(e.prevHeld & BTN.ATTACK)) {
      setFacing(e, dx / dd, dy / dd);
      out.buttons |= BTN.ATTACK;
    }
    return out;
  }

  // 4. Suivre le meneur, chacun à sa place derrière lui.
  if (anchor !== e) {
    const followers = w.heroes().filter((h) => h !== anchor);
    const side = followers.indexOf(e) === 0 ? 12 : -12;
    const tx = anchor.x - anchor.fx * 18 - anchor.fy * side;
    const ty = anchor.y - anchor.fy * 18 + anchor.fx * side;
    const dx = tx - e.x;
    const dy = ty - e.y;
    const dd = Math.hypot(dx, dy);
    if (dd > 10) {
      steer(w, e, dx, dy, out);
      if (dd > 64) out.buttons |= BTN.RUN;
    }
  }
  return out;
}

const snap = (v) => (v > 0.38 ? 1 : v < -0.38 ? -1 : 0);

// Direction vers la cible, avec un détour de 90° quand le compagnon reste coincé.
function steer(w, e, dx, dy, out) {
  const ai = e.ai;
  let ang = Math.atan2(dy, dx);
  if (ai.detour > 0) {
    ai.detour--;
    ang += (ai.detourSide * Math.PI) / 2;
  }
  out.mx = snap(Math.cos(ang));
  out.my = snap(Math.sin(ang));
  const moved = Math.hypot(e.x - ai.lastX, e.y - ai.lastY);
  ai.lastX = e.x;
  ai.lastY = e.y;
  if (moved < 0.2) {
    if (++ai.stuck > 12) {
      ai.stuck = 0;
      ai.detour = 24;
      ai.detourSide = w.rand() < 0.5 ? -1 : 1;
    }
  } else {
    ai.stuck = 0;
  }
}

function teleportNear(w, e, anchor) {
  const spots = [[-anchor.fx * 16, -anchor.fy * 16], [-14, 0], [14, 0], [0, -14], [0, 14], [0, 0]];
  for (const [ox, oy] of spots) {
    const x = anchor.x + ox;
    const y = anchor.y + oy;
    if (!blockedAt(w.map, x, y)) {
      e.x = e.px = x;
      e.y = e.py = y;
      e.kx = e.ky = 0;
      w.emit({ type: 'fx', name: 'poof', x, y });
      return;
    }
  }
}
