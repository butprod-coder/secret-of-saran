// Fait tourner une fonction ~60 fois par seconde même quand l'onglet est caché.
// Un onglet en arrière-plan n'a plus de requestAnimationFrame et ses minuteries sont ralenties
// à une par seconde ; celles d'un Worker ne le sont pas. Sert à l'hôte : s'il réduit sa
// fenêtre, la partie continue pour ses invités.
const WORKER_CODE = 'let t=null;onmessage=(e)=>{clearInterval(t);if(e.data)t=setInterval(()=>postMessage(0),e.data);};';

export class BackgroundTicker {
  constructor(fn, everyMs = 16) {
    this.fn = fn;
    this.everyMs = everyMs;
    this.worker = null;
    this.onVisibility = () => (document.hidden ? this.start() : this.stop());
    document.addEventListener('visibilitychange', this.onVisibility);
    if (document.hidden) this.start();
  }

  start() {
    if (!this.worker) {
      const url = URL.createObjectURL(new Blob([WORKER_CODE], { type: 'text/javascript' }));
      this.worker = new Worker(url);
      URL.revokeObjectURL(url);
      this.worker.onmessage = () => this.tick();
    }
    this.last = performance.now();
    this.worker.postMessage(this.everyMs);
  }

  stop() { this.worker?.postMessage(0); }

  tick() {
    const now = performance.now();
    const dt = now - this.last;
    this.last = now;
    try { this.fn(now, dt); } catch (e) { console.error(e); }
  }

  destroy() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.worker?.terminate();
    this.worker = null;
  }
}
