// Connexions WebRTC entre joueurs, via PeerJS (chargé en global par vendor/peerjs.min.js).
// L'hôte ouvre une salle (code de 4 lettres) ; chaque invité ouvre un canal fiable vers lui.
// Le serveur PeerJS ne sert qu'à la mise en relation : les messages vont ensuite en direct.
// Les scènes reçoivent les messages via `net.handler` (rebranché à chaque création de session).
import { CODE_LENGTH, CODE_LETTERS, ICE_SERVERS, PEER_PREFIX, SIM_JITTER, SIM_LAG } from './config.js';

const ERRORS = {
  'peer-unavailable': 'Aucune partie ouverte avec ce code.',
  'unavailable-id': 'Ce code de salle est déjà pris.',
  'browser-incompatible': 'Ce navigateur ne gère pas WebRTC.',
  network: 'Serveur de mise en relation injoignable.',
  'server-error': 'Serveur de mise en relation injoignable.',
  'socket-error': 'Serveur de mise en relation injoignable.',
  'socket-closed': 'Connexion au serveur de mise en relation perdue.',
};
export const netError = (e) => ERRORS[e?.type] ?? e?.message ?? 'Erreur réseau.';

export function randomCode() {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  return s;
}

// Identifiant de ce navigateur, gardé d'une partie à l'autre : l'hôte s'en sert pour rendre
// son héros à un invité qui revient (rechargement de page, coupure).
export function browserToken() {
  try {
    let t = localStorage.getItem('sos-token');
    if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('sos-token', t); }
    return t;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

class Net {
  constructor() {
    this.reset();
  }

  reset() {
    this.role = null; // 'host' | 'guest' | null (solo)
    this.code = null;
    this.peer = null;
    this.conns = new Map(); // hôte : peerId -> connexion
    this.hostConn = null; // invité : connexion vers l'hôte
    this.sendAt = new Map(); // latence simulée : dernier envoi prévu par connexion (garde l'ordre)
    this.handler = null;
  }

  get online() { return this.role !== null; }

  openPeer(id) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') { reject({ type: 'browser-incompatible' }); return; }
      const peer = new Peer(id, { config: { iceServers: ICE_SERVERS }, debug: 1 });
      const fail = (e) => { peer.destroy(); reject(e); };
      peer.once('open', () => { peer.off('error', fail); resolve(peer); });
      peer.once('error', fail);
    });
  }

  // --- Hôte -----------------------------------------------------------------
  // `preferred` : code d'une partie sauvegardée, repris s'il est libre pour que les invités
  // retrouvent la même salle.
  async host(preferred = null) {
    const handler = this.handler; // déjà branché par la scène (HostLink)
    this.close();
    this.handler = handler;
    for (let tries = 0; ; tries++) {
      const code = tries === 0 && preferred ? preferred : randomCode();
      try {
        this.peer = await this.openPeer(PEER_PREFIX + code);
        this.code = code;
        break;
      } catch (e) {
        if (e.type !== 'unavailable-id' || tries >= 4) throw e;
      }
    }
    this.role = 'host';
    this.peer.on('connection', (conn) => {
      conn.on('open', () => this.conns.set(conn.peer, conn));
      conn.on('data', (msg) => this.handler?.onGuestMessage?.(conn.peer, msg));
      conn.on('close', () => this.dropGuest(conn.peer));
      conn.on('error', () => this.dropGuest(conn.peer));
    });
    // Perdre le serveur de mise en relation ne coupe pas les invités déjà là ; on s'y reconnecte
    // pour en accueillir d'autres.
    this.peer.on('disconnected', () => { if (this.peer && !this.peer.destroyed) this.peer.reconnect(); });
    this.peer.on('error', (e) => console.warn('PeerJS', e.type, e));
    return this.code;
  }

  dropGuest(peerId) {
    if (!this.conns.delete(peerId)) return;
    this.handler?.onGuestLeave?.(peerId);
  }

  sendTo(peerId, msg) {
    const c = this.conns.get(peerId);
    if (c) this.send(c, msg);
  }

  broadcast(msg) {
    for (const c of this.conns.values()) this.send(c, msg);
  }

  kick(peerId) {
    const c = this.conns.get(peerId);
    this.conns.delete(peerId);
    setTimeout(() => c?.close(), 300); // laisser partir le dernier message
  }

  // --- Invité ---------------------------------------------------------------
  async join(code) {
    this.close();
    this.peer = await this.openPeer(undefined);
    const conn = this.peer.connect(PEER_PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject({ message: "L'hôte ne répond pas." }), 15000);
      conn.once('open', () => { clearTimeout(timer); resolve(); });
      this.peer.once('error', (e) => { clearTimeout(timer); reject(e); });
    }).catch((e) => { this.close(); throw e; });
    this.role = 'guest';
    this.code = code.toUpperCase();
    this.hostConn = conn;
    conn.on('data', (msg) => this.handler?.onHostMessage?.(msg));
    const lost = () => { if (this.hostConn === conn) { this.hostConn = null; this.handler?.onHostLost?.(); } };
    conn.on('close', lost);
    conn.on('error', lost);
    return this.code;
  }

  sendToHost(msg) {
    if (this.hostConn) this.send(this.hostConn, msg);
  }

  // --- Commun ---------------------------------------------------------------
  send(conn, msg) {
    if (!conn.open) return;
    if (!SIM_LAG && !SIM_JITTER) { conn.send(msg); return; }
    // Latence simulée, sans jamais doubler un message précédent (canal ordonné).
    const now = performance.now();
    const at = Math.max(this.sendAt.get(conn) ?? 0, now + SIM_LAG + Math.random() * SIM_JITTER);
    this.sendAt.set(conn, at);
    setTimeout(() => { if (conn.open) conn.send(msg); }, at - now);
  }

  close() {
    const peer = this.peer;
    this.reset();
    peer?.destroy();
  }
}

export const net = new Net();
window.__net = net; // débogage
