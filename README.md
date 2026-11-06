# Parushi & Rishabh: wedding invite

An animated 3D invitation. A beagle tugs the thread on a sealed envelope, the card opens to reveal the names, and the camera pulls back to show the meadow is a tiny planet. Scrolling rolls the planet under the pup from one event to the next.

Built with Three.js, GSAP and Vite. Every model is generated in code, so there are no 3D files to download.

## Edit the invite

All wording, dates and venues live in [`src/config.js`](src/config.js). Dates shown there are placeholders until replaced.

To use a real recording instead of the built-in score, put the file in `public/` and set `music: 'music.mp3'` in the config.

## Run it

```sh
npm install
npm run dev
```

Useful URL flags: `?skip` jumps past the opening, `?low` forces the phone quality level.

## Publish

Every push to `main` builds the site and deploys it to GitHub Pages through `.github/workflows/deploy.yml`. Paths are relative, so it also runs from any other static host: upload the contents of `dist/` after `npm run build`.

## Maintenance scripts

These need the dev server running and Playwright installed with `npm i --no-save playwright`.

- `node scripts/bake-art.mjs` repaints the watercolour images in `public/art/`.
- `node scripts/check-music.mjs` renders the score offline and prints its levels.
