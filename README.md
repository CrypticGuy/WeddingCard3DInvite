# Parushi & Rishabh: wedding invite

An animated 3D invitation. A beagle tugs the thread on a sealed envelope, the card opens to reveal the names, and the camera pulls back to show the meadow is a tiny planet. Scrolling rolls the planet under the pup from one event to the next.

Built with Three.js, GSAP and Vite. Every model is generated in code, so there are no 3D files to download.

## Versions

The site root is a review page listing every version. Each version is a folder: `v1/` for the page and `public/v1/` for its static files. To add one, create `v3/index.html` and add an entry to [`src/router/versions.js`](src/router/versions.js). The build picks up new folders automatically.

## Edit the invite

All wording, dates and venues live in [`src/config.js`](src/config.js). Dates shown there are placeholders until replaced.

Music lives in `public/v1/music/` and is set by `music` in the config. Licences and required credits are in [`public/v1/music/CREDITS.md`](public/v1/music/CREDITS.md).

## Run it

```sh
npm install
npm run dev
```

Useful URL flags: `?skip` jumps past the opening, `?low` forces the phone quality level, `?perf` shows the performance monitor.

## Publish

Every push to `main` builds the site and deploys it to GitHub Pages through `.github/workflows/deploy.yml`. Paths are relative, so it also runs from any other static host: upload the contents of `dist/` after `npm run build`.

## Performance monitoring

**On a real phone:** open the site with `?perf` on the end of the URL. A panel shows live figures, and Copy report gives you the whole session as JSON.

**Emulated phones:** `npm run perf` builds the site, runs it through a set of phone profiles and writes `perf-report/index.html`. Use `npm run perf -- --seconds 120` for longer runs. It needs Chrome installed.

What each number means, and how far to trust it, is explained at the top of the report. Emulation slows the CPU but cannot slow the GPU, so only a real phone gives true frame rates.

## Maintenance scripts

`node scripts/bake-art.mjs` repaints the watercolour images in `public/v1/art/`. It needs the dev server running.
