# Hat Trick Odyssey

A 2D side-scrolling platformer for iPhone and iPad (it plays fine on a desktop
browser too). It is a plain static web app: no build step, no frameworks, no
downloads at run time, and it works offline once it has been opened once.

Whisk, a cream-and-ginger cat in a tall purple patchwork hat, flies the Teapot
Zeppelin from world to world. The gloomy Baron von Ho-Hum has shattered the
Big Fun Crate, so Whisk gathers the scattered Fun Sparks, throws the hat to
capture creatures and borrow their abilities, and beats a boss in each world.
Every character, name, drawing, line of text and sound is original.

## How to play

| Action | Touch | Keyboard |
|---|---|---|
| Move | Left / Right buttons | Arrow keys or A / D |
| Jump (hold for higher) | JUMP | Space, Z or Up |
| Throw the hat | HAT | X or Shift |

- You can slide a finger between the touch buttons without lifting it.
- The thrown hat defeats weak enemies, grabs pickups and **captures** some
  creatures: Whisk becomes that creature and gets its ability. Press Hat again
  to hop out.
- **Hat trick:** jump onto the hat while it hovers for one extra bounce.
- Three hearts, checkpoint flags, no game over. Running out of hearts refills
  them and puts you back at the last flag.
- Each world has 8 Fun Sparks (the boss holds the last one) and Buttons to
  spend in the hat shop. Progress is saved on the device.
- Nine worlds: each needs the one before it cleared plus a few Fun Sparks in
  total. Beating World 8 shows the ending; World 9 is a harder bonus world
  that opens at 48 Fun Sparks. Story scenes you have seen can be watched again
  from **Settings → Story**.

## Run it locally

Any static file server works. From this folder:

```
tools/serve.sh 8100          # python3 -m http.server on 127.0.0.1
```

then open <http://127.0.0.1:8100/>. Opening `index.html` straight from disk
does not work, because browsers block ES modules on `file://`.

Useful URL parameters: `?world=N` (jump into a world), `?unlock=1` (open every
world), `?reset=1` (wipe the save), `?touch=1` (show touch buttons on desktop),
`?debug=1` (debug API, see `CONTRACT.md`), `?nocs=1` (skip story scenes).

**Offline cache while developing.** On `localhost` / `127.0.0.1` the service
worker is switched off so you always see your latest edits. Add `?sw=1` to
turn it on and test offline behaviour, and `?nosw=1` skips it anywhere.

## Offline support and the precache list

`sw.js` precaches every file the game needs and serves them cache-first. The
file list and a version hash are generated from the real file tree:

```
node tools/make-precache.mjs           # rewrite the list in sw.js
node tools/make-precache.mjs --check   # exit 1 if it is out of date
```

**Re-run it whenever you add, remove or change a game file** (anything under
`css/`, `js/`, `icons/`, plus `index.html`, `manifest.webmanifest`, `pwa.js`).
The GitHub Pages workflow also runs it before every deploy, so a deployed
build is always consistent even if the committed list is stale.

How updates reach players: a new version installs in the background, takes
over immediately and deletes the old cache. If the app was only just opened it
refreshes itself; if someone is mid-game a "New version ready, tap to refresh"
chip appears instead, and the next launch uses the new version either way.

The app icons are drawn in code. To redraw them (needs Playwright with
Chromium):

```
node tools/make-icons.mjs
```

## Put it on GitHub Pages

1. In the repository on GitHub: **Settings → Pages → Build and deployment →
   Source: GitHub Actions**. This is a one-time step.
2. Push to the default branch. The workflow
   `.github/workflows/hat-trick-pages.yml` runs whenever something under
   `hat-trick-odyssey/` changes (you can also start it by hand from the
   **Actions** tab with **Run workflow**).
3. The workflow publishes only this folder's game files, so the game is at the
   root of the project site:

   ```
   https://<owner>.github.io/<repository>/
   ```

   For a repository named `ReLoom` owned by `some-user` that is
   `https://some-user.github.io/ReLoom/`. The exact address is shown on the
   workflow run and under Settings → Pages.

Every path in the app is relative, so it also works from a site root, a custom
domain or any sub-folder. The workflow does not build or touch the Godot
project in the rest of the repository (and `.gdignore` keeps Godot from
importing this folder).

## Add it to the iPhone or iPad home screen

1. Open the game's address in **Safari**.
2. Tap the **Share** button (the square with an arrow).
3. Choose **Add to Home Screen**, then **Add**.
4. Launch it from the new Hat Trick icon. It opens full screen with no browser
   bars and keeps working without a connection.

Turn the device sideways: the game is made for landscape and shows a rotate
hint on phones held upright. iOS does not let a web app lock the orientation,
so make sure the rotation lock in Control Centre is off. Sound starts after
the first touch, and the ring/silent switch may mute it.

On Android (Chrome) use the menu's **Install app** / **Add to Home screen**.

Saved progress lives in the browser's storage for that site. On iOS the home
screen app and the Safari tab keep separate saves.

## Project layout

```
index.html              page shell: canvas, touch buttons, rotate hint
manifest.webmanifest    install metadata (name, icons, landscape, colours)
sw.js                   service worker: offline cache (list is generated)
pwa.js                  registers the service worker, handles updates
css/app.css             page styles
icons/                  app icons (generated by tools/make-icons.mjs)
js/main.js              boot, canvas sizing, scene switching, main loop
js/engine/              engine: loop, input, tiles, levels, physics, player,
                        hat, bosses, audio, save, HUD, debug API
js/art/                 Canvas 2D drawing helpers and characters
js/ui/                  title, sky map, hat shop, settings, clear screen,
                        cutscene player, shared menu kit
js/story/               the story script (every cutscene) and its panel art
js/worlds/              one module per world (w1.js ... w9.js) + index.js
tools/serve.sh          local static server
tools/smoke.mjs         Playwright smoke test for a world
tools/make-precache.mjs regenerates the precache list in sw.js
tools/make-icons.mjs    redraws the PNG icons
CONTRACT.md             the engine contract: how everything fits together
```

## Add or change a world

Read **`CONTRACT.md`** first: it documents the world module shape, the ASCII
level format, every tile, entity, zone and boss feature, the art helpers, and
ends with a world checklist. `js/worlds/w1.js` is the worked example. In short:

1. Write `js/worlds/wN.js` (prefix every new entity and tile name with `wN_`).
2. Run the smoke test and look at the screenshots:

   ```
   tools/serve.sh 8101 &
   node tools/smoke.mjs --port 8101 --world N --device iphone
   ```

3. Run `node tools/make-precache.mjs` so the new file is available offline.
