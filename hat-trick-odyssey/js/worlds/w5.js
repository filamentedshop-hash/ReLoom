// WORLD 5: Kite-Kite Peaks. STUB (flat floor + goal). The world-5 agent replaces
// this whole file; see CONTRACT.md and js/worlds/w1.js for the real shape.
export default {
  id: 5,
  name: 'Kite-Kite Peaks',
  stub: true,
  build(L) {
    L.chunk([
      '                                        ',
      '                                        ',
      '                                        ',
      '                                        ',
      '                                        ',
      '                                        ',
      '                                        ',
      '                                        ',
      '                                        ',
      '              o o o                     ',
      '                                        ',
      '  P    ?            F          E        ',
      '########################################',
      '########################################',
      '########################################',
    ]);
    L.hints(['This world is still being sewn.\nHop to the airship and head on home!']);
  },
};
