// Réglages réseau de la co-op en ligne.

// Préfixe des identifiants PeerJS : l'hôte de la salle ABCD s'appelle « secret-of-saran-ABCD »
// sur le serveur de mise en relation public de PeerJS (0.peerjs.com).
export const PEER_PREFIX = 'secret-of-saran-';

// Lettres des codes de salle (sans I ni O, trop proches de 1 et 0).
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

// Serveurs STUN publics de Google. Pour les réseaux qui bloquent la connexion directe,
// ajouter ici un serveur TURN (Cloudflare, Metered...) :
//   { urls: 'turn:turn.example.com:3478', username: '...', credential: '...' }
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const SNAPSHOT_MS = 50; // l'hôte envoie l'état du monde 20 fois par seconde
export const INPUT_KEEPALIVE_MS = 100; // l'invité renvoie ses entrées au moins à ce rythme
export const PING_EVERY_MS = 1000;

// Latence simulée pour les tests : ?lag=150&jitter=40 dans l'adresse (millisecondes,
// appliquées à chaque message envoyé, dans les deux sens).
const params = new URLSearchParams(location.search);
export const SIM_LAG = Math.max(0, Number(params.get('lag')) || 0);
export const SIM_JITTER = Math.max(0, Number(params.get('jitter')) || 0);
