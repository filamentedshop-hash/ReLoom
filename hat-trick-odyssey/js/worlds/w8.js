// WORLD 8: Ho-Hum Kingdom. STUB (flat floor + goal). The world-8 agent replaces
// this whole file; see CONTRACT.md and js/worlds/w1.js for the real shape.
export default {
  id: 8,
  name: 'Ho-Hum Kingdom',
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
