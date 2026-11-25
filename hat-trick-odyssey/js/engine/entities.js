// Entity type registry. Worlds call defineEntity() at module load time to add
// their own creatures, enemies, hazards and bosses; the engine never needs to
// be edited. See CONTRACT.md "Entities" for the full list of fields and hooks.

const defs = new Map();

const DEFAULTS = {
  w: 16, h: 16,
  anchor: 'feet',        // how level cells place it: 'feet' | 'center' | 'cell'
  layer: 0,              // -1 behind, 0 normal, 1 in front of the player
  always: false,         // update/draw even when far from the camera
  sizeFromProps: false,  // take w/h from spawn props (zones, platforms, doors)
  // interaction flags
  pickup: false,         // touching (player or hat) calls onCollect
  enemy: false,          // stompable + hurts on touch + hat defeats it (see below)
  stompable: true,       // (enemy) can be stomped from above
  hurts: true,           // (enemy) touching it from the side hurts
  hatProof: false,       // (enemy) the hat clinks off instead of defeating it
  capturable: false,     // the hat captures it (needs a `capture` spec)
  platform: false,       // one-way surface that carries riders (moving platforms)
  solid: false,          // full solid box (doors, crates)
  zone: false,           // handled by the zone system, not by touch
  boss: false,
  // hooks (all optional):
  //   init(e, game)             once when spawned (read e.props here)
  //   update(e, game)           every tick while active
  //   draw(ctx, e, game)        world coordinates; ctx is already camera-translated
  //   onTouch(e, game, player)  player overlaps it (any kind)
  //   onStomp(e, game, player)  replaces the default stomp result
  //   onHat(e, game, hat)       replaces the default hat result; return 'bounce'
  //                             to send the hat back, anything else to let it fly on
  //   onHit(e, game, source)    harmed by 'hat' | 'stomp' | 'projectile' | 'ability';
  //                             default: defeated. Return false = no effect (clink)
  //   onDefeat(e, game)         after being defeated
  //   onCollect(e, game)        (pickup)
  //   capture: {...}            (capturable) see CONTRACT.md "Capturable creatures"
};

export function defineEntity(name, def) {
  if (defs.has(name)) { console.error(`[entities] duplicate entity type '${name}' ignored`); return defs.get(name); }
  const d = Object.assign({ name }, DEFAULTS, def);
  if (d.capturable && !d.capture) d.capture = {};
  defs.set(name, d);
  return d;
}
export function getDef(name) { return defs.get(name) || null; }
export function allDefs() { return defs; }

let nextId = 1;
export function createEntity(type, x, y, props) {
  const def = defs.get(type);
  if (!def) throw new Error(`Unknown entity type '${type}'`);
  const p = props || {};
  return {
    id: nextId++, type, def, props: p,
    x, y,
    w: def.sizeFromProps && p.w !== undefined ? p.w : def.w,
    h: def.sizeFromProps && p.h !== undefined ? p.h : def.h,
    vx: 0, vy: 0, facing: p.facing || -1,
    gdir: p.gdir || 1, baseGdir: p.gdir || 1,
    homeX: x, homeY: y,
    t: 0, dead: false, hidden: false, active: false, cooldown: 0,
    onGround: false, hitWall: 0, hitCeil: false, riding: null, inLiquid: false,
    groundTile: null, touchHazard: null, bounced: false, pushX: 0,
    dx: 0, dy: 0,          // movement this tick (platforms: used to carry riders)
    light: 0,              // radius of light in darkness (0 = none)
  };
}
