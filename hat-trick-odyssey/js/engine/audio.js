// Audio: WebAudio synth sound system. No audio files: every sound effect is
// built from oscillators and filtered noise, and all music is original note
// data (below) played by a lookahead scheduler.
//
// PUBLIC API (stable; see CONTRACT.md section 11)
//   audio.unlock()                 call from the first user gesture (main.js does)
//   audio.sfx(name, opts?)         one-shot. opts: {pitch: semitones, vol: 0..2}.
//                                  Unknown names play a soft default blip (never throw).
//   audio.music(trackId, opts?)    start/crossfade looping music; same id = no-op.
//                                  opts: {restart: true, fade: seconds}
//   audio.stopMusic(fade?)
//   audio.setVolume(v)             master 0..1
//   audio.setSfxEnabled(bool) / audio.setMusicEnabled(bool)
//   audio.suspend() / audio.resume()   app hidden / visible
//
// ADDITIONS (optional, safe to ignore)
//   audio.setMusicVolume(v) / audio.setSfxVolume(v)   0..1, persisted in the save
//       settings as `musicVol` / `sfxVol` (getters: audio.musicVolume, audio.sfxVolume)
//   audio.setMusicIntensity(v)     0..1 layer amount for layered tracks (w8: gray and
//       sparse at 0, full band and a major key at 1). Until someone calls it, w8
//       brightens by itself over about three minutes. audio.musicIntensity reads it.
//   audio.duck(seconds)            dip the music briefly under an important sound
//   audio.tracks / audio.sfxNames  lists of what exists
//
// sfx names: jump land throw catch capture release hattrick button spark heart
//   hurt stomp pop checkpoint bounce break switch door splash swim clink hint
//   toast bosshit bossdown clear ui uiBack pause            (fired by the engine)
//   uiMove select deny buy unlock equip flap float fizz bubble dash roll zap
//   flip wind snore dig stick grow shrink freeze fire honk bell shoot charge
//   boom laugh confetti warp whistle squeak thud roar tick whoosh spin drip
//   sizzle buzz crumble magnet windup glide stretch sneeze yawn
//   Names may carry a world prefix (`w4_snore`); names that are not listed are
//   matched by keyword (`w6_dough_stretch` -> stretch) and otherwise get a blip.
// music ids: title map w1..w9 boss finalboss clear ending. Unknown ids fall back
//   by keyword (`w5_storm` -> w5, anything with "boss" -> boss, else map).
import { save } from './save.js';

const LOOKAHEAD = 0.22;      // seconds of music scheduled ahead of the clock
const TICK_MS = 30;          // scheduler wake-up interval
const MUSIC_LEVEL = 0.42;    // music bus trim (tracks are mixed to similar loudness)
const SFX_LEVEL = 0.9;
const MAX_LIVE = 96;         // hard cap on sounding voices (sfx are dropped beyond it)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------
// MUSIC DATA
// A track is a set of channels plus sections. Melodies are written per bar as
// space-separated tokens: a scale degree (0 = tonic, 7 = an octave up, may be
// negative, `#`/`b` suffix = chromatic), `_` = hold the previous note, `.` =
// rest. The number of tokens in a bar sets the step length (8 = eighths).
// `chords` gives one diatonic chord root (scale degree) per bar (`3,4` = two
// in a bar; suffix M/m forces a major/minor third, 7 adds the seventh). Bass
// and arpeggio channels are patterns relative to the current chord
// (bass: r root, t third, f fifth, o octave; arp: chord-tone index, 3+ = next
// octave). Drum lanes are one character per step: k kick, s snare, h hat,
// o open hat, r rim, t tom, c clap (x = hit, X = accent).
// ---------------------------------------------------------------------------
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
  harmMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygDom: [0, 1, 4, 5, 7, 8, 10],
  lydDom: [0, 2, 4, 6, 7, 9, 10],
};

const VIB = { hz: 5.6, amt: 0.006, delay: 0.14, min: 0.28 };
const lead = (o) => Object.assign({ kind: 'mel', wave: 'pulse', vol: 0.16, oct: 0, env: [0.006, 0.09, 0.62, 0.06], gate: 0.9, vib: VIB, echo: 0.28, echoDelay: 0.75 }, o);
const bass = (o) => Object.assign({ kind: 'bass', wave: 'triangle', vol: 0.34, lo: 43, env: [0.004, 0.12, 0.7, 0.04], gate: 0.8 }, o);
const arp = (o) => Object.assign({ kind: 'arp', wave: 'square', vol: 0.05, oct: 1, env: [0.003, 0.06, 0.3, 0.03], gate: 0.6 }, o);
const pad = (o) => Object.assign({ kind: 'pad', wave: 'triangle', vol: 0.075, oct: 0, env: [0.14, 0.2, 0.85, 0.3] }, o);
const drums = (pat, o) => Object.assign({ kind: 'drum', vol: 0.5, pat }, o);

const TITLE_A = [
  '0 . 2 4 7 _ 4 .', '5 4 2 4 2 _ _ .', '3 . 5 7 9 _ 7 .', '8 7 6 4 6 _ _ .',
  '0 . 2 4 7 _ 9 .', '9 7 5 7 9 _ 7 5', '7 _ 5 3 5 _ 3 .', '4 6 8 6 7 _ _ .',
];

const TRACKS = {
  // Title: a bouncy little parade for a cat in a patchwork hat. D major.
  title: {
    bpm: 124, root: 62, scale: 'major', swing: 0.12, form: 'A A B A',
    ch: {
      lead: lead({}),
      bass: bass({ pat: 'r . o . f . o .' }),
      arp: arp({ pat: '0 2 1 2 0 2 1 2' }),
      drums: drums({ k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }),
    },
    sections: {
      A: { chords: '0 0 3 4 0 5 3 4,0', lead: TITLE_A },
      B: {
        chords: '3 3 0 0 1 4 0 4',
        lead: ['5 _ 7 5 3 _ 5 .', '7 _ 9 7 5 _ _ .', '4 _ 7 4 2 _ 4 .', '7 9 7 4 2 _ _ .',
          '1 3 5 3 8 _ 5 .', '4 6 8 6 11 _ 8 .', '9 _ 7 _ 4 2 4 7', '8 _ 6 _ 4 _ . .'],
        arp: '0 1 2 3 2 1 2 3',
      },
    },
  },

  // Map: drifting in the Teapot Zeppelin. F lydian, floaty and unhurried.
  map: {
    bpm: 96, root: 65, scale: 'lydian', gain: 0.8, form: 'A A B A', delay: { beats: 0.75, fb: 0.32 },
    ch: {
      lead: lead({ wave: 'triangle', vol: 0.3, env: [0.02, 0.15, 0.75, 0.12], echo: 0, send: 0.5 }),
      pad: pad({}),
      bass: bass({ pat: 'r _ _ _ f _ _ _', gate: 0.95 }),
      arp: arp({ wave: 'triangle', vol: 0.11, pat: '0 1 2 3 2 1 0 1 2 3 4 3 2 1 2 1', send: 0.4 }),
      drums: drums({ k: 'x.......x.......', r: '....x.......x...', h: '..x...x...x...x.' }, { vol: 0.32 }),
    },
    sections: {
      A: { chords: '0 1 0 1', lead: ['4 _ _ 2 4 _ 7 _', '8 _ 5 _ 3 _ _ .', '4 _ _ 2 4 _ 9 _', '8 _ 10 _ 8 _ _ .'] },
      B: { chords: '5 2 1 4', lead: ['9 _ 7 _ 5 _ 7 _', '6 _ 4 _ 2 _ 4 _', '5 _ 3 _ 1 _ 3 5', '4 _ _ _ 6 _ 8 .'] },
    },
  },

  // World 1, Lollipop Meadow: a skipping, sunny tune. C major with a light swing.
  w1: {
    bpm: 132, root: 60, scale: 'major', swing: 0.16, form: 'A A B A',
    ch: {
      lead: lead({}),
      bass: bass({ pat: 'r . f . r . f .' }),
      arp: arp({ pat: '. 0 . 2 . 1 . 2', vol: 0.06, gate: 0.5 }),
      drums: drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }),
    },
    sections: {
      A: {
        chords: '0 5 3 4 0 5 3,4 0',
        lead: ['4 . 4 5 4 2 0 .', '2 . 2 4 2 0 -2 .', '3 . 5 7 5 _ 3 .', '4 6 8 6 4 _ . .',
          '4 . 4 5 4 2 0 .', '2 . 2 4 7 _ 5 .', '5 3 5 7 6 4 6 8', '7 _ . 4 7 _ . .'],
      },
      B: {
        chords: '3 0 3 4 3 0 1 4',
        lead: ['7 _ 5 7 9 _ 7 .', '9 7 4 7 4 _ . .', '7 _ 5 7 10 _ 9 .', '8 _ 6 _ 4 _ . 4',
          '5 5 7 5 3 5 7 .', '4 4 7 4 2 4 7 .', '3 5 8 5 3 5 8 10', '11 _ 8 _ 6 4 . .'],
        drums: { k: 'x.....x.x.......', s: '....x.......x.x.', h: 'x.x.x.x.x.x.x.x.' },
      },
    },
  },

  // World 2, Fizzlewump Falls: bubbly staccato pops and tumbling runs. A major.
  w2: {
    bpm: 146, root: 57, scale: 'major', form: 'A A B A', delay: { beats: 0.5, fb: 0.25 },
    ch: {
      lead: lead({ wave: 'square', vol: 0.13, gate: 0.55, echo: 0, send: 0.35, oct: 1, env: [0.003, 0.06, 0.5, 0.05] }),
      bass: bass({ pat: 'r . r o . r f .' }),
      arp: arp({ wave: 'triangle', vol: 0.13, oct: 1, pat: '0 1 2 3 2 1 0 1 2 3 4 3 2 1 0 1', gate: 0.45, send: 0.3 }),
      drums: drums({ k: 'x.....x...x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' }, { vol: 0.42 }),
    },
    sections: {
      A: {
        chords: '0 3 0 4 0 3 1 4',
        lead: ['0 2 4 . 7 . 4 .', '3 5 7 . 10 . 7 .', '9 7 4 . 7 4 2 .', '1 4 6 . 8 _ . .',
          '0 2 4 . 7 . 9 .', '10 7 5 . 7 5 3 .', '5 . 3 . 8 . 5 .', '6 . 4 . 8 9 10 11'],
      },
      B: {
        chords: '5 5 3 3 1 1 4 4',
        lead: ['12 _ 11 9 7 _ 9 7 5 _ 7 5 2 _ . .', '5 _ 7 9 12 _ 9 7 9 _ _ _ . . . .',
          '10 _ 9 7 5 _ 7 5 3 _ 5 3 0 _ . .', '3 _ 5 7 10 _ 7 5 7 _ _ _ . . . .',
          '8 _ 7 5 3 _ 5 3 1 _ 3 5 8 _ . .', '8 _ 10 8 5 _ 8 5 3 _ _ _ . . . .',
          '4 _ 6 8 11 _ 8 6 4 _ 6 8 11 _ . .', '11 _ 13 11 8 _ 6 4 6 _ 8 _ 11 _ . .'],
        arp: '0 . 2 . 1 . 2 . 0 . 2 . 3 . 2 .',
      },
    },
  },

  // World 3, Topsy-Town: a quirky syncopated tune; the B section is the A
  // melody turned upside down. E dorian.
  w3: {
    bpm: 126, root: 64, scale: 'dorian', swing: 0.1, form: 'A B A B',
    ch: {
      lead: lead({ wave: 'pulse12', vol: 0.17 }),
      bass: bass({ pat: 'r . . r . . f .' }),
      arp: arp({ pat: '. 0 . 1 . 2 . 1', vol: 0.055, gate: 0.4 }),
      drums: drums({ k: 'x..x..x...x.x...', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.' }),
    },
    sections: {
      A: {
        chords: '0 3 0 4 0 3 6 0',
        lead: ['0 . 4 . 2 4 . 7', '_ . 5 . 3 5 . 7', '_ 4 2 0 2 . 4 .', '6 . 4 . 1 . . .',
          '0 . 4 . 2 4 . 9', '_ . 7 . 5 7 . 10', '_ 8 6 8 10 . 8 .', '7 . 4 . 7 . . .'],
      },
      B: {
        chords: '4 1 4 0 4 1 5 4', mirror: { of: 'A', axis: 4 },
        arp: '2 . 1 . 0 . 1 .',
        drums: { k: 'x.....x..x..x...', s: '....x..x....x...', h: 'x.x.x.x.x.x.x.x.', r: '..x.......x.....' },
      },
    },
  },

  // World 4, Snoozle Sands: a slow, drowsy desert lullaby in three. D phrygian dominant.
  w4: {
    bpm: 80, beats: 3, root: 62, scale: 'phrygDom', gain: 0.78, form: 'A B', delay: { beats: 1, fb: 0.38 },
    ch: {
      lead: lead({ wave: 'triangle', vol: 0.32, env: [0.03, 0.2, 0.8, 0.2], echo: 0, send: 0.55, gate: 0.97 }),
      pad: pad({ vol: 0.06 }),
      bass: bass({ pat: 'r _ _ _ _ _', gate: 0.95, vol: 0.3 }),
      arp: arp({ wave: 'sine', vol: 0.14, pat: '. . 0 . 1 2', oct: 1, gate: 0.9, env: [0.01, 0.2, 0.4, 0.2], send: 0.4 }),
      drums: drums({ k: 'x.....', h: '..x.x.' }, { vol: 0.2 }),
    },
    sections: {
      A: {
        chords: '0 1 0 1 3 0 1 0',
        lead: ['4 _ _ 2 4 _', '5 _ _ 3 1 _', '2 _ 4 _ 7 _', '8 _ 5 _ _ .',
          '7 _ _ 5 7 _', '9 _ 7 _ 4 _', '5 _ 3 _ 1 _', '0 _ _ _ _ .'],
      },
      B: {
        chords: '3 3 0 0 6 1 0 0',
        lead: ['3 _ 5 _ 7 _', '10 _ _ 8 7 _', '9 _ 7 _ 4 _', '7 _ _ _ _ .',
          '6 _ 8 _ 10 _', '8 _ _ 5 3 _', '2 _ 1 _ 0 _', '0 _ _ _ _ .'],
      },
    },
  },

  // World 5, Kite-Kite Peaks: soaring leaps over a driving pulse. B-flat major.
  w5: {
    bpm: 152, root: 58, scale: 'major', form: 'A A B A', delay: { beats: 0.75, fb: 0.28 },
    ch: {
      lead: lead({ vol: 0.16, echo: 0, send: 0.4 }),
      pad: pad({ vol: 0.05 }),
      bass: bass({ pat: 'r r o r r r o r', gate: 0.6 }),
      arp: arp({ pat: '0 2 1 2 3 2 1 2', vol: 0.045 }),
      drums: drums({ k: 'x.......x.x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' }, { vol: 0.45 }),
    },
    sections: {
      A: {
        chords: '0 4 5 3 0 4 3 4',
        lead: ['0 _ 4 _ 7 _ _ 9', '8 _ 6 _ 4 _ _ .', '5 _ 9 _ 12 _ _ 11', '10 _ 7 _ 5 _ _ .',
          '0 _ 4 _ 7 _ _ 9', '11 _ 8 _ 6 _ 8 _', '10 _ _ 9 7 _ 5 _', '6 _ 8 _ 11 _ . .'],
      },
      B: {
        chords: '3 4 2 5 3 4 0 0',
        lead: ['3 5 7 10 7 5 7 10 12 _ _ _ 10 _ . .', '4 6 8 11 8 6 8 11 13 _ _ _ 11 _ . .',
          '9 _ _ _ 6 _ 4 _ 6 _ _ _ . . . .', '7 _ _ _ 5 _ 9 _ 7 _ _ _ . . . .',
          '3 5 7 10 7 5 7 10 12 _ _ _ 10 _ . .', '4 6 8 11 8 6 8 11 13 _ _ _ 11 _ . .',
          '14 _ _ _ 11 _ 9 _ 7 _ _ _ 9 _ 11 _', '7 _ _ _ _ _ _ _ . . . . . . . .'],
        drums: { k: 'x.....x.x.....x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
      },
    },
  },

  // World 6, Bakeberry Bay: a jolly kitchen shuffle with a walking bass. G major.
  w6: {
    bpm: 112, root: 55, scale: 'major', swing: 0.3, form: 'A A B A',
    ch: {
      lead: lead({ wave: 'square', vol: 0.12, oct: 1, gate: 0.8 }),
      bass: bass({ pat: ['r . t . f . o .', 'o . f . t . r .'], gate: 0.85, lo: 43 }),
      arp: arp({ pat: '. . 0 . . . 0 .', vol: 0.055, gate: 0.35, chord: true }),
      drums: drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', r: '......x.......x.' }),
    },
    sections: {
      A: {
        chords: '0 0 3 3 0 4 0 4',
        lead: ['0 2 4 5 4 . 2 .', '4 5 4 2 0 . . .', '3 5 7 8 7 . 5 .', '7 8 7 5 3 . . .',
          '4 . 7 . 9 7 4 .', '8 . 6 . 4 3# 4 .', '7 . 4 2 0 . 2 4', '1 . . 1 4 . . .'],
      },
      B: {
        chords: '5 2 3 0 5 2 1,4 0',
        lead: ['9 . 7 . 5 7 9 .', '6 . 4 . 2 4 6 .', '7 . 5 . 3 5 7 .', '4 2 0 2 4 . . .',
          '9 . 7 . 5 7 12 .', '11 . 9 . 6 9 11 .', '8 . 5 3 6 . 8 .', '7 . . 7 . . . .'],
      },
    },
  },

  // World 7, Neon Nobble City: night-time synth strut. F-sharp minor.
  w7: {
    bpm: 122, root: 54, scale: 'minor', form: 'A A B A', delay: { beats: 0.75, fb: 0.35 },
    ch: {
      lead: lead({ wave: 'pulse12', vol: 0.15, oct: 1, echo: 0, send: 0.5 }),
      pad: pad({ wave: 'sawtooth', vol: 0.028, lp: 1400 }),
      bass: bass({ wave: 'sawtooth', vol: 0.15, lp: 900, pat: 'r o r o r o r o', gate: 0.55 }),
      arp: arp({ pat: '0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 1', vol: 0.04, gate: 0.5, send: 0.3 }),
      drums: drums({ k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.', o: '..............x.' }, { vol: 0.5 }),
    },
    sections: {
      A: {
        chords: '0 0 5 6 0 0 3 4',
        lead: ['. 4 . 4 7 _ 4 2', '4 _ . 2 0 _ . .', '. 7 . 7 9 _ 7 5', '8 _ . 6 8 _ 10 _',
          '. 4 . 4 7 _ 4 2', '4 _ . 7 9 _ . .', '10 _ 7 5 7 _ 5 3', '4 _ . 6 4 _ . .'],
      },
      B: {
        chords: '5 6 0 0 5 6 4M 4M',
        lead: ['12 _ _ 9 7 _ 9 _', '13 _ _ 10 8 _ 10 _', '11 _ 9 _ 7 _ 4 _', '7 _ _ _ . . 4 7',
          '12 _ _ 9 7 _ 9 _', '13 _ _ 10 8 _ 10 13', '11 _ _ _ 8 _ 6# _', '4 _ 6# _ 8 _ 11 _'],
      },
    },
  },

  // World 8, Ho-Hum Kingdom: gray, slow and nearly empty. Layers join as the
  // music intensity rises (bass + pad -> melody -> harp -> drums -> sparkle) and near the
  // top the whole tune turns from C minor to C major (at the next loop).
  w8: {
    bpm: 84, root: 60, scale: 'minor', gain: 0.82, form: 'A B', delay: { beats: 1.5, fb: 0.4 },
    autoIntensity: 160, bright: { scale: 'major', at: 0.72 },
    ch: {
      bass: bass({ pat: 'r _ _ _ _ _ _ .', gate: 0.95, vol: 0.3, send: 0.2 }),
      pad: pad({ vol: 0.07 }),
      lead: lead({ wave: 'triangle', vol: 0.3, env: [0.03, 0.2, 0.8, 0.2], echo: 0, send: 0.6, min: 0.22 }),
      arp: arp({ wave: 'triangle', vol: 0.12, pat: '0 . 1 . 2 . 3 . 2 . 1 . 2 . 1 .', gate: 0.8, send: 0.4, min: 0.5 }),
      drums: drums({ k: 'x.........x.....', r: '....x.......x...', h: '..x...x...x...x.' }, { vol: 0.34, min: 0.68 }),
      glint: lead({ wave: 'pulse', vol: 0.07, oct: 1, echo: 0, send: 0.5, min: 0.86, from: 'lead', shift: 2 }),
    },
    sections: {
      A: {
        chords: '0 0 5 5 3 3 4 4',
        lead: ['4 _ _ _ 2 _ 0 _', '2 _ _ _ _ _ . .', '5 _ _ _ 4 _ 2 _', '0 _ _ _ _ _ . .',
          '3 _ _ _ 5 _ 7 _', '5 _ _ _ _ _ 3 _', '4 _ _ _ 6 _ 4 _', '1 _ _ _ _ _ . .'],
      },
      B: {
        chords: '5 3 0 0 5 3 4 4',
        lead: ['7 _ _ 5 7 _ 9 _', '7 _ _ 5 7 _ 10 _', '9 _ 7 _ 4 _ _ _', '_ _ _ _ . . . .',
          '7 _ _ 5 7 _ 9 _', '10 _ _ 7 5 _ 7 _', '8 _ _ _ 6 _ 4 _', '4 _ _ _ _ _ . .'],
      },
    },
  },

  // World 9, The Moon of Mess: a lopsided seven-beat romp. E lydian dominant.
  w9: {
    bpm: 208, beats: 7, root: 64, scale: 'lydDom', form: 'A A B A', delay: { beats: 1.5, fb: 0.3 },
    ch: {
      lead: lead({ wave: 'pulse12', vol: 0.16, echo: 0, send: 0.4, gate: 0.8 }),
      bass: bass({ pat: 'r . r . r f o', gate: 0.7 }),
      arp: arp({ pat: '0 2 1 2 0 1 2', vol: 0.05, gate: 0.4 }),
      drums: drums({ k: 'x...x...x.....', s: '......x.....x.', h: 'x.x.x.x.x.x.x.', t: '...........x.x' }, { vol: 0.46 }),
    },
    sections: {
      A: {
        chords: '0 1 0 1 4 4 1 0',
        lead: ['0 4 2 4 7 _ 4', '8 5 3 5 1 _ .', '0 4 2 4 7 _ 9', '10 8 5 8 5 _ .',
          '11 8 6 8 4 _ 6', '8 _ 6 _ 4 6 8', '10 _ 8 _ 5 3 1', '0 _ . 7 _ . .'],
      },
      B: {
        chords: '1 0 1 0 5 4 1 4',
        lead: ['5 . 5 8 . 10 .', '4 . 4 7 . 9 .', '5 . 5 8 . 12 .', '11 9 7 9 4 _ .',
          '9 . 7 5 . 7 9', '8 . 6 4 . 6 8', '10 12 10 8 5 3 1', '4 _ _ 6 8 11 13'],
        bass: 'r . . r . f .',
      },
    },
  },

  // Boss: mischievous and urgent, never scary. D harmonic minor.
  boss: {
    bpm: 164, root: 62, scale: 'harmMinor', form: 'A A B A',
    ch: {
      lead: lead({ vol: 0.15, gate: 0.8, echo: 0.2 }),
      bass: bass({ wave: 'square', vol: 0.13, lp: 1100, pat: 'r r o r r r o r', gate: 0.55 }),
      arp: arp({ pat: '0 1 2 1 0 1 2 1', vol: 0.045 }),
      drums: drums({ k: 'x.....x.x.....x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }, { vol: 0.5 }),
    },
    sections: {
      A: {
        chords: '0 0 5 4 0 0 3 4',
        lead: ['0 0 4 0 7 0 4 2', '0 0 4 0 7 _ 6 _', '5 5 9 5 12 5 9 7', '4 4 8 4 11 _ 8 _',
          '0 0 4 0 7 0 4 2', '4 _ 7 _ 9 _ 7 _', '10 _ 7 5 7 _ 5 3', '4 _ 6 _ 8 _ 11 _'],
      },
      B: {
        chords: '5 3 0 4 5 3 4 4',
        lead: ['12 _ _ 9 7 _ 9 _', '10 _ _ 7 5 _ 7 _', '9 _ 7 _ 4 _ 2 _', '1 _ _ _ 4 _ 6 _',
          '12 _ _ 9 7 _ 9 12', '14 _ _ 12 10 _ 7 _', '11 _ 8 _ 6 _ 4 _', '6 8 11 8 6 8 11 13'],
        drums: { k: 'x..x..x.x..x..x.', s: '....x.......x.xx', h: 'x.x.x.x.x.x.x.x.' },
      },
    },
  },

  // Final boss: grand and gloomy in G minor, but the B section slips into G
  // major: the Baron is closer to laughing than he lets on.
  finalboss: {
    bpm: 150, root: 55, scale: 'harmMinor', form: 'A A B A', delay: { beats: 0.75, fb: 0.25 },
    ch: {
      lead: lead({ vol: 0.15, oct: 1, echo: 0, send: 0.35 }),
      pad: pad({ wave: 'sawtooth', vol: 0.03, lp: 1500 }),
      bass: bass({ wave: 'sawtooth', vol: 0.15, lp: 950, pat: 'r r o r r f o f', gate: 0.55 }),
      arp: arp({ pat: '0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 1', vol: 0.04, gate: 0.5 }),
      drums: drums({ k: 'x.....x.x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', t: '..............xx' }, { vol: 0.5 }),
    },
    sections: {
      A: {
        chords: '0 5 3 4 0 5 3 4',
        lead: ['7 _ _ 4 7 _ 9 _', '9 _ _ 7 5 _ 7 _', '10 _ _ 7 5 _ 7 _', '8 _ 6 _ 4 _ 6 8',
          '7 _ _ 4 7 _ 11 _', '12 _ _ 9 7 _ 9 _', '10 _ 12 _ 10 _ 7 _', '8 _ _ _ 6 4 6 8'],
      },
      B: {
        scale: 'major', chords: '0 4 5 3 0 4 3,4 0',
        lead: ['4 _ 7 _ 9 _ 7 _', '8 _ 6 _ 4 _ 6 _', '7 _ 9 _ 12 _ 9 _', '10 _ 7 _ 5 _ . .',
          '4 _ 7 _ 9 _ 11 _', '13 _ 11 _ 8 _ 6 _', '10 _ 7 _ 8 _ 11 _', '14 _ _ _ _ _ . .'],
        bass: 'r . o . f . o .',
        drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      },
    },
  },

  // World clear: a four-bar jingle (played once), then a quiet happy loop.
  clear: {
    bpm: 140, root: 60, scale: 'major', intro: 'I', form: 'L',
    ch: {
      lead: lead({ vol: 0.17, oct: 1 }),
      pad: pad({}),
      bass: bass({ pat: 'r . o . f . o .' }),
      arp: arp({ pat: '0 1 2 3 2 1 2 3', vol: 0.045 }),
      drums: drums({ k: 'x.......x.......', r: '....x.......x...', h: '..x...x...x...x.' }, { vol: 0.34 }),
    },
    sections: {
      I: {
        chords: '3 4 0 0',
        lead: ['3 5 7 _ 5 7 10 _', '4 6 8 _ 6 8 11 _', '7 . 7 7 9 . 11 .', '14 _ _ _ _ _ . .'],
        bass: 'r . r . r . r r',
        drums: { k: 'x...x...x...x...', s: '....x.......x.xx', h: 'x.x.x.x.x.x.x.x.' },
      },
      L: {
        chords: '0 5 3 4',
        lead: ['4 _ . 2 4 _ 7 _', '9 _ . 7 5 _ . .', '7 _ . 5 3 _ 5 _', '6 _ . 4 8 _ . .'],
      },
    },
  },

  // Ending: the title tune come home, slower and warmer, with a new middle.
  ending: {
    bpm: 92, root: 62, scale: 'major', gain: 0.8, form: 'A B A B', delay: { beats: 0.75, fb: 0.34 },
    ch: {
      lead: lead({ wave: 'triangle', vol: 0.32, env: [0.02, 0.15, 0.8, 0.15], echo: 0, send: 0.5 }),
      glint: lead({ wave: 'pulse', vol: 0.05, oct: 1, echo: 0, send: 0.5, from: 'lead', shift: 2 }),
      pad: pad({ vol: 0.08 }),
      bass: bass({ pat: 'r _ _ . f _ o .', gate: 0.9 }),
      arp: arp({ wave: 'triangle', vol: 0.11, pat: '0 1 2 3 2 1 2 1', gate: 0.8, send: 0.3 }),
      drums: drums({ k: 'x.........x.....', r: '....x.......x...', h: '..x...x...x...x.' }, { vol: 0.3 }),
    },
    sections: {
      A: { chords: '0 0 3 4 0 5 3 4,0', lead: TITLE_A },
      B: {
        chords: '3 4 2 5 3 4 0 0',
        lead: ['5 _ 7 _ 10 _ 7 _', '6 _ 8 _ 11 _ 8 _', '4 _ 6 _ 9 _ 6 _', '7 _ 9 _ 12 _ _ _',
          '10 _ 7 _ 5 _ 7 _', '11 _ 8 _ 6 _ 8 _', '9 _ 7 _ 4 _ 2 _', '0 _ _ _ _ _ . .'],
      },
    },
  },
};

function resolveTrack(id) {
  if (id == null) return null;
  const s = String(id);
  if (TRACKS[s]) return s;
  const low = s.toLowerCase();
  const m = /w(?:orld)?_?(\d)/.exec(low);
  if (/final/.test(low)) return 'finalboss';
  if (/boss/.test(low)) return 'boss';
  if (m && TRACKS['w' + m[1]]) return 'w' + m[1];
  if (/end|credit/.test(low)) return 'ending';
  if (/clear|win|victory/.test(low)) return 'clear';
  if (/title|menu|intro/.test(low)) return 'title';
  return 'map';
}

// ---- compiler: track data -> flat, time-sorted event lists (cached) ---------
function degToMidi(root, scale, d, acc) {
  const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
  return root + 12 * o + scale[i] + (acc || 0);
}

function chordTones(root, scale, tok) {
  const m = /^(-?\d+)([Mm7]*)$/.exec(tok) || [0, '0', ''];
  const d = parseInt(m[1], 10), fl = m[2];
  const r = degToMidi(root, scale, d, 0);
  let third = degToMidi(root, scale, d + 2, 0) - r;
  if (fl.indexOf('M') >= 0) third = 4; else if (fl.indexOf('m') >= 0) third = 3;
  const tones = [r, r + third, degToMidi(root, scale, d + 4, 0)];
  if (fl.indexOf('7') >= 0) tones.push(degToMidi(root, scale, d + 6, 0));
  return tones;
}

function mirrorBars(bars, axis) {
  return bars.map((bar) => bar.trim().split(/\s+/).map((t) => {
    const m = /^(-?\d+)([#b]?)$/.exec(t);
    if (!m) return t;
    return (2 * axis - parseInt(m[1], 10)) + (m[2] === '#' ? 'b' : m[2] === 'b' ? '#' : '');
  }).join(' '));
}

function compileSection(T, name, off, ev, scaleOverride) {
  const sec = T.sections[name];
  if (!sec) return 0;
  const scale = SCALES[scaleOverride && !sec.scale ? scaleOverride : (sec.scale || T.scale)] || SCALES.major;
  const bb = T.beats || 4;
  const ctoks = sec.chords.trim().split(/\s+/), nb = ctoks.length;
  const spans = [];
  for (let i = 0; i < nb; i++) {
    const parts = ctoks[i].split(',');
    for (let j = 0; j < parts.length; j++) {
      spans.push({ b0: i * bb + (j * bb) / parts.length, b1: i * bb + ((j + 1) * bb) / parts.length, tones: chordTones(T.root, scale, parts[j]) });
    }
  }
  const chordAt = (b) => { for (let i = spans.length - 1; i >= 0; i--) if (b >= spans[i].b0 - 1e-6) return spans[i]; return spans[0]; };

  for (const cn in T.ch) {
    const def = T.ch[cn];
    const srcName = def.from || cn;
    let src = sec[srcName] !== undefined ? sec[srcName] : def.pat;
    if (def.kind === 'mel' && sec.mirror && src === undefined) src = mirrorBars(T.sections[sec.mirror.of][srcName], sec.mirror.axis);
    if (src == null) continue;
    const gate = def.gate || 0.9;

    if (def.kind === 'drum') {
      for (const lane in src) {
        if (lane.length !== 1) continue;
        const pats = Array.isArray(src[lane]) ? src[lane] : [src[lane]];
        for (let i = 0; i < nb; i++) {
          const p = pats[i % pats.length], step = bb / p.length;
          for (let s = 0; s < p.length; s++) {
            const c = p[s];
            if (c === 'x' || c === 'X') ev.push({ b: off + i * bb + s * step, c: cn, k: lane, v: c === 'X' ? 1.25 : 1 });
          }
        }
      }
      continue;
    }

    if (def.kind === 'pad') {
      for (const sp of spans) {
        for (let k = 0; k < sp.tones.length; k++) ev.push({ b: off + sp.b0, d: (sp.b1 - sp.b0) * 0.98, m: sp.tones[k] + 12 * (def.oct || 0), c: cn, v: 1 });
      }
      continue;
    }

    // melodic / bass / arp: build one token stream for the whole section so
    // that `_` can hold a note across a bar line
    const bars = Array.isArray(src) ? src : [src];
    let cur = null;
    const flush = () => { if (cur) { cur.d *= gate; ev.push(cur); cur = null; } };
    for (let i = 0; i < nb; i++) {
      const bar = def.kind === 'mel' ? bars[i] : bars[i % bars.length];
      if (!bar) { flush(); continue; }
      const toks = bar.trim().split(/\s+/), step = bb / toks.length;
      for (let s = 0; s < toks.length; s++) {
        const t = toks[s], b = i * bb + s * step;
        if (t === '_') { if (cur) cur.d += step; continue; }
        flush();
        if (t === '.') continue;
        let m = null;
        if (def.kind === 'mel') {
          const mm = /^(-?\d+)([#b]?)$/.exec(t);
          if (mm) m = degToMidi(T.root, scale, parseInt(mm[1], 10) + (def.shift || 0), mm[2] === '#' ? 1 : mm[2] === 'b' ? -1 : 0) + 12 * (def.oct || 0);
        } else if (def.kind === 'bass') {
          const tones = chordAt(b).tones, lo = def.lo || 43;
          let base = tones[0];
          while (base >= lo + 12) base -= 12;
          while (base < lo) base += 12;
          if (t === 'r') m = base;
          else if (t === 't') m = base + (tones[1] - tones[0]);
          else if (t === 'f') m = base + (tones[2] - tones[0]);
          else if (t === 'o') m = base + 12;
        } else {
          const tones = chordAt(b).tones, n = tones.length, k = parseInt(t, 10);
          if (!isNaN(k)) {
            if (def.chord) {           // stab: the whole chord at once
              for (let q = 0; q < n; q++) ev.push({ b: off + b, d: step * gate, m: tones[q] + 12 * (def.oct || 0), c: cn, v: 0.8 });
              continue;
            }
            m = tones[((k % n) + n) % n] + 12 * Math.floor(k / n) + 12 * (def.oct || 0);
          }
        }
        if (m != null) cur = { b: off + b, d: step, m, c: cn, v: 1 };
      }
    }
    flush();
  }
  return nb * bb;
}

const compiled = new Map();
function compile(key, names, loop, scaleOverride) {
  const ck = key + '|' + names.join(',') + '|' + (scaleOverride || '');
  let c = compiled.get(ck);
  if (c) return c;
  const T = TRACKS[key], ev = [];
  let len = 0;
  for (const nm of names) len += compileSection(T, nm, len, ev, scaleOverride);
  // echoes (a quieter repeat of melodic notes, the classic chip-tune trick)
  const n0 = ev.length;
  for (let i = 0; i < n0; i++) {
    const e = ev[i], def = T.ch[e.c];
    if (def.kind === 'mel' && def.echo) ev.push({ b: e.b + (def.echoDelay || 0.75), d: e.d, m: e.m, c: e.c, v: def.echo });
  }
  const sw = T.swing || 0, out = [];
  for (const e of ev) {
    if (sw) { const h = e.b * 2, r = Math.round(h); if (Math.abs(h - r) < 0.01 && (r & 1)) e.b += sw * 0.5; }
    if (e.b >= len - 1e-6) { if (!loop) continue; e.b -= len; if (e.b < 0) e.b = 0; }
    out.push(e);
  }
  out.sort((a, b) => a.b - b.b);
  c = { ev: out, len };
  compiled.set(ck, c);
  return c;
}

// ---------------------------------------------------------------------------
// SOUND EFFECT RECIPES
// Each recipe gets the engine `A` and calls A.tn (tone), A.nz (noise) and
// A.sq (note sequence). Times are seconds from the start of the effect.
//   A.tn(wave, f0, f1, dur, vol, delay, env)     f1 = 0 for a steady pitch
//   A.nz(filterType, f0, f1, dur, vol, delay, q)
//   A.sq(wave, [midi...], step, noteDur, vol, delay)
// ---------------------------------------------------------------------------
const PLUCK = [0.002, 0.08, 0, 0.04];
const SOFT = [0.01, 0.08, 0.6, 0.08];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

const SFX = {
  // --- Whisk ---
  jump(A) { A.tn('pulse', 330, 700, 0.11, 0.2); A.tn('sine', 220, 520, 0.09, 0.18); },
  land(A) { A.nz('lowpass', 500, 120, 0.06, 0.3); A.tn('sine', 150, 70, 0.07, 0.3); },
  throw(A) { A.nz('bandpass', 700, 2600, 0.14, 0.3, 0, 1.2); A.tn('triangle', 480, 940, 0.11, 0.2); },
  catch(A) { A.tn('triangle', 900, 480, 0.06, 0.22); A.tn('square', 700, 0, 0.035, 0.13, 0.055, PLUCK); },
  hattrick(A) { A.tn('sine', 260, 980, 0.15, 0.3); A.sq('pulse', [76, 81, 88], 0.05, 0.07, 0.16, 0.04); },
  capture(A) { A.sq('square', [60, 64, 67, 72, 76, 84], 0.042, 0.07, 0.15); A.nz('highpass', 5000, 9000, 0.25, 0.08, 0.1); A.tn('sine', 300, 1200, 0.26, 0.14); },
  release(A) { A.sq('square', [79, 74, 67], 0.045, 0.06, 0.14); A.tn('sine', 620, 240, 0.1, 0.22, 0.03); },
  hurt(A) { A.tn('sawtooth', 460, 110, 0.24, 0.2); A.tn('square', 230, 70, 0.2, 0.12, 0.02); A.nz('lowpass', 900, 200, 0.12, 0.25); },
  stomp(A) { A.tn('square', 170, 540, 0.07, 0.2); A.nz('lowpass', 700, 150, 0.07, 0.3); },
  bounce(A) { A.tn('sine', 190, 820, 0.17, 0.32, 0, [0.004, 0.1, 0.6, 0.06]); A.tn('triangle', 380, 1640, 0.17, 0.08); },
  swim(A) { A.tn('sine', 280, 520, 0.09, 0.2, 0, SOFT); A.tn('sine', 700, 1100, 0.04, 0.08, 0.07, PLUCK); },
  splash(A) { A.nz('bandpass', 2200, 500, 0.28, 0.35, 0, 0.8); A.tn('sine', 620, 260, 0.14, 0.18); A.tn('sine', 900, 1500, 0.05, 0.08, 0.16, PLUCK); },
  // --- pickups ---
  button(A) { const f = mtof(84 + PENTA[A._streak]); A.tn('square', f, 0, 0.05, 0.11, 0, PLUCK); A.tn('triangle', f * 2, 0, 0.11, 0.2, 0.035, PLUCK); },
  spark(A) { A.sq('pulse', [72, 76, 79, 84, 88, 91], 0.065, 0.1, 0.16); A.sq('triangle', [84, 88, 91, 96], 0, 0.55, 0.11, 0.39); A.nz('highpass', 6000, 10000, 0.5, 0.06, 0.3); A.duck(0.7); },
  heart(A) { A.sq('sine', [72, 79], 0.09, 0.14, 0.26); A.tn('triangle', mtof(84), 0, 0.3, 0.2, 0.18, [0.01, 0.25, 0, 0.1]); },
  checkpoint(A) { A.sq('triangle', [67, 72, 76, 79], 0.075, 0.1, 0.26); A.sq('pulse', [84, 88], 0, 0.34, 0.1, 0.3); A.nz('bandpass', 1500, 2500, 0.2, 0.06, 0.02, 2); },
  clink(A) { A.tn('square', 2093, 0, 0.03, 0.09, 0, PLUCK); A.tn('triangle', 3136, 0, 0.09, 0.14, 0.01, PLUCK); },
  // --- world bits ---
  pop(A) { A.tn('sine', 760, 180, 0.07, 0.3); A.nz('highpass', 3000, 7000, 0.07, 0.2); A.sq('triangle', [96, 91, 98, 93], 0.035, 0.05, 0.1, 0.05); },
  break(A) { A.nz('lowpass', 1500, 200, 0.2, 0.4); A.tn('square', 130, 55, 0.12, 0.2); A.nz('bandpass', 900, 400, 0.08, 0.2, 0.1, 2); },
  switch(A) { A.tn('square', 1200, 0, 0.02, 0.14, 0, PLUCK); A.tn('square', 760, 1020, 0.06, 0.14, 0.03); },
  door(A) { A.tn('triangle', 105, 170, 0.32, 0.32, 0, SOFT); A.nz('lowpass', 300, 180, 0.32, 0.25); A.tn('square', 520, 0, 0.03, 0.08, 0.3, PLUCK); },
  hint(A) { A.sq('sine', [79, 84], 0.08, 0.1, 0.2); },
  toast(A) { A.sq('sine', [76, 83], 0.07, 0.09, 0.18); },
  // --- bosses / big moments ---
  bosshit(A) { A.tn('square', 140, 720, 0.2, 0.22); A.nz('bandpass', 1200, 400, 0.16, 0.35, 0, 1); A.sq('pulse', [64, 71, 76], 0.05, 0.08, 0.16, 0.08); A.duck(0.3); },
  bossdown(A) {
    A.tn('sawtooth', 820, 60, 0.9, 0.18); A.tn('square', 410, 40, 0.9, 0.1);
    for (let i = 0; i < 4; i++) A.nz('lowpass', 1400 - i * 250, 150, 0.2, 0.32, i * 0.16);
    A.sq('pulse', [60, 64, 67, 72, 76, 79, 84], 0.07, 0.11, 0.17, 0.8);
    A.sq('triangle', [72, 76, 79, 84], 0, 0.7, 0.12, 1.3);
    A.duck(1.8);
  },
  clear(A) { A.nz('highpass', 3000, 11000, 0.6, 0.08); A.tn('sine', 500, 2400, 0.5, 0.12, 0, SOFT); A.sq('triangle', [96, 100, 103, 108], 0.05, 0.08, 0.08, 0.3); },
  // --- menus ---
  ui(A) { A.tn('square', 880, 1180, 0.045, 0.2, 0, SOFT); },
  uiMove(A) { A.tn('square', 740, 880, 0.035, 0.15, 0, SOFT); },
  uiBack(A) { A.tn('square', 700, 440, 0.07, 0.17); },
  select(A) { A.sq('pulse', [72, 79], 0.055, 0.08, 0.13); },
  pause(A) { A.sq('square', [72, 67], 0.07, 0.07, 0.1); },
  deny(A) { A.sq('sawtooth', [50, 49], 0.09, 0.09, 0.12); },
  buy(A) { A.tn('triangle', 3136, 0, 0.08, 0.14, 0, PLUCK); A.sq('pulse', [79, 84, 91], 0.06, 0.09, 0.14, 0.05); },
  equip(A) { A.tn('triangle', 500, 900, 0.07, 0.2); A.tn('square', 990, 0, 0.04, 0.1, 0.07, PLUCK); },
  unlock(A) { A.sq('pulse', [67, 72, 76, 79, 84], 0.08, 0.12, 0.15); A.sq('triangle', [84, 88, 91], 0, 0.5, 0.1, 0.4); A.duck(0.8); },
  // --- creature abilities and world flavour (optional names) ---
  flap(A) { A.nz('bandpass', 500, 1400, 0.09, 0.3, 0, 1.2); A.tn('sine', 340, 560, 0.08, 0.12); },
  float(A) { A.tn('sine', 420, 640, 0.3, 0.14, 0, [0.08, 0.1, 0.7, 0.15]); },
  glide(A) { A.nz('bandpass', 900, 1600, 0.3, 0.14, 0, 2); },
  fizz(A) { A.nz('highpass', 4000, 9000, 0.3, 0.14); A.sq('sine', [88, 93, 91, 96], 0.05, 0.04, 0.1); },
  bubble(A) { A.tn('sine', 380, 1000, 0.07, 0.22, 0, PLUCK); },
  drip(A) { A.tn('sine', 1300, 600, 0.05, 0.2, 0, PLUCK); },
  dash(A) { A.nz('bandpass', 400, 3200, 0.16, 0.3, 0, 1); A.tn('sawtooth', 200, 600, 0.12, 0.08); },
  whoosh(A) { A.nz('bandpass', 500, 2400, 0.22, 0.28, 0, 1.4); },
  roll(A) { A.nz('lowpass', 260, 420, 0.3, 0.3); A.tn('triangle', 80, 120, 0.3, 0.2, 0, SOFT); },
  spin(A) { A.sq('triangle', [72, 76, 79, 76, 72, 76, 79, 84], 0.03, 0.04, 0.14); },
  zap(A) { A.tn('sawtooth', 1900, 180, 0.13, 0.14); A.tn('square', 950, 90, 0.13, 0.1); },
  buzz(A) { A.tn('sawtooth', 110, 104, 0.2, 0.12); A.tn('square', 220, 208, 0.2, 0.06); },
  flip(A) { A.tn('sine', 300, 1000, 0.13, 0.22); A.tn('sine', 1000, 300, 0.15, 0.2, 0.13); A.nz('bandpass', 800, 2000, 0.26, 0.08, 0, 2); },
  wind(A) { A.nz('bandpass', 400, 1300, 0.3, 0.22, 0, 1.5); A.nz('bandpass', 1300, 500, 0.35, 0.18, 0.28, 1.5); },
  snore(A) { A.tn('sawtooth', 95, 70, 0.4, 0.1, 0, [0.15, 0.1, 0.8, 0.15]); A.tn('sine', 700, 1100, 0.3, 0.08, 0.5, [0.1, 0.1, 0.6, 0.1]); },
  yawn(A) { A.tn('triangle', 300, 520, 0.2, 0.18, 0, SOFT); A.tn('triangle', 520, 200, 0.4, 0.18, 0.2, SOFT); },
  dig(A) { for (let i = 0; i < 3; i++) A.nz('lowpass', 700, 250, 0.06, 0.3, i * 0.07); },
  stick(A) { A.tn('sine', 240, 110, 0.1, 0.25); A.nz('bandpass', 600, 300, 0.1, 0.2, 0.02, 3); },
  stretch(A) { A.tn('triangle', 180, 520, 0.28, 0.2, 0, SOFT); A.tn('sine', 360, 1040, 0.28, 0.08, 0, SOFT); },
  grow(A) { A.tn('square', 200, 640, 0.25, 0.14); A.tn('sine', 100, 320, 0.25, 0.2); },
  shrink(A) { A.tn('square', 640, 200, 0.22, 0.14); A.tn('sine', 1280, 400, 0.22, 0.1); },
  freeze(A) { A.sq('triangle', [100, 96, 103, 98, 105], 0.03, 0.12, 0.1); A.nz('highpass', 7000, 9000, 0.2, 0.05); },
  fire(A) { A.nz('lowpass', 900, 2400, 0.25, 0.25); A.tn('sawtooth', 140, 320, 0.2, 0.07); },
  sizzle(A) { A.nz('highpass', 5000, 7000, 0.35, 0.12); },
  honk(A) { A.tn('square', 233, 0, 0.16, 0.14, 0, SOFT); A.tn('square', 311, 0, 0.16, 0.12, 0, SOFT); },
  bell(A) { A.tn('sine', 1568, 0, 0.6, 0.2, 0, [0.002, 0.55, 0, 0.1]); A.tn('sine', 2349, 0, 0.4, 0.1, 0, [0.002, 0.35, 0, 0.1]); A.tn('triangle', 3136, 0, 0.15, 0.06, 0, PLUCK); },
  whistle(A) { A.tn('sine', 1200, 1900, 0.12, 0.18, 0, SOFT); A.tn('sine', 1900, 1500, 0.14, 0.18, 0.12, SOFT); },
  squeak(A) { A.tn('sine', 1500, 2300, 0.06, 0.18); A.tn('sine', 1800, 2600, 0.05, 0.14, 0.08); },
  shoot(A) { A.tn('pulse', 980, 280, 0.09, 0.16); A.nz('highpass', 3000, 1500, 0.05, 0.12); },
  charge(A) { A.tn('sawtooth', 140, 620, 0.5, 0.09, 0, [0.2, 0.1, 0.9, 0.05]); A.tn('sine', 280, 1240, 0.5, 0.12, 0, [0.2, 0.1, 0.9, 0.05]); },
  boom(A) { A.nz('lowpass', 900, 60, 0.5, 0.5); A.tn('sine', 130, 38, 0.4, 0.4); A.tn('square', 90, 40, 0.2, 0.12); A.duck(0.4); },
  thud(A) { A.tn('sine', 110, 42, 0.14, 0.4); A.nz('lowpass', 400, 100, 0.1, 0.35); },
  crumble(A) { for (let i = 0; i < 4; i++) A.nz('lowpass', 1100 - i * 200, 200, 0.09, 0.26, i * 0.06); },
  roar(A) { A.tn('sawtooth', 130, 72, 0.55, 0.16, 0, [0.06, 0.1, 0.9, 0.2]); A.tn('square', 65, 36, 0.55, 0.14, 0, [0.06, 0.1, 0.9, 0.2]); A.nz('lowpass', 500, 200, 0.5, 0.2); },
  laugh(A) { A.sq('pulse', [67, 71, 67, 72, 69, 74, 72, 79], 0.085, 0.06, 0.15); A.sq('triangle', [55, 59, 55, 60, 57, 62, 60, 67], 0.085, 0.06, 0.2); },
  confetti(A) { A.sq('triangle', [96, 91, 100, 93, 103, 98, 105], 0.035, 0.06, 0.11); A.nz('highpass', 5000, 9000, 0.25, 0.07); },
  warp(A) { A.tn('sine', 200, 1600, 0.35, 0.18, 0, SOFT); A.tn('triangle', 1600, 400, 0.25, 0.12, 0.3, SOFT); },
  magnet(A) { A.tn('sine', 180, 360, 0.22, 0.2, 0, SOFT); A.tn('square', 720, 760, 0.22, 0.04, 0, SOFT); },
  windup(A) { for (let i = 0; i < 5; i++) A.tn('square', 900 + i * 90, 0, 0.018, 0.1, i * 0.045, PLUCK); },
  tick(A) { A.tn('square', 1500, 0, 0.02, 0.2, 0, SOFT); },
  sneeze(A) { A.tn('sine', 500, 900, 0.14, 0.14, 0, SOFT); A.nz('bandpass', 2500, 900, 0.14, 0.35, 0.16, 1); },
  blip(A) { A.tn('sine', 660, 880, 0.05, 0.12, 0, SOFT); },
};

// keyword fallbacks for names other modules invent (first match wins)
const SFX_ALIASES = [
  [/hat.?trick/, 'hattrick'], [/boss.*(down|dead|defeat|beat)/, 'bossdown'], [/boss/, 'bosshit'],
  [/laugh|giggle|chuckle|haha/, 'laugh'], [/confetti|party|cheer/, 'confetti'],
  [/spark|fanfare|star/, 'spark'], [/coin|button|pling/, 'button'], [/heart|heal/, 'heart'],
  [/check|flag/, 'checkpoint'], [/unlock|reward|victory/, 'unlock'], [/buy|purchase|shop/, 'buy'], [/equip|wear/, 'equip'],
  [/deny|error|locked|nope|fail/, 'deny'], [/select|confirm|accept/, 'select'], [/back|cancel|close/, 'uiBack'],
  [/cursor|menu|^ui|^tab/, 'uiMove'],
  [/hurt|ouch|damage/, 'hurt'], [/stomp|squash|squish/, 'stomp'],
  [/snore|sleep|snooze|doze/, 'snore'], [/yawn/, 'yawn'], [/sneez/, 'sneeze'],
  [/flap|wing|flutter|kite/, 'flap'], [/float|hover|drift|balloon/, 'float'], [/glide|soar/, 'glide'],
  [/fizz|soda|foam|spray/, 'fizz'], [/bubble|blub|gulp/, 'bubble'], [/drip|drop/, 'drip'],
  [/splash|plop|dunk/, 'splash'], [/swim|paddle|stroke/, 'swim'],
  [/dash|zoom|charge_go|rush|sprint|boost/, 'dash'], [/charg|wind.?up_hold|power/, 'charge'],
  [/roll|tumble|rumble/, 'roll'], [/spin|twirl|whirl/, 'spin'],
  [/zap|shock|spark_?z|electric|laser|bolt/, 'zap'], [/buzz|hum|neon|flicker/, 'buzz'],
  [/flip|gravity|topsy|invert/, 'flip'], [/wind|gust|breeze|blow|^fan/, 'wind'],
  [/dig|burrow|sand/, 'dig'], [/stick|sticky|goo|jam|squelch|dough|splat/, 'stick'], [/stretch|elastic|noodle/, 'stretch'],
  [/grow|inflate|rise/, 'grow'], [/shrink|deflate|small/, 'shrink'],
  [/freez|^ice|icy|frost|chill/, 'freeze'], [/sizzle|fry|steam/, 'sizzle'], [/fire|flame|burn|toast_?er|oven/, 'fire'],
  [/honk|horn|toot/, 'honk'], [/bell|chime|ding|gong/, 'bell'], [/whistle|tweet|chirp/, 'whistle'], [/squeak|mouse|squeal/, 'squeak'],
  [/shoot|spit|launch|fire_?ball|throw/, 'shoot'], [/boom|explo|bang|blast/, 'boom'],
  [/thud|slam|crash|smash|pound|stamp/, 'thud'], [/crumble|crack|shatter|break/, 'break'], [/roar|growl|grumble|groan/, 'roar'],
  [/warp|teleport|portal|magic/, 'warp'], [/magnet|pull|grab/, 'magnet'], [/^key|ratchet|crank|clockwork|gear/, 'windup'], [/tick|tock|click|step/, 'tick'],
  [/whoosh|swoosh|swing|swipe/, 'whoosh'], [/boing|spring|bounce|trampoline/, 'bounce'], [/jump|hop|leap/, 'jump'], [/land|thump/, 'land'],
  [/pop|burst/, 'pop'], [/clink|clank|metal|ping/, 'clink'], [/switch|lever|toggle/, 'switch'], [/door|gate|open/, 'door'],
  [/capture|possess/, 'capture'], [/release|eject|exit/, 'release'], [/catch/, 'catch'], [/hit$/, 'hurt'],
];
const sfxResolved = new Map();
function resolveSfx(name) {
  if (SFX[name]) return name;
  let r = sfxResolved.get(name);
  if (r) return r;
  const low = String(name).toLowerCase(), bare = low.replace(/^w\d+_?/, '');
  r = 'blip';
  for (const k in SFX) if (k.toLowerCase() === bare || k.toLowerCase() === low) { r = k; break; }
  if (r === 'blip') for (const [re, to] of SFX_ALIASES) if (re.test(bare)) { r = to; break; }
  if (sfxResolved.size < 500) sfxResolved.set(name, r);
  return r;
}

// ---------------------------------------------------------------------------
// ENGINE
// ---------------------------------------------------------------------------
export class AudioEngine {
  constructor(opts) {
    this.ctx = (opts && opts.ctx) || null;      // tests may inject an OfflineAudioContext
    this.unlocked = false;
    this.volume = 0.8; this.sfxOn = true; this.musicOn = true;
    this.musicVolume = 1; this.sfxVolume = 1;
    this.track = null;                           // the id that was asked for
    this.musicIntensity = 1;
    this._explicitIntensity = false;
    this._cur = null; this._timer = null; this._hidden = false;
    this._last = {}; this._streak = 0; this._lastButton = -9;
    this._live = 0; this._started = 0; this._late = 0; this._errors = 0;
    this._waves = {}; this._noiseBuf = null;
    this._sfxT = 0; this._sfxP = 1; this._sfxV = 1;
    this._settingsRead = false;
    if (this.ctx) { this._build(); this.unlocked = true; }
  }

  get tracks() { return Object.keys(TRACKS); }
  get sfxNames() { return Object.keys(SFX); }

  // ---- lifecycle ----
  unlock() {
    this._readSettings();
    try {
      if (!this.ctx) {
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;
        try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { this.ctx = new AC(); }
        this._build();
        this.ctx.onstatechange = () => this._onState();
      }
      const first = !this.unlocked;
      this.unlocked = true;
      if (this.ctx.state !== 'running' && !this._hidden) { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      if (first) {
        // a silent one-sample buffer played inside the gesture fully unlocks iOS
        const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource();
        s.buffer = b; s.connect(this.ctx.destination); s.start(0);
        this._syncMusic();
      }
    } catch (e) { this._errors++; }
  }

  suspend() {
    this._hidden = true;
    this._stopTimer();
    try { if (this.ctx && this.ctx.state === 'running' && this.ctx.suspend) { const p = this.ctx.suspend(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* ignore */ }
  }

  resume() {
    this._hidden = false;
    try {
      if (this.ctx && this.unlocked && this.ctx.state !== 'running' && this.ctx.resume) { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* ignore */ }
    if (this._cur) this._startTimer();
  }

  // any later touch/key: recover from an iOS interruption (phone call, Siri,
  // another app taking the audio session) which leaves the context not running
  _poke() {
    if (this._hidden) return;
    if (!this.unlocked) { this.unlock(); return; }
    try { if (this.ctx && this.ctx.state !== 'running') { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* ignore */ }
  }

  _onState() {
    if (!this.ctx) return;
    if (this.ctx.state === 'running') { if (this._cur && !this._hidden) this._startTimer(); } else this._stopTimer();
  }

  _readSettings() {
    if (this._settingsRead) return;
    this._settingsRead = true;
    try {
      const mv = save.setting('musicVol'), sv = save.setting('sfxVol');
      if (typeof mv === 'number') this.musicVolume = clamp01(mv);
      if (typeof sv === 'number') this.sfxVolume = clamp01(sv);
    } catch (e) { /* ignore */ }
  }

  // ---- settings ----
  setVolume(v) { this.volume = clamp01(+v || 0); this._applyGains(); }
  setSfxEnabled(on) { this.sfxOn = !!on; this._applyGains(); }
  setMusicEnabled(on) { this.musicOn = !!on; this._applyGains(); this._syncMusic(); }
  setMusicVolume(v, persist) {
    this._readSettings(); this.musicVolume = clamp01(+v || 0); this._applyGains();
    if (persist !== false) try { save.setSetting('musicVol', this.musicVolume); } catch (e) { /* ignore */ }
  }
  setSfxVolume(v, persist) {
    this._readSettings(); this.sfxVolume = clamp01(+v || 0); this._applyGains();
    if (persist !== false) try { save.setSetting('sfxVol', this.sfxVolume); } catch (e) { /* ignore */ }
  }
  setMusicIntensity(v, glide) {
    this.musicIntensity = clamp01(+v || 0);
    this._explicitIntensity = true;
    this._applyIntensity(glide == null ? 0.5 : glide);
  }
  setIntensity(v, glide) { this.setMusicIntensity(v, glide); }

  _applyGains() {
    if (!this.master) return;
    try {
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.volume, t, 0.03);
      this.sfxBus.gain.setTargetAtTime(this.sfxOn ? this.sfxVolume * SFX_LEVEL : 0, t, 0.03);
      this.musicBus.gain.setTargetAtTime(this.musicOn ? this.musicVolume * MUSIC_LEVEL : 0, t, 0.03);
    } catch (e) { /* ignore */ }
  }

  // ---- graph ----
  _build() {
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    try {
      this.comp.threshold.value = -13; this.comp.knee.value = 8; this.comp.ratio.value = 12;
      this.comp.attack.value = 0.003; this.comp.release.value = 0.18;
    } catch (e) { /* ignore */ }
    this.out = c.createGain(); this.out.gain.value = 0.95;
    this.master = c.createGain(); this.master.gain.value = this.volume;
    this.sfxBus = c.createGain(); this.musicBus = c.createGain(); this.duckGain = c.createGain();
    this.sfxBus.gain.value = this.sfxOn ? this.sfxVolume * SFX_LEVEL : 0;
    this.musicBus.gain.value = this.musicOn ? this.musicVolume * MUSIC_LEVEL : 0;
    this.duckGain.connect(this.musicBus);
    this.sfxBus.connect(this.master); this.musicBus.connect(this.master);
    this.master.connect(this.comp); this.comp.connect(this.out); this.out.connect(c.destination);
    const len = Math.floor(c.sampleRate * 1.0), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
  }

  _wave(name) {
    let w = this._waves[name];
    if (w) return w;
    const duty = name === 'pulse12' ? 0.125 : 0.25, n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) { re[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty); im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty)); }
    w = this.ctx.createPeriodicWave(re, im);
    this._waves[name] = w;
    return w;
  }

  // one enveloped oscillator note. env = [attack, decay, sustain level, release]
  _tone(dest, wave, f0, f1, t, dur, vol, env, vib) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    if (wave === 'pulse' || wave === 'pulse12') o.setPeriodicWave(this._wave(wave)); else o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const a = env ? env[0] : 0.004, d = Math.max(0.001, env ? env[1] : 0.05), s = env ? env[2] : 0.7, r = env ? env[3] : 0.05;
    const end = t + dur, ta = t + Math.min(a, dur * 0.5), td = Math.min(ta + d, end);
    const gg = g.gain;
    gg.setValueAtTime(0, t);
    gg.linearRampToValueAtTime(vol, ta);
    gg.linearRampToValueAtTime(vol * (1 - (1 - s) * ((td - ta) / d)), td);
    if (end > td) gg.setValueAtTime(vol * s, end);
    gg.linearRampToValueAtTime(0, end + r);
    o.connect(g); g.connect(dest);
    let lfo = null, lg = null;
    if (vib && dur >= vib.min) {
      lfo = c.createOscillator(); lg = c.createGain();
      lfo.frequency.value = vib.hz; lg.gain.value = f0 * vib.amt;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t + vib.delay); lfo.stop(end + r + 0.03);
    }
    o.start(t); o.stop(end + r + 0.03);
    this._live++; this._started++;
    o.onended = () => {
      this._live--;
      try { o.disconnect(); g.disconnect(); if (lg) { lfo.disconnect(); lg.disconnect(); } } catch (e) { /* ignore */ }
    };
  }

  // one burst of filtered noise with a sweeping filter
  _noise(dest, ftype, f0, f1, t, dur, vol, q) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this._noiseBuf; s.loop = true;
    f.type = ftype; f.Q.value = q || 0.7;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.004, dur * 0.3));
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, (this._started * 0.0731) % 0.9); s.stop(t + dur + 0.02);
    this._live++; this._started++;
    s.onended = () => { this._live--; try { s.disconnect(); f.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
  }

  _drum(dest, k, t, v) {
    switch (k) {
      case 'k': this._tone(dest, 'sine', 170, 48, t, 0.13, 0.9 * v, [0.001, 0.12, 0, 0.02]); this._tone(dest, 'triangle', 340, 90, t, 0.04, 0.3 * v, [0.001, 0.035, 0, 0.01]); break;
      case 's': this._noise(dest, 'bandpass', 2400, 1400, t, 0.13, 0.75 * v, 0.8); this._tone(dest, 'triangle', 230, 150, t, 0.06, 0.3 * v, [0.001, 0.05, 0, 0.01]); break;
      case 'h': this._noise(dest, 'highpass', 7500, 0, t, 0.035, 0.28 * v, 0.7); break;
      case 'o': this._noise(dest, 'highpass', 6500, 0, t, 0.16, 0.26 * v, 0.7); break;
      case 'r': this._tone(dest, 'triangle', 900, 0, t, 0.02, 0.4 * v, [0.001, 0.02, 0, 0.01]); this._noise(dest, 'bandpass', 2200, 0, t, 0.02, 0.2 * v, 3); break;
      case 't': this._tone(dest, 'sine', 240, 110, t, 0.14, 0.7 * v, [0.001, 0.13, 0, 0.02]); break;
      case 'c': this._noise(dest, 'bandpass', 1300, 0, t, 0.1, 0.7 * v, 1.2); this._noise(dest, 'bandpass', 1300, 0, t + 0.012, 0.08, 0.4 * v, 1.2); break;
      default: break;
    }
  }

  // ---- sound effects ----
  sfx(name, opts) {
    if (!this.unlocked || !this.sfxOn || !this.ctx || this.volume <= 0 || this.sfxVolume <= 0) return;
    try {
      if (this.ctx.state !== 'running' && !this._offline()) return;
      if (this._live > MAX_LIVE && !this._offline()) return;
      const now = this.ctx.currentTime, key = resolveSfx(name);
      const lastT = this._last[key];
      if (lastT !== undefined && now - lastT < 0.03 && now >= lastT) return;
      this._last[key] = now;
      if (key === 'button') {
        this._streak = now - this._lastButton < 0.6 ? Math.min(PENTA.length - 1, this._streak + 1) : 0;
        this._lastButton = now;
      }
      this._sfxT = now + 0.004;
      this._sfxP = opts && typeof opts.pitch === 'number' ? Math.pow(2, opts.pitch / 12) : 1;
      this._sfxV = opts && typeof opts.vol === 'number' ? Math.max(0, Math.min(2, opts.vol)) : 1;
      SFX[key](this);
    } catch (e) { this._errors++; }
  }

  tn(wave, f0, f1, dur, vol, delay, env) {
    const p = this._sfxP;
    this._tone(this.sfxBus, wave, f0 * p, f1 ? f1 * p : 0, this._sfxT + (delay || 0), dur, vol * this._sfxV, env || null, null);
  }
  nz(ftype, f0, f1, dur, vol, delay, q) { this._noise(this.sfxBus, ftype, f0, f1, this._sfxT + (delay || 0), dur, vol * this._sfxV, q); }
  sq(wave, notes, step, dur, vol, delay) {
    for (let i = 0; i < notes.length; i++) this.tn(wave, mtof(notes[i]), 0, dur, vol, (delay || 0) + i * step, [0.003, dur * 0.6, 0.35, 0.05]);
  }
  duck(seconds) {
    if (!this.duckGain) return;
    try {
      const t = this.ctx.currentTime, g = this.duckGain.gain;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(0.4, t, 0.02);
      g.setTargetAtTime(1, t + (seconds || 0.5), 0.25);
    } catch (e) { /* ignore */ }
  }

  // ---- music ----
  music(trackId, opts) {
    if (trackId == null || trackId === '') { this.stopMusic(); return; }
    if (this.track === trackId && !(opts && opts.restart)) return;
    this.track = trackId;
    this._fade = opts && typeof opts.fade === 'number' ? opts.fade : 0.35;
    this._syncMusic(true);
  }

  stopMusic(fade) {
    this.track = null;
    this._stopCur(typeof fade === 'number' ? fade : 0.35);
  }

  _offline() { return typeof this.ctx.startRendering === 'function'; }

  // make what is playing match what is wanted
  _syncMusic(force) {
    try {
      const want = this.unlocked && this.musicOn && this.ctx && this.track != null ? resolveTrack(this.track) : null;
      if (!want) { this._stopCur(0.25); return; }
      if (this._cur && this._cur.key === want && this._cur.id === this.track && !force) return;
      this._stopCur(this._fade == null ? 0.35 : this._fade);
      this._startCur(want, this.track);
    } catch (e) { this._errors++; }
  }

  _startCur(key, id) {
    const c = this.ctx, T = TRACKS[key], now = c.currentTime;
    const spb = 60 / T.bpm;
    const form = T.form.trim().split(/\s+/);
    const cur = {
      key, id, T, spb, idx: 0, loops: 0, t0: now + 0.09, started: now, nodes: [], ch: {},
      loop: compile(key, form, true, null),
      bright: T.bright ? compile(key, form, true, T.bright.scale) : null,
    };
    cur.seg = T.intro ? compile(key, T.intro.trim().split(/\s+/), false, null) : this._pickLoop(cur);
    cur.gain = c.createGain();
    cur.gain.gain.setValueAtTime(0, now);
    cur.gain.gain.linearRampToValueAtTime(T.gain || 1, now + 0.06);
    cur.gain.connect(this.duckGain);
    cur.nodes.push(cur.gain);
    let delayIn = null;
    if (T.delay) {
      const dl = c.createDelay(2), fb = c.createGain(), lp = c.createBiquadFilter();
      dl.delayTime.value = Math.min(1.9, T.delay.beats * spb); fb.gain.value = T.delay.fb; lp.type = 'lowpass'; lp.frequency.value = 2600;
      dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(cur.gain);
      cur.nodes.push(dl, fb, lp);
      delayIn = dl;
    }
    if (T.autoIntensity && !this._explicitIntensity) this.musicIntensity = 0;
    for (const cn in T.ch) {
      const def = T.ch[cn], g = c.createGain(), layer = this._layer(def);
      g.gain.value = def.vol * layer;
      let tail = g;
      if (def.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = def.lp; f.Q.value = 1.2; g.connect(f); tail = f; cur.nodes.push(f); }
      tail.connect(cur.gain);
      if (delayIn && def.send) { const sg = c.createGain(); sg.gain.value = def.send; tail.connect(sg); sg.connect(delayIn); cur.nodes.push(sg); }
      cur.nodes.push(g);
      cur.ch[cn] = { def, in: g, layer };
    }
    this._cur = cur;
    this._pump();
    if (!this._hidden) this._startTimer();
  }

  _stopCur(fade) {
    const cur = this._cur;
    if (!cur) return;
    this._cur = null;
    this._stopTimer();
    try {
      const now = this.ctx.currentTime, f = Math.max(0.02, fade || 0.02);
      cur.gain.gain.cancelScheduledValues(now);
      cur.gain.gain.setTargetAtTime(0, now, f / 4);
      const kill = () => { for (const n of cur.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } };
      if (this._offline()) kill(); else setTimeout(kill, (f + 0.6) * 1000);
    } catch (e) { /* ignore */ }
  }

  _layer(def) { return def.min == null ? 1 : clamp01((this.musicIntensity - def.min) / 0.12); }

  _applyIntensity(glide) {
    const cur = this._cur;
    if (!cur) return;
    const t = this.ctx.currentTime;
    for (const cn in cur.ch) {
      const ch = cur.ch[cn];
      if (ch.def.min == null) continue;
      const l = this._layer(ch.def);
      if (l === ch.layer) continue;
      ch.layer = l;
      try { ch.in.gain.setTargetAtTime(ch.def.vol * l, t, Math.max(0.01, glide / 3)); } catch (e) { /* ignore */ }
    }
  }

  _pickLoop(cur) { return cur.bright && this.musicIntensity >= cur.T.bright.at ? cur.bright : cur.loop; }

  _startTimer() {
    if (this._timer != null || typeof setInterval !== 'function' || !this.ctx || this._offline()) return;
    this._timer = setInterval(() => this._pump(), TICK_MS);
  }
  _stopTimer() { if (this._timer != null) { clearInterval(this._timer); this._timer = null; } }

  // schedule every music event that starts before the horizon
  _pump(horizonAbs) {
    const cur = this._cur;
    if (!cur || !this.ctx) return;
    try {
      const now = this.ctx.currentTime, hz = horizonAbs != null ? horizonAbs : now + LOOKAHEAD;
      if (cur.T.autoIntensity && !this._explicitIntensity) {
        const v = clamp01((now - cur.started) / cur.T.autoIntensity);
        if (v - this.musicIntensity > 0.01 || (v === 1 && this.musicIntensity !== 1)) { this.musicIntensity = v; this._applyIntensity(1.5); }
      }
      let guard = 0;
      while (guard++ < 20000) {
        const seg = cur.seg;
        if (cur.idx >= seg.ev.length) {
          const segLen = seg.len * cur.spb, end = cur.t0 + segLen;
          if (end > hz || segLen <= 0) break;
          cur.t0 = end; cur.seg = this._pickLoop(cur); cur.idx = 0; cur.loops++;
          const L = cur.seg.len * cur.spb;
          if (L <= 0) break;
          if (cur.t0 + L < now - 0.5) cur.t0 += Math.floor((now - cur.t0) / L) * L;   // fell far behind: skip whole loops
          continue;
        }
        const e = seg.ev[cur.idx], te = cur.t0 + e.b * cur.spb;
        if (te > hz) break;
        cur.idx++;
        if (te < now - 0.03) { this._late++; continue; }
        const ch = cur.ch[e.c];
        if (ch.layer <= 0.001 || (this._live > MAX_LIVE && !this._offline())) continue;
        const t = te < now ? now : te;
        if (e.k) this._drum(ch.in, e.k, t, e.v);
        else this._tone(ch.in, ch.def.wave, mtof(e.m), 0, t, e.d * cur.spb, e.v, ch.def.env, ch.def.vib);
      }
    } catch (e) { this._errors++; }
  }

  // test/debug helper
  _stats() {
    const cur = this._cur;
    return {
      live: this._live, started: this._started, late: this._late, errors: this._errors,
      state: this.ctx ? this.ctx.state : 'none', track: this.track, playing: cur ? cur.key : null,
      loops: cur ? cur.loops : 0, intensity: this.musicIntensity, timer: this._timer != null,
    };
  }
}

export const audio = new AudioEngine();

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const poke = () => audio._poke();
  for (const ev of ['touchend', 'pointerup', 'mousedown', 'keydown']) {
    try { window.addEventListener(ev, poke, { capture: true, passive: true }); } catch (e) { /* ignore */ }
  }
  // main.js also calls suspend()/resume(); these are idempotent and cover
  // pages that embed the audio module without the app shell
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });
  window.addEventListener('pagehide', () => audio.suspend());
  window.addEventListener('pageshow', () => { if (!document.hidden) audio.resume(); });
}
