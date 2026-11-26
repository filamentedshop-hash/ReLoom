// WORLD 1: LOLLIPOP MEADOW (tutorial). The exemplar world: every other world
// follows this file's shape. Read CONTRACT.md alongside it.
//
// New ideas taught, in order: run + jump, Gloomlets (stomp or hat), the
// Springle capture (super jump), the Hat Trick bounce, the Puffcloud capture
// (float + flap), cracked blocks, bouncy tiles, moving platforms, and a boss
// (Big Glum) who is too tall to reach without a Springle.
import { TILE, INK, clamp, hash2 } from '../engine/const.js';
import { defineEntity } from '../engine/entities.js';
import { stepBody } from '../engine/physics.js';
import { defineBoss, runPattern, byHits, stepName } from '../engine/boss.js';
import { PAL, outline, blob } from '../art/draw.js';
import { drawGloomlet } from '../art/items.js';
import { sky, hills, scatter, cloud } from '../art/bg.js';

// ============================================================== creatures
// SPRINGLE: a pink coil. Capture = much higher jump (velocity -14, ~8 tiles).
function drawSpringle(ctx, x, y, e) {
  const air = !e.onGround;
  const st = air ? clamp(-e.vy * 0.05, -0.25, 0.5) : Math.sin(e.t * 0.12) * 0.06;   // stretch
  const hgt = 12 * (1 + st);
  ctx.save(); ctx.translate(x, y);
  outline(ctx, 2);
  for (let i = 0; i < 3; i++) {                       // coil rings, bottom to top
    const ry = -2.5 - i * hgt / 3;
    ctx.beginPath(); ctx.ellipse(0, ry, 7.5 - i * 0.8, 2.6, 0, 0, 6.2832);
    ctx.fillStyle = i % 2 ? '#ff6fae' : '#ff9ecb'; ctx.fill(); ctx.stroke();
  }
  const hy = -hgt - 5;
  blob(ctx, 0, hy, 6.5, 5.8, '#ffb3d9', 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-2.5, hy - 2.5, 2, 1.2, -0.5, 0, 6.2832); ctx.fill();
  const f = e.facing || 1;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f * 1 - 2.2, hy, 1.2, 0, 6.2832); ctx.arc(f * 1 + 2.4, hy, 1.2, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f * 1 + 0.1, hy + 1.6, 1.6, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

defineEntity('springle', {
  w: 18, h: 20, capturable: true,
  init(e) { e.phase = (e.x * 7) % 90 | 0; },
  update(e, game) {
    if (e.onGround && (e.t + e.phase) % 90 === 0) e.vy = -3.6;     // idle hop
    stepBody(game, e);
  },
  draw(ctx, e) { drawSpringle(ctx, e.x + e.w / 2, e.y + e.h, e); },
  capture: {
    move: { jumpVel: 14, maxRun: 2.6 },
    hat: { y: -2, scale: 0.95 },
    onJump(p, game) { game.sfx('bounce'); game.fx.ring(p.x + p.w / 2, p.y + p.h, '#ff9ecb', 5); },
  },
});

// PUFFCLOUD: a sleepy cloud. Capture = float (gravity 0.12), tap Jump to flap
// (-3.2), pops after 8 seconds.
function drawPuff(ctx, x, y, e) {
  ctx.save(); ctx.translate(x, y);
  const b = Math.sin(e.t * 0.1) * 0.6;
  ctx.beginPath();
  ctx.arc(-8, -6, 6 + b, 0, 6.2832); ctx.arc(0, -10, 8 + b, 0, 6.2832); ctx.arc(8, -6.5, 6.5 - b, 0, 6.2832); ctx.rect(-9, -7, 18, 6.5);
  outline(ctx, 4); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.fillStyle = '#dff1ff'; ctx.fillRect(-10, -3.4, 21, 2.2);
  ctx.fillStyle = 'rgba(255,143,199,0.6)'; ctx.beginPath(); ctx.arc(-6, -5, 1.8, 0, 6.2832); ctx.arc(6.5, -5, 1.8, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath();
  if (e.possessed) { ctx.arc(-3, -8, 1.3, 0, 6.2832); ctx.moveTo(4.6, -8); ctx.arc(3.3, -8, 1.3, 0, 6.2832); }
  else { ctx.arc(-3, -8.6, 1.5, 0.2, Math.PI - 0.2); ctx.moveTo(4.8, -8.3); ctx.arc(3.3, -8.6, 1.5, 0.2, Math.PI - 0.2); }
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0.2, -5.6, 1.2, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

defineEntity('puffcloud', {
  w: 26, h: 18, capturable: true,
  update(e) { e.y = e.homeY + Math.sin(e.t * 0.04) * 3; },        // bobs in the air
  draw(ctx, e) { drawPuff(ctx, e.x + e.w / 2, e.y + e.h, e); },
  capture: {
    w: 22, h: 16,
    duration: 480,                                                 // 8 seconds, then pop
    move: { gravity: 0.12, maxFall: 1.6, maxRun: 1.9, accel: 0.2, airDecel: 0.04, groundDecel: 0.2, jumpVel: 3.2, riseCut: 0, windScale: 1.5 },
    hat: { y: -1 },
    control(p, game, c) {                                          // tap Jump to flap, anywhere
      if (c.jump && !p.onGround) {
        p.vy = -3.2 * p.gdir;
        game.sfx('swim'); game.fx.puff(p.x + p.w / 2, p.y + p.h, '#ffffff', 3);
      }
      return false;                                                // keep the default run physics
    },
    onExit(p, game, reason) { if (reason === 'timeout') { game.sfx('pop'); game.fx.puff(p.x + p.w / 2, p.y + p.h / 2, '#ffffff', 14); } },
  },
});

// ============================================================== boss: BIG GLUM
// A giant Gloomlet, 4 tiles tall: Whisk cannot jump onto him (jump = 3.6
// tiles), a Springle can. Loop: plod -> wind up -> hop -> slam (ground puffs)
// -> rest. Three stomps and the gloom pops.
defineEntity('w1_glumpuff', {
  w: 14, h: 12, enemy: true,
  init(e) { e.vx = e.props.vx || 1.5; e.life = 230; },
  update(e, game) {
    const vx = e.vx;
    stepBody(game, e);
    if (e.hitWall || --e.life <= 0) { e.dead = true; game.fx.puff(e.x + 7, e.y + 6, PAL.gloomLight, 5); return; }
    e.vx = vx; e.facing = vx > 0 ? 1 : -1;
  },
  draw(ctx, e) { drawGloomlet(ctx, e.x + 7, e.y + e.h, { scale: 0.75, t: e.t * 2, facing: e.facing, mood: 'angry', squash: Math.abs(Math.sin(e.t * 0.3)) * 0.3 }); },
});

const GLUM_STEPS = [
  { name: 'plod', frames: (e) => byHits(e, [120, 100, 80]),
    tick(e, game) {
      const p = game.player, a = game.arena;
      const tx = clamp(p.x + p.w / 2, a.x0 + 150, a.x1 - 150) - e.w / 2;
      const sp = byHits(e, [0.5, 0.75, 1.0]);
      e.vx = Math.abs(tx - e.x) < 3 ? 0 : Math.sign(tx - e.x) * sp;
      if (e.vx) e.facing = Math.sign(e.vx);
    } },
  { name: 'windup', frames: 36, enter(e) { e.vx = 0; } },
  { name: 'hop', enter(e, game) { e.vy = -8.5; game.sfx('jump'); }, until: (e) => e.onGround && e.stepT > 6 },
  { name: 'slam', frames: 8,
    enter(e, game) {
      game.cam.shake(5, 16); game.sfx('land');
      game.fx.burst(e.x + e.w / 2, e.y + e.h, { n: 14, speed: 3.5, up: 1, color: PAL.gloomLight, shape: 'dot', life: 28 });
      const n = byHits(e, [1, 1, 2]);
      for (let i = 0; i < n; i++) {
        game.spawn('w1_glumpuff', e.x - 14, e.y + e.h - 12, { vx: -(1.3 + i * 0.7) });
        game.spawn('w1_glumpuff', e.x + e.w, e.y + e.h - 12, { vx: 1.3 + i * 0.7 });
      }
    } },
  { name: 'rest', frames: (e) => byHits(e, [130, 110, 95]), enter(e) { e.vx = 0; } },
];

defineBoss('w1_bigglum', {
  title: 'Big Glum', hp: 3, w: 76, h: 96, hurtInv: 110,
  update(e, game) {
    runPattern(e, game, GLUM_STEPS);
    stepBody(game, e);
    const a = game.arena;
    e.x = clamp(e.x, a.x0 + 110, a.x1 - 110 - e.w);
  },
  idle(e, game) { e.vx = 0; stepBody(game, e); },
  onHurt(e, game) { game.toast(e.hp === 2 ? 'Boing! Two more!' : 'One more bounce!', 80); e.step = 4; e.stepT = 60; },
  draw(ctx, e) {
    const step = stepName(e, GLUM_STEPS);
    const hits = e.maxHp - e.hp;
    let mood = 'grump', squash = 0;
    if (e.defeated || e.inv > 40) mood = 'dizzy';
    else if (e.dormant || step === 'rest') mood = 'sleepy';
    else if (step === 'windup') { mood = 'angry'; squash = Math.min(1, e.stepT / 30) * 0.5; }
    else if (step === 'slam') squash = 0.6;
    if (e.inv > 0 && ((e.t >> 2) & 1)) ctx.globalAlpha = 0.6;
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    ctx.scale(1, 1.42);
    // colour seeps back in with every hit
    const body = hits === 0 ? PAL.gloom : hits === 1 ? '#9a8fc0' : '#c08fd0';
    const dark = hits === 0 ? PAL.gloomDark : hits === 1 ? '#7468a3' : '#9c68b3';
    drawGloomlet(ctx, 0, 0, { scale: 4.2, t: e.t, facing: e.facing, mood, squash, body, dark });
    ctx.restore();
    if (step === 'rest' && !e.defeated) {             // "zzz" = safe to bounce on
      ctx.fillStyle = '#fff'; ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center';
      const k = (e.t % 60) / 60;
      ctx.globalAlpha = 1 - k; ctx.fillText('z', e.x + e.w / 2 + 26 + k * 8, e.y - 4 - k * 16);
    }
    ctx.globalAlpha = 1;
  },
});

// ============================================================== level
// 19 rows tall; the meadow floor is row 14. Chunks are laid left to right.
// Legend (defaults): # ground  = one-way  ^ spikes  B cracked block  j bouncy
//   o button  * Fun Spark  F checkpoint  ? Mumble hint  G gloomlet  P start
// World legend: S springle  C puffcloud.  Digits are markers for builder calls.
const A_HELLO = [
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                          *                 ',
  '                        =====               ',
  '            ooo                     oo      ',
  '                     ==            o  o     ',
  '  P    ?       ###        ?    G        F   ',
  '####################################  ######',
  '####################################  ######',
  '####################################  ######',
  '####################################  ######',
  '####################################  ######',
];
const B_SPRINGLE = [
  '                                        ',
  '                                        ',
  '                                        ',
  '                           *            ',
  '                         =====          ',
  '                                        ',
  '                                        ',
  '                    ooo           o     ',
  '                  ###############       ',
  '                  ###############  o    ',
  '                  ##################    ',
  '            o     ##################  o ',
  '           o o    ##################### ',
  '   ?      S       ##################### ',
  '########################################',
  '########################################',
  '########################################',
  '########################################',
  '########################################',
];
const C_HATTRICK = [
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                                                ',
  '                    *                           ',
  '                 o     o                        ',
  '               o         o                      ',
  '  F   ?                              G          ',
  '##############            ######################',
  '##############            ######################',
  '################  oooo  ########################',
  '################################################',
  '################################################',
];
const D_PUFFCLOUD = [
  '                                                    ',
  '                                                    ',
  '                                                    ',
  '                        *                           ',
  '                                                    ',
  '                      o   o                         ',
  '                                                    ',
  '                    o       o                       ',
  '                                                    ',
  '                  o           o                     ',
  '                                                    ',
  '                o               o                   ',
  '                                                    ',
  '  F   ?    C                         G     G        ',
  '##############                    ##################',
  '##############^^^^^^^^^^^^^^^^^^^^##################',
  '####################################################',
  '####################################################',
  '####################################################',
];
const E_BLOCKS = [
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '                                                        ',
  '            oooooo                                      ',
  '          ##########            *                       ',
  '          ##########                                    ',
  '          #      ###          o   o                     ',
  '  ?       B   *  ###    F                    G     G    ',
  '######j#####################1       ####################',
  '############################        ####################',
  '############################        ####################',
  '############################        ####################',
  '############################        ####################',
];
const F_TOWERS = [
  '                                                  ',
  '                        *                         ',
  '                      =====                       ',
  '                                                  ',
  '                                                  ',
  '                                                  ',
  '                                                  ',
  '                ooo                               ',
  '               =====                              ',
  '                                                  ',
  '                                                  ',
  '                         oo            oo         ',
  '                                                  ',
  '  F     S         G      ^^     G      ^^         ',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
  '##################################################',
];
const G_BOSS = [
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '  F    ?    3  S              2          S  ',
  '############################################',
  '############################################',
  '############################################',
  '############################################',
  '############################################',
];

function build(L) {
  L.legend({ S: 'springle', C: { ent: 'puffcloud', props: { oy: -8 } } });
  L.chunk(A_HELLO).chunk(B_SPRINGLE).chunk(C_HATTRICK).chunk(D_PUFFCLOUD).chunk(E_BLOCKS).chunk(F_TOWERS).chunk(G_BOSS);

  // Mumble's rhymes, left to right, one per '?'.
  L.hints([
    'Left and Right will scoot your feet.\nPress Jump for Buttons, shiny and sweet!',
    'A grumpy Gloomlet blocks the way.\nBop its head, or toss your Hat: hooray!',
    'That pink Springle is coiled up tight.\nHat it, then Jump with all your might!',
    'Toss your Hat, then hop on top.\nA Hat Trick bounce goes boing, not flop!',
    'A Puffcloud naps on a pillow of air.\nHat it, tap Jump, and flap up there!',
    'Cracked blocks crumble, crack and pop\nwhen your flying Hat goes bop!',
    'Big Glum is tall, too tall to hop.\nBe a Springle, and land on top!',
  ]);

  // Moving platform over the gap in chunk E (marker 1 = its starting cell).
  L.on('1', 'mover', { tiles: 3, moveX: 5, period: 260 });

  // Boss arena: from marker 3 to the end of the level; Big Glum stands at marker 2.
  L.arena({ from: L.mark('3').tx, to: L.width - 1, boss: 'w1_bigglum', bossAt: '2' });
}

// ============================================================== look
const theme = {
  ground: '#c98a55', groundDark: '#a96d3e', groundSpeck: '#e3ab73',
  top: '#7fe07a', topDark: '#49b862',
  platform: '#ff9ecb', platformDark: '#e56aa8',
};

function lollipop(ctx, x, y, r, c1, c2) {
  ctx.fillStyle = '#fdf6e3'; ctx.fillRect(x - 2, y, 4, 300);
  ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = c2; ctx.lineWidth = r * 0.22;
  ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0.4, 5.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.25, 2.2, 6.8); ctx.stroke();
}

function drawBackground(ctx, cam, view, t, game) {
  sky(ctx, view, 'w1', [[0, '#7fd3ff'], [0.6, '#c9efff'], [1, '#ffe9f3']]);
  const lh = game.level.pxH;
  scatter(ctx, cam, view, { factor: 0.08, spacing: 190, yMin: 20, yMax: view.h * 0.42, seed: 3, drift: 0.12, t }, (c, x, y, i, r) => cloud(c, x, y, 0.8 + r * 0.6));
  hills(ctx, cam, view, { factor: 0.15, base: 96, amp: 44, wave: 330, color: '#b6ecd0', seed: 1, levelH: lh });
  const by = view.h - 70 + (lh - view.h - cam.y) * 0.12;
  scatter(ctx, cam, view, { factor: 0.3, spacing: 150, yMin: by - 70, yMax: by - 20, seed: 11 }, (c, x, y, i, r) => {
    const k = ((i % 3) + 3) % 3;
    lollipop(c, x, y, 13 + r * 9, k === 0 ? '#ffb3d9' : k === 1 ? '#ffe08a' : '#b9a6ff', k === 0 ? '#ff7fb8' : k === 1 ? '#ffb347' : '#8f77ee');
  });
  hills(ctx, cam, view, { factor: 0.4, base: 40, amp: 30, wave: 210, color: '#8fe3a0', seed: 5, levelH: lh, yFactor: 0.25 });
}

// Tile hook: let the default ground draw, then add a flower here and there.
function drawTile(ctx, def, x, y, info) {
  if (def.name !== 'ground') return false;                 // false = engine draws the default
  def.draw(ctx, x, y, info);
  const up = info.level.def(info.tx, info.ty - 1);
  if (!up && hash2(info.tx, 99) < 0.22) {
    const fx = x + 6 + hash2(info.tx, 5) * 12, sway = Math.sin(info.t * 0.05 + info.tx) * 1.2;
    ctx.strokeStyle = '#2f9e52'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx, y + 1); ctx.lineTo(fx + sway, y - 7); ctx.stroke();
    ctx.fillStyle = hash2(info.tx, 8) < 0.5 ? '#ff7fb8' : '#ffd23f';
    ctx.beginPath(); ctx.arc(fx + sway, y - 8, 3, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx + sway, y - 8, 1.1, 0, 6.2832); ctx.fill();
  }
  return true;                                             // true = handled, skip the default
}

export default {
  id: 1,
  name: 'Lollipop Meadow',
  blurb: 'Sweet hills, bouncy Springles and sleepy Puffclouds.',
  music: 'w1',
  theme,
  build,
  drawBackground,
  drawTile,
};
