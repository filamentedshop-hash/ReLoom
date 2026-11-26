// Built-in entity types shared by every world. They are defined with exactly
// the same defineEntity() API that worlds use for their own types.
import { TILE, INK, PHYS, clamp } from './const.js';
import { defineEntity } from './entities.js';
import { stepBody, edgeAhead } from './physics.js';
import { PAL, outline, blob, rrect, text } from '../art/draw.js';
import { drawSpark, drawButton, drawFlag, drawGloomlet, drawHeart } from '../art/items.js';
import { drawMumble, drawZeppelin } from '../art/friends.js';

// ------------------------------------------------------------ pickups
defineEntity('button', {
  w: 14, h: 14, anchor: 'center', pickup: true,
  onCollect(e, game) {
    e.dead = true;
    game.addButtons(e.props.value || 1);
    game.fx.sparkle(e.x + 7, e.y + 7, '#ffd1dc', 4);
    game.sfx('button');
  },
  draw(ctx, e) { drawButton(ctx, e.x + 7, e.y + 7 + Math.sin((e.t + e.homeX) * 0.08) * 1.5, { t: e.t + e.homeX }); },
});

defineEntity('spark', {
  w: 18, h: 18, anchor: 'center', pickup: true,
  init(e, game) { e.ghost = game.save.hasSpark(game.n, e.props.id); e.light = 46; },
  onCollect(e, game) { game.collectSpark(e); },
  draw(ctx, e) { drawSpark(ctx, e.x + 9, e.y + 9 + Math.sin(e.t * 0.06) * 2.5, { t: e.t, ghost: e.ghost }); },
});

defineEntity('heart', {
  w: 14, h: 14, anchor: 'center', pickup: true,
  onCollect(e, game) {
    const p = game.player;
    if (p.hearts >= PHYS.hearts) return;          // stays until needed
    e.dead = true; p.hearts++;
    game.fx.sparkle(e.x + 7, e.y + 7, '#ffb3c7', 8); game.sfx('heart');
  },
  draw(ctx, e) { drawHeart(ctx, e.x + 7, e.y + 7 + Math.sin(e.t * 0.08) * 2, true, 0.9 + Math.sin(e.t * 0.16) * 0.06); },
});

// ------------------------------------------------------------ checkpoint + hint + goal
defineEntity('checkpoint', {
  w: 18, h: 36, layer: -1,
  onTouch(e, game) { if (game.checkpoint.ent !== e) game.setCheckpoint(e); },
  draw(ctx, e, game) { drawFlag(ctx, e.x + 9, e.gdir > 0 ? e.y + e.h : e.y + e.h, { active: game.checkpoint.ent === e, t: e.t }); },
});

// Mumble's teacup. props: text (string, '\n' allowed), radius (px, default 46)
defineEntity('hint', {
  w: 22, h: 20, layer: -1,
  init(e) { e.text = e.props.text || ''; e.near = false; },
  update(e, game) {
    const p = game.player, r = e.props.radius || 46;
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h / 2) - (e.y + e.h / 2);
    const near = Math.abs(dx) < r && Math.abs(dy) < 60;
    if (near) { game.showHint(e.text, e); if (dx) e.facing = dx > 0 ? 1 : -1; }
    if (near && !e.near) game.sfx('hint');
    e.near = near;
  },
  draw(ctx, e) {
    drawMumble(ctx, e.x + e.w / 2, e.y + e.h, { t: e.t, talking: e.near, facing: e.facing });
    if (!e.near) {            // little "!" so kids know he has something to say
      const by = e.y - 16 + Math.sin(e.t * 0.1) * 1.5;
      blob(ctx, e.x + e.w / 2 + 6, by, 5, 5.5, '#fffaf0', 1.5);
      text(ctx, '!', e.x + e.w / 2 + 6, by + 3, 8, '#ff5d8f', 'center', 900, null);
    }
  },
});

// Level exit for worlds without a boss spark (stubs, bonus rooms).
defineEntity('goal', {
  w: 28, h: 44, layer: -1,
  onTouch(e, game) { game.clearWorld(); },
  draw(ctx, e) {
    drawZeppelin(ctx, e.x + e.w / 2, e.y - 22, { t: e.t, scale: 0.6 });
    ctx.fillStyle = INK; ctx.fillRect(e.x + e.w / 2 - 1, e.y + 8, 2, e.h - 8);
    rrect(ctx, e.x + 2, e.y + e.h - 6, e.w - 4, 6, 3, '#c98a4b', 1.6);
  },
});

// ------------------------------------------------------------ gloomlet
// Basic patrol enemy. props: speed (0.6), dir (-1|1), still (true = stands still)
defineEntity('gloomlet', {
  w: 18, h: 15, enemy: true,
  init(e) { e.speed = e.props.speed || 0.6; e.facing = e.props.dir || -1; },
  update(e, game) {
    if (!e.props.still && e.onGround) {
      if (edgeAhead(game, e, e.facing) || e.hitWall === e.facing) e.facing = -e.facing;
      e.vx = e.facing * e.speed;
    }
    stepBody(game, e);
    if (e.y > game.level.pxH + 60) e.dead = true;
  },
  draw(ctx, e) {
    const sq = e.onGround ? Math.max(0, Math.sin(e.t * 0.16)) * 0.25 : 0;
    drawGloomlet(ctx, e.x + e.w / 2, e.y + e.h, { facing: e.facing, t: e.t, squash: sq });
  },
});

// ------------------------------------------------------------ zones
// props: kind ('water' | 'wind' | 'gravity' | 'trigger' | 'dark'), w, h (px),
//   wind:    fx (px/frame sideways push), fy (added to vy each frame; -0.7 lifts)
//   gravity: dir (-1 = up, 1 = down)
//   any:     onEnter(game, zone), onExit(game, zone), onStay(game, zone), once,
//            signal (zone is only active while that signal is on), invisible,
//            draw(ctx, zone, game) to replace the default look
defineEntity('zone', {
  zone: true, sizeFromProps: true, anchor: 'cell', layer: 1,
  init(e) {
    const p = e.props;
    e.kind = p.kind || 'trigger';
    e.fx = p.fx || 0; e.fy = p.fy || 0; e.dir = p.dir || -1;
    e.inside = false; e.off = false; e.fired = false;
  },
  update(e, game) { if (e.props.signal !== undefined) e.off = !game.signal(e.props.signal); },
  draw(ctx, e, game) {
    const p = e.props;
    if (e.off || p.invisible) return;
    if (p.draw) { p.draw(ctx, e, game); return; }
    const cam = game.cam, v = game.view;
    const x0 = Math.max(e.x, cam.x), x1 = Math.min(e.x + e.w, cam.x + v.w);
    const y0 = Math.max(e.y, cam.y), y1 = Math.min(e.y + e.h, cam.y + v.h);
    if (x1 <= x0 || y1 <= y0) return;
    if (e.kind === 'water') {
      ctx.fillStyle = (game.theme.liquid) || 'rgba(90,190,255,0.5)';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (y0 === e.y) {
        ctx.fillStyle = game.theme.liquidTop || '#d9f4ff';
        for (let x = Math.floor(x0 / 12) * 12; x < x1; x += 12) {
          const a = Math.max(x, x0), b = Math.min(x + 12, x1);
          if (b > a) ctx.fillRect(a, e.y + Math.sin(game.t * 0.06 + x * 0.05) * 1.5, b - a, 2);
        }
      }
    } else if (e.kind === 'wind') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      const horiz = Math.abs(e.fx) >= Math.abs(e.fy);
      const sp = horiz ? Math.sign(e.fx) * 3 : Math.sign(e.fy) * 3;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const sx = ((i * 97) % 53) / 53, sy = ((i * 61) % 41) / 41;
        if (horiz) {
          const y = e.y + sy * e.h; if (y < y0 || y > y1) continue;
          const x = e.x + (((sx * e.w + game.t * sp) % e.w) + e.w) % e.w; if (x < x0 || x > x1 - 12) continue;
          ctx.moveTo(x, y); ctx.lineTo(x + 12, y);
        } else {
          const x = e.x + sx * e.w; if (x < x0 || x > x1) continue;
          const y = e.y + (((sy * e.h + game.t * sp) % e.h) + e.h) % e.h; if (y < y0 || y > y1 - 12) continue;
          ctx.moveTo(x, y); ctx.lineTo(x, y + 12);
        }
      }
      ctx.stroke();
    } else if (e.kind === 'gravity') {
      ctx.fillStyle = e.dir < 0 ? 'rgba(190,140,255,0.16)' : 'rgba(140,220,255,0.16)';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = Math.ceil(x0 / 48) * 48; x < x1; x += 48) {
        const yy = e.y + ((((x * 7) % e.h) - game.t * 0.5 * e.dir) % e.h + e.h) % e.h;
        if (yy < y0 + 4 || yy > y1 - 4) continue;
        ctx.beginPath(); ctx.moveTo(x - 4, yy + 3 * -e.dir * -1); ctx.lineTo(x, yy + 3 * e.dir); ctx.lineTo(x + 4, yy + 3 * -e.dir * -1); ctx.fill();
      }
    }
  },
});

// ------------------------------------------------------------ platforms
function plank(ctx, x, y, w, h, fill, dark) {
  rrect(ctx, x, y, w, h, 4, fill, 2);
  ctx.fillStyle = dark; ctx.fillRect(x + 3, y + h - 4, w - 6, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + 5, y + 2.5, Math.min(14, w - 10), 1.5);
}

// Moving platform (one-way, carries riders). Placed by its top-left cell.
// props: tiles (width, default 3), moveX, moveY (travel in tiles, may be
// fractional/negative), period (frames for a full there-and-back, default 240),
// phase (0..1), signal (only moves while that signal is on), draw(ctx, e, game)
defineEntity('mover', {
  platform: true, anchor: 'cell', h: 10,
  init(e) {
    const p = e.props;
    e.w = (p.tiles || 3) * TILE; e.h = 10;
    e.tx = (p.moveX || 0) * TILE; e.ty = (p.moveY || 0) * TILE;
    e.period = p.period || 240; e.clock = (p.phase || 0) * e.period;
    e.always = true;       // keeps cycling off-screen so timing stays predictable
  },
  update(e, game) {
    if (e.props.signal === undefined || game.signal(e.props.signal)) e.clock++;
    const k = 0.5 - 0.5 * Math.cos((e.clock / e.period) * 6.2832);
    const nx = e.homeX + e.tx * k, ny = e.homeY + e.ty * k;
    e.dx = nx - e.x; e.dy = ny - e.y; e.x = nx; e.y = ny;
  },
  draw(ctx, e, game) {
    if (e.props.draw) return e.props.draw(ctx, e, game);
    plank(ctx, e.x, e.y, e.w, e.h, game.theme.platform, game.theme.platformDark);
  },
});

// Timed platform: solid for `on` frames, gone for `off` frames (flashes before
// it vanishes). props: tiles (2), on (90), off (70), phase (frames)
defineEntity('blink', {
  platform: true, anchor: 'cell', h: 10,
  init(e) { const p = e.props; e.w = (p.tiles || 2) * TILE; e.on = p.on || 90; e.offT = p.off || 70; e.clock = p.phase || 0; e.always = true; },
  update(e) {
    e.clock = (e.clock + 1) % (e.on + e.offT);
    e.off = e.clock >= e.on;
  },
  draw(ctx, e, game) {
    if (e.off) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2); ctx.setLineDash([]);
      return;
    }
    const left = e.on - e.clock;
    if (left < 36 && ((left >> 2) & 1)) ctx.globalAlpha = 0.45;
    plank(ctx, e.x, e.y, e.w, e.h, '#ffe27a', '#e2b23c');
    ctx.globalAlpha = 1;
  },
});

// ------------------------------------------------------------ switches + doors
// Switch. Hit it with the hat (or stand on it when plate:true) to drive a signal.
// props: id (signal name), mode 'toggle' (default) | 'once' | 'timed' | 'hold',
//        time (frames, for 'timed'), plate (pressure plate instead of hat target)
defineEntity('switch', {
  w: 18, h: 18,
  init(e) { e.mode = e.props.mode || 'toggle'; e.cool = 0; e.timer = 0; e.pressed = false; if (e.props.plate) { e.h = 6; e.y += 12; } },
  update(e, game) {
    if (e.cool > 0) e.cool--;
    if (e.mode === 'timed' && e.timer > 0 && --e.timer === 0) { game.setSignal(e.props.id, false); game.sfx('switch'); }
    if (e.props.plate) {
      if (e.mode === 'hold') game.setSignal(e.props.id, e.pressed);
      e.wasPressed = e.pressed; e.pressed = false;
    }
  },
  activate(e, game) {
    if (e.cool > 0) return;
    e.cool = 30;
    const id = e.props.id;
    if (e.mode === 'once') { if (game.signal(id)) return; game.setSignal(id, true); }
    else if (e.mode === 'timed') { game.setSignal(id, true); e.timer = e.props.time || 300; }
    else game.setSignal(id, !game.signal(id));
    game.sfx('switch'); game.fx.sparkle(e.x + e.w / 2, e.y + 4, '#ffe27a', 6);
  },
  onHat(e, game) { if (!e.props.plate) { e.def.activate(e, game); return 'bounce'; } },
  onTouch(e, game, p) {
    if (!e.props.plate) return;
    e.pressed = true;
    if (!e.wasPressed && e.mode !== 'hold') e.def.activate(e, game);
  },
  draw(ctx, e, game) {
    const on = game.signal(e.props.id);
    if (e.props.plate) { rrect(ctx, e.x, e.y + (e.wasPressed ? 3 : 0), e.w, 6 - (e.wasPressed ? 3 : 0), 2, on ? '#7bd857' : '#ff5d8f', 1.6); return; }
    ctx.fillStyle = INK; ctx.fillRect(e.x + e.w / 2 - 1.5, e.y + 8, 3, e.h - 8);
    blob(ctx, e.x + e.w / 2, e.y + 7, 7, 7, on ? '#7bd857' : '#ff5d8f', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(e.x + e.w / 2 - 2, e.y + 5, 2, 0, 6.2832); ctx.fill();
    if (e.mode === 'timed' && e.timer > 0) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.arc(e.x + e.w / 2, e.y + 7, 10, -1.57, -1.57 + 6.2832 * e.timer / (e.props.time || 300)); ctx.stroke();
    }
  },
});

// Door: a solid box that opens while its signal is on.
// props: id (signal), tilesW (1), tilesH (3), invert (open while the signal is OFF)
defineEntity('door', {
  solid: true, anchor: 'cell',
  init(e) { e.w = (e.props.tilesW || 1) * TILE; e.h = (e.props.tilesH || 3) * TILE; e.open = 0; e.always = true; },
  update(e, game) {
    let want = game.signal(e.props.id);
    if (e.props.invert) want = !want;
    if (!want && e.off) {      // do not close on top of the player
      const p = game.player;
      if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) want = true;
    }
    if (want !== e.off) game.sfx('door');
    e.off = want;
    e.open = clamp(e.open + (want ? 0.08 : -0.08), 0, 1);
  },
  draw(ctx, e) {
    const h = e.h * (1 - e.open * 0.86);
    rrect(ctx, e.x + 2, e.y, e.w - 4, h, 4, '#9b6dff', 2);
    ctx.fillStyle = '#7a4fe0'; ctx.fillRect(e.x + 5, e.y + 3, 4, Math.max(0, h - 6));
    if (h > 20) blob(ctx, e.x + e.w / 2, e.y + h - 10, 3.5, 3.5, PAL.hatBand, 1.5);
  },
});

// ------------------------------------------------------------ projectiles
// Spawn with game.shoot({...}); see CONTRACT.md.
defineEntity('projectile', {
  w: 10, h: 10, always: true, layer: 1,
  init(e) {
    const p = e.props;
    e.w = e.h = (p.r || 5) * 2;
    e.vx = p.vx || 0; e.vy = p.vy || 0; e.life = p.life || 240;
    e.grav = p.gravity || 0; e.friendly = !!p.friendly;
  },
  update(e, game) {
    e.vy += e.grav; e.x += e.vx; e.y += e.vy;
    if (--e.life <= 0) { e.dead = true; return; }
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    if (e.props.hitsTiles !== false && game.level.solidAt(cx, cy)) return e.def.pop(e, game);
    if (e.friendly) {
      const A = game.active;
      for (let i = 0; i < A.length; i++) {
        const t = A[i];
        if (!t.def.enemy || t.dead || t.hidden) continue;
        if (cx > t.x && cx < t.x + t.w && cy > t.y && cy < t.y + t.h) { game.hit(t, 'projectile'); return e.def.pop(e, game); }
      }
    }
  },
  pop(e, game) {
    e.dead = true;
    if (e.props.onHit) e.props.onHit(e, game);
    game.fx.puff(e.x + e.w / 2, e.y + e.h / 2, e.props.color || PAL.gloomLight, 5);
  },
  onTouch(e, game, p) {
    if (e.friendly) return;
    game.hurtPlayer({ fromX: e.x + e.w / 2 });
    e.def.pop(e, game);
  },
  onHat(e, game) {
    if (e.friendly) return;
    if (e.props.hatProof) return 'bounce';
    e.def.pop(e, game); game.sfx('pop');
  },
  draw(ctx, e, game) {
    if (e.props.draw) return e.props.draw(ctx, e, game);
    blob(ctx, e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, e.props.color || PAL.gloom, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(e.x + e.w * 0.3, e.y + e.h * 0.25, 2, 2);
  },
});
