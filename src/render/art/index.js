// Génère toutes les textures du jeu au démarrage (placeholders « propres » en attendant les vrais assets).
import { buildFonts } from './font.js';
import { buildTileset } from './tiles.js';
import { buildHeroes } from './heroes.js';
import { buildMonsters } from './monsters.js';
import { buildFx } from './fx.js';
import { buildTitle } from './title.js';

export function buildAllTextures(scene, tileDefs) {
  buildFonts(scene);
  buildTileset(scene, tileDefs);
  buildHeroes(scene);
  buildMonsters(scene);
  buildFx(scene);
  buildTitle(scene);
}
