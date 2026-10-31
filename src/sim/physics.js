// Déplacements et collisions. La position (x, y) d'un corps est celle de ses pieds ;
// sa boîte de collision fait 10 x 6 px autour de ce point.
const HW = 5;
const HH = 3;

export function blockedAt(map, x, y) {
  return (
    map.isSolidAt(x - HW, y - HH) ||
    map.isSolidAt(x + HW - 0.01, y - HH) ||
    map.isSolidAt(x - HW, y + HH - 0.01) ||
    map.isSolidAt(x + HW - 0.01, y + HH - 0.01)
  );
}

// Déplace sur chaque axe séparément pour glisser le long des murs.
// Quand un déplacement droit est bloqué par un coin, on « contourne » de quelques pixels.
export function moveBody(map, e, dx, dy) {
  let moved = false;
  if (dx) {
    if (!blockedAt(map, e.x + dx, e.y)) { e.x += dx; moved = true; }
    else if (!dy) moved = nudge(map, e, dx, 0);
  }
  if (dy) {
    if (!blockedAt(map, e.x, e.y + dy)) { e.y += dy; moved = true; }
    else if (!dx) moved = nudge(map, e, 0, dy) || moved;
  }
  return moved;
}

function nudge(map, e, dx, dy) {
  for (let off = 1; off <= 6; off++) {
    for (const side of [-1, 1]) {
      const ox = dx ? 0 : side * off;
      const oy = dy ? 0 : side * off;
      if (!blockedAt(map, e.x + ox + dx, e.y + oy + dy)) {
        const sx = Math.sign(ox) * 0.75;
        const sy = Math.sign(oy) * 0.75;
        if (!blockedAt(map, e.x + sx, e.y + sy)) { e.x += sx; e.y += sy; return true; }
      }
    }
  }
  return false;
}

// Écarte les corps qui se chevauchent. Les alliés se traversent entre eux (comme dans Mana).
export function separate(map, ents) {
  // `ghost` : ennemi sous terre ou en plein saut, qu'on ne bouscule pas.
  const bodies = ents.filter((e) => (e.type === 'hero' || e.type === 'enemy') && !e.dead && !e.ghost && e.state !== 'ko');
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.type === 'hero' && b.type === 'hero') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d >= min) continue;
      const nx = d > 0.001 ? dx / d : 1;
      const ny = d > 0.001 ? dy / d : 0;
      const push = (min - d) * 0.25;
      moveBody(map, a, -nx * push, -ny * push);
      moveBody(map, b, nx * push, ny * push);
    }
  }
}
