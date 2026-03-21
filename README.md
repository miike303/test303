# Pocket Golf Deluxe

Pocket Golf Deluxe is a polished, production-style 2D mini-golf browser game built with vanilla HTML, CSS, and JavaScript. It runs by opening `index.html`, uses an HTML5 canvas renderer for gameplay, and is designed to feel smooth, premium, and touch-first on iPhone, iPad, and desktop browsers.

## How to run locally

No build step or dependency installation is required.

### Option 1: open directly
- Open `index.html` in any modern browser.

### Option 2: run a static server
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Push the project to the root of a GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your default branch and the **/ (root)** folder.
5. Save. GitHub Pages will publish the game automatically.

## Controls

### Desktop
- Click and drag from the ball to aim and set power.
- Release to shoot.
- `Esc` pauses or resumes.
- `R` restarts the current hole.
- `N` advances after a hole is complete.

### Mobile / tablet
- Touch and drag from the ball to aim and set power.
- Release to shoot.
- Use the large HUD buttons for pause and mute.

## Feature summary

- 12 handcrafted holes with increasing complexity.
- Quick Play, Course Select, Practice, and Campaign progression.
- Responsive canvas rendering with Retina support.
- Touch-first shot controls plus mouse/keyboard support.
- Sand, rough, sticky zones, water hazards, boost pads, moving obstacles, rotating blockers, and portals.
- Per-hole par scoring, score labels, medals, and locally saved best scores.
- Lightweight procedural audio with graceful mute support.
- Particle effects, trajectory guide, soft screen shake, animated flag, polished glassmorphism UI, and smooth state transitions.

## Project structure

- `index.html` — application shell, menus, HUD, and modal overlays.
- `style.css` — premium responsive layout, mobile-safe spacing, and UI styling.
- `js/main.js` — requestAnimationFrame bootstrapping.
- `js/game.js` — game state machine, shot flow, progression, and gameplay orchestration.
- `js/renderer.js` — canvas rendering, camera, course visuals, and shot guides.
- `js/input.js` — touch and mouse input handling.
- `js/physics.js` — collision helpers, surface checks, hazards, and scoring utilities.
- `js/levels.js` — handcrafted hole definitions.
- `js/ui.js` — DOM HUD and menu management.
- `js/audio.js` — procedural sound effects.
- `js/storage.js` — localStorage persistence.
- `js/effects.js` — particles and screen shake helpers.
