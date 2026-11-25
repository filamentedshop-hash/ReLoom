# HAT TRICK ODYSSEY: engine contract

The guide every agent follows. It describes the code as it is; if you find a mismatch, the code wins and you report it (do not edit engine files).

Static site, vanilla ES modules, no build step. Serve the folder and open `index.html`.

```
index.html, css/app.css        page shell, touch buttons, rotate hint
js/main.js                     boot, canvas sizing, scene switching, main loop (`app`)
js/engine/                     ENGINE (owner: engine architect)
  const.js    TILE, PHYS, HAT, view, INK, FONT, clamp/lerp/approach/hash2/rand/pick
  loop.js     fixed 60Hz loop          input.js    keyboard + multi-touch
  tiles.js    tile registry + Level    level.js    LevelBuilder (ASCII chunks)
  entities.js entity registry          builtin.js  built-in entity types
  physics.js  senseEnv/moveBody/stepBody/edgeAhead
  player.js   Whisk, hat, capture      boss.js     defineBoss, runPattern, arena
  game.js     Game (one running world: the API your hooks receive as `game`)
  camera.js particles.js hud.js save.js audio.js playscene.js debug.js
js/art/                        shared art helpers (draw, hat, whisk, friends, items, bg)
js/worlds/index.js, w1.js..w9.js
js/ui/                         title, map, clear, shop, settings, cutscenes, widgets
tools/serve.sh, tools/smoke.mjs
```

## 1. File ownership

| You are | You may create/replace | Never touch |
|---|---|---|
| World N agent | `js/worlds/wN.js` only (put world art, entities, boss in that one file; if it gets huge you may add `js/worlds/wN_*.js` helper modules imported by it) | engine, art, other worlds, `index.js` |
| Audio agent | `js/engine/audio.js` (keep the API in section 11) | everything else |
| UI/story agents | the `js/ui/*.js` file(s) named in your task (keep the export names and behaviour in section 12) | everything else |
| PWA agent | `manifest.webmanifest`, service worker, icons, the `<head>` of `index.html` | everything else |

Entity type names and tile names are global. `springle`, `puffcloud` (world 1) and all built-ins are shared and may be reused in any world's legend. **Prefix everything you define with your world: `w4_camel`, `w4_quicksand`.** A duplicate name logs a console error (which fails the smoke test) and is ignored.

No images, audio files, web fonts, CDNs. No `ctx.filter`, `OffscreenCanvas`, pointer lock. Everything original (see the bible's originality rule).

## 2. Coordinates, view, timing

- Tile = 24px. Entity `x, y` = top-left of its hitbox in level pixels. y grows downward.
- Fixed 60Hz tick; all speeds are px/frame. `game.t` = frames since the world started. Never use real time.
- **The view is not fixed.** It is at least 512x288 and grows to fill the screen: about 625x288 on an iPhone, 514x357 on an iPad, max 704x400. Always read `view.w` / `view.h` (import `view` from `engine/const.js`, or use the `view` argument of your hooks). `view.safe.{l,r,t,b}` are notch insets in logical px.
- Consequences for level design: boss arenas must be **at least 30 tiles wide**; make levels **at least 17 rows tall** (19 recommended) so tall screens do not see past the level; do not hide secrets "just off screen".
- Camera follows on both axes, keeping Whisk about 64% down the view, clamped to the level. Levels smaller than the view are centred horizontally and bottom-aligned.
- The left and right level edges are solid walls. Above the top is open sky. Below the bottom is a pit (costs a heart, respawn at the checkpoint).

## 3. Key numbers (for sizing gaps)

| Thing | Value |
|---|---|
| Whisk hitbox | 14x20 |
| Run | accel 0.45, max 2.8 px/frame (ice: accel x0.3, decel x0.06) |
| Jump | velocity 9.4, gravity 0.5, extra 0.6 while rising with Jump released, max fall 10, coyote 6, buffer 7 |
| Jump rise | 88px = **3.6 tiles**: ledges up to 3 tiles are comfortable |
| Running jump length | about 105px = 4.4 tiles on the flat (plus up to 1 tile from coyote time): **gaps of 3 are safe, 4 is hard, 5+ impossible** |
| Hat throw | 6.5 px/frame x0.97 for 18 frames (about 92px = 3.8 tiles), hovers 16 frames (waits up to 50 more and scoots under Whisk while he is airborne above it), returns at up to 9 |
| Hat height | the hat flies at chest height: its box spans 4..14px above Whisk's feet |
| Hat Trick | landing on the flying/hovering hat: bounce velocity 8.4 (70px), once per throw. Throw from the ground then jump: crosses about 8 tiles; a pickup 6.5 tiles out and 3.5 tiles up is hat-trick-only |
| Stomp bounce | 6.5 (8.6 with Jump held) |
| Bouncy tile | 11.5 = 5.5 tiles (13 = 7 tiles with Jump held) |
| Springle (capture) | jump 14 = **8.1 tiles** rise, run 2.6, about 6 tiles long |
| Puffcloud (capture) | gravity 0.12, flap 3.2 (42px), run 1.9, max fall 1.6, 480 frames: about 38 tiles of flight |
| Swim | gravity x0.3, sink speed max 2, Jump = stroke 4.2, run x0.7 |
| Hearts | 3; 90 invulnerable frames after a hit |
| Enemy hit | lose a heart + knockback. Hazard tile or pit: lose a heart + respawn at the checkpoint. At 0 hearts: refill + respawn. Checkpoints refill hearts. |
| Getting hit while captured | the creature absorbs it: Whisk pops out, no heart lost (hazard tiles and pits still cost a heart) |

`world.gravityScale` (default 1) multiplies gravity for the player and everything using `stepBody` (0.5 doubles jump height).

## 4. World module

`js/worlds/wN.js` default-exports one object. `js/worlds/w1.js` is the reference: copy its structure.

```js
export default {
  id: 4,                       // required, 1..9
  name: 'Snoozle Sands',       // required
  blurb: 'One line for the map.',
  stub: false,                 // stubs skip the "8 sparks" check
  music: 'w4',                 // default 'w' + id
  bossMusic: 'boss',           // default 'boss'
  gravityScale: 1,
  theme: { ground: '#..', top: '#..', ... },  // recolours the default tiles (keys: DEFAULT_THEME in tiles.js)
  build(L) { ... },            // required: describe the level with the LevelBuilder
  // optional hooks
  drawBackground(ctx, cam, view, t, game) {},  // SCREEN space (0..view.w, 0..view.h); must cover the whole view
  drawTile(ctx, def, x, y, info) {},           // world space; return true if you drew it, false for the default
  drawForeground(ctx, cam, view, t, game) {},  // WORLD space, above entities and particles
  drawOverlay(ctx, view, t, game) {},          // SCREEN space, above darkness/tint, below the HUD
  onStart(game) {}, onUpdate(game) {},         // once / every tick
  onRespawn(game) {}, onSignal(game, id, on) {}, onSpark(game, id, isNew) {},
  onCapture(game, entity) {}, onTileBroken(game, tx, ty, def) {}, onBossDefeated(game, boss) {},
};
```

`drawTile` info: `{tx, ty, level, t, theme, game, def}` (one shared object: do not keep it). To decorate the default look, call `def.draw(ctx, x, y, info)` yourself, add your details, return `true` (w1 does this for flowers).

Visual hooks you can set any time on `game`: `game.darkness = 0..1` (dark overlay with soft light holes around Whisk, radius `game.player.light` (80), and every active entity with `e.light > 0`; colour `game.darkColor`), `game.tint = 'rgba(...)'`, `game.desaturate = 0..1` (grays the world with the `saturation` blend mode: for Ho-Hum Kingdom), `game.hideFollowers`. `game.data = {}` is scratch space for your world.

Performance rules: `drawBackground` and `drawTile` run every frame. Keep a tile to a handful of fills, use the `art/bg.js` helpers (cached gradients), never create gradients/arrays/objects per frame, never loop over the whole level.

## 5. Authoring a level

Levels are ASCII chunks laid left to right (bottom-aligned), plus builder calls. Each chunk is an array of strings, one character per tile. Keep chunks 40 to 60 columns wide so they stay readable; use as many as you like. All `chunk()` calls must come before any other builder call that needs positions.

```js
const START = [
  '                    ',
  '        ooo         ',
  '  P   ?       G   F ',
  '####################',
];
function build(L) {
  L.legend({ S: 'springle', K: { ent: 'w5_kite', props: { speed: 2 } }, q: 'w4_quicksand', C: { ent: 'puffcloud', props: { oy: -8 } } });
  L.chunk(START).chunk(NEXT).chunk(BOSS);
  L.hints(['First rhyme\nsecond line', 'Next rhyme...']);       // one per '?', left to right
  L.on('1', 'mover', { tiles: 3, moveX: 5, period: 260 });      // entity at every marker '1'
  L.zoneBetween('2', 'water');                                  // rectangle spanned by the two '2' markers
  L.arena({ from: L.mark('3').tx, to: L.width - 1, boss: 'w4_boss', bossAt: '4' });
}
```

Default legend:

| Char | Meaning | Char | Meaning |
|---|---|---|---|
| space or `.` | empty | `P` | player start (stands in this cell) |
| `#` | ground (solid, auto grass top) | `o` | Button |
| `X` | block (solid) | `*` | Fun Spark |
| `=` | one-way platform | `F` | checkpoint flag |
| `^` `v` | spikes up / down (hazard) | `?` | Mumble hint |
| `~` | water tile (swim) | `G` | Gloomlet |
| `i` | ice | `E` | goal (stubs / levels without a boss) |
| `<` `>` | conveyor left / right (1.2 px/frame) | `0`..`9` | markers for builder calls |
| `j` | bouncy tile | `B` | cracked block (hat or head-bump breaks it) |
| `H` | hard block (only `game.breakTile`) | | |

Not in the default legend (add them yourself or use builder calls): `heart`, `switch`, `door`, `mover`, `blink`, `zone`, `springle`, `puffcloud`. An unknown character throws with the chunk/row/column.

Cell placement follows the entity's `anchor`: `'feet'` (default: standing on the cell's floor, horizontally centred), `'center'` (pickups), `'cell'` (top-left; platforms, doors, zones). Props `ox`, `oy` nudge in pixels.

LevelBuilder API:

| Call | Does |
|---|---|
| `L.legend({ch: 'tileOrEntityName' \| {tile} \| {ent, props} \| {ent, tile} \| {mark:true} \| null})` | extend the legend |
| `L.chunk(rows, {x, y, lift})` | add a chunk. Default: right after the previous one, bottom-aligned. `x` = tile column, `y` = tile row of its top, `lift` = tiles above the bottom |
| `L.size(w, h)` | force a minimum size in tiles |
| `L.width`, `L.height` | level size in tiles |
| `L.spawn(type, tx, ty, props)` / `L.spawnPx(type, x, y, props)` | add an entity by cell / by pixel |
| `L.marks(ch)` → `[{tx, ty, x, y}]`, `L.mark(ch, i = 0)` | marker cells, sorted left to right |
| `L.on(ch, type, props \| (i, mark) => props)` | spawn at every marker |
| `L.set(tx, ty, tileName)`, `L.fill(tileName, tx, ty, tw, th)` | edit tiles (`null`/0 clears) |
| `L.zone(kind, tx, ty, tw, th, props)`, `L.zoneBetween(ch, kind, props)` | rectangular zones (section 8) |
| `L.hints([...])` | texts for the `?` spots in left-to-right order (or give a hint its own `props.text`) |
| `L.start(tx, ty)` | player start (instead of `P`) |
| `L.arena({from, to, top, bottom, boss, bossAt, props})` | boss arena (section 9) |

Fun Sparks get ids 0..6 left to right; the boss spark is id 7. A non-stub world must have exactly 7 `*` plus a boss (the engine warns in the console otherwise). To pin an id use `{ent:'spark', props:{id: 3}}`. Checkpoints get `index` 0.. left to right.

## 6. Tiles

`defineTile(name, def)` from `engine/tiles.js`, then map a legend character to the name.

```js
defineTile('w4_quicksand', {
  solid: true, accel: 0.5, friction: 2,
  draw(ctx, x, y, info) { ctx.fillStyle = '#e8c56a'; ctx.fillRect(x, y, 24, 24); },
});
```

| Flag | Meaning |
|---|---|
| `solid` | blocks from every side |
| `oneway` | platform: solid only for a body moving in its gravity direction that started beyond it (works upside-down too) |
| `hazard` | `'respawn'` (or `true`): heart + back to checkpoint; `'knock'`: heart + knockback |
| `liquid` | swim zone for bodies whose centre is inside |
| `accel`, `friction` | multipliers for ground acceleration / stopping (ice: 0.3 / 0.06) |
| `conveyor` | px/frame push while standing on it (negative = left) |
| `bounce` | launch speed when stood/landed on |
| `breakable` | `game.breakTile(tx, ty)` removes it; `hatBreak`: the hat breaks it; `bumpBreak`: Whisk's head breaks it |

Runtime: `game.level.def(tx, ty)` (tile def or null), `.defAt(px, py)`, `.solid(tx, ty)`, `.solidAt(px, py)`, `.set(tx, ty, name|0)`, `.rectFree(x, y, w, h)`, `.w/.h/.pxW/.pxH`. `game.breakTile(tx, ty, force)`, `game.breakTilesIn(x, y, w, h)`. Slopes are not supported.

## 7. Entities

```js
import { defineEntity } from '../engine/entities.js';
import { stepBody, edgeAhead } from '../engine/physics.js';

defineEntity('w4_scarab', {
  w: 18, h: 14, enemy: true,
  init(e, game) { e.speed = e.props.speed || 0.8; },
  update(e, game) {
    if (e.onGround && (edgeAhead(game, e, e.facing) || e.hitWall === e.facing)) e.facing = -e.facing;
    e.vx = e.facing * e.speed;
    stepBody(game, e);                      // zones + gravity + tile/platform collision
  },
  draw(ctx, e, game) { /* world coords; (e.x, e.y) is the hitbox top-left */ },
});
```

Definition fields (defaults in brackets): `w, h` [16], `anchor` ['feet'], `layer` [0; -1 behind tiles' entities, 1 in front of Whisk], `always` [false: only updated/drawn within 220px of the view], `sizeFromProps`, and the interaction flags:

| Flag | Effect |
|---|---|
| `pickup` | player or hat touching it calls `onCollect(e, game)` |
| `enemy` | stomp from above → `game.hit(e,'stomp')` + bounce; hat → `game.hit(e,'hat')`; any other touch hurts Whisk |
| `stompable` [true], `hurts` [true], `hatProof` [false] | refine `enemy`: not stompable = hurts from above too; `hatProof` = the hat clinks off |
| `capturable` + `capture: {...}` | the hat captures it (below) |
| `platform` | one-way surface that carries riders; set `e.dx/e.dy` to this tick's movement (see `mover` in builtin.js) |
| `solid` | solid box (door, crate). Set `e.off = true` to disable a platform/solid |
| `zone` | built-in zones only |

Hooks: `init(e, game)`, `update(e, game)`, `draw(ctx, e, game)`, `onTouch(e, game, player)`, `onStomp(e, game, player)` (replaces the default stomp result; return false for "clink"), `onHat(e, game, hat)` (replaces the default hat result; return `'bounce'` to send the hat back), `onHit(e, game, source)` (source `'hat' | 'stomp' | 'projectile' | 'ability'`; default = defeated; return `false` = no effect), `onDefeat(e, game)`, `onCollect(e, game)`, `onReleased(e, game, reason)`, `onRespawn(e, game)`.

Instance fields: `x, y, w, h, vx, vy, facing, t` (age, auto-incremented), `props`, `homeX, homeY`, `dead` (set true to remove), `hidden`, `cooldown`, `gdir/baseGdir`, `light`, `always`, and after `stepBody`/`moveBody`: `onGround, hitWall (-1/0/1), hitCeil, riding, groundTile, touchHazard, inLiquid, justLanded, bounced`. Put your own state straight on `e`.

Physics helpers (`engine/physics.js`): `stepBody(game, body, {gravity, maxFall, windScale})` does everything; or `senseEnv(game, b)` (zones → `b.inLiquid, b.envWindX, b.envWindY, b.gdir`) then `moveBody(game, b)`; `edgeAhead(game, b, dir)`.

Game API for hooks:

| Call | Does |
|---|---|
| `game.player` | Whisk's body: `x,y,w,h,vx,vy,facing,onGround,form ('whisk' or entity type),cap,hearts,inv,gdir,baseGdir,data` |
| `game.hat` | `{state: 'home'|'fly'|'hover'|'return', x, y, w, h}` |
| `game.spawn(type, x, y, props)`, `game.spawnCell(type, tx, ty, props)` | create entities at runtime |
| `game.hit(e, source)`, `game.defeat(e)` | harm (goes through `onHit`) / defeat with confetti |
| `game.hurtPlayer({respawn, fromX, force})` | hurt Whisk |
| `game.capture(e)`, `game.release(reason)` | force capture / exit |
| `game.shoot({x, y, vx, vy, r, gravity, life, friendly, hatProof, hitsTiles, color, draw, onHit})` | projectile (x, y = centre). Hostile ones hurt Whisk and can be swatted with the hat; `friendly` ones hit enemies via `onHit(e, game, 'projectile')` |
| `game.signal(id)`, `game.setSignal(id, on)` | switch/door signals |
| `game.active`, `game.entities`, `game.forEachIn(x, y, w, h, fn)`, `game.nearest(x, y, typeOrFn, maxDist)` | queries (`active` = near the camera) |
| `game.toast(text, frames)`, `game.showHint(text)` (call every tick while it should show), `game.sfx(name)`, `game.cutscene(id)` | feedback |
| `game.fx.burst/confetti/puff/sparkle/ring/text(...)` | particles (see particles.js) |
| `game.cam.shake(mag, frames)` | screen shake (ignored with reduced motion) |
| `game.flipGravity(body, dir?)` | flip a body's own gravity |
| `game.liquidAt(px, py)`, `game.addButtons(n)`, `game.setCheckpoint(flagEntity)`, `game.teleport(x, y)`, `game.clearWorld()` | misc |
| `game.arena`, `game.theme`, `game.level`, `game.t`, `game.gravityScale`, `game.view`, `game.save`, `game.input` | state |

### Capturable creatures

```js
defineEntity('w5_gustbird', {
  w: 20, h: 16, capturable: true,
  update(e, game) { /* behaviour while free */ },
  draw(ctx, e, game) { /* also used while captured: then e.possessed === true */ },
  capture: {
    w: 18, h: 16,               // Whisk's hitbox while captured (default: the entity's)
    move: { jumpVel: 7, maxRun: 3.4, gravity: 0.3, airJumps: 2 },   // overrides PHYS (also: accel, groundDecel,
                                // airDecel, maxFall, riseCut, coyote, buffer, swimStroke, windScale, stompBounce)
    duration: 0,                // frames before it pops (0 = until Hat is pressed); shows a timer ring
    hat: { x: 0, y: -2, scale: 1 },   // where the mini-hat + ears sit (relative to top-centre)
    dropInPlace: false,         // true: creature stays where Whisk exits; false: reappears at home after respawnDelay (50)
    stomp: true, bump: false,   // can it stomp enemies / break bumpBreak tiles with its head
    onEnter(p, game, e) {}, onExit(p, game, reason) {},     // reason: 'hat'|'hurt'|'timeout'|'respawn'|'script'
    control(p, game, c) {},     // every tick BEFORE physics. c = {dir, jump (pressed), jumpHeld, hat}.
                                // Change p.vx/p.vy, set p.noGravity = true for this tick, use p.data for state.
                                // Return true to skip the default run/jump code (collision still runs).
    update(p, game, c) {},      // every tick AFTER physics (p.onGround etc. are fresh)
    onJump(p, game) {},         // the default jump fired
    onHazard(p, game, tile) {}, // return true to be immune to this hazard tile
    onTouchEntity(p, game, e) {},   // return true to handle a touch yourself (e.g. a ram that calls game.hit(e,'ability'))
    draw(ctx, p, game, e) {},   // optional custom draw while captured
  },
});
```

Whisk teleports into the creature when the hat touches it. Only Left, Right, Jump, Hat exist: Hat always exits (with a small upward pop). Express abilities with Jump (tap, hold to charge via `c.jumpHeld`, release) and direction. Abilities that break tiles call `game.breakTilesIn(...)`; abilities that hurt enemies call `game.hit(e, 'ability')`.

### Built-in entity types

| Type | Props / notes |
|---|---|
| `button` | `value` (1) |
| `spark` | `id` (auto), `boss` |
| `heart` | restores one heart |
| `checkpoint` | `index` (auto), `gdir` (gravity to respawn with) |
| `hint` | `text`, `radius` (46). Mumble's teacup |
| `goal` | touching it clears the world (stubs) |
| `gloomlet` | `speed` (0.6), `dir`, `still` |
| `mover` | moving one-way platform: `tiles` (3 wide), `moveX`, `moveY` (tiles of travel), `period` (240 frames there and back), `phase` (0..1), `signal`, `draw` |
| `blink` | timed platform: `tiles` (2), `on` (90), `off` (70), `phase` (frames) |
| `switch` | `id`, `mode` `'toggle'|'once'|'timed'|'hold'`, `time`, `plate` (pressure plate instead of a hat target) |
| `door` | solid, opens while signal `id` is on: `tilesW` (1), `tilesH` (3), `invert` |
| `zone` | section 8 |
| `projectile` | via `game.shoot` |
| `springle`, `puffcloud` | world 1 creatures, reusable anywhere |

## 8. Zones (water, wind, gravity, triggers)

`L.zone(kind, tx, ty, tw, th, props)` or `L.zoneBetween(markerChar, kind, props)`.

| Kind | Props | Effect on bodies whose centre is inside |
|---|---|---|
| `'water'` | | swim physics (same as `~` tiles; use a zone for big pools, drawn as one rectangle) |
| `'wind'` | `fx` (px/frame sideways drift), `fy` (added to vy each frame; -0.7 beats gravity and lifts) | pushes Whisk and `stepBody` entities; scaled by `capture.move.windScale` |
| `'gravity'` | `dir: -1` (up) or `1` | flips gravity while inside. Whisk is drawn upside-down, walks on ceilings, Jump pushes away from the ceiling; controls and camera stay screen-relative. Falling out of the top of the level while flipped counts as a pit |
| `'trigger'` | | nothing by itself |
| any kind | `onEnter(game, zone)`, `onExit`, `onStay`, `once`, `signal` (only active while that signal is on), `invisible`, `draw(ctx, zone, game)` | callbacks fire for the player |

Per-body gravity without a zone: `game.flipGravity(game.player)` (or any entity). Spikes for ceilings: `v`.

## 9. Bosses

```js
import { defineBoss, hurtBoss, runPattern, byHits, stepName, gotoStep } from '../engine/boss.js';

const STEPS = [
  { name: 'chase', frames: (e) => byHits(e, [120, 100, 80]), tick(e, game, t) { /* set e.vx */ } },
  { name: 'windup', frames: 36, enter(e, game) { e.vx = 0; } },
  { name: 'attack', enter(e, game) { e.vy = -8; }, until: (e) => e.onGround && e.stepT > 6 },
  { name: 'rest', frames: 110 },                       // optional: next: 'chase'
];
defineBoss('w4_boss', {
  title: 'Sir Snore', hp: 3, w: 60, h: 60, hurtInv: 100,
  update(e, game) { runPattern(e, game, STEPS); stepBody(game, e); },   // only while fighting
  idle(e, game) { stepBody(game, e); },                                 // dormant / during defeat
  onHit(e, game, source) { return source === 'ability' ? hurtBoss(e, game) : false; },
  onHurt(e, game) {}, onDefeated(e, game) {}, reset(e, game) {},
  draw(ctx, e, game) {},
});
```

- `L.arena({from, to, boss, bossAt})`: the boss is spawned dormant at the `bossAt` cell. When Whisk walks 30px into the arena the camera locks to it, invisible walls close, the boss wakes, the boss bar (title + pips) appears, `bossMusic` plays and the cutscene `w{N}_boss` is requested.
- Default `onHit`: stomps, abilities and friendly projectiles count, the hat clinks. Override it so the fight needs **your world's captures**. Call `hurtBoss(e, game)` for a hit that counts (it handles hp, invulnerability, shake, confetti).
- Fields: `e.hp, e.maxHp, e.inv, e.dormant, e.defeated, e.step, e.stepT`. `byHits(e, [a, b, c])` picks by hits taken. `stepName(e, STEPS)` for drawing.
- At 0 hp the engine plays 96 frames of confetti, removes the boss, unlocks the camera and drops the 8th Fun Spark at a reachable spot under where the boss was; collecting it clears the world. For the final boss, show the "he laughs" beat in `onDefeated` / your idle drawing and the `w8_clear` cutscene.
- If Whisk respawns mid-fight the arena reopens and the boss goes home dormant (hp is kept: kid-friendly). **Put a checkpoint right before the arena**, and put the creatures the fight needs inside it (they reappear at home 50 frames after use).
- Do not trap the player: bosses that fill the arena height must stay away from the edges or leave a way past (Big Glum patrols 110px short of each wall).

## 10. Art helpers (`js/art/`)

Style: ink outlines `#241a3a` (1.5 to 2.5px, round joins), flat bright fills, small highlights. Characters are positioned by their FEET (bottom-centre) unless noted.

| Module | Exports |
|---|---|
| `draw.js` | `INK, FONT, PAL` (palette: cream, ginger, hatPurple, hatBrim, hatPatch, hatBand, teal, tangerine, brass, spark, button, heart, gloom, gloomDark, gloomLight, pink, sky, grass, `confetti[]`), `outline(ctx, w)`, `blob(ctx, x, y, rx, ry, fill, lw)`, `rrect(ctx, x, y, w, h, r, fill, lw)`, `rrectPath`, `starPath`, `eyes`, `text(ctx, str, x, y, size, fill, align, weight, stroke)`, `wrapText` (cache it), `vGradient(ctx, key, y0, y1, stops)` (cached) |
| `whisk.js` | `drawWhisk(ctx, x, y, {facing, pose: 'idle'|'walk'|'jump'|'fall'|'hurt'|'cheer'|'swim', t, hat, flipY, scale, hatStyle})` |
| `hat.js` | `drawHat(ctx, x, y, {scale, angle, wobble, style, squash})` (brim bottom-centre), `drawCaptureHat(ctx, x, y, {scale, t})` (mini hat + cat ears; top-centre of a head; the engine draws it on captured creatures automatically), `registerHatStyle(id, {crown, brim, patch, band})`, `setHatStyle`, `getHatStyle`, `hatStyles` |
| `friends.js` | `drawFizz`, `drawPop`, `drawMouse(ctx, x, y, {color, facing, t, moving, cheer})`, `drawMumble(ctx, x, y, {t, talking, facing, scale})` (cup base), `drawZeppelin(ctx, x, y, {t, scale, facing, glow, still})` (balloon centre; 96x84 at scale 1), `drawBaron(ctx, x, y, {t, scale, facing, mood: 'glum'|'cross'|'surprised'|'laugh', color: 0..1})` |
| `items.js` | `drawSpark(ctx, x, y, {t, scale, ghost})`, `drawButton(ctx, x, y, {t, scale, flat, color})`, `drawHeart(ctx, x, y, full, scale)` (all centre-anchored), `drawFlag(ctx, x, y, {active, t})` (pole base), `drawGloomlet(ctx, x, y, {facing, t, scale, squash, mood: 'grump'|'angry'|'dizzy'|'sleepy', body, dark})`, `drawPanel` |
| `bg.js` | `sky(ctx, view, key, stops)`, `hills(ctx, cam, view, {factor, base, amp, wave, color, seed, levelH, yFactor, stroke})`, `scatter(ctx, cam, view, {factor, spacing, yMin, yMax, seed, drift, t}, drawFn)`, `cloud(ctx, x, y, scale, color)` |

World-specific art (creatures, bosses, tiles, backgrounds) lives in your world file.

## 11. Audio, save, input APIs

**Audio** (`engine/audio.js`, export `audio`): `unlock()`, `sfx(name)`, `music(trackId)`, `stopMusic()`, `setVolume(0..1)`, `setSfxEnabled(bool)`, `setMusicEnabled(bool)`, `suspend()`, `resume()`. Unknown names must be ignored silently. In worlds call `game.sfx(name)`.
Names the engine fires: `jump land throw catch capture release hattrick button spark heart hurt stomp pop checkpoint bounce break switch door splash swim clink hint toast bosshit bossdown clear ui uiBack pause`. Music ids requested: `title map w1..w9 boss finalboss clear` (plus whatever a world sets in `music` / `bossMusic`). The current version is a tiny placeholder synth with no music.

**Save** (`engine/save.js`, export `save`; localStorage key `hat-trick-odyssey-save-v1`, everything try/catch):
`save.data` = `{worlds: {n: {sparks (bitmask), cleared, bestTime, buttonsBest}}, buttons, hats: [ids], hat, settings: {sfx, music, volume, shake}, seen: {}}`.
Methods: `load()`, `commit()`, `reset()`, `world(n)`, `hasSpark(n, id)`, `addSpark(n, id)`, `sparkCount(n)`, `totalSparks()`, `isCleared(n)`, `setCleared(n, frames, buttons)`, `isUnlocked(n)`, `lockReason(n)` → `null | {needClear} | {needSparks}`, `buttons`, `addButtons(k)`, `spendButtons(k)` → bool, `ownsHat(id)`, `addHat(id)`, `equipHat(id)`, `setting(k)`, `setSetting(k, v)`, `flag(k)`, `setFlag(k, v)`. Constants: `WORLD_COUNT` 9, `SPARKS_PER_WORLD` 8, `SPARKS_NEEDED` (world n unlocks when world n-1 is cleared AND total sparks ≥ `[_,0,1,4,8,12,17,22,28,48][n]`). The engine saves sparks, clears and buttons itself; worlds never need to.

**Input** (`engine/input.js`, export `input`): actions `left right jump hat pause`. `held(a)`, `pressed(a)` (queued, never missed), `released(a)`, `consume(a)`, `axis()`. Menus use Left/Right to move, Jump to confirm, Hat to go back. Keyboard: arrows/A-D, Space/Z/Up/W, X/Shift, Esc/P/Enter = pause. Worlds read input only through capture hooks (`c`), never directly.

## 12. App, scenes, cutscenes (UI agents)

`app` (from `js/main.js`, passed to every scene hook): `app.go(sceneName, params)`, `app.save`, `app.audio`, `app.input`, `app.view`, `app.worlds` (index = world id), `app.cutscenes`, `app.applySettings()`, `app.wantTouch()`, `app.t`.

A scene is an object `{enter(app, params), exit(app), update(app), draw(ctx, app), pointer(app, kind, x, y), resize(app), onHide(app)}` (all optional). `draw` is in view coordinates (0..`view.w`, 0..`view.h`); `pointer` kinds are `'down' | 'move' | 'up'` in the same coordinates. Scenes and required exports:

| File | Export | Must do |
|---|---|---|
| `ui/title.js` | `titleScene` | on tap/Jump: play cutscene `'intro'` the first time, then `app.go('map')` |
| `ui/map.js` | `mapScene` | list 9 worlds with `save.isUnlocked/lockReason/sparkCount/isCleared`; `app.go('play', {world: n})`; links to `'shop'` and `'settings'`. `enter` params: `{world, advance}` |
| `ui/clear.js` | `clearScene` | `enter(app, {world, name, sparks, newSparks, buttons, frames})`; then `app.go('map', {world, advance: true})` |
| `ui/shop.js` | `shopScene` | spend Buttons on hat styles (`registerHatStyle` at module load, `save.addHat/equipHat`); back to `'map'`. The engine applies `save.data.hat` when a world starts |
| `ui/settings.js` | `settingsScene` | toggle settings, call `app.applySettings()`; back to `'map'` |
| `ui/cutscenes.js` | `cutscenes` | `play(id)` → Promise; `active`; `update(app)`, `draw(ctx, app)`, `pointer(app, kind, x, y)`. Resolve immediately for unknown ids and for scenes that should not replay (`app.save.flag`). **Set `active = true` synchronously inside `play()`** when a scene will show: the engine only waits for the promise if `active` is true. While active, the app calls the cutscene's update/draw/pointer instead of updating the scene underneath (which is still drawn first) |

Cutscene ids requested by the engine: `intro`, `w{N}_intro` (entering a world), `w{N}_boss` (first time the arena locks), `w{N}_clear` (before the clear screen). `ui/widgets.js` has `button(ctx, rect, label, opts)` and `hit(rect, x, y, pad)`.

Flow: title → map → play (pause menu: resume, back to flag, sound, music, map) → boss → clear → map.

## 13. Debug API and smoke test

URL params: `?world=N` (straight into a world), `?debug=1` (exposes `window.__hto`), `?unlock=1` (all worlds open), `?reset=1` (wipe the save), `?touch=1` (show touch buttons on desktop).

`window.__hto`:

| Member | |
|---|---|
| `state` | e.g. `'play:play'`, `'play:paused'`, `'play:respawn'`, `'play:clear'`, `'map'` |
| `scene`, `game`, `app`, `view`, `perf` | current scene name, the raw Game, the app, view size, `{fps, updateMs, drawMs}` |
| `player` | `{x, y, w, h, vx, vy, form, hearts, onGround, gdir, inv, hat}` |
| `world` | `{id, name, stub, tilesW, tilesH, pxW, pxH, entities, active, arena, checkpointIndex}` |
| `checkpoints`, `sparks` | `[{index, x, y}]`, `[{id, x, y, collected, ghost}]` |
| `counts` | sparks/buttons/checkpoints/hints in the level, entities by type, run stats |
| `errors` | array of error strings caught by the engine |
| `teleport(x, y)`, `teleportTile(tx, ty)`, `gotoCheckpoint(i)` (-1 = start), `gotoArena()` | movement |
| `setInvincible(bool)`, `hurt()`, `defeatBoss()` | cheats |
| `freeze(bool)`, `step(n)`, `timeScale(s)` | time control (`freeze(true)` then `step(n)` is deterministic and fast) |
| `hold(action, bool)`, `tap(action)`, `releaseAll()` | virtual input |
| `startWorld(n)`, `go(scene, params)`, `worlds()` | navigation |

Smoke test (Playwright + Chromium are preinstalled; never run `playwright install`):

```
tools/serve.sh 8101 &                       # python3 -m http.server from the project folder
node tools/smoke.mjs --port 8101 --world 4 --out /tmp/w4-shots --device iphone   # or ipad | desktop
```

It fails (exit 1, `ok: false`) on any console error, page error or failed request; checks real keyboard or real touch input (hold Right, second finger Jump, slide to Left, Hat); estimates fps; plays randomly for `--ticks` (1800); visits every checkpoint, spark and the boss arena with a screenshot each (`cp-NN.png`, `spark-N.png`, `boss-arena.png`, `boss-arena-later.png`); then beats the boss via the debug API and expects the clear screen (`--no-flow` skips, `--no-sparks` skips spark shots). It prints a JSON report. **Open the PNGs and look at them.** For mechanics, script your own check with `freeze/step/hold/tap` (pattern: `page.evaluate` a loop that reads `__hto.game` and steps one tick at a time), for example "capture the creature, do the ability, assert the spark is collected".

## 14. World checklist

- [ ] `id`, `name`, `build`, not `stub`; only `js/worlds/wN.js` touched; all new entity/tile names prefixed `wN_`
- [ ] One long level (first-time play 3 to 6 minutes: roughly 250 to 450 tiles of travel), at least 17 rows tall, its own `theme` + `drawBackground` (parallax, covers any view size) and tile look
- [ ] At least 2 new capturable creatures with clearly different abilities, each taught in a safe spot before it is needed
- [ ] At least 2 enemy/hazard types beyond the plain Gloomlet
- [ ] 4+ checkpoints, including one right before the boss arena and one after each hard section
- [ ] Exactly 7 `*` sparks + the boss spark; some behind capture puzzles or hat tricks; none unreachable (verify with a scripted run or by reasoning with section 3 numbers)
- [ ] 40+ Buttons (`__hto.counts.buttonsInLevel`)
- [ ] A Mumble `?` with an original rhyme for every new idea (two short lines, `\n` between them)
- [ ] Boss arena ≥ 30 tiles wide, 3-hit boss via `defineBoss`, beaten with this world's captures, cannot corner the player
- [ ] The main path never requires a pixel-perfect jump: gaps ≤ 3 tiles for plain jumps, mandatory hat tricks only over safe floors
- [ ] No softlocks: creatures needed for progress reappear (default) and every pit/hazard leads back to a checkpoint
- [ ] `node tools/smoke.mjs` passes on `desktop` and `iphone` with `ok: true`, and the screenshots look right at both sizes
- [ ] No per-frame allocations in `update`/`draw` hot paths; nothing drawn far outside the camera
