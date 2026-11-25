// HUD: hearts, Fun Spark pips, Button count, boss bar, pause button, toast,
// Mumble hint box and the pause menu. Drawn in view (screen) coordinates.
import { view, PHYS, INK } from './const.js';
import { text, rrect, wrapText, PAL } from '../art/draw.js';
import { drawHeart, drawSpark, drawButton, drawPanel } from '../art/items.js';
import { drawMumble } from '../art/friends.js';
import { SPARKS_PER_WORLD } from './save.js';

const wrapCache = new Map();
function wrapped(ctx, str, w, size) {
  const k = str + '|' + w + '|' + size;
  let r = wrapCache.get(k);
  if (!r) { if (wrapCache.size > 40) wrapCache.clear(); r = wrapText(ctx, str, w, size, 700); wrapCache.set(k, r); }
  return r;
}

export function pauseButtonRect() {
  return { x: view.w - view.safe.r - 30, y: view.safe.t + 5, w: 24, h: 22 };
}

export function drawHud(ctx, game) {
  const s = view.safe, p = game.player;
  const left = s.l + 8, top = s.t + 6;
  // hearts
  for (let i = 0; i < PHYS.hearts; i++) drawHeart(ctx, left + 9 + i * 19, top + 10, i < p.hearts, 1.05 + (i === p.hearts - 1 && p.hearts === 1 ? Math.sin(game.t * 0.3) * 0.08 : 0));
  // buttons
  drawButton(ctx, left + 8, top + 30, { flat: true, scale: 0.9 });
  text(ctx, String(game.save.buttons), left + 18, top + 34, 11, '#fff');
  // sparks: 8 pips
  const pr = pauseButtonRect();
  const sx0 = pr.x - 10 - SPARKS_PER_WORLD * 13;
  const mask = game.save.world(game.n).sparks;
  for (let i = 0; i < SPARKS_PER_WORLD; i++) {
    const have = (mask & (1 << i)) !== 0;
    const pop = game.sparkPop.id === i && game.sparkPop.t > 0 ? 1 + game.sparkPop.t / 30 : 1;
    if (have) drawSpark(ctx, sx0 + i * 13 + 6, top + 10, { scale: 0.55 * pop, t: game.t });
    else { ctx.fillStyle = 'rgba(36,26,58,0.4)'; ctx.beginPath(); ctx.arc(sx0 + i * 13 + 6, top + 10, 3.2, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  // pause button
  rrect(ctx, pr.x, pr.y, pr.w, pr.h, 6, 'rgba(255,255,255,0.3)', 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(pr.x + 7.5, pr.y + 5.5, 3.2, 11); ctx.fillRect(pr.x + 13.5, pr.y + 5.5, 3.2, 11);

  // boss bar
  const a = game.arena;
  if (a && a.active && a.boss && !a.boss.dead) {
    const b = a.boss, n = b.maxHp, w = 22 * n + 8, bx = view.w / 2 - w / 2, by = top + 2;
    text(ctx, b.def.title || 'Boss', view.w / 2, by + 9, 10, '#fff', 'center');
    for (let i = 0; i < n; i++) {
      const on = i < b.hp;
      rrect(ctx, bx + 6 + i * 22, by + 13, 18, 7, 3.5, on ? '#ff5d8f' : 'rgba(36,26,58,0.45)', 1.8);
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(bx + 9 + i * 22, by + 14.5, 8, 1.5); }
    }
  }

  // hint box (Mumble). Sits under the top HUD row, clear of the touch buttons.
  if (game.hintA > 0.02 && game.hintText) {
    const w = Math.min(330, view.w - s.l - s.r - 110), size = 10.5;
    const lines = wrapped(ctx, game.hintText, w - 46, size);
    const h = Math.max(30, lines.length * 13 + 12);
    const x = view.w / 2 - w / 2, y = top + 42 - (1 - game.hintA) * 8;
    ctx.globalAlpha = game.hintA;
    drawPanel(ctx, x, y, w, h);
    drawMumble(ctx, x + 19, y + h / 2 + 11, { t: game.t, talking: true });
    ctx.font = `700 ${size}px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`;
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + 38, y + 16 + i * 13 + (h - lines.length * 13 - 12) / 2);
    ctx.globalAlpha = 1;
  }

  // toast
  if (game.toastT > 0 && game.toastText) {
    const a2 = Math.min(1, game.toastT / 15, (game.toastMax - game.toastT) / 8 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, a2));
    const y = view.h * 0.3 - (1 - Math.min(1, (game.toastMax - game.toastT) / 10)) * 6;
    text(ctx, game.toastText, view.w / 2, y, 17, '#ffe27a', 'center', 900);
    ctx.globalAlpha = 1;
  }

  // respawn / clear fades
  if (game.fade > 0) { ctx.fillStyle = `rgba(36,26,58,${game.fade})`; ctx.fillRect(0, 0, view.w, view.h); }
}

// ------------------------------------------------------------ pause menu
const ITEMS = ['resume', 'retry', 'sfx', 'music', 'map'];
export function pauseLayout() {
  const w = 190, h = 26, gap = 6, x = view.w / 2 - w / 2;
  const total = ITEMS.length * (h + gap) - gap;
  const y0 = Math.max(52, view.h / 2 - total / 2 + 16);
  return ITEMS.map((id, i) => ({ id, x, y: y0 + i * (h + gap), w, h }));
}
export function pauseLabel(id, game) {
  if (id === 'resume') return 'Keep Playing';
  if (id === 'retry') return 'Back to Flag';
  if (id === 'sfx') return 'Sounds: ' + (game.save.setting('sfx') ? 'On' : 'Off');
  if (id === 'music') return 'Music: ' + (game.save.setting('music') ? 'On' : 'Off');
  return 'World Map';
}
export function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(36,26,58,0.72)'; ctx.fillRect(0, 0, view.w, view.h);
  const L = pauseLayout();
  text(ctx, 'Paused', view.w / 2, L[0].y - 14, 20, '#ffe27a', 'center', 900);
  L.forEach((r, i) => {
    const sel = i === game.pauseSel;
    rrect(ctx, r.x, r.y, r.w, r.h, 9, sel ? '#ffd23f' : '#fffaf0', 2.2);
    text(ctx, pauseLabel(r.id, game), r.x + r.w / 2, r.y + 17.5, 12, INK, 'center', 800, null);
  });
  text(ctx, game.world.name, view.w / 2, view.h - view.safe.b - 10, 9, 'rgba(255,255,255,0.7)', 'center', 700, null);
}
export { ITEMS as PAUSE_ITEMS, PAL };
