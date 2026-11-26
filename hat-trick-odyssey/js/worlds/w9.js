// WORLD 9: THE MOON OF MESS (post-game bonus). A low-gravity moon made of
// everything that ever got lost: odd socks, toy blocks, runaway marbles and
// tangled yarn. The hardest platforming in the game.
//
// Ideas, in order:
//   1. Moon gravity (world.gravityScale 0.7): long floaty jumps.
//   2. A jump-throw Hat Trick to reach a high ledge (taught right away).
//   3. Old friends, remixed: SPRINGLE (w1) up a block tower, CORK ROCKET (w2)
//      over a wide crater and up through a marble-glass ceiling.
//   4. TWIRLY TOP (new capture): hop, then Jump in mid-air for a whirling
//      dash that smashes candy-striped toy blocks and pops enemies.
//   5. YARN YO-YO (new capture): Jump near a hook to catch on (the yarn
//      winds itself up), Left/Right to pump the swing, Jump again to let go.
//   6. PUFFPOT (w6) up a block chimney (hold Jump in mid-air to steam).
//   7. Capture-to-capture transfers in mid-air: Puffcloud -> Twirly Top
//      (dash through a wall) -> Yarn Yo-Yo (swing to safety).
//   8. Hat Trick chains over a safe floor: catch the hat while still rising
//      and throw it again (optional expert line; a single-trick step is the
//      main path).
//   Boss: THE MESS MONSTER, a heap of lost toys and laundry with button eyes.
//   It slams a sock-arm down; while the sock lies limp, tidy it into the
//   giant toy chest: sock 1 with a Twirly Top dash, sock 2 yanked by a Yarn
//   Yo-Yo, sock 3 with a Springle stomp. Reward: the golden hat flag.
//
// Imported creatures are looked up in the shared registry when the level is
// built; if another world ever renames one, a stand-in with a similar ability
// is used instead (see pickCreature) so the level stays beatable.
import { TILE, INK, clamp, lerp, hash2 } from '../engine/const.js';
import { defineEntity, getDef } from '../engine/entities.js';
import { defineTile } from '../engine/tiles.js';
import { stepBody, edgeAhead } from '../engine/physics.js';
import { defineBoss, hurtBoss, runPattern, byHits, stepName, gotoStep } from '../engine/boss.js';
import { PAL, outline, blob, rrect, starPath, text } from '../art/draw.js';
import { drawGloomlet } from '../art/items.js';
import { sky, hills, scatter } from '../art/bg.js';

const TAU = Math.PI * 2;
const H = 24;               // level height in tiles
const FLOOR = 19;           // top row of the main moon floor
const STAND = FLOOR - 1;    // the row things stand in on the floor

// ============================================================== tiles
const BLOCK_COLS = [['#ff6f91', '#d94a70'], ['#4fd1c5', '#2fa89e'], ['#ffd23f', '#e0a91c'], ['#9b6dff', '#7448d6'], ['#7bd857', '#55b03a']];

function toyBlock(ctx, x, y, tx, ty) {
  const k = (hash2(tx, ty) * BLOCK_COLS.length) | 0, c = BLOCK_COLS[k];
  ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = c[1]; ctx.fillRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
  ctx.fillStyle = c[0]; ctx.fillRect(x + 1.5, y + 1.5, TILE - 5, TILE - 5);
  ctx.fillStyle = '#fff6e4'; ctx.fillRect(x + 5, y + 5, 12, 12);
  ctx.fillStyle = c[1];
  const s = ((hash2(ty, tx) * 3) | 0);
  ctx.beginPath();
  if (s === 0) ctx.arc(x + 11, y + 11, 4, 0, TAU);
  else if (s === 1) { ctx.moveTo(x + 11, y + 6.5); ctx.lineTo(x + 15.5, y + 15); ctx.lineTo(x + 6.5, y + 15); ctx.closePath(); }
  else { ctx.rect(x + 7.5, y + 7.5, 7, 7); }
  ctx.fill();
}

// Candy-striped toy blocks: only a Twirly Top dash knocks them loose.
defineTile('w9_toyblock', {
  solid: true, breakable: true, w9top: true,
  draw(ctx, x, y, i) {
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#fff1f6'; ctx.fillRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    for (let k = -1; k < 3; k++) { const o = k * 10 + 2; ctx.moveTo(x + 1.5 + o, y + 1.5); ctx.lineTo(x + 6.5 + o, y + 1.5); ctx.lineTo(x + 1.5 + o + 5 - 21, y + 22.5); ctx.lineTo(x + 1.5 + o - 21, y + 22.5); }
    ctx.save(); ctx.beginPath(); ctx.rect(x + 1.5, y + 1.5, TILE - 3, TILE - 3); ctx.clip();
    ctx.fillStyle = '#ff8fb5';
    for (let k = 0; k < 4; k++) { const o = x - 8 + k * 9; ctx.beginPath(); ctx.moveTo(o, y + 24); ctx.lineTo(o + 4, y + 24); ctx.lineTo(o + 24, y); ctx.lineTo(o + 20, y); ctx.fill(); }
    ctx.restore();
    // a little swirl = "a spinning top can knock me out"
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x + 12, y + 12, 5, 0.3, 5.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 12, y + 12, 2, 2.5, 7.6); ctx.stroke();
  },
});

// Marble-glass panes: a Cork Rocket smashes them.
defineTile('w9_glass', {
  solid: true, breakable: true, corkBreak: true,
  draw(ctx, x, y, i) {
    ctx.fillStyle = INK; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(150,215,255,0.95)'; ctx.fillRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
    ctx.fillStyle = '#d6f0ff'; ctx.fillRect(x + 4, y + 4, 4, 10); ctx.fillRect(x + 10, y + 4, 3, 3);
    ctx.strokeStyle = 'rgba(36,26,58,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 14, y + 6); ctx.lineTo(x + 17, y + 12); ctx.lineTo(x + 14, y + 17); ctx.moveTo(x + 17, y + 12); ctx.lineTo(x + 21, y + 13); ctx.stroke();
    ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.arc(x + 17, y + 19, 2, 0, TAU); ctx.fill();
  },
});

// ============================================================== hooks
// Felt buttons with a brass hook: Yarn Yo-Yo anchor points.
defineEntity('w9_hook', {
  w: 18, h: 18, anchor: 'center', layer: -1,
  draw(ctx, e, game) {
    const cx = e.x + 9, cy = e.y + 9, tgt = game.data.yoTarget === e;
    if (tgt) {
      ctx.strokeStyle = (game.t >> 3) & 1 ? '#ffe27a' : '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 14 + Math.sin(game.t * 0.3) * 2, 0, TAU); ctx.stroke();
    }
    blob(ctx, cx, cy - 2, 8.5, 8.5, '#5ab8ff', 2);
    blob(ctx, cx, cy - 2, 5.5, 5.5, '#8fd0ff', 0);
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 3, cy - 5, 2, 2); ctx.fillRect(cx + 1, cy - 5, 2, 2); ctx.fillRect(cx - 3, cy - 1, 2, 2); ctx.fillRect(cx + 1, cy - 1, 2, 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 9); ctx.arc(cx + 3.5, cy + 9, 3.5, Math.PI, 0, true); ctx.stroke();
    ctx.strokeStyle = PAL.brass; ctx.lineWidth = 2; ctx.stroke();
  },
});

// ============================================================== YARN YO-YO
// Capture: walks and hops a little. Jump near a hook (in range, glowing ring)
// = catch on; the yarn winds itself up to a comfy length. Left/Right = pump
// the swing. Jump again = let go with a snappy flick. Captured in mid-air
// under a hook, it starts swinging right away.
const YO_RANGE = 150, YO_MINLEN = 38, YO_MAXLEN = 150, YO_COMFY = 80;

function drawYoyo(ctx, cx, cy, e, spin, mood) {
  ctx.save(); ctx.translate(cx, cy);
  // side discs
  blob(ctx, 0, 0, 9.5, 9.5, '#ff6f91', 2.2);
  ctx.strokeStyle = '#ffb3c9'; ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) { const a = spin + k * 2.094; ctx.beginPath(); ctx.arc(0, 0, 7, a, a + 0.9); ctx.stroke(); }
  blob(ctx, 0, 0, 5.6, 5.6, '#ffd23f', 1.6);
  // face on the hub
  const f = e.facing || 1;
  ctx.fillStyle = INK;
  if (mood === 'dizzy') { ctx.font = '700 5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('x  x', f * 0.6, -0.2); }
  else { ctx.beginPath(); ctx.arc(f * 0.8 - 2, -1.2, 0.95, 0, TAU); ctx.arc(f * 0.8 + 2, -1.2, 0.95, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(f * 0.8, 0.6, 1.6, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,160,0.7)'; ctx.fillRect(f * 0.8 - 4.4, 0.6, 1.6, 1.1); ctx.fillRect(f * 0.8 + 2.8, 0.6, 1.6, 1.1);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-4.5, -5, 2.2, 1.2, -0.7, 0, TAU); ctx.fill();
  ctx.restore();
}
function yarn(ctx, x0, y0, x1, y1, slack, t) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + slack;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.6; ctx.stroke();
}

function yoFindTarget(game, p) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, A = game.active;
  let best = null, bd = YO_RANGE * YO_RANGE;
  for (let i = 0; i < A.length; i++) {
    const e = A[i];
    if (e.type !== 'w9_hook' || e.dead) continue;
    const dx = e.x + e.w / 2 - cx, dy = e.y + e.h / 2 - cy;
    if (dy > 12) continue;                                // hooks must be above (or level)
    const d = dx * dx + dy * dy - (dx * p.facing > 0 ? 900 : 0);   // small forward bias
    if (d < bd) { bd = d; best = e; }
  }
  const x = game.data.yoExtra;                            // the boss's limp sock (yank target)
  if (x && x.on) {
    const dx = x.x - cx, dy = x.y - cy;
    if (dx * dx + dy * dy < YO_RANGE * YO_RANGE * 1.1) return x;
  }
  return best;
}
function yoAttach(p, game, hook) {
  const d = p.data, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  d.hook = hook;
  d.len = clamp(Math.hypot(hook.x + hook.w / 2 - cx, hook.y + hook.h / 2 - cy), YO_MINLEN, YO_MAXLEN);
  d.reel = true;
  p.jumping = false;
  game.sfx('stretch');
  game.fx.ring(hook.x + hook.w / 2, hook.y + hook.h / 2, '#ffd23f', 5);
}
function yoLetGo(p, game) {
  const d = p.data;
  if (!d.hook) return;
  d.hook = null;
  p.vy = Math.min(p.vy, 0) - 5;                           // the snap: a flick upwards
  p.vx *= 1.2;
  p.jumping = false;
  game.sfx('whoosh');
  game.fx.puff(p.x + p.w / 2, p.y + p.h / 2, '#ffd23f', 4);
}

defineEntity('w9_yoyo', {
  w: 18, h: 18, capturable: true,
  init(e) { e.spin = 0; e.ph = (e.homeX * 7) % 200; e.hx = e.props.hx; e.hy = e.props.hy; e.bob = e.props.bob === undefined ? 10 : e.props.bob; },
  update(e) {
    e.y = e.homeY + Math.sin((e.t + e.ph) * 0.035) * e.bob;   // rolls up and down its yarn
    e.spin += 0.16;
  },
  draw(ctx, e, game) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    if (e.possessed) {
      const p = game.player, d = p.data;
      if (d.hook) yarn(ctx, d.hook.x + d.hook.w / 2, d.hook.y + d.hook.h / 2, cx, cy, 0, game.t);
      if (d.yankT > 0) yarn(ctx, d.yankX, d.yankY, cx, cy, 6, game.t);
      drawYoyo(ctx, cx, cy, e, d.spin || 0, null);
    } else {
      if (e.hx !== undefined) yarn(ctx, e.hx, e.hy, cx, cy - 9, 0, game.t);
      drawYoyo(ctx, cx, cy, e, e.spin, null);
    }
  },
  capture: {
    w: 16, h: 16,
    move: { maxRun: 2.3, accel: 0.32, jumpVel: 6.8, riseCut: 0.4, airDecel: 0.04 },
    hat: { y: -3, scale: 0.8 },
    onEnter(p, game, e) {
      const d = p.data;
      d.hook = null; d.len = 0; d.spin = 0; d.yankT = 0; d.reel = false;
      if (!game.data.toldYo) { game.data.toldYo = true; game.toast('Yarn Yo-Yo! Jump near a hook to swing!', 150); }
      // captured under a hook (its home): start swinging on it straight away
      let best = null, bd = 200 * 200;
      const A = game.active, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      for (let i = 0; i < A.length; i++) {
        const h = A[i]; if (h.type !== 'w9_hook') continue;
        const dx = h.x + h.w / 2 - cx, dy = h.y + h.h / 2 - cy;
        if (dy < 0 && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = h; }
      }
      if (best && e.hx !== undefined) yoAttach(p, game, best);
    },
    control(p, game, c) {
      const d = p.data, g = p.gdir;
      d.spin += 0.12 + Math.abs(p.vx) * 0.08;
      if (d.yankT > 0) d.yankT--;
      if (d.hook && (d.hook.dead || d.hook.hidden)) d.hook = null;
      if (c.jump) {
        c.jump = false;                                     // eat it: no default jump
        if (d.hook) yoLetGo(p, game);
        else {
          const t = yoFindTarget(game, p);
          if (t && t.grab) {                                // boss sock: YANK
            d.yankT = 16; d.yankX = t.x; d.yankY = t.y;
            t.grab(game, p);
            game.sfx('stretch');
          } else if (t) yoAttach(p, game, t);
          else if (p.onGround || p.coyote > 0) {
            p.vy = -6.8 * g; p.onGround = false; p.coyote = 0; p.jumping = true;
            game.sfx('jump'); game.fx.puff(p.x + p.w / 2, p.y + p.h, '#ffffff', 3);
          } else { game.sfx('clink'); game.fx.sparkle(p.x + p.w / 2, p.y, '#ffd23f', 2); }
        }
      }
      if (!d.hook) return false;
      // ---- swinging on the yarn
      const hx = d.hook.x + d.hook.w / 2, hy = d.hook.y + d.hook.h / 2;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      let vx = p.vx, vy = p.vy + p.mv.gravity * game.gravityScale * g;
      if (c.dir) { vx += c.dir * 0.2; p.facing = c.dir; }
      vx *= 0.998; vy *= 0.998;
      if (d.len > YO_COMFY) d.len = Math.max(YO_COMFY, d.len - 1.6);   // wind up the yarn
      let nx = cx + vx, ny = cy + vy;
      const dx = nx - hx, dy = ny - hy, dist = Math.hypot(dx, dy);
      if (dist > d.len && dist > 0.01) { nx = hx + dx / dist * d.len; ny = hy + dy / dist * d.len; }
      vx = nx - cx; vy = ny - cy;
      const sp = Math.hypot(vx, vy);
      if (sp > 9) { vx *= 9 / sp; vy *= 9 / sp; }
      if (p.onGround && !c.dir) vx *= 0.85;
      p.vx = vx; p.vy = vy; p.noGravity = true;
      return true;
    },
    update(p, game) {
      // which hook would Jump catch? (drawn as a glowing ring)
      game.data.yoTarget = p.data.hook ? null : yoFindTarget(game, p);
    },
    onExit(p, game) { p.data.hook = null; game.data.yoTarget = null; },
  },
});

// ============================================================== TWIRLY TOP
// Capture: runs, hops (jumpVel 8). Jump in mid-air = a whirling dash (6.6
// px/frame for 22 frames, no gravity) that smashes toy blocks and pops
// enemies. One dash per landing.
const DASH_FRAMES = 22, DASH_SPEED = 6.6;

function drawTop(ctx, x, y, e, spin, dashing, tilt) {
  ctx.save(); ctx.translate(x, y);
  if (tilt) ctx.rotate(tilt);
  // tip
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(0, 0.5); ctx.lineTo(2, -4); ctx.fill();
  // body: a rounded cone
  ctx.beginPath();
  ctx.moveTo(-10, -12); ctx.quadraticCurveTo(-9, -5, -1.5, -3); ctx.lineTo(1.5, -3); ctx.quadraticCurveTo(9, -5, 10, -12);
  ctx.quadraticCurveTo(0, -17, -10, -12); ctx.closePath();
  ctx.fillStyle = '#4fd1c5'; ctx.fill();
  ctx.save(); ctx.clip();
  // rotating stripes
  for (let k = 0; k < 4; k++) {
    const a = spin + k * 1.5708, sx = Math.sin(a) * 10;
    if (Math.cos(a) < 0) continue;
    ctx.fillStyle = k & 1 ? '#ffd23f' : '#ff6f91';
    ctx.fillRect(sx - 2.2, -18, 4.4, 16);
  }
  ctx.restore();
  outline(ctx, 2); ctx.stroke();
  // rim
  blob(ctx, 0, -12, 10.5, 2.6, '#9b6dff', 1.6);
  // handle
  rrect(ctx, -1.8, -20, 3.6, 7, 1.5, '#ffd23f', 1.4);
  // face on the rim band
  ctx.fillStyle = INK;
  const f = e.facing || 1;
  if (dashing) { ctx.fillRect(f * 1 - 4.5, -9.6, 3, 1.2); ctx.fillRect(f * 1 + 1.5, -9.6, 3, 1.2); }
  else { ctx.beginPath(); ctx.arc(f * 1 - 3, -9, 1.1, 0, TAU); ctx.arc(f * 1 + 3, -9, 1.1, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f * 1, -7.4, 1.6, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function topSmash(game, p) {
  const L = game.level, d = p.data;
  const ax = d.dir > 0 ? p.x + p.w - 2 : p.x - DASH_SPEED - 2, bx = d.dir > 0 ? p.x + p.w + DASH_SPEED + 2 : p.x + 2;
  const x0 = Math.floor(ax / TILE), x1 = Math.floor(bx / TILE);
  const y0 = Math.floor((p.y + 1) / TILE), y1 = Math.floor((p.y + p.h - 1) / TILE);
  let n = 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = L.def(tx, ty);
    if (t && t.w9top && game.breakTile(tx, ty)) n++;
  }
  if (n) { game.cam.shake(3, 8); game.fx.confetti(d.dir > 0 ? bx : ax, p.y + p.h / 2, 8); }
}

defineEntity('w9_top', {
  w: 20, h: 18, capturable: true,
  init(e) { e.spin = 0; e.ph = (e.homeX * 5) % 170 | 0; },
  update(e, game) {
    e.spin += 0.35;
    if (e.onGround && (e.t + e.ph) % 170 === 0) { e.vy = -3.2; e.facing = -e.facing; }
    stepBody(game, e);
  },
  draw(ctx, e, game) {
    const own = e.possessed, d = own ? game.player.data : null;
    const dashing = own && d.dash > 0;
    const wob = dashing ? d.dir * 0.35 : Math.sin(e.t * 0.2) * 0.08;
    if (dashing) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const bx = e.x + e.w / 2 - d.dir * 14;
      ctx.beginPath();
      ctx.moveTo(bx, e.y + 5); ctx.lineTo(bx - d.dir * 14, e.y + 5);
      ctx.moveTo(bx - d.dir * 4, e.y + 11); ctx.lineTo(bx - d.dir * 20, e.y + 11);
      ctx.stroke();
    }
    drawTop(ctx, e.x + e.w / 2, e.y + e.h, e, own ? d.spin : e.spin, dashing, wob);
    if (own && d.canDash && !game.player.onGround && !dashing) {   // "dash ready" sparkle
      ctx.fillStyle = '#ffe27a'; starPath(ctx, e.x + e.w / 2 + 12, e.y - 2, 3, 1.3); ctx.fill();
    }
  },
  capture: {
    w: 16, h: 18,
    move: { maxRun: 2.7, accel: 0.4, jumpVel: 8.0, riseCut: 0.5 },
    hat: { y: -19, scale: 0.75 },
    onEnter(p, game) {
      const d = p.data; d.dash = 0; d.dir = 1; d.canDash = true; d.spin = 0;
      if (!game.data.toldTop) { game.data.toldTop = true; game.toast('Twirly Top! Hop, then Jump in the air to whirl!', 150); }
    },
    control(p, game, c) {
      const d = p.data;
      d.spin += d.dash > 0 ? 0.9 : 0.4;
      if (p.onGround) d.canDash = true;
      if (d.dash > 0) {
        d.dash--;
        p.noGravity = true; p.vx = d.dir * DASH_SPEED; p.vy = 0; p.facing = d.dir;
        topSmash(game, p);
        if ((d.dash & 1) === 0) game.fx.emit(p.x + p.w / 2 - d.dir * 8, p.y + p.h / 2 + (Math.random() - 0.5) * 10, -d.dir * 0.6, 0, { g: 0, life: 18, size: 3, color: PAL.confetti[d.dash % 7], shape: 'star' });
        if (d.dash === 0) p.vx = d.dir * 3.2;
        return true;
      }
      if (c.jump && !p.onGround && p.coyote <= 0 && !p.inLiquid) {
        c.jump = false;
        if (d.canDash) {
          d.canDash = false; d.dash = DASH_FRAMES; d.dir = c.dir || p.facing;
          p.vy = 0; p.jumping = false;
          game.sfx('spin'); game.fx.ring(p.x + p.w / 2, p.y + p.h / 2, '#4fd1c5', 6);
          return true;
        }
        game.sfx('clink');
      }
      return false;
    },
    update(p, game) {
      const d = p.data;
      if (d.dash > 0 && p.hitWall) { d.dash = 0; p.vx = -d.dir * 1.5; game.sfx('clink'); game.fx.sparkle(p.x + (p.hitWall > 0 ? p.w : 0), p.y + p.h / 2, '#ffffff', 4); }
    },
    onTouchEntity(p, game, e) {
      if (p.data.dash > 0 && e.def.enemy && !e.def.boss && e.def.name !== 'projectile') { game.hit(e, 'ability'); return true; }
      return false;
    },
    onExit(p) { p.data.dash = 0; },
  },
});

// ============================================================== enemies + hazards
// SPACE GLOOMLET: a Gloomlet in a bubble helmet. Patrols, hops in low gravity.
defineEntity('w9_spacegloom', {
  w: 18, h: 16, enemy: true,
  init(e) { e.speed = e.props.speed || 0.55; e.facing = e.props.dir || -1; e.ph = (e.homeX * 3) % 140 | 0; },
  update(e, game) {
    if (e.onGround) {
      if (edgeAhead(game, e, e.facing) || e.hitWall === e.facing) e.facing = -e.facing;
      e.vx = e.facing * e.speed;
      if ((e.t + e.ph) % 140 === 0) e.vy = -4.2;
    }
    stepBody(game, e);
    if (e.y > game.level.pxH + 60) e.dead = true;
  },
  draw(ctx, e, game) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    drawGloomlet(ctx, cx, by, { facing: e.facing, t: e.t, squash: e.onGround ? Math.max(0, Math.sin(e.t * 0.16)) * 0.2 : -0.1 });
    // helmet
    ctx.fillStyle = 'rgba(200,235,255,0.28)'; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, by - 9, 12, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(cx - 5, by - 16, 2.5, 1.2, -0.6, 0, TAU); ctx.fill();
    // antenna
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, by - 21); ctx.lineTo(cx + Math.sin(e.t * 0.1) * 2, by - 26); ctx.stroke();
    blob(ctx, cx + Math.sin(e.t * 0.1) * 2, by - 27, 2, 2, (e.t >> 4) & 1 ? '#ff5d8f' : '#ffd23f', 1.2);
  },
});

// TANGLE: a grumpy knot of gray yarn that bounces on the spot. Too prickly to
// stomp; the Hat or a Twirly Top dash unravels it.
defineEntity('w9_tangle', {
  w: 18, h: 18, enemy: true, stompable: false,
  init(e) { e.jump = e.props.jump || 5.8; e.ph = ((e.homeX * 11) % 40) | 0; e.wait = e.ph; },
  update(e, game) {
    if (e.onGround) { if (--e.wait <= 0) { e.vy = -e.jump; e.wait = 24; } }
    stepBody(game, e);
  },
  draw(ctx, e, game) {
    const cx = e.x + 9, cy = e.y + 9, sq = e.onGround ? 0.2 : 0;
    ctx.save(); ctx.translate(cx, cy + sq * 4); ctx.scale(1 + sq * 0.4, 1 - sq);
    blob(ctx, 0, 0, 9, 9, '#a3a6b8', 2);
    ctx.strokeStyle = '#6f7388'; ctx.lineWidth = 1.3;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 3 + k, e.t * 0.05 + k * 0.8, 0, TAU); ctx.stroke(); }
    // loose ends
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8, 3); ctx.quadraticCurveTo(13, 4, 12, 9); ctx.moveTo(-8, -4); ctx.quadraticCurveTo(-13, -6, -12, -11); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -1, 2.4, 0, TAU); ctx.arc(3, -1, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-2.6, -0.6, 1.2, 0, TAU); ctx.arc(3.4, -0.6, 1.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-5.5, -4.5); ctx.lineTo(-1, -3); ctx.moveTo(5.5, -4.5); ctx.lineTo(1, -3); ctx.stroke();
    ctx.restore();
  },
});

// MARBLE CHUTE: a toy marble-run spout that shoots marble comets. It glows
// for 40 frames before each shot. props: dir (-1|1), period (150), phase, speed
function drawMarble(ctx, e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, r = e.w / 2, s = Math.sign(e.vx) || 1;
  ctx.fillStyle = 'rgba(255,226,122,0.35)';
  ctx.beginPath(); ctx.arc(cx - s * 8, cy, r * 0.8, 0, TAU); ctx.arc(cx - s * 15, cy, r * 0.55, 0, TAU); ctx.arc(cx - s * 21, cy, r * 0.35, 0, TAU); ctx.fill();
  blob(ctx, cx, cy, r, r, e.props.color || '#5ab8ff', 1.8);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, e.t * 0.3, e.t * 0.3 + 2.4); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(cx - r * 0.5, cy - r * 0.6, 2, 2);
}
const MARBLE_COLS = ['#5ab8ff', '#ff6f91', '#7bd857', '#ffd23f', '#9b6dff'];
defineEntity('w9_chute', {
  w: 24, h: 24, anchor: 'cell', layer: 1,
  init(e) { e.dir = e.props.dir || -1; e.period = e.props.period || 150; e.clock = e.props.phase || 0; e.n = 0; },
  update(e, game) {
    e.clock = (e.clock + 1) % e.period;
    if (e.clock === 0) {
      const col = MARBLE_COLS[e.n++ % MARBLE_COLS.length];
      game.shoot({ x: e.x + 12 + e.dir * 14, y: e.y + 12, vx: e.dir * (e.props.speed || 2.6), vy: 0, r: 6, life: 420, color: col, draw: drawMarble });
      game.sfx('roll');
      game.fx.puff(e.x + 12 + e.dir * 14, e.y + 12, '#ffffff', 4);
    }
  },
  draw(ctx, e, game) {
    const warn = e.clock > e.period - 40;
    const x = e.x, y = e.y, d = e.dir;
    rrect(ctx, x + 1, y + 3, 22, 18, 5, warn && ((e.clock >> 2) & 1) ? '#fff1a8' : '#ff9a3c', 2);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 5, y + 5, 3, 14); ctx.fillRect(x + 12, y + 5, 3, 14);
    blob(ctx, x + 12 + d * 11, y + 12, 3.5, 7, INK, 0);
    if (warn) { ctx.fillStyle = '#ffffff'; starPath(ctx, x + 12, y - 4, 4, 1.8); ctx.fill(); }
  },
});

// ============================================================== the toy chest + flying socks (boss)
const SOCKS = [
  { a: '#4fd1c5', b: '#ffd23f', need: 'w9_top', name: 'Twirly Top', how: 'whirl into it!' },
  { a: '#ff8fc7', b: '#ffffff', need: 'w9_yoyo', name: 'Yarn Yo-Yo', how: 'Jump near it to yank!' },
  { a: '#9b6dff', b: '#ff9a3c', need: 'springle', name: 'Springle', how: 'stomp it!' },
];
const SOCK_DASH = [7, 6];

defineEntity('w9_chest', {
  w: 96, h: 52, anchor: 'cell', layer: -1,
  init(e, game) { e.y += TILE * 2 - e.h; e.homeY = e.y; e.gulp = 0; e.got = 0; e.always = true; game.data.chest = e; },
  update(e) { if (e.gulp > 0) e.gulp--; },
  draw(ctx, e, game) {
    const x = e.x, y = e.y, w = e.w, h = e.h;
    const open = game.data.sockFlying ? 1 : e.gulp > 0 ? e.gulp / 30 : 0;
    // box
    rrect(ctx, x, y + 10, w, h - 10, 6, '#c9803d', 2.5);
    ctx.fillStyle = '#a8642a'; ctx.fillRect(x + 4, y + h - 8, w - 8, 4);
    ctx.fillStyle = '#e0a15e'; ctx.fillRect(x + 8, y + 16, w - 16, 3);
    ctx.fillStyle = PAL.brass; ctx.fillRect(x + 12, y + 10, 6, h - 12); ctx.fillRect(x + w - 18, y + 10, 6, h - 12);
    ctx.fillStyle = '#ffd23f'; starPath(ctx, x + w / 2, y + 32, 9, 4); ctx.fill(); outline(ctx, 1.6); ctx.stroke();
    // tidied socks peek out
    for (let k = 0; k < e.got; k++) {
      const s = SOCKS[k], sx = x + 24 + k * 22;
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(sx, y + 12); ctx.quadraticCurveTo(sx + 4, y - 2, sx + 12, y + 2); ctx.stroke();
      ctx.strokeStyle = s.a; ctx.lineWidth = 6; ctx.stroke();
    }
    // lid (hinged at the back-left, opens upward)
    ctx.save(); ctx.translate(x, y + 10); ctx.rotate(-open * 1.1);
    rrect(ctx, -2, -12, w + 4, 14, 6, '#d98f48', 2.5);
    ctx.fillStyle = PAL.brass; ctx.fillRect(w / 2 - 5, -4, 10, 7);
    ctx.restore();
    if (!game.data.bossDone) text(ctx, 'TIDY ME', x + w / 2, y - 6 - (open > 0 ? 18 : 0) + Math.sin(game.t * 0.08) * 1.5, 9, '#ffe27a', 'center', 900, INK);
  },
});

defineEntity('w9_flysock', {
  w: 20, h: 14, layer: 1, always: true,
  init(e) { const p = e.props; e.x0 = e.x; e.y0 = e.y; e.u = 0; e.k = p.k; },
  update(e, game) {
    const p = e.props, ch = game.data.chest;
    e.u = Math.min(1, e.u + 1 / 50);
    const tx = ch ? ch.x + ch.w / 2 - 10 : e.x0, ty = ch ? ch.y + 4 : e.y0;
    e.x = lerp(e.x0, tx, e.u); e.y = lerp(e.y0, ty, e.u) - Math.sin(e.u * Math.PI) * 150;
    if ((e.t & 3) === 0) game.fx.emit(e.x + 10, e.y + 7, 0, 0, { g: 0, life: 20, size: 3, color: SOCKS[e.k].a, shape: 'star' });
    if (e.u >= 1) {
      e.dead = true; game.data.sockFlying = false;
      if (ch) { ch.gulp = 30; ch.got = Math.max(ch.got, e.k + 1); }
      game.fx.confetti(tx + 10, ty, 30); game.fx.ring(tx + 10, ty, '#ffe27a', 10);
      game.fx.text(tx + 10, ty - 14, 'Tidy!', '#ffe27a');
      game.sfx('confetti'); game.cam.shake(3, 10);
    }
  },
  draw(ctx, e) {
    const s = SOCKS[e.k];
    ctx.save(); ctx.translate(e.x + 10, e.y + 7); ctx.rotate(e.u * 12);
    drawSockShape(ctx, -10, -3, 10, 3, s, 9, 6);
    ctx.restore();
  },
});

function drawSockShape(ctx, x0, y0, x1, y1, s, wInk, wFill) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = wInk;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = s.a; ctx.lineWidth = wFill; ctx.stroke();
  ctx.setLineDash(SOCK_DASH); ctx.strokeStyle = s.b; ctx.lineWidth = wFill * 0.7; ctx.stroke(); ctx.setLineDash(NO_DASH);
  blob(ctx, x1 + 2, y1 + 1, wInk * 0.55, wInk * 0.45, s.a, 1.8);
}
const NO_DASH = [];

// ============================================================== boss: THE MESS MONSTER
// A heap of laundry and lost toys against the right wall of the arena. Loop:
// sway (lobs balled-up laundry) -> reach (a sock-arm rises over Whisk, a
// shadow marks the spot) -> slam -> stuck (the sock lies limp: tidy it with
// the creature its bubble shows) -> retract. Sock 1: Twirly Top dash. Sock 2:
// Yarn Yo-Yo yank. Sock 3: Springle stomp.
const MM_W = 150, MM_H = 120;

function lob(e, game) {
  const p = game.player, sx = e.x + 40, sy = e.y + 30;
  const tx = p.x + p.w / 2 + (Math.random() - 0.5) * 60, ty = p.y + p.h - 6;
  const T = 64, g = 0.14;                       // lands near Whisk after T frames
  game.shoot({ x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy) / T - g * T / 2, r: 7, gravity: g, life: 260, color: '#b3b6c6', draw: drawLaundryBall });
  game.sfx('whoosh');
}
function drawLaundryBall(ctx, e) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  blob(ctx, cx, cy, 7, 6.5, '#c7c9d6', 1.8);
  ctx.strokeStyle = '#8b8fa3'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, 4, e.t * 0.2, e.t * 0.2 + 3); ctx.stroke();
  ctx.fillStyle = '#ff8fc7'; ctx.fillRect(cx + 2, cy - 5, 3, 3);
}

function armShoulder(e, k) {
  if (k === 0) { SH.x = e.x + 34; SH.y = e.y + 40; }
  else if (k === 1) { SH.x = e.x + 22; SH.y = e.y + 78; }
  else { SH.x = e.x + 58; SH.y = e.y + 18; }
  return SH;
}
const SH = { x: 0, y: 0 };
function armIdle(e, k, t) {
  const s = armShoulder(e, k);
  IDLE.x = s.x - 46 - k * 6 + Math.sin(t * 0.05 + k * 2) * 10;
  IDLE.y = s.y - 34 + k * 10 + Math.cos(t * 0.06 + k) * 9;
  return IDLE;
}
const IDLE = { x: 0, y: 0 };

function tidySock(e, game) {
  if (e.tidied) return;
  e.tidied = true;
  game.data.yoExtra.on = false;
  const k = e.armK;
  game.data.sockFlying = true;
  game.spawn('w9_flysock', e.hx - 10, e.hy - 7, { k });
  game.fx.confetti(e.hx, e.hy, 20);
  game.hit(e, 'ability');                    // counts through onHit -> hurtBoss
}

const MM_STEPS = [
  { name: 'sway', frames: (e) => byHits(e, [100, 86, 72]),
    enter(e, game) { e.tidied = false; game.data.yoExtra.on = false; },
    tick(e, game, t) {
      const n = byHits(e, [1, 2, 3]);
      if (t === 30 || (n > 1 && t === 52) || (n > 2 && t === 66)) lob(e, game);
    } },
  { name: 'reach', frames: (e) => byHits(e, [62, 56, 50]),
    enter(e, game) {
      const a = game.arena, p = game.player;
      e.armK = Math.min(2, e.maxHp - e.hp);
      e.tx = clamp(p.x + p.w / 2, a.x0 + 7 * TILE, e.x - 50);
      const id = armIdle(e, e.armK, e.t); e.sx0 = id.x; e.sy0 = id.y;
      game.sfx('windup');
    },
    tick(e, game, t) {
      const k = Math.min(1, t / 26);
      e.hx = lerp(e.sx0, e.tx, k); e.hy = lerp(e.sy0, e.floorY - 150, k) + Math.sin(t * 0.6) * 3;
    } },
  { name: 'slam', frames: 12,
    tick(e, game, t) {
      e.hy = Math.min(e.floorY - 8, e.hy + 22);
      if (t === 5) {
        game.cam.shake(6, 16); game.sfx('thud');
        game.fx.burst(e.hx, e.floorY, { n: 16, speed: 3.5, up: 1.5, colors: PAL.confetti, life: 26, shape: 'dot', g: 0.12 });
        const p = game.player;
        if (Math.abs(p.x + p.w / 2 - e.hx) < 26 && p.y + p.h > e.floorY - 46) game.hurtPlayer({ fromX: e.hx });
        if (e.hp < e.maxHp) {        // later socks send little laundry ripples along the floor
          for (let s = -1; s <= 1; s += 2) game.shoot({ x: e.hx + s * 20, y: e.floorY - 7, vx: s * 2.2, vy: 0, r: 6, life: 140, color: '#c7c9d6', draw: drawLaundryBall });
        }
      }
    } },
  { name: 'stuck', frames: (e) => byHits(e, [320, 280, 240]),
    enter(e, game) {
      e.hy = e.floorY - 8;
      const x = game.data.yoExtra; x.x = e.hx; x.y = e.hy; x.on = e.armK === 1;
      game.sfx('snore');
    },
    tick(e, game, t) {
      const p = game.player, k = e.armK, g = p.gdir;
      const hx0 = e.hx - 22, hx1 = e.hx + 22, hy0 = e.hy - 16, hy1 = e.hy + 8;
      const over = p.x < hx1 && p.x + p.w > hx0 && p.y < hy1 && p.y + p.h > hy0;
      // a whirl anywhere up to about four tiles over the limp sock knocks it
      // loose: a Top dashes at the top of its hop (feet ~90px up), and that
      // natural hop-then-whirl must count, not only a frame-tight low dash
      if (k === 0 && p.form === 'w9_top' && p.data.dash > 0 && p.x < hx1 + 6 && p.x + p.w > hx0 - 6 && p.y < hy1 && p.y + p.h > hy0 - 100) { tidySock(e, game); return; }
      if (k === 2 && over && p.form === 'springle' && p.vy * g > 0.3 && p.y + p.h - p.vy <= hy0 + 10) {
        p.vy = -9 * g; p.jumping = false; game.sfx('bounce'); tidySock(e, game); return;
      }
      if (over && game.data.sockHintT <= 0) {
        const s = SOCKS[k];
        game.data.sockHintT = 150;
        game.toast(p.form === s.need ? (k === 1 ? 'Jump near the sock to yank it!' : 'Now ' + s.how) : 'This sock needs a ' + s.name + ': ' + s.how, 120);
        if (p.form !== s.need) game.sfx('deny');
      }
    } },
  { name: 'retract', frames: 34, next: 'sway',
    enter(e, game) { game.data.yoExtra.on = false; game.sfx('stretch'); },
    tick(e, game, t) {
      const id = armIdle(e, e.armK, e.t), k = Math.min(1, t / 30);
      e.hx = lerp(e.hx, id.x, k * 0.4); e.hy = lerp(e.hy, id.y, k * 0.4);
    } },
  { name: 'ouch', frames: 84, next: 'sway', enter(e, game) { game.data.yoExtra.on = false; } },
];

function drawMessMonster(ctx, e, game) {
  const step = e.defeated ? 'done' : stepName(e, MM_STEPS);
  const t = e.t, x = e.x, y = e.y, w = e.w, h = e.h;
  const hits = e.maxHp - e.hp;
  const shrink = e.defeated ? Math.min(1, e.defT / 90) : 0;
  const wob = Math.sin(t * 0.07) * 2 * (1 - shrink);
  const sq = step === 'ouch' ? Math.sin(e.stepT * 0.5) * 0.06 : step === 'slam' ? 0.05 : 0;
  ctx.save();
  ctx.translate(x + w / 2, y + h);
  ctx.scale(1 + sq - shrink * 0.35, 1 - sq - shrink * 0.55);
  // the heap: overlapping laundry lumps (colour seeps in as it is tidied)
  const gray = hits === 0 ? 0 : hits === 1 ? 1 : 2;
  const L = HEAP[gray];
  blob(ctx, -40, -30 + wob * 0.3, 40, 30, L[0], 2.5);
  blob(ctx, 34, -34, 42, 34, L[1], 2.5);
  blob(ctx, -2, -70 + wob, 52, 42, L[2], 2.5);
  blob(ctx, 22, -98 + wob * 1.3, 30, 22, L[3], 2.5);
  // a lost teddy ear, a toy block, a shirt sleeve
  blob(ctx, -30, -102 + wob * 1.2, 9, 9, '#c98a55', 2); blob(ctx, -30, -102 + wob * 1.2, 4.5, 4.5, '#e9b88a', 0);
  rrect(ctx, 40, -66, 22, 22, 3, '#ffd23f', 2); ctx.fillStyle = '#e0a91c'; ctx.beginPath(); ctx.arc(51, -55, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(36,26,58,0.18)'; ctx.fillRect(-52, -24, 30, 4); ctx.fillRect(10, -40, 36, 4);
  // button eyes
  const angry = step === 'reach' || step === 'slam', dizzy = step === 'ouch' || e.inv > 40, happy = e.defeated;
  for (let s = -1; s <= 1; s += 2) {
    const ex = s * 18 + 2, ey = -76 + wob;
    blob(ctx, ex, ey, 11, 11, s < 0 ? '#ff6f91' : '#5ab8ff', 2.2);
    if (dizzy) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ex, ey, 5, t * 0.3, t * 0.3 + 4.5); ctx.stroke(); }
    else if (happy) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey + 3, 5, Math.PI + 0.4, -0.4); ctx.stroke(); }
    else {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(ex - 3, ey - 3, 1.8, 0, TAU); ctx.arc(ex + 3, ey - 3, 1.8, 0, TAU); ctx.arc(ex - 3, ey + 3, 1.8, 0, TAU); ctx.arc(ex + 3, ey + 3, 1.8, 0, TAU); ctx.fill();
    }
    if (angry) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - s * 12, ey - 16); ctx.lineTo(ex + s * 6, ey - 11); ctx.stroke(); }
  }
  // mouth: a zip that grins when tidy, grumbles otherwise
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath();
  if (happy) { ctx.arc(2, -56 + wob, 16, 0.2, Math.PI - 0.2); }
  else if (dizzy) { ctx.ellipse(2, -50 + wob, 7, 5, 0, 0, TAU); }
  else { for (let k = 0; k <= 8; k++) { const mx = -18 + k * 5, my = -52 + wob + (k & 1 ? 3 : -2); if (k) ctx.lineTo(mx, my); else ctx.moveTo(mx, my); } }
  ctx.stroke();
  ctx.restore();

  // sock-arms
  if (!e.defeated) {
    for (let k = 0; k < 3; k++) {
      if (k < hits) continue;                               // already tidied away
      const s = armShoulder(e, k), sx = s.x, sy = s.y;
      let hx, hy;
      const active = k === e.armK && (step === 'reach' || step === 'slam' || step === 'stuck' || step === 'retract') && !e.tidied;
      if (active) { hx = e.hx; hy = e.hy; } else { const id = armIdle(e, k, t); hx = id.x; hy = id.y; }
      const mx = (sx + hx) / 2, my = Math.min(sy, hy) - 40;
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
      ctx.strokeStyle = SOCKS[k].a; ctx.lineWidth = 10; ctx.stroke();
      ctx.setLineDash(SOCK_DASH); ctx.strokeStyle = SOCKS[k].b; ctx.lineWidth = 7; ctx.stroke(); ctx.setLineDash(NO_DASH);
      // the toe (a big sock foot)
      const dir = hx < sx ? -1 : 1;
      blob(ctx, hx + dir * 6, hy + 2, 12, 9, SOCKS[k].a, 2.2);
      blob(ctx, hx + dir * 12, hy + 3, 5, 5, SOCKS[k].b, 1.5);
      if (active && step === 'stuck') {
        // limp: dizzy little zzz, glowing outline and a bubble showing who can tidy it
        const pulse = 0.5 + 0.5 * Math.sin(game.t * 0.25);
        ctx.globalAlpha = 0.4 + pulse * 0.6; ctx.strokeStyle = '#ffe27a';
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(hx + dir * 6, hy + 2, 18, 13, 0, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        drawNeedBubble(ctx, hx, hy - 44 + Math.sin(game.t * 0.1) * 2, k, game);
      }
    }
    // the shadow where a sock will slam
    if (step === 'reach' || step === 'slam') {
      const k = Math.min(1, e.stepT / 30);
      ctx.globalAlpha = 0.15 + k * 0.25; ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(e.tx, e.floorY - 1, 14 + k * 14, 4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      if (step === 'reach' && ((e.stepT >> 3) & 1)) text(ctx, '!', e.tx, e.floorY - 60, 16, '#ff5d8f', 'center', 900, INK);
    }
  }
}
const HEAP = [
  ['#9a9cae', '#8b8fa3', '#a7a9ba', '#b3b6c6'],
  ['#9a8fc0', '#7fb3b0', '#b3a3c6', '#c6b3a3'],
  ['#c08fd0', '#6fd1c5', '#ffb3c9', '#ffd27a'],
];
const BUBBLE_FAKE = { t: 0, facing: 1, onGround: true, vy: 0, possessed: false, x: 0, y: 0, w: 18, h: 20, props: {} };
function drawNeedBubble(ctx, x, y, k, game) {
  blob(ctx, x, y, 17, 15, '#fffaf0', 2);
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.moveTo(x - 4, y + 13); ctx.lineTo(x, y + 21); ctx.lineTo(x + 4, y + 13); ctx.fill();
  const f = BUBBLE_FAKE; f.t = game.t;
  ctx.save(); ctx.translate(x, y + 9); ctx.scale(0.72, 0.72);
  if (k === 0) drawTop(ctx, 0, 0, f, game.t * 0.3, false, 0);
  else if (k === 1) drawYoyo(ctx, 0, -10, f, game.t * 0.1, null);
  else { const sp = getDef('springle'); if (sp) { f.x = -9; f.y = -20; sp.draw(ctx, f, game); } }
  ctx.restore();
}

defineBoss('w9_messmonster', {
  title: 'The Mess Monster', hp: 3, w: MM_W, h: MM_H, hurtInv: 90, hatProof: true,
  init(e, game) {
    e.floorY = e.y + e.h; e.hx = e.x; e.hy = e.y; e.tx = e.x; e.armK = 0; e.tidied = false;
    game.data.yoExtra = { x: 0, y: 0, w: 0, h: 0, on: false, grab: (g, p) => { if (e.armK === 1 && stepName(e, MM_STEPS) === 'stuck') tidySock(e, g); } };
    game.data.sockHintT = 0;
  },
  update(e, game) {
    if (game.data.sockHintT > 0) game.data.sockHintT--;
    runPattern(e, game, MM_STEPS);
  },
  idle(e) { /* rooted to the spot */ },
  // Only tidying counts (the debug API's defeatBoss() also uses 'ability').
  onHit(e, game, source) { return source === 'ability' ? hurtBoss(e, game) : false; },
  onHurt(e, game) {
    game.toast(e.hp === 2 ? 'One sock tidied! Two to go!' : 'Two tidied! One more sock!', 110);
    game.sfx('laugh');
    gotoStep(e, game, MM_STEPS, 'ouch');
  },
  onDefeated(e, game) {
    game.data.yoExtra.on = false; game.data.bossDone = true;
    game.toast('All tidy! You earned the Golden Topper!', 90);
    game.sfx('laugh');
    try { game.save.setFlag('goldenHat', true); } catch (err) { /* ignore */ }
  },
  reset(e, game) { e.tidied = false; game.data.yoExtra.on = false; game.data.sockFlying = false; },
  draw(ctx, e, game) {
    if (e.inv > 0 && ((e.t >> 2) & 1)) ctx.globalAlpha = 0.75;
    drawMessMonster(ctx, e, game);
    ctx.globalAlpha = 1;
  },
});

// ============================================================== level
// Built with fill/spawn calls (the moon is mostly sky). Columns are tiles.
function pickCreature(name, fallback) { return getDef(name) ? name : fallback; }

function build(L) {
  const W = 388;
  L.size(W, H);
  L.start(3, STAND);
  const G = (x0, x1, top = FLOOR) => L.fill('ground', x0, top, x1 - x0 + 1, H - top);
  const B = (x0, y0, w, h, tile = 'block') => L.fill(tile, x0, y0, w, h);
  const btn = (tx, ty) => L.spawn('button', tx, ty);
  const row = (tx0, tx1, ty) => { for (let x = tx0; x <= tx1; x++) btn(x, ty); };
  // buttons along a parabola from cell (ax, ay) to (bx, by), peaking `lift` tiles higher
  const arc = (ax, ay, bx, by, n, lift) => {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const px = lerp(ax, bx, u) * TILE + 12, py = lerp(ay, by, u) * TILE + 12 - Math.sin(u * Math.PI) * lift * TILE;
      L.spawnPx('button', px - 7, py - 7);
    }
  };
  const hint = (tx, text, ty = STAND) => L.spawn('hint', tx, ty, { text });
  const flag = (tx, ty = STAND) => L.spawn('checkpoint', tx, ty);
  const spark = (tx, ty) => L.spawn('spark', tx, ty);
  const hook = (tx, ty) => L.spawn('w9_hook', tx, ty);
  const yoyo = (tx, hookTy, hang) => {      // a Yo-Yo dangling `hang` px below the hook at (tx, hookTy)
    const hx = tx * TILE + 12, hy = hookTy * TILE + 12;
    L.spawnPx('w9_yoyo', hx - 9, hy + hang - 9, { hx, hy });
  };
  const CORK = pickCreature('w2_cork', 'puffcloud');
  const POT = pickCreature('w6_teapot', 'puffcloud');
  const creature = (type, tx, ty = STAND) => (type === 'puffcloud' ? L.spawn('puffcloud', tx, ty, { oy: -8 }) : L.spawn(type, tx, ty));

  // ---------------------------------------------------------------- A: landing (0-57)
  G(0, 13); G(18, 30); G(31, 40, 16); G(41, 57);
  hint(7, 'The Moon is light, so leap up high!\nYour jumps float far across the sky.');
  arc(12, 17, 19, 17, 6, 2.5);
  L.spawn('w9_spacegloom', 26, STAND);
  hint(33, 'Jump, then toss your Hat mid-flight:\nbounce on its brim to double your height!', 15);
  B(35, 9, 3, 1, 'oneway'); spark(36, 8);
  arc(31, 14, 34, 11, 3, 1);
  row(44, 48, 15);
  L.spawn('w9_tangle', 50, STAND);
  flag(55);

  // ---------------------------------------------------------------- B: old friends (58-125)
  G(58, 83); G(90, 125, 16);
  hint(61, 'Lost things float up here, it\'s true:\nold friends! A Springle waits for you.');
  L.spawn('springle', 65, STAND);
  B(70, 10, 4, 9);                                       // the block tower (9 tall)
  arc(66, 14, 71, 8, 4, 2);
  spark(75, 2);                                          // a Springle jump from the tower top
  row(70, 73, 8);
  // cork corner: glass-floored secret room, then the wide crater
  flag(74);                                              // retries of the crater start past the tower
  hint(76, 'A Cork! Hold Jump, then let it go.\nLean while you launch to rocket just so!');
  creature(CORK, 77);
  B(78, 10, 1, 5); B(81, 10, 1, 5); B(79, 10, 2, 1);      // secret room with a marble-glass floor
  L.fill(CORK === 'w2_cork' ? 'w9_glass' : 'crack', 79, 14, 2, 1);
  L.spawnPx('spark', 80 * TILE - 9, 12 * TILE + 3);
  arc(84, 14, 90, 12, 6, 2.5);
  L.spawn('w9_spacegloom', 104, 15, { dir: -1 });
  L.spawn('w9_chute', 124, 14, { dir: -1, period: 170 });
  row(100, 104, 12);
  L.spawn('w9_tangle', 114, 15);
  flag(121, 15);

  // ---------------------------------------------------------------- C: Twirly Top (126-185)
  G(126, 149); G(156, 187);
  hint(129, 'Hop with the Top, then Jump midair:\nit whirls through toy blocks without a care!');
  L.spawn('w9_top', 133, STAND);
  B(137, 0, 2, 19, 'w9_toyblock');                       // the first toy wall
  L.set(141, FLOOR, 'bouncy');
  // floating box (cols 143-146, rows 8-13) with a toy-block door at rows 10-11
  B(143, 8, 4, 1); B(143, 13, 4, 1); B(146, 9, 1, 4); B(143, 9, 1, 1); B(143, 12, 1, 1); B(143, 10, 1, 2, 'w9_toyblock');
  spark(144, 11);
  arc(139, 17, 142, 12, 3, 1);
  arc(150, 17, 155, 16, 5, 2.5);
  B(156, 0, 1, 19, 'w9_toyblock');                       // wall at the far edge of the pit
  L.spawn('w9_tangle', 166, STAND);
  L.spawn('w9_spacegloom', 172, STAND);
  row(163, 167, 15);
  L.spawn('w9_chute', 187, 17, { dir: -1, period: 160, phase: 60 });
  flag(185);

  // ---------------------------------------------------------------- D: Yarn Yo-Yo + Puffpot (188-252)
  G(188, 197); G(223, 252);
  hint(190, 'Yarn Yo-Yo loves a hook up high.\nJump to catch, swing, then Jump to fly!');
  hook(195, 11); yoyo(195, 11, 118);
  hook(201, 10); hook(207, 10); hook(213, 10); hook(219, 10);
  spark(219, 7);                                         // pump hard on the fourth hook and fling up
  arc(198, 12, 222, 12, 13, 2.5);
  hint(226, 'A Puffpot! Hold Jump up in the air\nand steam your way up the chimney stair.');
  creature(POT, 229);
  B(231, 13, 4, 1, 'oneway'); B(236, 7, 4, 1, 'oneway');
  B(242, 4, 2, 15);                                      // tall wall: over the top only
  row(231, 234, 11); row(236, 239, 5);
  arc(240, 2, 246, 15, 5, 1);
  L.spawn('w9_spacegloom', 249, STAND);

  // ---------------------------------------------------------------- E: mid-air transfers (253-305)
  G(253, 259); L.fill('ground', 260, FLOOR + 1, 37, H - FLOOR - 1); L.fill('spikes', 260, FLOOR, 37, 1); G(297, 305);
  flag(254);
  hint(256, 'Hop out midair, then toss your Hat:\nfrom friend to friend to friend! Imagine that!');
  L.spawn('puffcloud', 258, STAND, { oy: -8 });
  B(268, 14, 2, 1, 'oneway'); L.spawn('w9_top', 268, 13);
  B(272, 0, 1, 19, 'w9_toyblock');
  hook(280, 9); yoyo(280, 9, 76);
  hook(286, 9); hook(292, 9);
  spark(291, 6);                                         // pump on the middle hook, then fling high
  arc(260, 15, 267, 12, 5, 2);
  arc(281, 13, 296, 15, 7, 2);

  // ---------------------------------------------------------------- F: Hat Trick tower (306-347)
  G(306, 347);
  flag(299);
  hint(303, 'Moon Hats zip home after each trick, so throw\nagain while you rise: trick, trick, and go!');
  // a 7-tall tower (jump + Hat Trick), then a basin with a safe floor and a
  // 10-tall plateau 14 tiles away: only a two-trick chain from the tower top
  // reaches it. Falling in the basin just means walking back to the tower.
  B(310, 12, 6, 7);
  G(330, 338, 9);
  // a low step at the plateau's foot: one plain Hat Trick from here reaches the
  // top, so the main path never needs the frame-tight two-trick chain (that
  // stays the expert line from the tower, and the way to the spark)
  B(327, 15, 3, 1, 'oneway');
  spark(324, 4);                                       // the top of a perfect first trick
  row(311, 315, 10); arc(317, 8, 329, 7, 8, 2.5); row(331, 337, 7);
  L.spawn('w9_tangle', 322, STAND);
  L.spawn('w9_chute', 347, 17, { dir: -1, period: 190 });

  // ---------------------------------------------------------------- G: boss (348-387)
  G(348, W - 1);
  flag(349);
  hint(351, 'The Mess Monster\'s socks need tidying, quick!\nEach sock wants a different friend\'s trick!');
  row(340, 346, 15);
  const A0 = 354;
  L.spawn('w9_chest', A0 + 1, FLOOR - 2);
  L.spawn('w9_top', A0 + 7, STAND);
  L.spawn('springle', A0 + 10, STAND);
  hook(A0 + 13, 12); hook(A0 + 19, 12); yoyo(A0 + 16, 11, 104); hook(A0 + 16, 11);
  L.spawn('heart', A0 + 22, 14);
  L.arena({ from: A0, to: W - 1, boss: 'w9_messmonster', bossAt: { tx: W - 4, ty: STAND } });
}

// ============================================================== look
const theme = {
  ground: '#a99bd0', groundDark: '#8f80bd', groundSpeck: '#c6bbe6',
  top: '#efe9ff', topDark: '#cfc4f2',
  block: '#ffd23f', blockDark: '#e0a91c',
  platform: '#7fd3ff', platformDark: '#4fa6dd',
  spike: '#ffd23f', spikeDark: '#e0a91c',
  bouncy: '#ff6f91', bouncyDark: '#d94a70',
  crack: '#cfe6ff', crackDark: '#9cc3ea',
};

const SKY = [[0, '#0d0a26'], [0.55, '#271a52'], [1, '#4a2f78']];
function drawBackground(ctx, cam, view, t, game) {
  sky(ctx, view, 'w9', SKY);
  // twinkling stars
  scatter(ctx, cam, view, { factor: 0.03, spacing: 46, yMin: 4, yMax: view.h * 0.8, seed: 9 }, (c, x, y, i, r) => {
    const tw = 0.5 + 0.5 * Math.sin(t * 0.05 + i * 1.7);
    c.fillStyle = r < 0.2 ? '#ffe27a' : '#ffffff';
    c.globalAlpha = 0.35 + tw * 0.65;
    const s = 1 + (r * 3 | 0) * 0.5;
    c.fillRect(x, y, s, s);
    if (r > 0.85) { c.fillRect(x - 2, y + s / 2 - 0.5, s + 4, 1); c.fillRect(x + s / 2 - 0.5, y - 2, 1, s + 4); }
  });
  ctx.globalAlpha = 1;
  // the big beach-ball planet (and a tiny Teapot Zeppelin moon-bound)
  const px = view.w * 0.78 - cam.x * 0.015, py = view.h * 0.26 - cam.y * 0.02;
  ctx.save();
  ctx.beginPath(); ctx.arc(px, py, 46, 0, TAU); ctx.clip();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(px - 50, py - 50, 100, 100);
  const cols = ['#ff6f91', '#ffd23f', '#4fd1c5', '#9b6dff'];
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = cols[k];
    ctx.beginPath(); ctx.ellipse(px - 30 + k * 20 + (t * 0.02 % 20), py, 7, 50, 0.3, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(13,10,38,0.22)'; ctx.beginPath(); ctx.arc(px + 22, py + 18, 50, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 46, 0, TAU); ctx.stroke();
  // floating lost things drifting past
  scatter(ctx, cam, view, { factor: 0.12, spacing: 170, yMin: 30, yMax: view.h * 0.55, seed: 4, drift: 0.1, t }, (c, x, y, i, r) => {
    const a = t * 0.01 + i;
    c.save(); c.translate(x, y + Math.sin(t * 0.02 + i) * 6); c.rotate(a);
    c.globalAlpha = 0.55;
    const k = ((i % 3) + 3) % 3;
    if (k === 0) { drawSockShape(c, -8, -2, 8, 2, SOCKS[(i & 1) ? 0 : 2], 7, 4); }
    else if (k === 1) { c.fillStyle = BLOCK_COLS[(i * 7 & 3)][0]; c.fillRect(-6, -6, 12, 12); c.fillStyle = '#fff6e4'; c.fillRect(-3, -3, 6, 6); }
    else { c.fillStyle = MARBLE_COLS[(i * 3 & 3)]; c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fill(); }
    c.restore();
  });
  ctx.globalAlpha = 1;
  const lh = game.level.pxH;
  hills(ctx, cam, view, { factor: 0.18, base: 110, amp: 36, wave: 300, color: '#3a2a66', seed: 2, levelH: lh, yFactor: 0.2 });
  // craters on the far hills
  const hy = view.h - 110 + (lh - view.h - cam.y) * 0.2;
  scatter(ctx, cam, view, { factor: 0.18, spacing: 130, yMin: hy + 6, yMax: hy + 30, seed: 12 }, (c, x, y, i, r) => {
    c.fillStyle = '#2d2054'; c.beginPath(); c.ellipse(x, y, 12 + r * 10, 4 + r * 2, 0, 0, TAU); c.fill();
  });
  hills(ctx, cam, view, { factor: 0.35, base: 54, amp: 26, wave: 220, color: '#58448f', seed: 6, levelH: lh, yFactor: 0.3 });
}

// Tile hook: moon felt with stitches + craters, alphabet blocks, toy jacks.
function drawTile(ctx, def, x, y, info) {
  const n = def.name;
  if (n === 'block') { toyBlock(ctx, x, y, info.tx, info.ty); return true; }
  if (n === 'spikes') {
    // toy jacks: little stars with ball tips
    for (let k = 0; k < 2; k++) {
      const jx = x + 6 + k * 12, jy = y + 17 + ((info.tx + k) & 1) * 2;
      ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(jx - 5, jy - 5); ctx.lineTo(jx + 5, jy + 5); ctx.moveTo(jx + 5, jy - 5); ctx.lineTo(jx - 5, jy + 5); ctx.moveTo(jx, jy - 7); ctx.lineTo(jx, jy + 5); ctx.stroke();
      ctx.strokeStyle = '#d6dbe8'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.arc(jx, jy - 7, 2.2, 0, TAU); ctx.fill();
    }
    return true;
  }
  if (n !== 'ground') return false;
  def.draw(ctx, x, y, info);
  const L = info.level, up = L.def(info.tx, info.ty - 1);
  if (!up || !up.solid) {
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) ctx.fillRect(x + 2 + k * 8, y + 9, 4, 1.5);
  } else if (hash2(info.tx, info.ty) < 0.16) {
    ctx.fillStyle = '#8f80bd'; ctx.beginPath(); ctx.ellipse(x + 12, y + 12, 7, 3.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c6bbe6'; ctx.fillRect(x + 6, y + 9, 12, 1.5);
  }
  return true;
}

// Foreground: nothing heavy; the moon has an invisible ceiling at the level top.
// Moon magic: right after a Hat Trick the hat zips straight back onto Whisk's
// head, so it can be thrown again while he is still rising (Hat Trick chains).
function onUpdate(game) {
  const p = game.player, h = game.hat, d = game.data;
  if (p.y < 0) { p.y = 0; if (p.vy < 0) p.vy = 0; }
  const n = game.stats.hatTricks;
  if (n !== d.tricks) {
    d.tricks = n;
    if (h.state === 'return' && !p.cap) {
      h.state = 'home';
      game.fx.sparkle(p.x + p.w / 2, p.y - 2, '#ffe27a', 6);
      game.sfx('catch');
    }
  }
}
function onRespawn(game) {
  if (game.data.yoExtra) game.data.yoExtra.on = false;
  game.data.yoTarget = null; game.data.sockFlying = false;
}
function onBossDefeated(game, b) {
  const s = game.entities.find((e) => e.type === 'spark' && e.props.boss);
  if (!s) return;
  game.spawn('hint', s.x - 80, s.y + 26, {
    text: 'You tidied the Moon! What a marvelous sight!\nThe Golden Topper is yours: wear it bright!',
    radius: 140,
  });
  game.sfx('unlock');
}

export default {
  id: 9,
  name: 'The Moon of Mess',
  blurb: 'A low-gravity moon of lost toys. The hardest tricks of all!',
  music: 'w9',
  bossMusic: 'boss',
  gravityScale: 0.7,
  theme,
  build,
  drawBackground,
  drawTile,
  onUpdate,
  onRespawn,
  onBossDefeated,
};
