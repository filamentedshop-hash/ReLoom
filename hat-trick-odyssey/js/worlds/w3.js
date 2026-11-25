// WORLD 3: Topsy-Town. STUB (flat floor + goal). The world-3 agent replaces
// this whole file; see CONTRACT.md and js/worlds/w1.js for the real shape.
export default {
  id: 3,
  name: 'Topsy-Town',
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
