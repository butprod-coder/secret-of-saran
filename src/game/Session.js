// Une partie locale : possède le monde, fait avancer la simulation à pas fixe et
// relie les joueurs locaux (clavier, manettes) à leurs héros. En ligne, l'hôte
// utilisera la même classe et recevra en plus les entrées des clients.
import { STEP_MS } from '../config.js';
import { BTN } from '../sim/input.js';
import { MapData } from '../sim/MapData.js';
import { World } from '../sim/World.js';
import { HEROES, HERO_ORDER } from '../sim/data/heroes.js';

const MAX_PLAYERS = 3;
const LOST_GRACE_MS = 30000;

export class Session {
  // loadMap(id) renvoie le JSON Tiled d'une carte. `save` (déjà migrée) reprend une partie.
  constructor({ loadMap, mapId = 'prairie', seed = 1, save = null }) {
    this.loadMap = loadMap;
    this.mapCache = new Map();
    if (save) {
      this.map = this.mapData(save.game.mapId);
      this.world = World.fromSave({ map: this.map, game: save.game });
    } else {
      this.map = this.mapData(mapId);
      this.world = new World({ map: this.map, seed });
    }
    this.acc = 0;
    this.paused = false;
    this.commands = [];
    this.events = [];
    this.notices = [];
    this.players = [];
    this.addPlayer(['kb'], 'gus');
  }

  get alpha() { return this.acc / STEP_MS; }

  mapData(id) {
    if (!this.mapCache.has(id)) this.mapCache.set(id, MapData.fromTiled(id, this.loadMap(id)));
    return this.mapCache.get(id);
  }

  // Sortie empruntée pendant le dernier pas (le monde est figé en attendant).
  get pendingWarp() { return this.world.s.warp; }

  // Passe sur une autre carte : le groupe est conservé, les ennemis repartent de zéro.
  // Les joueurs locaux gardent leur héros et leur manette.
  changeMap(mapId, entry) {
    const game = this.world.toSave();
    this.map = this.mapData(mapId);
    this.world = World.fromSave({ map: this.map, game, entry });
    this.acc = 0;
    this.commands = [];
    this.events = [];
    this.players.forEach((p, i) => {
      if (p.lostSince == null) this.world.setController(p.hero, 'p' + i);
      p.suppress = BTN.ATTACK;
    });
  }

  addPlayer(devices, heroId) {
    const p = { slot: this.players.length, devices: new Set(devices), hero: heroId, suppress: 0 };
    this.players.push(p);
    this.world.setController(heroId, 'p' + p.slot);
    return p;
  }

  playerOf(heroId) { return this.players.find((p) => p.hero === heroId) ?? null; }

  // Joueurs locaux à conserver quand on recharge une partie (scène relancée).
  playersSnapshot() {
    return this.players.filter((p) => p.lostSince == null).map((p) => ({ devices: [...p.devices], hero: p.hero, padName: p.padName }));
  }

  restorePlayers(list = []) {
    list.forEach((pl, i) => {
      if (i === 0) {
        const p0 = this.players[0];
        for (const d of pl.devices) p0.devices.add(d);
        p0.padName = pl.padName;
        if (pl.hero !== p0.hero) {
          this.world.setController(p0.hero, 'ai');
          p0.hero = pl.hero;
          this.world.setController(pl.hero, 'p0');
        }
      } else if (!this.playerOf(pl.hero)) {
        this.addPlayer(pl.devices, pl.hero).padName = pl.padName;
      }
    });
    for (const p of this.players) p.suppress = BTN.ATTACK;
  }

  // Branche les manettes : la première rejoint le joueur 1, les suivantes créent les
  // joueurs 2 et 3, qui reprennent un héros jusque-là contrôlé par l'IA. Une manette
  // perdue (Bluetooth en veille, piles) laisse son héros à l'IA mais garde la place du
  // joueur pendant LOST_GRACE_MS : la même manette rallumée la récupère sans rien faire.
  updatePlayers(input, now = performance.now()) {
    for (const ev of input.drainPadEvents()) {
      if (ev.type === 'connect') this.notices.push(`Manette détectée : ${ev.name}`);
    }
    const hasPad = (p) => [...p.devices].some((d) => d.startsWith('pad'));

    for (const p of this.players) {
      for (const d of [...p.devices]) {
        if (d === 'kb' || input.device(d)) continue;
        p.devices.delete(d);
        if (p.slot === 0) { this.notices.push('J1 : manette déconnectée, le clavier reste actif'); continue; }
        p.lostSince = now;
        this.world.setController(p.hero, 'ai');
        this.notices.push(`J${p.slot + 1} : manette perdue, ${HEROES[p.hero].name} passe sous IA`);
      }
    }
    for (const p of [...this.players]) {
      if (p.lostSince == null || now - p.lostSince < LOST_GRACE_MS) continue;
      this.players.splice(this.players.indexOf(p), 1);
      this.notices.push(`J${p.slot + 1} a quitté la partie`);
    }

    const owned = new Set(this.players.flatMap((p) => [...p.devices]));
    for (const id of input.padIds()) {
      if (owned.has(id)) continue;
      const dev = input.device(id);
      // Même modèle qu'une manette perdue : on la rend à son joueur sans attendre un bouton.
      const back = this.players.find((p) => !hasPad(p) && p.padName === dev.name && (p.slot === 0 || p.lostSince != null));
      if (back) {
        back.devices.add(id);
        back.lostSince = null;
        back.suppress = BTN.ATTACK;
        this.notices.push(`J${back.slot + 1} a retrouvé sa manette`);
      } else if (dev.any) {
        const p1 = this.players[0];
        if (!hasPad(p1)) {
          p1.devices.add(id);
          p1.padName = dev.name;
        } else if (this.players.length < MAX_PLAYERS) {
          const hero = this.freeHeroes()[0];
          if (!hero) continue;
          const p = this.addPlayer([id], hero.id);
          p.padName = dev.name;
          p.suppress = BTN.ATTACK;
          this.notices.push(`Joueur ${p.slot + 1} : ${HEROES[hero.id].name}`);
        } else continue;
      } else continue;
      owned.add(id);
    }

    this.players.forEach((p, i) => {
      p.slot = i;
      if (p.lostSince != null) return;
      if (this.world.get(p.hero).controller !== 'p' + i) this.world.setController(p.hero, 'p' + i);
    });
  }

  rumble(heroId, input, strong, weak, ms) {
    const p = this.playerOf(heroId);
    if (p) input.rumble([...p.devices], strong, weak, ms);
  }

  freeHeroes() {
    return this.world.heroes().filter((h) => !this.playerOf(h.id) && h.state !== 'ko');
  }

  // Bascule vers le héros suivant libre ; l'ancien repasse sous IA.
  switchHero(p) {
    const ids = HERO_ORDER;
    const start = ids.indexOf(p.hero);
    for (let k = 1; k < ids.length; k++) {
      const id = ids[(start + k) % ids.length];
      const h = this.world.get(id);
      if (!h || h.state === 'ko' || this.playerOf(id)) continue;
      this.world.setController(p.hero, 'ai');
      p.hero = id;
      this.world.setController(id, 'p' + p.slot);
      p.suppress = BTN.ATTACK;
      return true;
    }
    return false;
  }

  // Commandes appliquées au prochain pas (objets, sorts) ou tout de suite (réglages comme
  // la tactique, utiles même jeu en pause). En ligne, les deux passeront par l'hôte.
  queueCommand(c) { this.commands.push(c); }
  applyNow(c) { return this.world.command(c); }

  update(dtMs, input, blockedPlayers = new Set()) {
    if (this.paused) return;
    this.acc += Math.min(dtMs, 100);
    const inputs = {};
    for (const p of this.players) {
      const m = input.merged([...p.devices]);
      let buttons = (m.held.attack ? BTN.ATTACK : 0) | (m.held.run ? BTN.RUN : 0);
      // Après un menu ou une bascule, on ignore l'attaque tant qu'elle n'est pas relâchée.
      if (!m.held.attack) p.suppress &= ~BTN.ATTACK;
      buttons &= ~p.suppress;
      inputs[p.hero] = blockedPlayers.has(p) ? { mx: 0, my: 0, buttons: 0 } : { mx: m.mx, my: m.my, buttons };
    }
    while (this.acc >= STEP_MS && !this.pendingWarp) {
      this.world.step(inputs, this.commands);
      this.commands = [];
      this.events.push(...this.world.s.events);
      this.acc -= STEP_MS;
    }
    if (this.pendingWarp) this.acc = 0;
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  // Panneau ou coffre fermé devant le héros, à portée de main ?
  inFront(hero, list) {
    const fx = hero.x + hero.fx * 12;
    const fy = hero.y - 4 + hero.fy * 12;
    return list.find((s) => Math.hypot(s.x - fx, s.y - fy) < 13) ?? null;
  }
  signInFront(hero) { return this.inFront(hero, this.map.signs); }
  chestInFront(hero) { return this.inFront(hero, this.map.chests.filter((c) => !this.world.s.flags[c.key])); }
}
