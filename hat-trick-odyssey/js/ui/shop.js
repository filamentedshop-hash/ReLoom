// HAT SHOP SCENE: the hat rack in the Teapot Zeppelin's cabin. Spend Buttons
// on cosmetic hats (js/ui/hats.js), preview them on Whisk, wear one.
// Contract: export `shopScene`; leaving calls app.go('map'). The equipped id is
// stored with save.equipHat(id) and applied with setHatStyle(id), so the
// in-game hat, the thrown hat and the capture mini-hat all match.
// Touch: tap a hat to try it on, tap the big button to buy / wear.
// Keys: Left/Right browse, Jump = buy / wear, Hat = back.
import { view, INK } from '../engine/const.js';
import { text, rrect, rrectPath, outline, wrapText, vGradient } from '../art/draw.js';
import { cloud } from '../art/bg.js';
import { drawHat, setHatStyle } from '../art/hat.js';
import { drawButton } from '../art/items.js';
import { drawWhisk } from '../art/whisk.js';
import { drawFizz, drawPop } from '../art/friends.js';
import { Particles } from '../engine/particles.js';
import { btn, hit, panel, padlock, fitSize, syncHat, motionOK, TAU } from './kit.js';
import { HATS, rewardReady } from './hats.js';

const fx = new Particles();
const blurbCache = new Map();
const GAP = 6, LEFT_W = 150;
const grid = { x: 0, y: 0, tile: 56, cols: 1, rows: 1 };
const tileRect = { x: 0, y: 0, w: 0, h: 0 };

export const shopScene = {
  t: 0, sel: 0, cheer: 0, nope: 0, msg: '', msgT: 0,
  enter(app) {
    this.t = 0; this.cheer = 0; this.nope = 0; this.msgT = 0;
    fx.clear(); syncHat(app.save);
    this.sel = Math.max(0, HATS.findIndex((h) => h.id === app.save.data.hat));
  },
  exit(app) { syncHat(app.save); },

  // ---- layout
  layout() {
    const s = view.safe, top = s.t + 44, bottom = view.h - s.b - 10;
    const left = { x: s.l + 10, y: top, w: LEFT_W, h: bottom - top };
    const gx = left.x + left.w + 12, gw = view.w - s.r - 10 - gx, gh = bottom - top;
    let tile = 66, cols = 1, rows = 1;
    for (; tile >= 36; tile -= 2) {
      cols = Math.max(1, Math.floor((gw + GAP) / (tile + GAP)));
      rows = Math.ceil(HATS.length / cols);
      if (rows * (tile + GAP) - GAP <= gh) break;
    }
    cols = Math.min(cols, Math.ceil(HATS.length / rows));
    grid.tile = tile; grid.cols = cols; grid.rows = rows;
    grid.x = gx + (gw - (cols * (tile + GAP) - GAP)) / 2;
    grid.y = top + Math.min(20, (gh - (rows * (tile + GAP) - GAP)) / 2);
    return {
      left,
      back: { x: s.l + 10, y: s.t + 7, w: 66, h: 28 },
      action: { x: left.x + 8, y: left.y + left.h - 46, w: left.w - 16, h: 36 },
    };
  },
  tile(i) {
    tileRect.x = grid.x + (i % grid.cols) * (grid.tile + GAP);
    tileRect.y = grid.y + Math.floor(i / grid.cols) * (grid.tile + GAP);
    tileRect.w = tileRect.h = grid.tile;
    return tileRect;
  },

  // ---- state of the selected hat
  // -> 'wearing' | 'owned' | 'claim' | 'locked' | 'buy' | 'poor'
  status(app, h) {
    const save = app.save;
    if (save.ownsHat(h.id)) return save.data.hat === h.id ? 'wearing' : 'owned';
    if (h.reward) return rewardReady(save, h) ? 'claim' : 'locked';
    return save.buttons >= h.price ? 'buy' : 'poor';
  },
  say(m) { this.msg = m; this.msgT = 110; },
  wear(app, h) {
    app.save.equipHat(h.id); setHatStyle(h.id);
    this.cheer = 50;
  },
  act(app) {
    const h = HATS[this.sel], st = this.status(app, h), L = this.layout();
    const px = L.left.x + L.left.w / 2, py = L.left.y + 60;
    if (st === 'owned') { this.wear(app, h); app.audio.sfx('catch'); return; }
    if (st === 'buy' || st === 'claim') {
      if (st === 'buy' && !app.save.spendButtons(h.price)) return;
      app.save.addHat(h.id); this.wear(app, h);
      app.audio.sfx('spark');
      fx.confetti(px, py, 26); fx.confetti(px - 30, py + 20, 10); fx.confetti(px + 30, py + 20, 10);
      this.say(st === 'claim' ? 'You earned it!' : 'New hat!');
      return;
    }
    if (st === 'wearing') return;
    this.nope = 14; app.audio.sfx('uiBack');
  },
  back(app) { app.audio.sfx('uiBack'); app.go('map'); },
  pick(app, i) {
    if (i === this.sel) { if (this.status(app, HATS[i]) === 'owned') this.act(app); return; }
    this.sel = i; app.audio.sfx('ui');
  },

  update(app) {
    this.t++;
    if (this.cheer > 0) this.cheer--;
    if (this.nope > 0) this.nope--;
    if (this.msgT > 0) this.msgT--;
    fx.update();
    const inp = app.input, n = HATS.length;
    if (inp.pressed('right')) { this.sel = (this.sel + 1) % n; app.audio.sfx('ui'); }
    if (inp.pressed('left')) { this.sel = (this.sel + n - 1) % n; app.audio.sfx('ui'); }
    if (this.t > 10 && inp.pressed('jump')) this.act(app);
    if (this.t > 10 && (inp.pressed('hat') || inp.pressed('pause'))) this.back(app);
  },
  pointer(app, kind, x, y) {
    if (kind !== 'down') return;
    const L = this.layout();
    if (hit(L.back, x, y, 7)) return this.back(app);
    if (hit(L.action, x, y, 5)) return this.act(app);
    for (let i = 0; i < HATS.length; i++) if (hit(this.tile(i), x, y, GAP / 2)) return this.pick(app, i);
  },

  // ---- drawing
  drawCabin(ctx, t) {
    const s = view.safe, move = motionOK();
    ctx.fillStyle = vGradient(ctx, 'shop', 0, view.h, [[0, '#8a5a3c'], [1, '#6e4530']]);
    ctx.fillRect(0, 0, view.w, view.h);
    // planks
    ctx.strokeStyle = 'rgba(36,26,58,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let y = 34; y < view.h; y += 34) { ctx.moveTo(0, y); ctx.lineTo(view.w, y); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let k = 0; k < 9; k++) ctx.fillRect(((k * 173) % (view.w + 80)) - 40, ((k * 3) % 9) * 34 + 3, 70, 3);
    // portholes with the sky drifting by
    const py = Math.min(view.h - 60, view.h * 0.5);
    for (let k = 2; k < 2; k++) {   // portholes are hidden behind the rack for now
      const px = k === 0 ? s.l + 58 : view.w - s.r - 46, r = 30;
      ctx.save();
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fillStyle = '#8fd8ff'; ctx.fill(); ctx.clip();
      const off = move ? (t * 0.25 + k * 50) % 150 : k * 40;
      cloud(ctx, px + 70 - off, py - 6, 0.7); cloud(ctx, px + 150 - off, py + 12, 0.55); cloud(ctx, px - 30 - off + 150, py + 16, 0.5);
      ctx.restore();
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke();
      ctx.strokeStyle = '#e2b23c'; ctx.lineWidth = 4.5; ctx.stroke();
    }
    // bunting along the top
    const by = s.t + 2;
    const cols = ['#ff6f91', '#ffd23f', '#4fd1c5', '#9b6dff', '#ff9a3c'];
    for (let x = -6, k = 0; x < view.w; x += 22, k++) {
      const sag = Math.sin(((x + 11) / view.w) * Math.PI * 4) * 2 + 3;
      ctx.beginPath(); ctx.moveTo(x, by + sag - 3); ctx.lineTo(x + 20, by + sag - 3); ctx.lineTo(x + 10, by + sag + 9); ctx.closePath();
      ctx.fillStyle = cols[k % cols.length]; ctx.fill(); outline(ctx, 1.4); ctx.stroke();
    }
  },
  drawTile(ctx, app, i) {
    const h = HATS[i], r = this.tile(i), st = this.status(app, h), sel = i === this.sel, T = r.w;
    const worn = st === 'wearing';
    const fill = sel ? '#fff3b0' : st === 'locked' ? '#d8d2e6' : '#fffaf0';
    rrectPath(ctx, r.x + 1.5, r.y + 3.5, T, T, 9); ctx.fillStyle = 'rgba(36,26,58,0.3)'; ctx.fill();
    rrect(ctx, r.x, r.y, T, T, 9, fill, 2.2);
    if (sel) { rrectPath(ctx, r.x - 2.5, r.y - 2.5, T + 5, T + 5, 11); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke(); }
    const k = T / 35, hy = r.y + T * 0.7;
    if (st === 'locked') ctx.globalAlpha = 0.45;
    drawHat(ctx, r.x + T / 2, hy, { scale: k, style: h.id, wobble: sel && motionOK() ? Math.sin(this.t * 0.12) : 0 });
    ctx.globalAlpha = 1;
    // tag
    const ty = r.y + T - 5.5, cx = r.x + T / 2, fs = Math.max(8, T * 0.165);
    if (worn) {
      rrect(ctx, cx - T * 0.34, ty - fs + 0.5, T * 0.68, fs + 3.5, (fs + 3.5) / 2, '#7be06d', 1.5);
      text(ctx, 'ON', cx, ty, fs, INK, 'center', 900, null);
    } else if (st === 'owned') {
      text(ctx, 'Yours', cx, ty, fs, '#3a9a46', 'center', 900, null);
    } else if (st === 'locked') {
      padlock(ctx, r.x + T - 12, r.y + 13, 0.8);
      text(ctx, 'Prize', cx, ty, fs, '#7a6f96', 'center', 900, null);
    } else if (st === 'claim') {
      text(ctx, 'Free!', cx, ty, fs, '#c2456b', 'center', 900, null);
    } else {
      drawButton(ctx, cx - fs * 0.9, ty - fs * 0.36, { flat: true, scale: fs / 12 });
      text(ctx, String(h.price), cx - fs * 0.2, ty, fs, st === 'poor' ? '#b0506e' : INK, 'left', 900, null);
    }
  },
  drawPreview(ctx, app, L) {
    const h = HATS[this.sel], st = this.status(app, h), l = L.left, t = this.t, move = motionOK();
    panel(ctx, l.x, l.y, l.w, l.h, '#4b3a80', 12);
    const cx = l.x + l.w / 2;
    const roomy = l.h > 230, ws = roomy ? 3.2 : 2.5;
    const textTop = l.y + l.h - (roomy ? 104 : 92);
    const feet = textTop - 12;
    // spotlight + little stage
    ctx.save(); rrectPath(ctx, l.x + 2, l.y + 2, l.w - 4, l.h - 4, 10); ctx.clip();
    ctx.fillStyle = 'rgba(255,240,170,0.16)';
    ctx.beginPath(); ctx.moveTo(cx - 14, l.y); ctx.lineTo(cx + 14, l.y); ctx.lineTo(cx + 56, feet + 4); ctx.lineTo(cx - 56, feet + 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, feet + 2, 52, 9, 0, 0, TAU); ctx.fillStyle = '#ff8fc7'; ctx.fill(); outline(ctx, 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx - 10, feet, 30, 3, 0, 0, TAU); ctx.fill();
    drawPop(ctx, cx - 38, feet + 4, { t, cheer: this.cheer > 0 });
    drawFizz(ctx, cx + 40, feet + 4, { t: t + 9, cheer: this.cheer > 0, facing: -1 });
    const hop = this.cheer > 0 && move ? -Math.abs(Math.sin(this.cheer * 0.25)) * 6 : 0;
    drawWhisk(ctx, cx - 2, feet + hop, { t: move ? t : 0, pose: this.cheer > 0 ? 'cheer' : 'idle', scale: ws, hatStyle: h.id });
    // name + blurb
    text(ctx, h.name, cx, textTop + 12, fitSize(ctx, h.name, l.w - 14, 13.5, 900), '#ffe27a', 'center', 900);
    const key = h.id + (st === 'locked' ? ':lock' : '');
    let lines = blurbCache.get(key);
    if (!lines) { lines = wrapText(ctx, st === 'locked' ? (h.lockText || 'A prize for later') + ' to win this hat.' : h.blurb, l.w - 16, 9.5, 700); blurbCache.set(key, lines); }
    for (let i = 0; i < lines.length && i < 2; i++) text(ctx, lines[i], cx, textTop + 26 + i * 11.5, 9.5, '#fff', 'center', 700, null);
    // action button
    const a = L.action, ox = this.nope ? Math.sin(this.nope * 1.9) * 3 : 0, r = { x: a.x + ox, y: a.y, w: a.w, h: a.h };
    if (st === 'wearing') btn(ctx, r, 'Wearing it!', { kind: 'plain', size: 13, disabled: true });
    else if (st === 'owned') btn(ctx, r, 'Wear it', { kind: 'go', size: 15 });
    else if (st === 'claim') btn(ctx, r, 'Claim it!', { kind: 'primary', size: 15 });
    else if (st === 'locked') btn(ctx, r, 'Locked', { kind: 'plain', size: 13, disabled: true });
    else if (st === 'buy') {
      btn(ctx, r, 'Buy     ' + h.price, { kind: 'primary', size: 15 });
      drawButton(ctx, r.x + r.w / 2 + 2 - String(h.price).length * 2.5, r.y + r.h / 2, { flat: true, scale: 0.95 });
    } else btn(ctx, r, `Need ${h.price - app.save.buttons} more`, { kind: 'plain', size: 12.5, disabled: true });
  },
  draw(ctx, app) {
    const s = view.safe, L = this.layout(), t = this.t;
    this.drawCabin(ctx, t);
    // top bar
    btn(ctx, L.back, 'Back', { kind: 'plain', size: 12, dx: 5 });
    ctx.beginPath(); ctx.moveTo(L.back.x + 9, L.back.y + 14); ctx.lineTo(L.back.x + 17, L.back.y + 8.5); ctx.lineTo(L.back.x + 17, L.back.y + 19.5); ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
    text(ctx, 'Hat Shop', view.w / 2, s.t + 29, 20, '#ffe27a', 'center', 900);
    const count = String(app.save.buttons);
    const bw = 40 + count.length * 8, bx = view.w - s.r - 10 - bw;
    rrect(ctx, bx, s.t + 8, bw, 26, 13, '#fffaf0', 2.2);
    drawButton(ctx, bx + 15, s.t + 21, { flat: true, scale: 1.05 });
    text(ctx, count, bx + 28, s.t + 25.5, 13, INK, 'left', 900, null);

    this.drawPreview(ctx, app, L);
    for (let i = 0; i < HATS.length; i++) this.drawTile(ctx, app, i);
    fx.draw(ctx, { x: 0, y: 0 });
    if (this.msgT > 0) {
      const a = Math.min(1, this.msgT / 20), cx = L.left.x + L.left.w / 2;
      ctx.globalAlpha = a;
      text(ctx, this.msg, cx, L.left.y + 22 - (1 - Math.min(1, (110 - this.msgT) / 10)) * 8, 15, '#ffe27a', 'center', 900);
      ctx.globalAlpha = 1;
    }
  },
};
