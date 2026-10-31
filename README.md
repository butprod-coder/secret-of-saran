# Secret of Saran

Action-RPG coopératif en pixel art 16 bits, inspiré de *Secret of Mana*, dans l'univers de Saranfou.
Trois héros : **Gus** (bretteur), **Karonux** (mage), **Lorenzo** (soigneur).

**État** : jalons 1 à 5 (carte, combat, trois héros et IA, ring menu, équipement, sauvegardes, deux cartes reliées, co-op en ligne à 3).

## Jouer

Double-cliquer sur **play.bat**. Un petit serveur PowerShell démarre sur `http://localhost:8080` et ouvre le navigateur.
Garder la fenêtre ouverte pendant la partie. Il n'y a ni Node, ni Python, ni étape de build.
Ne pas ouvrir `index.html` directement en `file://`, car les modules ES y sont bloqués.

| Action | Clavier | Manette |
|---|---|---|
| Se déplacer (8 directions) | Flèches ou ZQSD | Croix ou stick gauche |
| Attaquer / lire un panneau / ouvrir un coffre | J ou Espace | A |
| Charger un coup spécial | maintenir J | maintenir A |
| Courir | Maj | X |
| Ring menu (pause) | K ou E | Y |
| Annuler | L ou Échap | B |
| Changer de héros | Tab | LB ou Select |
| Valider (menus) | Entrée ou J | A ou Start |

- **Jauge** : chaque coup la vide, puis elle remonte. Frapper avant 100 % fait peu de dégâts.
- **Charge** : avec la jauge pleine, maintenir l'attaque monte des niveaux de charge, jusqu'au niveau d'arme (+1 pour Gus). Relâcher déclenche le coup spécial.
- **Ring menu** : haut/bas change d'anneau, gauche/droite tourne, valider puis choisir la cible.
  - **Objets** et **Magie** (les sorts des trois héros).
  - **Équipement** : la fenêtre de statut d'un héros (stats, arme, niveau d'arme). Haut/bas choisit l'emplacement (tête, corps, bras), gauche/droite change la pièce.
  - **Tactique** : le comportement de chaque compagnon IA.
  - **Système** : sauvegarder, charger, exporter, importer, retour au titre.
- **Équipement** : dans les coffres et, plus rarement, sur les ennemis. Certaines pièces sont réservées à un héros (la cotte de mailles à Gus, par exemple).
- **Compagnons IA** : tactique Agressif, Défensif ou Suivre, réglable dans l'anneau Tactique. Lorenzo soigne seul les alliés sous 50 % de PV.
- **Multijoueur local** : une manette rejoint la partie dès qu'on appuie sur un bouton. La première va au joueur 1, les suivantes reprennent un héros de l'IA. Si on la débranche, le héros repasse sous IA.

## Co-op en ligne

Jusqu'à 3 joueurs, chacun sur son ordinateur. Écran titre > **Co-op en ligne** :

| Choix | Effet |
|---|---|
| Héberger une nouvelle partie / la dernière sauvegarde / un fichier .json | Ouvre une salle. Son code (4 lettres) s'affiche en haut de l'écran. |
| Rejoindre avec un code | Haut/bas change la lettre, gauche/droite passe à la suivante, valider rejoint. |

- **Lien d'invitation** : `https://adresse-du-jeu/?room=ABCD` ouvre directement la saisie du code.
- **Héros** : un invité reprend le premier héros contrôlé par l'IA ; Tab / LB passe au suivant libre.
- **Hôte** : c'est son navigateur qui fait tourner la partie. Il peut réduire sa fenêtre, la partie continue ; s'il la ferme, les invités reviennent à l'écran titre.
- **Menus** : avec des invités connectés, ouvrir le ring menu ne met plus le jeu en pause (comme dans une partie à plusieurs, le monde continue).
- **Coupure d'un invité** : son héros passe sous IA. S'il revient dans les 30 secondes depuis le même navigateur, il retrouve sa place et son héros.
- **Sauvegardes** : seul l'hôte sauvegarde (auto + emplacements). La sauvegarde retient le code de salle et le héros de chaque invité : en rehébergeant cette sauvegarde, l'hôte rouvre la même salle (si le code est libre) et chacun récupère son héros.
- **Changer d'hôte** : un invité peut **exporter** la partie (anneau Système). En l'hébergeant à son tour (« Héberger un fichier .json »), il devient l'hôte.

**Fonctionnement** : l'hôte fait autorité. Les invités envoient leurs entrées et leurs commandes de menu ; l'hôte renvoie l'état du monde 20 fois par seconde, et l'invité l'affiche en interpolant. Il n'y a pas encore de prédiction côté invité : ses mouvements apparaissent avec le délai du réseau (en pratique 50 à 150 ms).

**Réseau** : la mise en relation passe par le serveur public gratuit de PeerJS (`0.peerjs.com`), ensuite les joueurs se parlent en direct (WebRTC). Certains réseaux (entreprise, certaines box ou connexions mobiles) bloquent la connexion directe : il faut alors un serveur relais TURN, à déclarer dans `ICE_SERVERS` de [src/net/config.js](src/net/config.js).

**Tester seul** : ouvrir deux fenêtres du navigateur (pas deux onglets : un onglet caché est ralenti par le navigateur), héberger dans l'une, rejoindre dans l'autre. Ajouter `?lag=120&jitter=40` à l'adresse simule 120 ms de latence (plus 0 à 40 ms aléatoires) sur chaque message envoyé.

## Mettre le jeu en ligne (Cloudflare Pages)

Le jeu n'est que des fichiers statiques : pas de build, pas de serveur à faire tourner. Cloudflare Pages les sert gratuitement en HTTPS (obligatoire pour WebRTC), directement depuis le dépôt GitHub.

1. Créer un compte gratuit sur **dash.cloudflare.com**.
2. Menu **Workers & Pages** > **Créer** > onglet **Pages** > **Se connecter à Git** (« Connect to Git »).
3. Autoriser Cloudflare à accéder à GitHub, puis choisir le dépôt `secret-of-saran`.
4. Réglages du build :
   - Branche de production : `main`.
   - Framework : **Aucun** (« None »).
   - Commande de build : **vide**.
   - Répertoire de sortie : **vide** (ou `/`) : le site est la racine du dépôt.
5. **Enregistrer et déployer**. Au bout d'une minute, le jeu est sur `https://secret-of-saran.pages.dev` (ou un nom proche, si celui-ci est pris).

Ensuite, chaque `git push` sur `main` redéploie le site tout seul. Les sauvegardes dépendant de l'adresse, celles faites sur `localhost:8080` n'apparaissent pas sur le site : les exporter puis les importer.

Les écrans de Cloudflare changent de temps en temps ; les noms des menus peuvent varier légèrement.

## Sauvegardes

- **Automatique** : à chaque changement de carte, dans l'emplacement « Auto ».
- **Manuelle** : trois emplacements, depuis l'anneau Système.
- **Reprendre** : écran titre (Continuer = la plus récente, ou Charger), ou après un K.O. de toute l'équipe.
- **Fichier .json** :
  - Exporter : anneau Système, télécharge la partie en cours.
  - Importer : écran titre ou anneau Système, au clavier. Le navigateur n'ouvre pas le sélecteur de fichiers depuis une manette ; on peut alors glisser le fichier sur l'écran titre.
- **Stockage** : IndexedDB du navigateur, propre à l'adresse (`localhost:8080`). Changer de navigateur ou de port repart de zéro : exporter d'abord. En navigation privée, les sauvegardes restent en mémoire et un message le signale.
- **Contenu** : le groupe (niveaux, PV/PM, armes, équipement, tactiques), le sac, les écus, l'heure, les coffres ouverts et la position. Les ennemis repartent de zéro.
- **Format** : JSON versionné (`version`), vérifié à la lecture. Une sauvegarde abîmée ou faite par une version plus récente est refusée avec un message ; les anciennes sont mises à jour par les migrations de [src/save/format.js](src/save/format.js).
- **Écriture atomique** : un emplacement est écrit en une seule transaction IndexedDB, après un contrôle aller-retour. On ne peut pas obtenir un mélange de l'ancienne et de la nouvelle sauvegarde.
- **Co-op** : même format (voir « Co-op en ligne »).

## Manettes Bluetooth

1. Appairer la manette dans Windows : **Paramètres > Bluetooth et appareils > Ajouter un appareil**.
2. Lancer le jeu, puis appuyer sur un bouton de la manette. Pour des raisons de confidentialité, le navigateur ne montre une manette qu'à partir de ce moment-là.

| Situation | Ce que fait le jeu |
|---|---|
| Manette détectée | Un message l'annonce. |
| Manette éteinte ou hors de portée | Le héros du joueur passe sous IA et le panneau affiche « J2? ». La place du joueur reste réservée 30 secondes. |
| Même manette rallumée dans ce délai | Le joueur reprend son héros sans appuyer sur rien. |
| Délai dépassé | Le joueur quitte la partie ; il pourra rejoindre en appuyant sur un bouton. |

- **Vibrations** : quand son héros est touché, à chaque niveau de charge et lors d'un K.O. Elles marchent sur les manettes Xbox et DualSense sous Chrome ou Edge ; Firefox n'expose pas la vibration.
- **Faux positifs** : un appareil sans stick (casque avec boutons d'appel, par exemple) est ignoré. Un bouton déjà enfoncé au moment où la manette apparaît ne compte pas comme un appui.
- **Mappings** :
  - Chrome et Edge présentent la plupart des manettes Bluetooth (Xbox, DualSense, DualShock 4, Switch Pro) en mapping « standard ».
  - En mode non standard (Firefox, certains pilotes DirectInput), le jeu lit la croix directionnelle codée sur un seul axe. Il applique aussi la disposition Sony quand l'identifiant le permet.
  - Une manette exotique mal reconnue s'ajoute dans `PROFILES`, dans [src/input/InputManager.js](src/input/InputManager.js).

## Univers (propositions)

- **Le Grand Chêne de Saran** joue le rôle de l'Arbre Mana. Il se meurt, et les esprits élémentaires se dispersent dans la région.
- **Esprits** :
  - Ondine de Loire : eau, soins, gel.
  - Salamandre du Barbecue : feu.
  - Gnomard, gnome de jardin : terre, protections.
  - Les autres esprits viendront plus tard.
- **Armes de départ** :
  - Gus : Épée de Saran (lourde, grosse charge).
  - Karonux : Bâton de noisetier (faible au corps à corps).
  - Lorenzo : Arc du Bourg (à distance, salve de trois flèches en charge).
- **Monnaie** : l'écu.
- **Objets** :
  - Chocolatine : rend des PV (et on ne dit pas « pain au chocolat »).
  - Eau de Loire : rend des PM.
  - Verre de l'amitié : relève un héros K.O.
- **Lieux** :
  - La Prairie de Saran : le bourg et la Loire.
  - La Lisière du Grand Chêne, à l'est, avec l'étang de la Mère Ondine. Gnomard a fermé de ronces le chemin du Grand Chêne.
  - Les Galeries de Gnomard (premier donjon) : on y descend par un terrier, à l'est de l'étang. Il y a deux ailes, une grille commandée par un levier, et l'arène du boss.
  - Le Grand Chêne : on y arrive une fois Gnomard vaincu, par l'échelle de l'arène ou par le chemin libéré des ronces.
- **Équipement** : bandana de fanfare, casquette du PMU, casque de pompier, bonnet de Gnomard, t-shirt de Saran, gilet de pêche, cotte de mailles rouillée, robe de chambre, gants de jardinage (ceux de Gnomard), bracelet brésilien, montre en toc.
- **Bestiaire** :
  - Lapinfou : le Rabite local, avec un foulard de fanfare.
  - Champignard : il libère des spores.
  - Taupinarde : elle file sous terre, où on ne peut pas la toucher, puis surgit pour mordre.
- **Boss : Gnomard, gnome de jardin**. Il dort, statue de pierre, au fond de ses galeries.
  - Entrer dans l'arène le réveille. La grille se ferme, et tout le groupe est attiré à l'intérieur.
  - Il bondit et écrase le sol à l'atterrissage, frappe à la pelle, lance des cailloux en éventail, et creuse pour surgir sous vos pieds. Juste après, il reste un moment vulnérable.
  - Sous la moitié de ses PV, il appelle deux Champignards et accélère.
  - Il ne recule pas sous les coups et le Gel ne l'arrête pas.
  - Vaincu, il laisse son bonnet et retire les ronces. Karonux apprend alors le Séisme (sort de terre, dégâts autour de lui).
- **La boulangerie** est fermée le lundi, et c'est toujours lundi au début de l'aventure.

## Architecture

```
play.bat, tools/serve.ps1   serveur statique local
tools/build-map.ps1         génère assets/maps/*.tmj (format Tiled)
assets/tilesets/saran.json  index des tuiles, partagé par le générateur de carte et le jeu
vendor/phaser.min.js        Phaser 3.80.1
vendor/peerjs.min.js        PeerJS 1.5.4 (WebRTC)
src/sim/                    simulation pure (sans Phaser ni DOM), pas fixe à 60 Hz
  World.js                  état sérialisable (this.s), step(inputs, commands)
  hero.js, enemy.js, magic.js, projectile.js, combat.js, physics.js
  ai/ally.js                IA des compagnons (produit la même entrée qu'un joueur)
  data/                     héros, armes, sorts, objets, équipement, bestiaire
src/save/                   format versionné + migrations, IndexedDB, fichiers .json
src/game/Session.js         boucle à pas fixe, joueurs locaux, commandes, changement de carte
src/net/                    co-op en ligne : Net (PeerJS, latence simulée), HostLink (hôte),
                            RemoteSession (invité), config (STUN/TURN, rythmes)
src/input/InputManager.js   clavier (un seul jeu de listeners) + manettes par polling
src/render/                 rendu Phaser, en lecture seule sur la simulation
  art/                      tous les graphismes générés par code (tuiles, sprites, police, icônes)
  scenes/                   Boot, Title, World, UI
  ui/                       ring menu, dialogues, fenêtres
tests/                      tests de simulation dans le navigateur : http://localhost:8080/tests/
```

- La simulation n'utilise ni `Math.random` ni l'horloge : son générateur aléatoire est seedé et stocké dans l'état. Les tests vérifient qu'avec la même graine et les mêmes entrées on obtient le même état, et qu'un aller-retour JSON ne change rien.
- Les menus envoient des **commandes** (`cast`, `item`, `tactic`, `equip`, `open` pour un coffre ou un levier) plutôt que de modifier l'état. En ligne, ce sont elles que les clients enverront à l'hôte.
- **Changement de carte** : la simulation fige le monde quand un héros joueur entre dans une sortie. La session extrait alors le groupe (`World.toSave()`) et recrée le monde sur l'autre carte (`World.fromSave()`). C'est le même chemin que le chargement d'une sauvegarde.

## Modifier la carte

- **Par script** : éditer `tools/build-map.ps1` (une section par carte, ajouter l'id dans `MAPS` de `src/config.js` pour une nouvelle carte), puis lancer :
  `powershell -ExecutionPolicy Bypass -File tools\build-map.ps1`
- **Dans Tiled** : on peut aussi ouvrir le `.tmj` directement. Les tuiles sont générées par le jeu ; l'export de `saran.png` pour l'éditeur Tiled est prévu.
- **Calques** :
  - `ground` : le sol.
  - `deco` : les obstacles, sous les personnages.
  - `above` : la cime des arbres et le faîte des toits, au-dessus des personnages.
  - `objects` :
    - `start` : départ d'une nouvelle partie.
    - `spawn` (propriété `enemy`), `sign` (propriété `text`).
    - `chest` (propriétés `item` et/ou `gold`) : poser aussi la tuile de coffre sur `deco`. Son id d'objet Tiled sert à mémoriser qu'il est ouvert : ne pas le changer.
    - `warp` (propriétés `map` et `entry`) : rectangle de sortie.
    - `entry` (propriété `entry`) : point d'arrivée nommé, à placer hors du rectangle de sortie.
    - `door` (propriétés `look` = `gate` ou `ronces`, plus `until` = drapeau ou `during` = `boss`) : porte, fermée tant que le drapeau n'est pas levé, ou pendant le combat de boss. Ses tuiles ne sont pas solides : c'est le jeu qui la ferme (`World.syncDoors`).
    - `lever` (propriété `flag`) : levier qui lève ce drapeau, une seule fois.
    - `arena` : rectangle de l'arène de boss. L'entrée nommée `arene` est l'endroit où le groupe est rassemblé.
  - Propriété de carte `dark` : pénombre constante (souterrains), sans cycle jour/nuit.
- **Murs de grotte** : dans le script, `Area ... 'x'` pose de la roche et `'c'` du sol de grotte. Le front du rocher est dessiné automatiquement au-dessus d'un sol.

## Prochaines étapes

- **J7** : la suite au Grand Chêne. Gnomard veut récupérer ses gants.
- **Plus tard** : musique et bruitages ; une boutique pour dépenser les écus ; amélioration des armes ; prédiction des mouvements côté invité ; un serveur TURN si des amis n'arrivent pas à se connecter.
