# Génère les cartes assets/maps/*.tmj (format Tiled JSON) à partir des commandes ci-dessous.
# Les .tmj produits s'ouvrent dans Tiled ; relancer ce script écrase les retouches faites à la main.
# Usage : powershell -ExecutionPolicy Bypass -File tools\build-map.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$defs = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'assets\tilesets\saran.json') | ConvertFrom-Json
$Groups = @{}
foreach ($g in $defs.groups) { $Groups[$g.name] = $g }
function Gid([string]$name, [int]$v = 0) { return [int]$Groups[$name].start + $v + 1 }

# Commence une carte vierge de $mw x $mh tuiles (les fonctions de dessin écrivent dedans).
function BeginMap([int]$mw, [int]$mh) {
  $script:W = $mw; $script:H = $mh
  $script:terrain = New-Object 'string[,]' $mw, $mh
  $script:deco = New-Object 'int[,]' $mw, $mh
  $script:above = New-Object 'int[,]' $mw, $mh
  $script:objects = New-Object System.Collections.ArrayList
  $script:nextObj = 1
}

# --- Outils de dessin -------------------------------------------------------
function Area([int]$x, [int]$y, [int]$aw, [int]$ah, [string]$t) {
  for ($j = $y; $j -lt $y + $ah; $j++) { for ($i = $x; $i -lt $x + $aw; $i++) {
    if ($i -ge 0 -and $j -ge 0 -and $i -lt $W -and $j -lt $H) { $terrain[$i, $j] = $t }
  } }
}
# Arbre 2x2 : la rangée du haut passe au-dessus des personnages, celle du bas bloque.
function Tree([int]$x, [int]$y, [switch]$Wall) {
  $above[$x, $y] = Gid 'tree' 0; $above[($x + 1), $y] = Gid 'tree' 1
  $deco[$x, ($y + 1)] = Gid 'tree' 2; $deco[($x + 1), ($y + 1)] = Gid 'tree' 3
  if ($Wall) { $deco[$x, $y] = Gid 'block'; $deco[($x + 1), $y] = Gid 'block' }
}
# Maison 5x4 : faîte au-dessus des personnages, le reste bloque.
function House([int]$x, [int]$y, [string]$kind) {
  for ($r = 0; $r -lt 4; $r++) { for ($c = 0; $c -lt 5; $c++) {
    $gid = Gid $kind ($r * 5 + $c)
    if ($r -eq 0) { $above[($x + $c), ($y + $r)] = $gid } else { $deco[($x + $c), ($y + $r)] = $gid }
  } }
}
function Put([int]$x, [int]$y, [string]$name, [int]$v = 0) { $deco[$x, $y] = Gid $name $v }
# Le Grand Chêne 6x6 : les quatre rangées du haut passent au-dessus des personnages.
function Oak([int]$x, [int]$y) {
  for ($r = 0; $r -lt 6; $r++) { for ($c = 0; $c -lt 6; $c++) {
    $gid = Gid 'oak' ($r * 6 + $c)
    if ($r -lt 4) { $above[($x + $c), ($y + $r)] = $gid } else { $deco[($x + $c), ($y + $r)] = $gid }
  } }
}
function Obj([string]$type, [int]$tx, [int]$ty, [hashtable]$props = @{}, [int]$tw = 1, [int]$th = 1) {
  [void]$objects.Add([pscustomobject]@{ id = $script:nextObj; type = $type; x = $tx * 16; y = $ty * 16; w = $tw * 16; h = $th * 16; props = $props })
  $script:nextObj++
}
function Sign([int]$x, [int]$y, [string]$text) { Put $x $y 'sign'; Obj 'sign' $x $y @{ text = $text } }
function Spawn([int]$x, [int]$y, [string]$enemy) { Obj 'spawn' $x $y @{ enemy = $enemy } }
# Coffre : contient un objet ou une pièce d'équipement (item) et/ou des écus (gold).
function Chest([int]$x, [int]$y, [string]$item = '', [int]$gold = 0) {
  Put $x $y 'chest'
  $props = @{}
  if ($item) { $props.item = $item }
  if ($gold) { $props.gold = "$gold" }
  Obj 'chest' $x $y $props
}
# Sortie (rectangle en tuiles) vers l'entrée $entry de la carte $map, et point d'arrivée nommé.
function Warp([int]$x, [int]$y, [int]$tw, [int]$th, [string]$map, [string]$entry) { Obj 'warp' $x $y @{ map = $map; entry = $entry } $tw $th }
function Entry([int]$x, [int]$y, [string]$name, [int]$tw = 1, [int]$th = 1) { Obj 'entry' $x $y @{ entry = $name } $tw $th }
# Porte (grille ou ronces) : fermée jusqu'au drapeau $until, ou pendant le combat de boss ($during = 'boss').
# Ses tuiles ne sont pas solides : c'est le jeu qui la ferme ou l'ouvre.
function Door([int]$x, [int]$y, [int]$tw, [int]$th, [string]$look, [string]$until = '', [string]$during = '') {
  for ($j = $y; $j -lt $y + $th; $j++) { for ($i = $x; $i -lt $x + $tw; $i++) { Put $i $j $look 0 } }
  $props = @{ look = $look }
  if ($until) { $props.until = $until }
  if ($during) { $props.during = $during }
  Obj 'door' $x $y $props $tw $th
}
function Lever([int]$x, [int]$y, [string]$flag) { Put $x $y 'lever'; Obj 'lever' $x $y @{ flag = $flag } }
# Arène de boss : y entrer réveille le boss (voir World.checkArena).
function Arena([int]$x, [int]$y, [int]$tw, [int]$th) { Obj 'arena' $x $y @{} $tw $th }
# Bordure d'arbres, avec des trouées : liste de @(côté, début, fin) en tuiles.
function Border([object[]]$gaps = @()) {
  # PowerShell aplatit @(@('s', 1, 2)) : une trouée seule redevient une liste de trouées.
  if ($gaps.Count -gt 0 -and $gaps[0] -isnot [array]) { $gaps = ,$gaps }
  $open ={ param($side, $a) foreach ($g in $gaps) { if ($g[0] -eq $side -and $a + 1 -ge $g[1] -and $a -le $g[2]) { return $true } }; return $false }
  for ($x = 0; $x -lt $W; $x += 2) {
    if (-not (& $open 'n' $x)) { Tree $x 0 -Wall }
    if (-not (& $open 's' $x)) { Tree $x ($H - 2) -Wall }
  }
  for ($y = 2; $y -lt $H - 2; $y += 2) {
    if (-not (& $open 'w' $y)) { Tree 0 $y -Wall }
    if (-not (& $open 'e' $y)) { Tree ($W - 2) $y -Wall }
  }
}

# --- Auto-tuiles (berges et bords de chemin) --------------------------------
function IsT([int]$x, [int]$y, [string[]]$set) {
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $W -or $y -ge $H) { return $true }
  return $set -contains $terrain[$x, $y]
}
function Mask([int]$x, [int]$y, [string[]]$set) {
  $m = 0
  if (IsT $x ($y - 1) $set) { $m += 1 }
  if (IsT ($x + 1) $y $set) { $m += 2 }
  if (IsT $x ($y + 1) $set) { $m += 4 }
  if (IsT ($x - 1) $y $set) { $m += 8 }
  return $m
}
function GroundLayer {
  $ground = New-Object 'int[,]' $W, $H
  for ($y = 0; $y -lt $H; $y++) { for ($x = 0; $x -lt $W; $x++) {
    $ground[$x, $y] = switch ($terrain[$x, $y]) {
      'w' { Gid 'water' (Mask $x $y @('w', 'b')) }
      'p' { Gid 'path' (Mask $x $y @('p', 'b')) }
      'b' { Gid 'bridge' }
      'r' { Gid 'flowers' 0 }
      'y' { Gid 'flowers' 1 }
      'd' { Gid 'dirt' }
      'c' {
        $hash = (($x * 5023 + $y * 7919) -bxor ($x * $y * 17)) % 100
        if ($hash -lt 75) { Gid 'cave' 0 } elseif ($hash -lt 90) { Gid 'cave' 1 } else { Gid 'cave' 2 }
      }
      # Paroi : on voit le front du rocher là où un sol s'étend juste en dessous.
      'x' { if ($y + 1 -lt $H -and $terrain[$x, ($y + 1)] -ne 'x') { Gid 'cavewall' 1 } else { Gid 'cavewall' 0 } }
      default {
        $hash = (($x * 7349 + $y * 9151) -bxor ($x * $y * 31)) % 100
        if ($hash -lt 70) { Gid 'grass' 0 } elseif ($hash -lt 88) { Gid 'grass' 1 } else { Gid 'grass' 2 }
      }
    }
  } }
  return ,$ground
}

# --- Écriture JSON ----------------------------------------------------------
function J([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('"')
  foreach ($ch in $s.ToCharArray()) {
    $c = [int]$ch
    if ($ch -eq '"') { [void]$sb.Append('\"') }
    elseif ($ch -eq '\') { [void]$sb.Append('\\') }
    elseif ($c -lt 32 -or $c -gt 126) { [void]$sb.Append(('\u{0:x4}' -f $c)) }
    else { [void]$sb.Append($ch) }
  }
  [void]$sb.Append('"')
  return $sb.ToString()
}
function LayerData($grid) {
  $vals = New-Object System.Collections.Generic.List[string]
  for ($y = 0; $y -lt $H; $y++) { for ($x = 0; $x -lt $W; $x++) { $cell = $grid[$x, $y]; $vals.Add("$cell") } }
  return ($vals -join ',')
}
function TileLayer([int]$id, [string]$name, $grid) {
  return "{`"id`":$id,`"name`":$(J $name),`"type`":`"tilelayer`",`"x`":0,`"y`":0,`"width`":$W,`"height`":$H,`"opacity`":1,`"visible`":true,`"data`":[$(LayerData $grid)]}"
}

$tileProps = New-Object System.Collections.Generic.List[string]
foreach ($g in $defs.groups) {
  for ($v = 0; $v -lt $g.count; $v++) {
    $props = @()
    $solidFrom = $g.PSObject.Properties['solidFrom']
    if ($g.solid -or ($solidFrom -and $v -ge [int]$g.solidFrom)) { $props += '{"name":"solid","type":"bool","value":true}' }
    if ($g.low) { $props += '{"name":"low","type":"bool","value":true}' }
    if ($props.Count) { $tileProps.Add("{`"id`":$([int]$g.start + $v),`"properties`":[$($props -join ',')]}") }
  }
}

function SaveMap([string]$id, [string]$name, [switch]$Dark) {
  $ground = GroundLayer
  $mapProps = "{`"name`":`"name`",`"type`":`"string`",`"value`":$(J $name)}"
  if ($Dark) { $mapProps += ',{"name":"dark","type":"bool","value":true}' }
  $objJson = foreach ($o in $objects) {
    $props = foreach ($k in $o.props.Keys) { "{`"name`":$(J $k),`"type`":`"string`",`"value`":$(J $o.props[$k])}" }
    "{`"id`":$($o.id),`"name`":`"`",`"type`":$(J $o.type),`"x`":$($o.x),`"y`":$($o.y),`"width`":$($o.w),`"height`":$($o.h),`"rotation`":0,`"visible`":true,`"properties`":[$($props -join ',')]}"
  }
  $tileCount = $defs.columns * $defs.rows
  $json = @"
{"type":"map","version":"1.10","tiledversion":"1.11.0","orientation":"orthogonal","renderorder":"right-down","infinite":false,
"width":$W,"height":$H,"tilewidth":16,"tileheight":16,"nextlayerid":5,"nextobjectid":$($script:nextObj),
"properties":[$mapProps],
"tilesets":[{"firstgid":1,"name":"saran","image":"../tilesets/saran.png","imagewidth":$($defs.columns * 16),"imageheight":$($defs.rows * 16),"tilewidth":16,"tileheight":16,"tilecount":$tileCount,"columns":$($defs.columns),"margin":0,"spacing":0,
"tiles":[$($tileProps -join ',')]}],
"layers":[
$(TileLayer 1 'ground' $ground),
$(TileLayer 2 'deco' $deco),
$(TileLayer 3 'above' $above),
{"id":4,"name":"objects","type":"objectgroup","draworder":"topdown","x":0,"y":0,"opacity":1,"visible":true,"objects":[$($objJson -join ',')]}
]}
"@
  $out = Join-Path $root "assets\maps\$id.tmj"
  [System.IO.File]::WriteAllText($out, $json, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "Carte écrite : $out"
}

# === La Prairie de Saran ====================================================
BeginMap 50 34
Area 0 0 $W $H 'g'
Area 30 0 4 $H 'w'                      # la Loire (un petit bras, soyons honnêtes)
Area 2 15 28 2 'p'; Area 30 15 4 2 'b'; Area 34 15 16 2 'p'
Area 7 8 1 7 'p'; Area 15 8 1 7 'p'; Area 23 13 1 2 'p'
Area 3 20 11 1 'r'; Area 3 21 11 1 'y'; Area 3 22 11 1 'r'
Area 40 11 3 2 'y'; Area 36 25 3 2 'r'

for ($x = 0; $x -lt $W; $x += 2) { if ($x -ne 30 -and $x -ne 32) { Tree $x 0 -Wall; Tree $x 32 -Wall } }
for ($y = 2; $y -lt 32; $y += 2) { Tree 0 $y -Wall; if ($y -ne 14 -and $y -ne 16) { Tree 48 $y -Wall } }
foreach ($b in @(@(48, 14), @(49, 14), @(48, 17), @(49, 17))) { Put $b[0] $b[1] 'bush' }

House 5 4 'house'; House 13 4 'house'; House 21 9 'bakery'
for ($x = 3; $x -le 13; $x++) { Put $x 19 'fence' }

Tree 10 2; Tree 24 3; Tree 19 18; Tree 25 20; Tree 4 26; Tree 10 28; Tree 21 26
Tree 37 4; Tree 43 8; Tree 35 21; Tree 44 22; Tree 40 28
foreach ($r in @(@(27, 6), @(28, 24), @(12, 25), @(36, 9), @(46, 12), @(39, 19), @(45, 30))) { Put $r[0] $r[1] 'rock' }
foreach ($b in @(@(3, 13), @(26, 17), @(18, 23), @(41, 3), @(38, 12), @(46, 19), @(36, 30))) { Put $b[0] $b[1] 'bush' }

Sign 12 9 'Saran, le Bourg. Boulangerie fermée le lundi. (Nous sommes lundi.)'
Sign 28 13 'Pont de Loire. Au-delà : la Prairie des Lapinfous. Merci de ne pas les nourrir.'
Sign 44 14 'Vers le Grand Chêne de Saran. Chemin en travaux depuis 1987.'

Chest 2 21 'gants'
Chest 46 4 'gilet'

Obj 'start' 9 16
Entry 45 15 'est' 1 2
Warp 49 15 1 2 'clairiere' 'ouest'
Spawn 39 6 'lapinfou'; Spawn 45 9 'lapinfou'; Spawn 41 19 'lapinfou'; Spawn 38 24 'lapinfou'; Spawn 45 27 'lapinfou'
Spawn 24 29 'lapinfou'
Spawn 42 21 'champignard'; Spawn 36 28 'champignard'; Spawn 14 29 'champignard'
SaveMap 'prairie' 'Prairie de Saran'

# === La Lisière du Grand Chêne ==============================================
BeginMap 40 26
Area 0 0 $W $H 'g'
Border @(@('w', 12, 13), @('n', 18, 19))
Area 0 12 20 2 'p'; Area 18 0 2 12 'p'
Area 24 16 6 4 'w'; Area 25 15 4 1 'w'; Area 25 20 3 1 'w'
Area 5 4 4 2 'y'; Area 30 9 3 3 'r'; Area 8 19 5 1 'r'; Area 8 20 5 1 'y'
Area 33 19 3 2 'd'

# Le bosquet du Grand Chêne, au nord : seul le chemin le traverse, et Gnomard l'a fermé de ronces.
Tree 14 2 -Wall; Tree 16 2 -Wall; Tree 20 2 -Wall; Tree 22 2 -Wall; Tree 16 4; Tree 20 4
Door 18 3 2 1 'ronces' 'gnomard'
Tree 6 7; Tree 11 5; Tree 26 4; Tree 31 3; Tree 34 6; Tree 4 16; Tree 13 16; Tree 19 18; Tree 30 12; Tree 35 13; Tree 22 21; Tree 15 21
foreach ($r in @(@(10, 9), @(23, 9), @(28, 22), @(6, 22), @(36, 17), @(21, 15))) { Put $r[0] $r[1] 'rock' }
foreach ($b in @(@(3, 8), @(14, 10), @(27, 7), @(33, 16), @(9, 14), @(30, 21))) { Put $b[0] $b[1] 'bush' }

Sign 4 11 'Lisière du Grand Chêne. Les Champignards y sont chez eux. Vous, non.'
Sign 17 7 "Le Grand Chêne dort derrière ces ronces. Gnomard les fait pousser depuis son terrier, à l'est de l'étang."
Sign 23 14 'Étang de la Mère Ondine. Baignade interdite, sauf aux canards.'

Chest 36 3 'bracelet'
Chest 34 21 'casque'
Chest 8 3 'amitie' 25

Entry 3 12 'ouest' 1 2
Warp 0 12 1 2 'prairie' 'est'
Entry 18 5 'chene' 2 1
Warp 18 0 2 1 'chene' 'sud'
Put 34 19 'hole'                         # le terrier de Gnomard
Entry 34 17 'terrier'
Warp 34 19 1 1 'galeries' 'terrier'
Spawn 13 7 'lapinfou'; Spawn 28 10 'lapinfou'; Spawn 11 22 'lapinfou'
Spawn 31 6 'champignard'; Spawn 33 14 'champignard'; Spawn 20 23 'champignard'; Spawn 26 13 'champignard'
SaveMap 'clairiere' 'Lisière du Grand Chêne'

# === Les Galeries de Gnomard (donjon) =======================================
# Hall au sud (échelle vers la clairière), ailes ouest et est, grille ouverte par le levier
# de l'aile ouest, antichambre, puis l'arène de Gnomard au nord.
BeginMap 36 30
Area 0 0 $W $H 'x'
Area 13 22 10 7 'c'                     # hall
Area 11 24 2 2 'c'; Area 2 14 9 12 'c'  # couloir et aile ouest
Area 23 24 2 2 'c'; Area 25 14 9 12 'c' # couloir et aile est
Area 17 15 2 7 'c'                      # couloir nord (grille au bout)
Area 14 12 8 3 'c'                      # antichambre
Area 17 11 2 1 'c'                      # seuil de l'arène
Area 8 3 20 8 'c'                       # arène
Area 25 1 1 2 'c'                       # niche de l'échelle, derrière une grille

Put 17 28 'ladder'
Entry 17 26 'terrier'
Warp 17 28 1 1 'clairiere' 'terrier'

Sign 14 22 'Galeries de Gnomard. Propriété privée. Les taupes mordent, le propriétaire aussi.'
Sign 21 22 "Grille de service. Le levier est dans l'aile ouest. - La Direction"
Door 17 15 2 1 'gate' 'galeries:levier'
Lever 3 14 'galeries:levier'

Chest 9 15 'cotte'
Chest 33 15 'robe'
Chest 33 25 'chocolatine' 60
Chest 21 12 'amitie'
foreach ($r in @(@(5, 16), @(8, 23), @(28, 20), @(31, 17), @(14, 27), @(10, 4), @(26, 9))) { Put $r[0] $r[1] 'roots' }
foreach ($s in @(@(2, 21), @(6, 25), @(27, 15), @(32, 22), @(22, 28), @(13, 23), @(8, 10), @(27, 3), @(15, 14))) { Put $s[0] $s[1] 'shroom' }
Spawn 5 19 'taupinarde'; Spawn 8 22 'taupinarde'
Spawn 28 17 'champignard'; Spawn 31 23 'taupinarde'; Spawn 27 23 'champignard'

Sign 14 12 'Ici dort Gnomard. Ne pas réveiller. (Trop tard, vous avez lu ce panneau.)'
Door 17 11 2 1 'gate' '' 'boss'
Arena 8 3 20 8
Entry 17 9 'arene' 2 1
Spawn 17 5 'gnomard'
Door 25 2 1 1 'gate' 'gnomard'
Put 25 1 'ladder'
Entry 25 4 'echelle'
Warp 25 1 1 1 'chene' 'racines'
SaveMap 'galeries' 'Galeries de Gnomard' -Dark

# === Le Grand Chêne =========================================================
BeginMap 28 22
Area 0 0 $W $H 'g'
Border @(@('s', 12, 13))
Area 12 11 2 11 'p'
Area 4 5 5 2 'y'; Area 20 6 4 2 'r'; Area 6 16 4 1 'r'; Area 6 17 4 1 'y'; Area 19 15 3 2 'y'
Oak 11 4
Put 13 10 'hole'
Entry 13 12 'racines'
Warp 13 10 1 1 'galeries' 'echelle'
Tree 3 9; Tree 22 10; Tree 5 13; Tree 21 3
foreach ($b in @(@(9, 13), @(18, 12), @(3, 4), @(24, 15))) { Put $b[0] $b[1] 'bush' }
Sign 16 12 'Le Grand Chêne de Saran. Sous ses racines, les Lapinfous cachaient... des glands. Que des glands.'
Sign 10 18 "Gnomard (de très loin) : « Et rendez-moi mes gants de jardinage ! » Suite au jalon 7."
Chest 17 7 'chocolatine' 200
Entry 12 19 'sud' 2 1
Warp 12 21 2 1 'clairiere' 'chene'
SaveMap 'chene' 'Le Grand Chêne'
