// THE STORY of Hat Trick Odyssey: every cutscene as data. All text is original.
//
// A scene is { title, music?, panels: [ { art, a?, lines, sfx? } ] }.
//   art    key of a painter in js/story/art.js
//   a      arguments for the painter (world number, mood...)
//   lines  1 to 4 short caption lines, revealed one at a time
//   sfx    sound played when the panel appears
//   kind   'credits' draws the lines big and centred over the picture
//
// Mumble: the Baron snatches him in the intro, but he tumbles out of a hole in
// the Baron's coat pocket on arrival at world 1 ("pre-w1"). From then on he
// travels with the crew and waits ahead at each hint spot, which is why his
// teacup is in every world.

const S = {};

S['intro'] = { title: 'A Rainy Afternoon', panels: [
  { art: 'window', a: { rain: 1 }, lines: [
    'Drip went the rain on the windowpane. Drop.',
    'Whisk gave a sigh. So did Fizz. So did Pop.',
    'No games left to play, and nowhere to go.',
    'The clock ticked slow. The clock ticked SLOW.' ] },
  { art: 'attic', sfx: 'magnet', lines: [
    'But up in the attic, behind an old gate,',
    'sat a humming, glowing BIG FUN CRATE,',
    'stuffed to the lid with giggles and larks,',
    'all packed in tight as bright FUN SPARKS.' ] },
  { art: 'crash', sfx: 'boom', lines: [
    'Then CRASH! Through the roof, all gloomy and glum,',
    'came the gray-coated Baron Von Ho-Hum.',
    '"Fun is too loud! Fun is too bright!',
    'I shall make every world dull and gray by tonight!"' ] },
  { art: 'shatter', sfx: 'break', lines: [
    'He cracked the Crate with one big thump.',
    'Out flew the Sparks with a fizz and a jump!',
    'Over nine far worlds they scattered wide,',
    'each one finding a place to hide.' ] },
  { art: 'snatch', sfx: 'whoosh', lines: [
    'He scooped up Mumble, teacup and all.',
    '"Oh dear, oh my!" came the snail\'s small call.',
    'Then off the Baron swept in a cloud of gray,',
    'and the color of the day drained right away.' ] },
  { art: 'hatalive', sfx: 'hattrick', lines: [
    'Then Whisk\'s tall hat gave a wiggle and a hop.',
    'It spun on its brim like a patchwork top!',
    '"A hat that\'s alive? Well, fancy that!',
    'Come on, friends. Hold on to my hat!"' ] },
  { art: 'takeoff', sfx: 'whistle', lines: [
    'Out in the yard, puffing steam from its spout,',
    'the Teapot Zeppelin was set to head out.',
    'With Fizz, with Pop, and a hat that could fly,',
    'Whisk sailed up into the rainy sky.' ] },
] };

// ------------------------------------------------------------------ world 1
S['pre-w1'] = { title: 'Lollipop Meadow', panels: [
  { art: 'arrive', a: { n: 1 }, lines: [
    'First stop: a meadow of lollipop trees,',
    'where sugar-swirl petals sway in the breeze.',
    'But gray little Gloomlets are plodding about,',
    'and the fun in the flowers is flickering out.' ] },
  { art: 'mumblefall', sfx: 'clink', lines: [
    'Plop! From a hole in the Baron\'s gray coat',
    'fell a teacup, a snail, and a very small "Oh!"',
    '"I\'m free!" gasped Mumble. "What a terrible ride!',
    'I\'ll wait up ahead, and I\'ll be your guide."' ] },
  { art: 'mumble', a: { n: 1 }, lines: [
    '"Toss your hat at a creature and, one, two, three,',
    'you\'ll bounce like a Springle, as high as a tree!',
    'Or puff like a Puffcloud and float on the air.',
    'The Sparks are close by. Go and find out where!"' ] },
] };
S['post-w1'] = { title: 'Meadow in Bloom', music: 'clear', panels: [
  { art: 'cheer', a: { n: 1 }, sfx: 'confetti', lines: [
    'Big Glum went pop in a confetti spray,',
    'and the meadow got back its sunny day!',
    'The Sparks in the teapot went fizz, hum, and toot,',
    'and the propeller spun round like a whirligig flute.' ] },
  { art: 'baronfar', a: { n: 2, mood: 'glum' }, lines: [
    'Far off in his tower, the Baron said, "Bah.',
    'One meadow of fun? That won\'t get them far."',
    'He straightened his coat and he frowned at his tea.',
    '"The Falls will be flat by a quarter past three."' ] },
] };

// ------------------------------------------------------------------ world 2
S['pre-w2'] = { title: 'Fizzlewump Falls', panels: [
  { art: 'arrive', a: { n: 2 }, lines: [
    'Next come the Falls, where the rivers run fizzy',
    'and soda-pop rapids spin round till you\'re dizzy.',
    'Orange and cherry and lime tumble down',
    'with a hiss and a pop and a bubble-foam crown.' ] },
  { art: 'mumble', a: { n: 2 }, lines: [
    '"Mind the fizz!" Mumble called from a rock.',
    '"It tickles your whiskers and soaks through your sock!',
    'But the splashers who live here can swim, pop, and spray.',
    'Borrow their tricks with your hat. That\'s the way!"' ] },
] };
S['post-w2'] = { title: 'Fizz Restored', music: 'clear', panels: [
  { art: 'cheer', a: { n: 2 }, sfx: 'fizz', lines: [
    'The Falls fizz again, every bubble and drop,',
    'and the Zeppelin\'s kettle is whistling on top!',
    'More Sparks in the tank, more puff in the spout,',
    'and up through the mist the brave teapot flew out.' ] },
  { art: 'baronfar', a: { n: 3, mood: 'cross' }, lines: [
    'The Baron peered out through his dull gray spyglass.',
    '"Fizzing AGAIN? What a bubbly morass!',
    'No matter. In Topsy-Town nothing stays put.',
    'Let\'s see that cat dance with the sky underfoot."' ] },
] };

// ------------------------------------------------------------------ world 3
S['pre-w3'] = { title: 'Topsy-Town', panels: [
  { art: 'arrive', a: { n: 3 }, lines: [
    'This is Topsy-Town. Look up! No, look down!',
    'There are streets on the ceiling all over this town.',
    'The chimneys puff downward, the puddles rain up,',
    'and the tea climbs right out of a tipped-over cup.' ] },
  { art: 'mumble', a: { n: 3 }, lines: [
    '"Step in a swirl and you\'ll fall to the sky!"',
    'squeaked Mumble. "It\'s awful! I don\'t dare try.',
    'But the townsfolk here know which way is which.',
    'Wear one as a hat and you\'ll flip like a switch."' ] },
] };
S['post-w3'] = { title: 'Right Side Up', music: 'clear', panels: [
  { art: 'cheer', a: { n: 3 }, sfx: 'bell', lines: [
    'Topsy-Town\'s bells rang from floor and from ceiling,',
    'and Whisk took a bow with a head-over-heels feeling.',
    'The engine went hum and the basket went sway.',
    'Up, down, or sideways, they\'re off and away!' ] },
  { art: 'baronfar', a: { n: 4, mood: 'surprised' }, lines: [
    '"Upside-down CHEERING?" The Baron went pale.',
    'He stirred his cold porridge and let out a wail.',
    '"To Snoozle Sands, then. It\'s drowsy and deep.',
    'Not even a hat can have fun in its sleep."' ] },
] };

// ------------------------------------------------------------------ world 4
S['pre-w4'] = { title: 'Snoozle Sands', panels: [
  { art: 'arrive', a: { n: 4 }, sfx: 'yawn', lines: [
    'The sun wore a nightcap. The dunes gave a yawn.',
    'In Snoozle Sands, bedtime lasts right up to dawn.',
    'The cactuses snore and the breezes say "hush,"',
    'and the sand is as soft as a slipper of plush.' ] },
  { art: 'mumble', a: { n: 4 }, lines: [
    '"Tiptoe," yawned Mumble, "and try not to peep.',
    'The big ones get grumpy when woken from sleep.',
    'But the small ones who burrow, or ring loud and bright,',
    'will lend you a paw if you hat them just right."' ] },
] };
S['post-w4'] = { title: 'Wide Awake', music: 'clear', panels: [
  { art: 'cheer', a: { n: 4 }, sfx: 'confetti', lines: [
    'The desert woke up with a stretch and a cheer,',
    'and the cactuses clapped. (It stung, I fear.)',
    'Warm Sparks in the boiler! The teapot glowed gold',
    'and rose like the sun as the night air turned cold.' ] },
  { art: 'baronfar', a: { n: 5, mood: 'cross' }, lines: [
    'The Baron yawned once, and then looked rather cross.',
    '"I am NOT getting sleepy. Who\'s sleepy? I\'m boss.',
    'Blow, mountain winds, at the Kite-Kite Peaks!',
    'Blow that cat\'s hat into three or four weeks!"' ] },
] };

// ------------------------------------------------------------------ world 5
S['pre-w5'] = { title: 'Kite-Kite Peaks', panels: [
  { art: 'arrive', a: { n: 5 }, sfx: 'wind', lines: [
    'Whoosh go the winds of the Kite-Kite Peaks,',
    'where the mountains wear scarves and the weathervane squeaks.',
    'A hundred bright kites tug their strings in the blue,',
    'and the only way onward is up, up, and through.' ] },
  { art: 'mumble', a: { n: 5 }, lines: [
    '"Hold on to your hat!" Mumble called from a ledge.',
    '"I\'m holding my teacup. I\'m nowhere near the edge.',
    'The wind is a bully, but some here can glide,',
    'and some hold on tight to the mountainside."' ] },
] };
S['post-w5'] = { title: 'Top of the World', music: 'clear', panels: [
  { art: 'cheer', a: { n: 5 }, sfx: 'confetti', lines: [
    'The top of the world! What a view! What a climb!',
    'Every kite did a loop at the very same time.',
    'The Zeppelin\'s lid gave a rattle and ring,',
    'and it rode the high wind like a bird on the wing.' ] },
  { art: 'baronfar', a: { n: 6, mood: 'glum' }, lines: [
    '"They climbed it?" The Baron sat down with a bump.',
    'His tower felt taller. His throat had a lump.',
    '"I used to fly kites..." Then he shook his gray head.',
    '"Burn the buns in Bakeberry Bay!" he said.' ] },
] };

// ------------------------------------------------------------------ world 6
S['pre-w6'] = { title: 'Bakeberry Bay', panels: [
  { art: 'arrive', a: { n: 6 }, lines: [
    'Sniff! Something\'s baking in Bakeberry Bay,',
    'an island where supper is cooked the BIG way.',
    'The spoons are like rowboats, the pots are like halls,',
    'the jelly is deep, and the pancakes are walls.' ] },
  { art: 'mumble', a: { n: 6 }, lines: [
    '"It\'s hot!" Mumble fretted. "The stovetops, they glow!',
    'And the dough is so sticky. I know, oh, I know.',
    'But the kitchen has helpers who stretch, steam, and stick.',
    'One flick of your hat and you\'ll learn every trick."' ] },
] };
S['post-w6'] = { title: 'Teatime', music: 'clear', panels: [
  { art: 'cheer', a: { n: 6 }, sfx: 'bell', lines: [
    'The ovens went ding and the kettles went wheee,',
    'and the whole bay sat down to a very large tea.',
    'Whisk packed up a muffin for Fizz and for Pop,',
    'and the Zeppelin left with a cherry on top.' ] },
  { art: 'baronfar', a: { n: 7, mood: 'surprised' }, lines: [
    'A warm muffin smell reached the Baron\'s gray door.',
    'His tummy said "Yes." He said "No!" Then, "...More?"',
    '"Enough! Neon Nobble shall switch off its light.',
    'Let them try to have fun in the dark of the night."' ] },
] };

// ------------------------------------------------------------------ world 7
S['pre-w7'] = { title: 'Neon Nobble City', panels: [
  { art: 'arrive', a: { n: 7 }, lines: [
    'The night came down soft over Neon Nobble,',
    'where the tall towers blink and the streetlights wobble.',
    'Signs buzz in pink and in green and in blue,',
    'but the Baron\'s gray fog has been dimming a few.' ] },
  { art: 'mumble', a: { n: 7 }, lines: [
    '"It\'s dark," whispered Mumble, "and darker in there.',
    'I\'ll wait with a tip by each lamp on the stair.',
    'Find the beetle-cab racer, the spark on the wire.',
    'With a hat on their heads, they\'ll lift the lights higher."' ] },
] };
S['post-w7'] = { title: 'Lights On', music: 'clear', panels: [
  { art: 'cheer', a: { n: 7 }, sfx: 'zap', lines: [
    'Click! Every sign in the city came on,',
    'and the rooftops all danced till a quarter to dawn.',
    'The Zeppelin glowed like a lantern in flight.',
    'One last world to go, at the end of the night.' ] },
  { art: 'baronfar', a: { n: 7, mood: 'glum', alone: 1 }, lines: [
    'The Baron stood still at his window, alone.',
    'The glow of the city crept up his gray stone.',
    '"So. They are coming. Then let them come here.',
    'My kingdom is quiet. There\'s nothing to cheer."' ] },
] };

// ------------------------------------------------------------------ world 8
S['pre-w8'] = { title: 'Ho-Hum Kingdom', panels: [
  { art: 'gray', a: { c: 0 }, lines: [
    'Gray were the hills, and gray was the sky,',
    'and gray was the bird that forgot how to fly.',
    'No music, no chatter, no whistle, no hum.',
    'This was the Kingdom of Baron Ho-Hum.' ] },
  { art: 'graystep', lines: [
    'But where Whisk stepped, the grass went green,',
    'and a small bit of color came back to the scene.',
    '"Oh my," Mumble gasped. "Did you see that just now?',
    'Keep going! Keep going! You\'re showing it how!"' ] },
  { art: 'tower', lines: [
    'High on the hill stood a tower, tall and plain,',
    'with one small light in one small windowpane.',
    '"He\'s up there," said Whisk, "and he\'s all on his own.',
    'Come on. Nobody should be gray alone."' ] },
] };
S['w8-boss'] = { title: 'The Baron', panels: [
  { art: 'faceoff', sfx: 'thud', lines: [
    '"So. The cat with the hat, and the noise, and the cheer.',
    'I had a hat once. It is long gone, I fear.',
    'Without it the fun went away, bit by bit.',
    'So NOBODY gets any fun. That is it!"' ] },
] };

S['ending'] = { title: 'The Last Laugh', music: 'ending', panels: [
  { art: 'offer', lines: [
    'The Baron sat down with a great gray sigh.',
    'He looked at Whisk\'s hat with a tear in his eye.',
    'Then Whisk did a thing that made everyone pause:',
    'he held out his hat in his two cream paws.' ] },
  { art: 'laugh', sfx: 'laugh', lines: [
    'On went the hat. It wobbled. It slid.',
    'It tickled his ears, as that hat always did.',
    'First came a snort. Then a hic. Then a "HA!"',
    'Then the Baron was laughing: "Ho-hee-hee-HAH!"' ] },
  { art: 'colorwave', sfx: 'warp', lines: [
    'And out rolled the color, like paint from a pail,',
    'over tower and hilltop and river and trail.',
    'Each world, one by one, turned its brightness back on,',
    'and the gray, like a cloud in the morning, was gone.' ] },
  { art: 'crate', sfx: 'spark', lines: [
    'They gathered the Sparks, every last little light,',
    'and they built the Fun Crate back up, snug and tight.',
    'The Baron himself tapped the very last nail,',
    'and he hummed as he worked. (It was slightly off-scale.)' ] },
  { art: 'window', a: { rain: 0.35, sun: 1, home: 1 }, lines: [
    'Then home in the teapot, through one last gray cloud,',
    'with Fizz and Pop cheering, all squeaky and loud.',
    'They were back at the window, the very same one,',
    'just before the rain stopped. And look: here\'s the sun.' ] },
  { art: 'credits', kind: 'credits', lines: [
    'HAT TRICK ODYSSEY',
    'Made with love',
    'Thank you for playing!' ] },
  { art: 'tease', sfx: 'spark', lines: [
    'But late that night, with the stars all aglow,',
    'one Spark zipped past the window. Where did it go?',
    'Up, up to the Moon, where the mess never ends...',
    'There\'s one more adventure. Sleep tight, little friends.' ] },
] };

// ------------------------------------------------------------------ world 9
S['pre-w9'] = { title: 'The Moon of Mess', panels: [
  { art: 'arrive', a: { n: 9 }, lines: [
    'Up past the clouds and the last weathervane',
    'floats the Moon of Mess, where it\'s toys that rain.',
    'Odd socks, lost marbles, a kite with no string:',
    'it\'s where everything lost ends up. Everything.' ] },
  { art: 'mumble', a: { n: 9 }, lines: [
    '"What a muddle!" cried Mumble. "A jumble! A heap!',
    'There are things in this mess that go bump, bounce, and beep.',
    'Use all that you\'ve learned, every trick, every hat.',
    'This one is the hardest. Good luck, little cat."' ] },
] };
S['w9-clear'] = { title: 'Thank You', music: 'ending', panels: [
  { art: 'cheer', a: { n: 9, all: 1 }, sfx: 'confetti', lines: [
    'The Moon is all tidy. Well... tidy enough.',
    '(There\'s a sock on a crater. That\'s moon sort of stuff.)',
    'Every last Spark is back home in its Crate,',
    'and the Baron sends word that the party was great.' ] },
  { art: 'thanks', lines: [
    'So thank you, dear player, for jumping so far,',
    'for each flick of the hat and each Spark like a star.',
    'Whisk tips his tall hat, and so do his friends.',
    'Come back any time. The fun never ends.' ] },
] };

export const SCENES = S;

// Order used by the replay gallery.
export const SCENE_ORDER = [
  'intro',
  'pre-w1', 'post-w1', 'pre-w2', 'post-w2', 'pre-w3', 'post-w3', 'pre-w4', 'post-w4',
  'pre-w5', 'post-w5', 'pre-w6', 'post-w6', 'pre-w7', 'post-w7',
  'pre-w8', 'w8-boss', 'ending', 'pre-w9', 'w9-clear',
];

// Map any id the engine or a menu might ask for to a scene in SCENES (or null).
//   'intro' | 'ending' | 'w9-clear' | 'pre-wN' | 'post-wN'     story names
//   'w{N}_intro' | 'w{N}_boss' | 'w{N}_clear'                  engine names
export function canonicalId(id) {
  if (typeof id !== 'string') return null;
  if (S[id]) return id;
  let m = /^w(\d+)[_-](intro|boss|clear)$/.exec(id);
  let n = 0, kind = '';
  if (m) { n = +m[1]; kind = m[2]; }
  else if ((m = /^(pre|post)-w(\d+)$/.exec(id))) { n = +m[2]; kind = m[1] === 'pre' ? 'intro' : 'clear'; }
  else return null;
  let out;
  if (kind === 'intro') out = 'pre-w' + n;
  else if (kind === 'boss') out = 'w' + n + '-boss';
  else out = n === 8 ? 'ending' : n === 9 ? 'w9-clear' : 'post-w' + n;
  return S[out] ? out : null;
}
