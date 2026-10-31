# Secret of Saran

Action-RPG coopératif en pixel art 16 bits, inspiré de *Secret of Mana*, dans l'univers de Saranfou.
Trois héros : **Gus** (bretteur), **Karonux** (mage), **Lorenzo** (soigneur).

**État** : jalons 1 à 4 (carte, combat, trois héros et IA, ring menu, équipement, sauvegardes, deux cartes reliées).

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
- **Co-op** : même format. Seul l'hôte sauvegardera ; un autre joueur pourra devenir hôte en important le fichier (jalon 5).

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
- **Lieux** : la Prairie de Saran (le bourg, la Loire) et, à l'est, la Lisière du Grand Chêne, avec l'étang de la Mère Ondine. Gnomard a fermé le passage vers le Grand Chêne.
- **Équipement** : bandana de fanfare, casquette du PMU, casque de pompier, t-shirt de Saran, gilet de pêche, cotte de mailles rouillée, robe de chambre, gants de jardinage (ceux de Gnomard), bracelet brésilien, montre en toc.
- **Bestiaire** :
  - Lapinfou : le Rabite local, avec un foulard de fanfare.
  - Champignard : il libère des spores.
- **La boulangerie** est fermée le lundi, et c'est toujours lundi au début de l'aventure.

## Architecture

```
play.bat, tools/serve.ps1   serveur statique local
tools/build-map.ps1         génère assets/maps/*.tmj (format Tiled)
assets/tilesets/saran.json  index des tuiles, partagé par le générateur de carte et le jeu
vendor/phaser.min.js        Phaser 3.80.1
src/sim/                    simulation pure (sans Phaser ni DOM), pas fixe à 60 Hz
  World.js                  état sérialisable (this.s), step(inputs, commands)
  hero.js, enemy.js, magic.js, projectile.js, combat.js, physics.js
  ai/ally.js                IA des compagnons (produit la même entrée qu'un joueur)
  data/                     héros, armes, sorts, objets, équipement, bestiaire
src/save/                   format versionné + migrations, IndexedDB, fichiers .json
src/game/Session.js         boucle à pas fixe, joueurs locaux, commandes, changement de carte
src/input/InputManager.js   clavier (un seul jeu de listeners) + manettes par polling
src/render/                 rendu Phaser, en lecture seule sur la simulation
  art/                      tous les graphismes générés par code (tuiles, sprites, police, icônes)
  scenes/                   Boot, Title, World, UI
  ui/                       ring menu, dialogues, fenêtres
tests/                      tests de simulation dans le navigateur : http://localhost:8080/tests/
```

- La simulation n'utilise ni `Math.random` ni l'horloge : son générateur aléatoire est seedé et stocké dans l'état. Les tests vérifient qu'avec la même graine et les mêmes entrées on obtient le même état, et qu'un aller-retour JSON ne change rien.
- Les menus envoient des **commandes** (`cast`, `item`, `tactic`, `equip`, `open`) plutôt que de modifier l'état. En ligne, ce sont elles que les clients enverront à l'hôte.
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

## Prochaines étapes

- **J5** : co-op en ligne à 3 (PeerJS, code de salle, latence simulée).
- **J6** : premier donjon et boss.
- **Plus tard** : musique et bruitages ; une boutique pour dépenser les écus ; amélioration des armes.
