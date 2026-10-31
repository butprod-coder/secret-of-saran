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
function Put([int]$x, [int]$y, [string]$name) { $deco[$x, $y] = Gid $name }
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
# Bordure d'arbres, avec des trouées : liste de @(côté, début, fin) en tuiles.
function Border([object[]]$gaps = @()) {
  $open = { param($side, $a) foreach ($g in $gaps) { if ($g[0] -eq $side -and $a + 1 -ge $g[1] -and $a -le $g[2]) { return $true } }; return $false }
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

function SaveMap([string]$id, [string]$name) {
  $ground = GroundLayer
  $objJson = foreach ($o in $objects) {
    $props = foreach ($k in $o.props.Keys) { "{`"name`":$(J $k),`"type`":`"string`",`"value`":$(J $o.props[$k])}" }
    "{`"id`":$($o.id),`"name`":`"`",`"type`":$(J $o.type),`"x`":$($o.x),`"y`":$($o.y),`"width`":$($o.w),`"height`":$($o.h),`"rotation`":0,`"visible`":true,`"properties`":[$($props -join ',')]}"
  }
  $tileCount = $defs.columns * $defs.rows
  $json = @"
{"type":"map","version":"1.10","tiledversion":"1.11.0","orientation":"orthogonal","renderorder":"right-down","infinite":false,
"width":$W,"height":$H,"tilewidth":16,"tileheight":16,"nextlayerid":5,"nextobjectid":$($script:nextObj),
"properties":[{"name":"name","type":"string","value":$(J $name)}],
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
Border @(@('w', 12, 13))
Area 0 12 20 2 'p'; Area 18 6 2 6 'p'
Area 24 16 6 4 'w'; Area 25 15 4 1 'w'; Area 25 20 3 1 'w'
Area 5 4 4 2 'y'; Area 30 9 3 3 'r'; Area 8 19 5 1 'r'; Area 8 20 5 1 'y'
Area 33 19 3 2 'd'

# Le bosquet du Grand Chêne, au nord, barre le chemin pour l'instant.
Tree 14 2; Tree 16 2; Tree 18 2 -Wall; Tree 20 2; Tree 22 2; Tree 16 4; Tree 20 4
Tree 6 7; Tree 11 5; Tree 26 4; Tree 31 3; Tree 34 6; Tree 4 16; Tree 13 16; Tree 19 18; Tree 30 12; Tree 35 13; Tree 22 21; Tree 15 21
foreach ($r in @(@(10, 9), @(23, 9), @(28, 22), @(6, 22), @(36, 17), @(21, 15))) { Put $r[0] $r[1] 'rock' }
foreach ($b in @(@(3, 8), @(14, 10), @(27, 7), @(33, 16), @(9, 14), @(30, 21))) { Put $b[0] $b[1] 'bush' }

Sign 4 11 'Lisière du Grand Chêne. Les Champignards y sont chez eux. Vous, non.'
Sign 17 7 "Le Grand Chêne dort derrière ces arbres. Gnomard a fermé le passage (jalon 6)."
Sign 23 14 'Étang de la Mère Ondine. Baignade interdite, sauf aux canards.'

Chest 36 3 'bracelet'
Chest 34 21 'casque'
Chest 8 3 'amitie' 25

Entry 3 12 'ouest' 1 2
Warp 0 12 1 2 'prairie' 'est'
Spawn 13 7 'lapinfou'; Spawn 28 10 'lapinfou'; Spawn 11 22 'lapinfou'
Spawn 31 6 'champignard'; Spawn 33 14 'champignard'; Spawn 20 23 'champignard'; Spawn 26 13 'champignard'
SaveMap 'clairiere' 'Lisière du Grand Chêne'
