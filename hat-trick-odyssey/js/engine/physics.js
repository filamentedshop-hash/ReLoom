// Tile + platform collision for any "body": an object with
//   x, y, w, h, vx, vy, gdir (1 = gravity down, -1 = gravity up)
// After moveBody() the body has: onGround, hitWall (-1/0/1), hitCeil, riding
// (platform entity or null), groundTile (tile def stood on), touchHazard (tile
// def or null), inLiquid (bool), bounced (launched by a bouncy tile this tick).
import { TILE, PHYS } from './const.js';

const EPS = 0.001;

// Environment at a body: zones (wind/water/gravity) + liquid tiles.
// Writes b.envWindX, b.envWindY, b.inLiquid, b.gdir. Returns nothing.
export function senseEnv(game, b) {
  const L = game.level;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const d = L.defAt(cx, cy);
  let liquid = !!(d && d.liquid);
  let wx = 0, wy = 0, g = b.baseGdir || 1;
  const zs = game.zones;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (z.off || cx < z.x || cx > z.x + z.w || cy < z.y || cy > z.y + z.h) continue;
    const k = z.kind;
    if (k === 'water') liquid = true;
    else if (k === 'wind') { wx += z.fx; wy += z.fy; }
    else if (k === 'gravity') g = z.dir;
  }
  b.inLiquid = liquid; b.envWindX = wx; b.envWindY = wy; b.gdir = g;
}

export function moveBody(game, b) {
  const L = game.level;
  const g = b.gdir || 1;
  const wasGround = b.onGround;
  b.onGround = false; b.hitWall = 0; b.hitCeil = false; b.bounced = false;

  // Carried by the platform we stood on last tick.
  let carryX = 0;
  const ride = b.riding;
  if (ride) {
    if (ride.dead || ride.off) b.riding = null;
    else { carryX = ride.dx; b.y += ride.dy; }
  }
  const prevY = b.y;

  // ---------------- X ----------------
  const mx = b.vx + (b.pushX || 0) + carryX;
  if (mx !== 0) {
    b.x += mx;
    const y0 = Math.floor((b.y + EPS) / TILE), y1 = Math.floor((b.y + b.h - EPS) / TILE);
    if (mx > 0) {
      const tx = Math.floor((b.x + b.w - EPS) / TILE);
      for (let ty = y0; ty <= y1; ty++) if (L.solid(tx, ty)) { b.x = tx * TILE - b.w; b.hitWall = 1; if (b.vx > 0) b.vx = 0; break; }
    } else {
      const tx = Math.floor(b.x / TILE);
      for (let ty = y0; ty <= y1; ty++) if (L.solid(tx, ty)) { b.x = (tx + 1) * TILE; b.hitWall = -1; if (b.vx < 0) b.vx = 0; break; }
    }
    const S = game.solids;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (s === b || s.off || s.dead) continue;
      if (b.x < s.x + s.w && b.x + b.w > s.x && b.y < s.y + s.h - EPS && b.y + b.h > s.y + EPS) {
        if (b.x + b.w / 2 < s.x + s.w / 2) { b.x = s.x - b.w; b.hitWall = 1; if (b.vx > 0) b.vx = 0; }
        else { b.x = s.x + s.w; b.hitWall = -1; if (b.vx < 0) b.vx = 0; }
      }
    }
  }

  // ---------------- Y ----------------
  const my = b.vy;
  b.y += my;
  const x0 = Math.floor((b.x + EPS) / TILE), x1 = Math.floor((b.x + b.w - EPS) / TILE);
  let landed = false, ground = null;
  if (my * g >= 0) {
    // moving "down" (towards gravity): floors, one-ways, platforms
    if (g > 0) {
      const ty = Math.floor((b.y + b.h - EPS) / TILE);
      const prevFeet = prevY + b.h;
      for (let tx = x0; tx <= x1; tx++) {
        const d = L.def(tx, ty);
        if (!d) continue;
        if (d.solid || (d.oneway && !b.dropThrough && prevFeet <= ty * TILE + 0.5)) {
          b.y = ty * TILE - b.h; landed = true;
          if (!ground || Math.abs((tx + 0.5) * TILE - (b.x + b.w / 2)) < TILE / 2) ground = d;
        }
      }
    } else {
      const ty = Math.floor(b.y / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const d = L.def(tx, ty);
        if (!d) continue;
        if (d.solid || (d.oneway && !b.dropThrough && prevY >= (ty + 1) * TILE - 0.5)) {
          b.y = (ty + 1) * TILE; landed = true;
          if (!ground || Math.abs((tx + 0.5) * TILE - (b.x + b.w / 2)) < TILE / 2) ground = d;
        }
      }
    }
  } else {
    // moving "up" (against gravity): ceilings
    if (g > 0) {
      const ty = Math.floor(b.y / TILE);
      for (let tx = x0; tx <= x1; tx++) if (L.solid(tx, ty) && ty >= 0) { b.y = (ty + 1) * TILE; b.hitCeil = true; b.ceilTx = tx; b.ceilTy = ty; }
    } else {
      const ty = Math.floor((b.y + b.h - EPS) / TILE);
      for (let tx = x0; tx <= x1; tx++) if (L.solid(tx, ty) && ty < L.h) { b.y = ty * TILE - b.h; b.hitCeil = true; b.ceilTx = tx; b.ceilTy = ty; }
    }
    if (b.hitCeil) b.vy = 0;
  }

  // solid boxes (vertical)
  const S = game.solids;
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    if (s === b || s.off || s.dead) continue;
    if (b.x < s.x + s.w - EPS && b.x + b.w > s.x + EPS && b.y < s.y + s.h && b.y + b.h > s.y) {
      const fromAbove = b.y + b.h / 2 < s.y + s.h / 2;
      if (fromAbove) { b.y = s.y - b.h; if (g > 0) { landed = true; b.riding = s; } else { b.hitCeil = true; if (b.vy > 0) b.vy = 0; } }
      else { b.y = s.y + s.h; if (g < 0) { landed = true; b.riding = s; } else { b.hitCeil = true; if (b.vy < 0) b.vy = 0; } }
    }
  }

  // one-way platforms (entities): land on the gravity-facing surface
  let plat = null;
  if (my * g >= 0 && !b.dropThrough) {
    const P = game.platforms;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p === b || p.off || p.dead) continue;
      if (b.x + b.w <= p.x + EPS || b.x >= p.x + p.w - EPS) continue;
      if (g > 0) {
        const top = p.y, prevTop = p.y - p.dy;
        const prevFeet = prevY + b.h - (ride === p ? 0 : 0);
        if (b.y + b.h >= top && prevFeet <= prevTop + Math.max(2, Math.abs(p.dy) + 1.5)) { b.y = top - b.h; plat = p; }
      } else {
        const bot = p.y + p.h, prevBot = bot - p.dy;
        if (b.y <= bot && prevY >= prevBot - Math.max(2, Math.abs(p.dy) + 1.5)) { b.y = bot; plat = p; }
      }
    }
  }
  if (plat) { landed = true; b.riding = plat; ground = null; }
  else if (!landed || ground) { if (!(b.riding && b.riding.def && b.riding.def.solid && landed)) b.riding = null; }

  if (landed) {
    b.onGround = true;
    b.groundTile = ground;
    if (ground && ground.bounce && my * g > 0.5) {
      b.vy = -g * (b.bounceHeld ? Math.max(ground.bounce, PHYS.bounceTileHeld) : ground.bounce);
      b.onGround = false; b.bounced = true;
    } else b.vy = 0;
  } else b.groundTile = null;
  b.justLanded = landed && !wasGround;

  // hazards: any overlapping hazard tile (hitbox inset so grazes are forgiven)
  b.touchHazard = null;
  const hx0 = Math.floor((b.x + 3) / TILE), hx1 = Math.floor((b.x + b.w - 3) / TILE);
  const hy0 = Math.floor((b.y + 3) / TILE), hy1 = Math.floor((b.y + b.h - 2) / TILE);
  for (let ty = hy0; ty <= hy1; ty++) for (let tx = hx0; tx <= hx1; tx++) {
    const d = L.def(tx, ty);
    if (d && d.hazard) b.touchHazard = d;
  }
}

// One-call physics for simple entities: environment + gravity + movement.
// opts: {gravity (default PHYS.gravity), maxFall, windScale}
export function stepBody(game, b, opts) {
  senseEnv(game, b);
  const grav = (opts && opts.gravity !== undefined ? opts.gravity : PHYS.gravity) * game.gravityScale;
  const maxFall = opts && opts.maxFall !== undefined ? opts.maxFall : PHYS.maxFall;
  const ws = opts && opts.windScale !== undefined ? opts.windScale : 1;
  if (b.inLiquid) { b.vy += grav * 0.3 * b.gdir; if (b.vy * b.gdir > 2) b.vy = 2 * b.gdir; }
  else b.vy += grav * b.gdir;
  b.vy += b.envWindY * ws;
  if (b.vy * b.gdir > maxFall) b.vy = maxFall * b.gdir;
  b.pushX = b.envWindX * ws + (b.onGround && b.groundTile ? b.groundTile.conveyor : 0);
  moveBody(game, b);
}

// Would the body walk off a ledge or into a wall if it kept going in `dir`?
// Handy for patrol enemies.
export function edgeAhead(game, b, dir) {
  const L = game.level;
  const fx = dir > 0 ? b.x + b.w + 2 : b.x - 2;
  if (L.solidAt(fx, b.y + b.h / 2)) return true;
  const fy = b.gdir > 0 ? b.y + b.h + 4 : b.y - 4;
  const d = L.defAt(fx, fy);
  return !(d && (d.solid || d.oneway));
}
