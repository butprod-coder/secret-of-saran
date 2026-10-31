// Tests de la simulation, exécutés dans le navigateur (http://localhost:8080/tests/).
import { MapData } from '../src/sim/MapData.js';
import { World } from '../src/sim/World.js';
import { BTN } from '../src/sim/input.js';
import { SAVE_VERSION, SaveError, makeSave, migrate } from '../src/save/format.js';
import { Session } from '../src/game/Session.js';
import { net } from '../src/net/Net.js';
import { HostLink } from '../src/net/HostLink.js';
import { RemoteSession } from '../src/net/RemoteSession.js';

const out = document.getElementById('out');
const results = [];
function test(name, fn) {
  try { fn(); results.push([name, true]); } catch (e) { results.push([name, false, e.message]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const mapJson = await (await fetch('../assets/maps/prairie.tmj')).json();
const map = MapData.fromTiled('prairie', mapJson);
const run = (w, n, inputs = {}) => { for (let i = 0; i < n; i++) w.step(inputs); };
const playerWorld = (seed = 42) => {
  const w = new World({ map, seed });
  w.setController('gus', 'p0');
  return w;
};

test('la carte Tiled est lue (taille, départ, apparitions, panneaux)', () => {
  assert(map.width === 50 && map.height === 34, 'taille inattendue');
  assert(map.spawns.length === 9, 'apparitions : ' + map.spawns.length);
  assert(map.signs.length === 3, 'panneaux : ' + map.signs.length);
  assert(!map.isSolidAt(map.start.x, map.start.y), 'le départ est dans un mur');
});

test("l'eau bloque les héros mais pas les flèches", () => {
  const x = 31 * 16 + 8;
  const y = 5 * 16 + 8;
  assert(map.isSolidAt(x, y), "l'eau devrait bloquer");
  assert(!map.blocksProjectileAt(x, y), "l'eau ne devrait pas arrêter un projectile");
});

test('les murs arrêtent le héros', () => {
  const w = playerWorld();
  const gus = w.get('gus');
  run(w, 600, { gus: { mx: 0, my: -1, buttons: 0 } });
  assert(gus.y > 16 * 2, 'Gus est sorti par le haut : y=' + gus.y);
});

test('la jauge tombe à 0 après un coup puis remonte à 100 %', () => {
  const w = playerWorld();
  const gus = w.get('gus');
  w.step({ gus: { mx: 0, my: 0, buttons: BTN.ATTACK } });
  assert(gus.state === 'attack' && gus.gauge === 0, 'pas d\'attaque');
  run(w, 120);
  assert(gus.gauge === 100, 'jauge : ' + gus.gauge);
});

test('maintenir l\'attaque charge un coup spécial de niveau 2 pour Gus', () => {
  const w = playerWorld();
  const gus = w.get('gus');
  run(w, 200, { gus: { mx: 0, my: 0, buttons: BTN.ATTACK } });
  assert(gus.charge === 200, 'charge : ' + gus.charge);
  w.step({ gus: { mx: 0, my: 0, buttons: 0 } });
  assert(gus.state === 'attack' && gus.atk.level === 2, 'pas de coup chargé');
});

test("un coup à pleine jauge tue un Lapinfou affaibli et rapporte de l'expérience", () => {
  const w = playerWorld();
  const gus = w.get('gus');
  const lapin = w.foes().find((f) => f.kind === 'lapinfou');
  lapin.x = gus.x + 12;
  lapin.y = gus.y;
  lapin.hp = 5;
  lapin.wait = 9999;
  w.step({ gus: { mx: 0, my: 0, buttons: 0 } });
  run(w, 10, { gus: { mx: 1, my: 0, buttons: 0 } });
  gus.x = lapin.x - 12; gus.y = lapin.y; gus.gauge = 100;
  w.step({ gus: { mx: 0, my: 0, buttons: BTN.ATTACK } });
  run(w, 20);
  assert(!w.get(lapin.id), 'le Lapinfou est toujours là');
  assert(gus.xp > 0 || gus.lv > 1, 'pas d\'expérience');
});

test('la simulation est déterministe (même graine, mêmes entrées)', () => {
  const a = playerWorld(7);
  const b = playerWorld(7);
  const script = (i) => ({ gus: { mx: i % 200 < 100 ? 1 : -1, my: i % 70 < 35 ? 0 : 1, buttons: i % 40 === 0 ? BTN.ATTACK : 0 } });
  for (let i = 0; i < 3000; i++) { a.step(script(i)); b.step(script(i)); }
  assert(JSON.stringify(a.s) === JSON.stringify(b.s), 'états différents');
});

test("l'état du monde survit à un aller-retour JSON", () => {
  const a = playerWorld(3);
  run(a, 500);
  const b = new World({ map, state: JSON.parse(JSON.stringify(a.s)) });
  run(a, 500);
  run(b, 500);
  assert(JSON.stringify(a.s) === JSON.stringify(b.s), 'divergence après rechargement');
});

test('Lorenzo soigne un allié blessé', () => {
  const w = new World({ map, seed: 5 });
  const gus = w.get('gus');
  gus.hp = 10;
  run(w, 200);
  assert(gus.hp > 10, 'Gus n\'a pas été soigné : ' + gus.hp);
});

test("une Chocolatine ne relève pas un K.O., le Verre de l'amitié si", () => {
  const w = playerWorld();
  const kar = w.get('karonux');
  w.knockOut(kar);
  w.step({}, [{ type: 'item', actor: 'gus', item: 'chocolatine', target: 'karonux' }]);
  assert(kar.state === 'ko', 'une chocolatine ne relève pas');
  w.step({}, [{ type: 'item', actor: 'gus', item: 'amitie', target: 'karonux' }]);
  assert(kar.state !== 'ko' && kar.hp > 0, 'pas relevé');
  assert(w.s.inventory.amitie === 0, 'objet non consommé');
});

// --- Jalon 4 : équipement, coffres, cartes, sauvegardes -----------------------
const clairiere = MapData.fromTiled('clairiere', await (await fetch('../assets/maps/clairiere.tmj')).json());

test("équiper une pièce change la défense et la retire du sac", () => {
  const w = playerWorld();
  const gus = w.get('gus');
  const before = gus.stats.def;
  assert(w.s.gear.bandana === 1, 'bandana absent du sac de départ');
  assert(w.command({ type: 'equip', hero: 'gus', slot: 'head', gear: 'bandana' }), 'équipement refusé');
  assert(gus.stats.def === before + 2 && w.s.gear.bandana === 0, 'déf ' + gus.stats.def);
  assert(!w.command({ type: 'equip', hero: 'karonux', slot: 'head', gear: 'bandana' }), 'le sac était vide');
  w.command({ type: 'equip', hero: 'gus', slot: 'head', gear: null });
  assert(gus.stats.def === before && w.s.gear.bandana === 1, 'retrait mal fait');
  w.s.gear.cotte = 1;
  assert(!w.command({ type: 'equip', hero: 'karonux', slot: 'body', gear: 'cotte' }), 'Karonux ne porte pas la cotte');
});

test("un coffre s'ouvre une seule fois et donne son contenu", () => {
  const w = playerWorld();
  const gus = w.get('gus');
  const c = map.chests.find((ch) => ch.item === 'gants');
  assert(c, 'coffre aux gants introuvable');
  assert(!w.command({ type: 'open', actor: 'gus', chest: c.key }), 'ouvert de loin');
  gus.x = c.x; gus.y = c.y - 14;
  assert(w.command({ type: 'open', actor: 'gus', chest: c.key }), 'pas ouvert');
  assert(w.s.gear.gants === 1 && w.s.flags[c.key], 'contenu ou drapeau manquant');
  assert(!w.command({ type: 'open', actor: 'gus', chest: c.key }) && w.s.gear.gants === 1, 'ouvert deux fois');
});

test('une sortie mène à la clairière et le groupe garde ses progrès', () => {
  const w = playerWorld();
  const gus = w.get('gus');
  const wp = map.warps[0];
  assert(wp && wp.map === 'clairiere' && clairiere.entries[wp.entry], 'sortie ou entrée manquante');
  gus.lv = 5; w.s.gold = 77; w.s.flags['prairie:1'] = true;
  gus.x = wp.x + 2; gus.y = wp.y + 8;
  w.step({ gus: { mx: 1, my: 0, buttons: 0 } });
  assert(w.s.warp?.map === 'clairiere', 'sortie non déclenchée');
  const tick = w.s.tick;
  w.step({});
  assert(w.s.tick === tick, 'le monde devrait être figé');
  const w2 = World.fromSave({ map: clairiere, game: w.toSave(), entry: wp.entry });
  const g2 = w2.get('gus');
  const e = clairiere.entries[wp.entry];
  assert(Math.hypot(g2.x - e.x, g2.y - e.y) < 1, 'pas à l\'entrée');
  assert(g2.lv === 5 && w2.s.gold === 77 && w2.s.flags['prairie:1'], 'progrès perdus');
  assert(w2.foes().every((f) => Math.hypot(f.x - e.x, f.y - e.y) > 64), 'ennemi sur l\'entrée');
});

test('la sauvegarde fait un aller-retour JSON et reprend au même endroit', () => {
  const w = playerWorld(9);
  run(w, 400, { gus: { mx: 1, my: 0, buttons: 0 } });
  w.command({ type: 'equip', hero: 'lorenzo', slot: 'head', gear: 'bandana' });
  const save = migrate(JSON.stringify(makeSave(w, map.name)));
  const w2 = World.fromSave({ map, game: save.game });
  const a = w.get('lorenzo');
  const b = w2.get('lorenzo');
  assert(b.equip.head === 'bandana' && b.stats.def === a.stats.def, 'équipement perdu');
  assert(Math.hypot(w2.get('gus').x - w.get('gus').x, w2.get('gus').y - w.get('gus').y) < 1, 'position perdue');
  assert(w2.s.clock === w.s.clock && w2.s.rng === w.s.rng, 'horloge ou graine perdue');
});

test('les sauvegardes invalides ou trop récentes sont refusées', () => {
  const good = makeSave(playerWorld(), map.name);
  const refuse = (d, why) => { let ok = false; try { migrate(d); } catch (e) { ok = e instanceof SaveError; } assert(ok, why); };
  refuse('{pas du json', 'JSON cassé accepté');
  refuse({ format: 'autre', version: 1 }, 'autre format accepté');
  refuse({ ...good, version: SAVE_VERSION + 1 }, 'version future acceptée');
  refuse({ ...good, game: { ...good.game, gold: -5 } }, 'or négatif accepté');
  refuse({ ...good, game: { ...good.game, heroes: { bob: { lv: 1 } } } }, 'héros inconnu accepté');
  assert(migrate(good).game.gold === good.game.gold, 'sauvegarde valide refusée');
});

// --- Jalon 5 : protocole hôte / invité, sans réseau (messages capturés) ---------
{
  const maps = { prairie: mapJson, clairiere: await (await fetch('../assets/maps/clairiere.tmj')).json() };
  const loadMap = (id) => maps[id];
  const sent = [];
  // Remplace l'envoi réseau : on garde les messages, passés par JSON comme sur le fil.
  const wire = (m) => JSON.parse(JSON.stringify(m));
  Object.assign(net, {
    code: 'TEST',
    conns: new Map([['peerA', {}]]),
    sendTo: (to, m) => sent.push({ to, m: wire(m) }),
    broadcast: (m) => sent.push({ to: '*', m: wire(m) }),
    kick: () => {},
    sendToHost: (m) => sent.push({ to: 'host', m: wire(m) }),
  });
  const last = (t, to) => [...sent].reverse().find((x) => x.m.t === t && (!to || x.to === to))?.m;

  test("l'hôte accueille un invité, applique ses entrées et lui envoie l'état", () => {
    const s = new Session({ loadMap, seed: 4 });
    const link = new HostLink(s);
    link.onGuestMessage('peerA', { t: 'hello', token: 'tokA' });
    const p = s.players.find((q) => q.remote === 'peerA');
    assert(p && p.hero === 'karonux', 'invité non placé sur Karonux');
    assert(last('welcome', 'peerA')?.id === p.id, 'pas de welcome');
    const kar = s.world.get('karonux');
    const x0 = kar.x;
    link.onGuestMessage('peerA', { t: 'in', mx: -1, my: 0, b: 0 });
    for (let i = 0; i < 30; i++) s.update(1000 / 60, { merged: () => ({ held: {}, pressed: {}, repeat: {}, mx: 0, my: 0 }) });
    assert(kar.x < x0 - 10, "Karonux n'a pas bougé : " + (kar.x - x0));
    link.lastSent = 0;
    link.update();
    const snap = last('snap', '*');
    assert(snap && snap.roster.some((r) => r.id === p.id && r.hero === 'karonux'), 'instantané incomplet');
    assert(snap.s.ents.find((e) => e.id === 'karonux').ai === null, "la mémoire de l'IA devrait être retirée");
  });

  test("l'hôte refuse les commandes faites au nom d'un autre héros", () => {
    const s = new Session({ loadMap, seed: 4 });
    const link = new HostLink(s);
    link.onGuestMessage('peerA', { t: 'hello', token: 'tokB' });
    const gus = s.world.get('gus');
    gus.hp = 10;
    link.onGuestMessage('peerA', { t: 'cmd', c: { type: 'item', actor: 'gus', item: 'chocolatine', target: 'gus' } });
    link.onGuestMessage('peerA', { t: 'cmd', c: { type: 'hack', actor: 'karonux' } });
    assert(s.commands.length === 0, 'commande acceptée');
    link.onGuestMessage('peerA', { t: 'cmd', c: { type: 'item', actor: 'karonux', item: 'chocolatine', target: 'gus' } });
    assert(s.commands.length === 1, 'commande légitime refusée');
  });

  test('un invité coupé repasse sous IA puis retrouve son héros avec le même jeton', () => {
    const s = new Session({ loadMap, seed: 4 });
    const link = new HostLink(s);
    link.onGuestMessage('peerA', { t: 'hello', token: 'tokC' });
    const hero = s.players[1].hero;
    link.onGuestLeave('peerA');
    assert(s.world.get(hero).controller === 'ai' && s.players[1].lostSince != null, "pas repassé sous IA");
    link.onGuestMessage('peerB', { t: 'hello', token: 'tokC' });
    assert(s.players.length === 2 && s.players[1].remote === 'peerB' && s.players[1].hero === hero, 'héros non rendu');
    assert(s.world.get(hero).controller === 'p1', 'contrôle non rendu');
  });

  test("une sauvegarde co-op rend son héros à l'invité, et refuse un 4e joueur", () => {
    const s = new Session({ loadMap, seed: 4 });
    const link = new HostLink(s, { tokD: 'lorenzo' });
    link.onGuestMessage('peerA', { t: 'hello', token: 'tokD' });
    assert(s.players[1].hero === 'lorenzo', 'héros réservé ignoré : ' + s.players[1].hero);
    link.onGuestMessage('peerB', { t: 'hello', token: 'tokE' });
    link.onGuestMessage('peerC', { t: 'hello', token: 'tokF' });
    assert(s.players.length === 3 && last('refused', 'peerC'), '4e joueur accepté');
    const save = migrate(JSON.stringify(makeSave(s.world, 'x', { code: 'ABCD', guests: link.reservations() })));
    assert(save.coop.code === 'ABCD' && save.coop.guests.tokD === 'lorenzo', 'infos co-op perdues');
  });

  test("l'invité affiche l'état reçu, suit son héros et envoie ses entrées", () => {
    const s = new Session({ loadMap, seed: 4 });
    const link = new HostLink(s);
    link.onGuestMessage('peerA', { t: 'hello', token: 'tokG' });
    const welcome = last('welcome', 'peerA');
    const r = new RemoteSession({ loadMap, selfId: welcome.id, snap: last('snap', 'peerA') });
    assert(r.players[0].hero === 'karonux' && r.map.id === 'prairie', 'invité mal initialisé');
    assert(r.playerOf('gus')?.slot === 0, "le HUD ne sait pas que Gus est J1");
    const fakeInput = { merged: () => ({ held: { attack: false }, pressed: {}, repeat: {}, mx: 1, my: 0 }) };
    r.update(16, fakeInput);
    const inp = last('in', 'host');
    assert(inp && inp.mx === 1, "entrée non envoyée");
    // Changement de carte côté hôte : l'invité doit reconstruire sa carte.
    s.changeMap('clairiere', 'ouest');
    link.lastSent = 0;
    link.update();
    r.onHostMessage(last('snap', '*'));
    assert(r.map.id === 'clairiere' && r.mapChanged, "changement de carte non suivi");
    r.onHostMessage({ t: 'pong', ts: performance.now() - 42 });
    assert(r.ping >= 42, 'ping non mesuré');
  });
  net.reset();
}

const failed = results.filter((r) => !r[1]).length;
out.innerHTML = results.map(([n, ok, msg]) => `<div class="${ok ? 'ok' : 'ko'}">${ok ? 'OK ' : 'ÉCHEC '} ${n}${msg ? ' : ' + msg : ''}</div>`).join('')
  + `<p>${results.length - failed}/${results.length} réussis</p>`;
window.testResults = { total: results.length, failed };
