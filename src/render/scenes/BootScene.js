import { MAPS } from '../../config.js';
import { buildAllTextures } from '../art/index.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.json('tiledefs', 'assets/tilesets/saran.json');
    for (const id of MAPS) this.load.tilemapTiledJSON(id, `assets/maps/${id}.tmj`);
  }

  create() {
    buildAllTextures(this, this.cache.json.get('tiledefs'));
    this.scene.start('Title');
  }
}
