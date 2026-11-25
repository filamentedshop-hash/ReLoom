// Audio: SMALL STABLE API, placeholder implementation (tiny synth blips, no
// music). The audio agent replaces this file but must keep these exports:
//
//   audio.unlock()                 call from the first user gesture (main.js does)
//   audio.sfx(name, opts?)         play a one-shot; unknown names must be ignored
//   audio.music(trackId)           start/crossfade looping music; same id = no-op
//   audio.stopMusic()
//   audio.setVolume(v)             master 0..1
//   audio.setSfxEnabled(bool) / audio.setMusicEnabled(bool)
//   audio.suspend() / audio.resume()   app hidden / visible
//
// sfx names the engine fires: jump land throw catch capture release hattrick
//   button spark heart hurt stomp pop checkpoint bounce break switch door
//   splash swim clink hint toast bosshit bossdown clear ui uiBack pause
// music ids the engine asks for: title map w1..w9 boss finalboss clear
//   (a world can name its own via world.music / world.bossMusic)

const BLIPS = {
  jump: [420, 640, 0.09, 'square'], land: [160, 110, 0.05, 'triangle'], throw: [520, 300, 0.08, 'triangle'],
  catch: [300, 520, 0.06, 'triangle'], capture: [330, 880, 0.18, 'square'], release: [700, 330, 0.12, 'square'],
  hattrick: [520, 1040, 0.16, 'square'], button: [1250, 1650, 0.05, 'square'], spark: [660, 1320, 0.3, 'triangle'],
  heart: [520, 780, 0.2, 'triangle'], hurt: [300, 110, 0.2, 'sawtooth'], stomp: [240, 480, 0.08, 'square'],
  pop: [500, 200, 0.1, 'triangle'], checkpoint: [520, 780, 0.25, 'triangle'], bounce: [260, 720, 0.12, 'sine'],
  break: [180, 80, 0.12, 'sawtooth'], switch: [600, 900, 0.06, 'square'], door: [200, 140, 0.2, 'triangle'],
  splash: [500, 250, 0.12, 'sine'], swim: [300, 420, 0.07, 'sine'], clink: [1500, 1300, 0.04, 'square'],
  hint: [700, 880, 0.08, 'sine'], toast: [600, 760, 0.08, 'sine'], bosshit: [200, 620, 0.25, 'square'],
  bossdown: [700, 90, 0.7, 'sawtooth'], clear: [520, 1560, 0.6, 'triangle'], ui: [800, 1000, 0.04, 'square'],
  uiBack: [700, 500, 0.05, 'square'], pause: [500, 500, 0.05, 'square'],
};

export const audio = {
  ctx: null, unlocked: false,
  volume: 0.8, sfxOn: true, musicOn: true, track: null,
  _last: {},

  unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = this.ctx || new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = true;
    } catch (e) { /* no audio available: stay silent */ }
  },
  sfx(name) {
    if (!this.unlocked || !this.sfxOn || !this.ctx || this.volume <= 0) return;
    const b = BLIPS[name];
    if (!b) return;
    try {
      const now = this.ctx.currentTime;
      if (this._last[name] && now - this._last[name] < 0.03) return;
      this._last[name] = now;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = b[3];
      o.frequency.setValueAtTime(b[0], now);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, b[1]), now + b[2]);
      g.gain.setValueAtTime(0.11 * this.volume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + b[2] + 0.03);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(now); o.stop(now + b[2] + 0.05);
    } catch (e) { /* ignore */ }
  },
  music(trackId) { this.track = trackId; },
  stopMusic() { this.track = null; },
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); },
  setSfxEnabled(on) { this.sfxOn = !!on; },
  setMusicEnabled(on) { this.musicOn = !!on; },
  suspend() { try { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); } catch (e) { /* ignore */ } },
  resume() { try { if (this.ctx && this.unlocked && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* ignore */ } },
};
