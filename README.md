# Wall Shift

Wall Shift is a polished portrait-first mobile arcade game built with HTML, CSS, and vanilla JavaScript. You play as a glowing core climbing an endless procedural shaft by bouncing between walls, dodging telegraphed hazards, collecting coins, triggering power-ups, and chasing short addictive high-score runs.

## Features

- Portrait 9:16 single-page web app tuned for mobile Safari and desktop testing.
- Endless procedural generation with escalating difficulty, biome changes, and rare run events.
- Touch-first wall-jump controls with keyboard and mouse support for testing.
- Multiple hazard types including spikes, moving spikes, lasers, rotating bars, gates, fake grips, collapsing grips, and drones.
- Power-ups, combo scoring, coins, persistent missions, cosmetics, settings, and local save data.
- Premium neon UI with title, shop, missions, settings, pause, tutorial, and game-over flows.
- Lightweight generated Web Audio sound effects with mute support.

## Project structure

- `index.html` — app shell, menus, overlays, and HUD.
- `style.css` — mobile-first premium portrait styling and responsive UI.
- `js/main.js` — bootstraps the requestAnimationFrame loop.
- `js/game.js` — gameplay orchestration, scoring, progression, collisions, and run flow.
- `js/config.js` — centralized gameplay tuning, cosmetics, missions, and biome data.
- `js/player.js` — wall-jump player state and movement.
- `js/generator.js` — endless chunk generation, events, power-ups, and coin placement.
- `js/obstacles.js` — obstacle factory and procedural pattern definitions.
- `js/renderer.js` — canvas rendering, VFX, and biome presentation.
- `js/effects.js` — particles, floating text, and screen shake.
- `js/audio.js` — generated SFX.
- `js/storage.js` — localStorage persistence and reset handling.
- `js/ui.js` — HUD, menu, shop, settings, and mission rendering.
- `js/shop.js` — cosmetic unlock and selection logic.
- `js/missions.js` — rotating objective progress and claiming.

## Run locally

No build step is required.

### Option 1: open directly

Open `index.html` in a modern browser.

### Option 2: use a simple local server

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your main branch and the repository root.
5. Save and wait for Pages to publish.

Because the project is static and framework-free, it works well on GitHub Pages without any extra configuration.

## Controls

### Touch / mobile
- Tap anywhere in the play area to leap to the opposite wall.
- Use the pause button in the HUD to pause.
- Keep the device in portrait orientation.

### Desktop
- Click to jump.
- `Space`, `W`, or `Arrow Up` to jump.
- `P` or `Escape` to pause.

## Save data

Wall Shift stores the following in `localStorage`:

- best score and best height
- total coins, runs, and distance climbed
- cosmetics unlocked and equipped
- mission progress and rewards claimed
- audio/effects/settings preferences
- lifetime stats and tutorial completion

## Notes

- The game is intentionally designed around portrait play.
- If the browser is landscape, a rotate overlay is shown.
- Audio unlocks on first interaction to comply with mobile browser policies.
