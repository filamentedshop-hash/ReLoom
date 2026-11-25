// THE HAT RACK: every cosmetic hat Whisk can wear. Each one is registered as a
// hat style (js/art/hat.js) at module load, so drawHat / drawWhisk / the flying
// hat / the mini capture hat all show whichever one is equipped.
//
// Custom shapes are drawn in hat-local units: brim bottom-centre at (0, 0),
// up is negative y, the default hat is 18 wide and about 15 tall. `wob` is the
// sideways lean of the tip (about -2.5..2.5).
import { INK, PAL, outline, blob, rrect, starPath } from '../art/draw.js';
import { registerHatStyle } from '../art/hat.js';

const TAU = 6.2832;
function ink(ctx, w = 1.6) { outline(ctx, w); ctx.stroke(); }
function star(ctx, x, y, r, fill) { starPath(ctx, x, y, r, r * 0.45, 5); ctx.fillStyle = fill; ctx.fill(); }
function glint(ctx, x, y, r) { starPath(ctx, x, y, r, r * 0.3, 4); ctx.fillStyle = '#fff'; ctx.fill(); }

function chef(ctx, st, wob, H) {
  const lean = wob * 0.7, ty = -H * 0.78;
  blob(ctx, -5 + lean, ty + 1, 4.4, 4.2, '#fff', 1.6);
  blob(ctx, 5 + lean, ty + 1, 4.4, 4.2, '#fff', 1.6);
  blob(ctx, lean, ty - 2.2, 5.2, 4.6, '#fff', 1.6);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(lean, ty + 1.5, 6.5, 3.6, 0, 0, TAU); ctx.fill();
  rrect(ctx, -6, -7, 12, 6.4, 1.6, '#fff', 1.6);
  ctx.strokeStyle = '#c9cbe0'; ctx.lineWidth = 0.8; ctx.beginPath();
  ctx.moveTo(-2.5, -6); ctx.lineTo(-2.5, -1.6); ctx.moveTo(1, -6); ctx.lineTo(1, -1.6); ctx.moveTo(4, -6); ctx.lineTo(4, -1.6); ctx.stroke();
  ctx.fillStyle = 'rgba(160,170,210,0.35)'; ctx.beginPath(); ctx.ellipse(3 + lean, ty + 1, 3, 2, 0, 0, TAU); ctx.fill();
}

function party(ctx, st, wob, H) {
  const tx = wob * 1.3, ty = -H - 4;
  const cone = () => {
    ctx.beginPath(); ctx.moveTo(-6, -1); ctx.quadraticCurveTo(-3 + tx * 0.4, ty * 0.5, tx, ty);
    ctx.quadraticCurveTo(3 + tx * 0.4, ty * 0.5, 6, -1); ctx.quadraticCurveTo(0, 1.4, -6, -1); ctx.closePath();
  };
  cone(); ctx.fillStyle = '#ff6fa5'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2.2; ctx.beginPath();
  for (let k = -3; k < 3; k++) { ctx.moveTo(-9, k * 5.5 - 1); ctx.lineTo(9, k * 5.5 - 7); }
  ctx.stroke();
  ctx.fillStyle = '#4fd1c5'; ctx.beginPath(); ctx.arc(-1.5, -5.2, 1.1, 0, TAU); ctx.arc(1.8 + tx * 0.3, -10.6, 1, 0, TAU); ctx.fill();
  ctx.restore();
  cone(); ink(ctx);
  blob(ctx, tx, ty - 1, 2.6, 2.6, '#4fd1c5', 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(tx - 1.4, ty - 2.4, 1.1, 1.1);
}

function pilot(ctx, st, wob, H) {
  // ear flaps
  rrect(ctx, -8.6, -4, 3.8, 7.4, 1.8, '#8a5a34', 1.5);
  rrect(ctx, 4.8, -4, 3.8, 7.4, 1.8, '#8a5a34', 1.5);
  // leather dome
  ctx.beginPath(); ctx.moveTo(-8, -0.6); ctx.quadraticCurveTo(-8.6, -10.5, 0, -10.5); ctx.quadraticCurveTo(8.6, -10.5, 8, -0.6); ctx.closePath();
  ctx.fillStyle = '#a8703f'; ctx.fill(); ink(ctx);
  ctx.strokeStyle = '#7b4c28'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -6.5); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-3.6, -8, 2.6, 1.2, -0.5, 0, TAU); ctx.fill();
  // goggles
  ctx.fillStyle = INK; ctx.fillRect(-8, -5.6, 16, 2.4);
  blob(ctx, 1.2, -4.4, 3, 2.8, PAL.brass, 1.4); blob(ctx, 6.4, -4.4, 2.6, 2.8, PAL.brass, 1.4);
  blob(ctx, 1.2, -4.4, 1.9, 1.7, '#9fe8ff', 0); blob(ctx, 6.4, -4.4, 1.5, 1.7, '#9fe8ff', 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0.2, -5.6, 1, 1); ctx.fillRect(5.6, -5.6, 0.9, 1);
}

function wizard(ctx, st, wob, H) {
  const tx = wob * 1.6 - 3, ty = -H - 6;
  ctx.beginPath(); ctx.moveTo(-6, -1.5);
  ctx.quadraticCurveTo(-3, -H * 0.7, 0.5, -H - 1);
  ctx.quadraticCurveTo(1, ty - 1, tx, ty + 1.6);
  ctx.quadraticCurveTo(3.4, ty - 0.4, 3.6, -H * 0.75);
  ctx.quadraticCurveTo(4.4, -5, 6, -1.5); ctx.closePath();
  ctx.fillStyle = '#3d4fc4'; ctx.fill(); ink(ctx);
  star(ctx, -0.6, -6.2, 2.2, '#ffe27a'); star(ctx, 2.6, -10.8, 1.5, '#ffe27a');
  ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(-2.6, -9.8, 0.8, 0, TAU); ctx.arc(3.2, -4.6, 0.7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -1.5, 10, 2.8, 0, 0, TAU); ctx.fillStyle = '#2c3794'; ctx.fill(); ink(ctx);
  ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(0, -2.6, 5.9, 1.3, 0, 0.15, Math.PI - 0.15); ctx.stroke();
}

function flowerpot(ctx, st, wob, H) {
  const fx = wob * 1.4, fy = -H - 6.5;
  // stem + leaves
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(fx * 0.3, -H - 1, fx, fy + 2);
  outline(ctx, 2.8); ctx.stroke(); ctx.strokeStyle = '#5cc45a'; ctx.lineWidth = 1.3; ctx.stroke();
  blob(ctx, -2.2 + fx * 0.3, -12.6, 2.3, 1.2, '#5cc45a', 1.1, 0.5);
  // daisy
  ctx.fillStyle = '#fff'; outline(ctx, 1.1);
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * 2.7, fy + Math.sin(a) * 2.7, 1.9, 1.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, fy, 2.6, 0, TAU); ctx.fill();
  blob(ctx, fx, fy, 1.8, 1.8, '#ffd23f', 1);
  // pot
  ctx.beginPath(); ctx.moveTo(-5, -0.6); ctx.lineTo(-6.6, -8); ctx.lineTo(6.6, -8); ctx.lineTo(5, -0.6); ctx.closePath();
  ctx.fillStyle = '#d9773f'; ctx.fill(); ink(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-4.6, -7, 1.8, 5.6);
  ctx.fillStyle = '#5a3a26'; ctx.beginPath(); ctx.ellipse(0, -9.6, 5.6, 1.2, 0, 0, TAU); ctx.fill();
  rrect(ctx, -7.6, -10.4, 15.2, 3.2, 1.4, '#ee9257', 1.6);
}

function nightcap(ctx, st, wob, H) {
  const px = -11.5 + wob * 0.8, py = -3.5 - Math.abs(wob) * 0.4;
  // floppy tail
  ctx.beginPath(); ctx.moveTo(1, -H + 0.5);
  ctx.quadraticCurveTo(-9, -H - 3, px, py);
  ctx.quadraticCurveTo(-8, -H + 3, -4, -5); ctx.closePath();
  ctx.fillStyle = '#7fa6ff'; ctx.fill(); ink(ctx);
  // dome
  ctx.beginPath(); ctx.moveTo(-6.4, -2); ctx.quadraticCurveTo(-6.8, -H, 0.5, -H); ctx.quadraticCurveTo(7, -H + 0.5, 6.4, -2); ctx.closePath();
  ctx.fillStyle = '#7fa6ff'; ctx.fill(); ink(ctx);
  ctx.fillStyle = '#7fa6ff'; ctx.beginPath(); ctx.ellipse(-2.6, -H + 3.4, 2.6, 2.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.arc(2.6, -7.6, 1.9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7fa6ff'; ctx.beginPath(); ctx.arc(3.5, -8.2, 1.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-3.4, -8.4, 1, 1); ctx.fillRect(-1, -5.6, 0.9, 0.9); ctx.fillRect(4.2, -4.8, 0.9, 0.9);
  // fluffy band + pom-pom
  rrect(ctx, -7.4, -3.6, 14.8, 4, 2, '#fff', 1.6);
  blob(ctx, px, py + 1, 2.7, 2.7, '#fff', 1.5);
}

function kite(ctx, st, wob, H) {
  const cx = wob * 1.2, cy = -H - 0.5;
  // tail with bows (trails behind)
  ctx.beginPath(); ctx.moveTo(cx * 0.4, -5.5); ctx.quadraticCurveTo(-7, -7 + wob, -9.5, -2.5); ctx.quadraticCurveTo(-11, 0, -13, -1.6 - wob * 0.5);
  outline(ctx, 1.1); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-7.6, -6.6 + wob * 0.6); ctx.lineTo(-5.4, -4.2 + wob * 0.6); ctx.lineTo(-8.6, -3.6 + wob * 0.6); ctx.closePath(); ctx.fill(); ink(ctx, 0.9);
  ctx.fillStyle = '#4fd1c5'; ctx.beginPath(); ctx.moveTo(-11.6, -2.6); ctx.lineTo(-9.4, -0.4); ctx.lineTo(-12.2, 0.6); ctx.closePath(); ctx.fill(); ink(ctx, 0.9);
  // little red cap
  ctx.beginPath(); ctx.moveTo(-6.4, -0.8); ctx.quadraticCurveTo(-6.4, -6.2, 0, -6.2); ctx.quadraticCurveTo(6.4, -6.2, 6.4, -0.8); ctx.closePath();
  ctx.fillStyle = '#ff5d6c'; ctx.fill(); ink(ctx);
  // the kite, quartered
  const top = cy - 8.5, bot = -4.4, lx = cx * 0.7 - 6.4, rx = cx * 0.7 + 6.4, my = cy - 1.5, mx = cx * 0.7;
  const quad = (ax, ay, bx, by, fill) => { ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(ax, ay); ctx.lineTo(bx, by); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  quad(cx, top, rx, my, '#ffd23f'); quad(rx, my, cx * 0.4, bot, '#ff8fc7'); quad(cx * 0.4, bot, lx, my, '#4fd1c5'); quad(lx, my, cx, top, '#9b6dff');
  ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(rx, my); ctx.lineTo(cx * 0.4, bot); ctx.lineTo(lx, my); ctx.closePath(); ink(ctx);
  ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx * 0.4, bot); ctx.moveTo(lx, my); ctx.lineTo(rx, my); ctx.stroke();
}

function neon(ctx, st, wob, H) {
  // glowing bill
  ctx.beginPath(); ctx.moveTo(1, -3.4); ctx.quadraticCurveTo(9, -4.4, 12.6, -0.6); ctx.quadraticCurveTo(7, 1.2, 1, 0.4); ctx.closePath();
  ctx.strokeStyle = 'rgba(120,255,190,0.4)'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#6dffb5'; ctx.fill(); ink(ctx, 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(6.6, -2.3, 3, 0.7, 0.12, 0, TAU); ctx.fill();
  // band
  rrect(ctx, -7, -5.4, 14, 4.6, 2.2, '#2b2350', 1.6);
  ctx.fillStyle = '#ff5de0'; ctx.fillRect(-5.6, -3.7, 11.2, 1.3);
  ctx.fillStyle = '#5ae8ff'; ctx.fillRect(-5.6, -3.7, 3, 1.3);
  // bobbing antenna light
  ctx.beginPath(); ctx.moveTo(-4, -5.2); ctx.quadraticCurveTo(-5 + wob, -9, -4 + wob * 1.6, -11.6); outline(ctx, 1.2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,93,224,0.35)'; ctx.beginPath(); ctx.arc(-4 + wob * 1.6, -12.4, 3.6, 0, TAU); ctx.fill();
  blob(ctx, -4 + wob * 1.6, -12.4, 1.9, 1.9, '#ff5de0', 1.2);
}

const CROWN_BUTTONS = ['#ff6f91', '#4fd1c5', '#9b6dff'];
function crown(ctx, st, wob, H) {
  const lean = wob * 0.35;
  ctx.beginPath(); ctx.moveTo(-6.6, -0.8); ctx.lineTo(-7.6 + lean, -10.4); ctx.lineTo(-3.6 + lean * 0.6, -6.2); ctx.lineTo(lean, -12);
  ctx.lineTo(3.6 + lean * 0.6, -6.2); ctx.lineTo(7.6 + lean, -10.4); ctx.lineTo(6.6, -0.8); ctx.closePath();
  ctx.fillStyle = '#ffd23f'; ctx.fill(); ink(ctx);
  ctx.fillStyle = '#e3a51c'; ctx.fillRect(-6, -3.6, 12, 2.2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-5.2, -6.4, 1.4, 2.4);
  for (let k = 0; k < 3; k++) {
    const bx = (k - 1) * 7.6 + lean * (k === 1 ? 1 : 1), by = k === 1 ? -12.6 : -11;
    blob(ctx, bx, by, 2.5, 2.5, CROWN_BUTTONS[k], 1.3);
    ctx.fillStyle = INK; ctx.fillRect(bx - 1.1, by - 0.5, 0.9, 0.9); ctx.fillRect(bx + 0.3, by - 0.5, 0.9, 0.9);
  }
  blob(ctx, 0, -2.5, 1.5, 1.5, '#ff6f91', 0.9);
}

function teacosy(ctx, st, wob, H) {
  const lean = wob * 0.5;
  const dome = () => { ctx.beginPath(); ctx.moveTo(-7.4, -0.6); ctx.quadraticCurveTo(-8.4 + lean, -H - 1, lean, -H - 1); ctx.quadraticCurveTo(8.4 + lean, -H - 1, 7.4, -0.6); ctx.closePath(); };
  dome(); ctx.fillStyle = '#ff9a4d'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = '#fff1d6'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  for (let row = 0; row < 2; row++) {
    const y = -4.5 - row * 5;
    ctx.beginPath(); ctx.moveTo(-9, y);
    for (let x = -9; x <= 9; x += 3) ctx.lineTo(x + 1.5, y + ((x / 3) & 1 ? 1.6 : -1.6));
    ctx.stroke();
  }
  ctx.fillStyle = '#4fd1c5'; ctx.fillRect(-9, -3, 18, 1.6);
  ctx.restore();
  dome(); ink(ctx);
  rrect(ctx, -8, -2.4, 16, 3, 1.5, '#e0703a', 1.5);
  blob(ctx, lean * 1.6, -H - 3, 3, 3, '#fff1d6', 1.5);
  ctx.strokeStyle = '#e0c9a0'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(lean * 1.6 - 1.4, -H - 3.6); ctx.lineTo(lean * 1.6 + 1.2, -H - 2.2); ctx.stroke();
}

function goldGlints(ctx, st, wob, H) {
  glint(ctx, -3.4 + wob * 0.4, -H * 0.55, 2.2);
  glint(ctx, 5.4, -3.2, 1.5);
  glint(ctx, 3.6 + wob, -H - 1, 1.8);
}

// price 0 = already owned; reward = cannot be bought (see unlockedBy).
export const HATS = [
  { id: 'patchwork', name: 'Patchwork Topper', price: 0, blurb: 'Tall, wobbly, stitched with love.' },
  { id: 'berry', name: 'Berry Topper', price: 10, blurb: 'Same wobble, jammier colors.', style: { crown: '#e0457b', brim: '#a82457', patch: '#7bd857', band: '#fff1d6' } },
  { id: 'party', name: 'Party Cone', price: 15, blurb: 'Every day is a birthday somewhere.', style: { draw: party } },
  { id: 'chef', name: 'Puffy Toque', price: 20, blurb: 'Smells faintly of pancakes.', style: { draw: chef } },
  { id: 'teacosy', name: 'Tea Cosy', price: 25, blurb: 'Keeps a clever head warm.', style: { draw: teacosy } },
  { id: 'flowerpot', name: 'Flowerpot', price: 30, blurb: 'Water it twice a week.', style: { draw: flowerpot } },
  { id: 'pilot', name: 'Sky Cap', price: 35, blurb: 'Goggles for extra-windy days.', style: { draw: pilot } },
  { id: 'nightcap', name: 'Sleepy Nightcap', price: 40, blurb: 'Yawn... is it nap time yet?', style: { draw: nightcap } },
  { id: 'wizard', name: 'Starry Cone', price: 45, blurb: 'Full of tricks. Mostly hat tricks.', style: { draw: wizard } },
  { id: 'kite', name: 'Kite Hat', price: 55, blurb: 'Hold on tight when it gusts!', style: { draw: kite } },
  { id: 'neon', name: 'Neon Visor', price: 60, blurb: 'Glows after bedtime.', style: { draw: neon } },
  { id: 'crown', name: 'Crown of Buttons', price: 80, blurb: 'Fit for a very silly king.', style: { draw: crown } },
  { id: 'golden', name: 'Golden Topper', price: 0, reward: true, unlockWorld: 9, blurb: 'The shiniest hat in any sky.',
    lockText: 'Finish the Moon of Mess', style: { crown: '#ffd23f', brim: '#d6951a', patch: '#fff7c2', band: '#ff6f91', extra: goldGlints } },
];

for (const h of HATS) if (h.style) registerHatStyle(h.id, h.style);

export function hatById(id) { for (const h of HATS) if (h.id === id) return h; return null; }
// Can the player get this reward hat yet?
export function rewardReady(save, h) { return !!h.reward && save.isCleared(h.unlockWorld); }
