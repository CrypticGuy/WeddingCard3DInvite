// Colour schemes for the 3D world and the page behind it. Plain data, so any page can
// read it without loading Three.js. The world compiles the chosen one into colours once.
//
// A mood is one sky-and-light recipe:
//   top, mid, bot     sky gradient, zenith to horizon (mid also tints water and fog)
//   sun, sunI         sunlight colour and strength (also the glow in the sky)
//   hemiSky, hemiGround, hemiI   soft fill light from above and below
//   rim               edge light on the plants and props
//   night             0 day to 1 night: stars, dimmer water, brighter lanterns
//   sunEl             optional height of the sky glow, in radians (moon at night)
//
// moods holds intro, hero and finale. Events take their sky from their start time
// (src/world/sky.js), unless `events` names one by event id. `sky` replaces the time of
// day keyframes for this palette only. view.wide and view.close move the camera closer
// (above 1) on the globe shots and the event shots.

export const DEFAULT_PALETTE = 'skyglass';

// Mixes two #rrggbb colours, t from 0 (a) to 1 (b).
function mix(a, b, t) {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = n(a), B = n(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// The four light schemes share their lights; only the sky, page and water differ.
function light(label, [top, mid, bot], page, [deep, shallow]) {
  const lights = { sun: '#fff3e0', sunI: 1.6, hemiSky: '#fffaf6', hemiGround: '#e9f3df', hemiI: 1.4, rim: '#fff1ee' };
  const warm = (c) => mix(c, '#ffd2c4', 0.25);
  return {
    label,
    page,
    water: { deep, shallow },
    view: { wide: 1.18, close: 1.05 },
    vignette: 0.09,
    bloomNight: 0.2,
    moods: {
      intro: { top: warm(top), mid: warm(mid), bot: warm(bot), ...lights, sun: '#fff0dc', sunI: 1.55 },
      hero: { top, mid, bot, ...lights },
      finale: { top: mix(top, '#7f8fd6', 0.32), mid: mix(mid, '#e6cdea', 0.2), bot, ...lights, night: 0.25 },
    },
  };
}

export const PALETTES = {
  porcelain: light('Porcelain', ['#dfeefb', '#fbeef0', '#fff6ea'], '#fdf1ee', ['#a9dfe2', '#dcf6f1']),
  skyglass: light('Sky glass', ['#bfe0fb', '#e6f3fd', '#fff7ec'], '#eef6fc', ['#8fd0e6', '#cfeff6']),
  peachmilk: light('Peach milk', ['#ffe3cf', '#fff0e2', '#fffaf0'], '#fff1e4', ['#a4dcd4', '#d9f5ea']),
  mintdawn: light('Mint dawn', ['#cfeee2', '#eef8ec', '#fffbe9'], '#f1f8ee', ['#93d6cf', '#d3f3ea']),

  // The colours the invite launched with, exactly.
  original: {
    label: 'Original',
    page: '#fbdbe2',
    water: { deep: '#9ed6dc', shallow: '#d0f0ec' },
    view: { wide: 1, close: 1 },
    vignette: 0.16,
    bloomNight: 0,
    moods: {
      intro: { top: '#f9c7da', mid: '#fddfd9', bot: '#fff1dc', sun: '#fff0dc', sunI: 1.55, hemiSky: '#fff2ee', hemiGround: '#e7f3dc', hemiI: 1.4, rim: '#ffeef2' },
      hero: { top: '#a9c9f3', mid: '#e9cdea', bot: '#ffe6d3', sun: '#fff3e0', sunI: 1.6, hemiSky: '#f6f0ff', hemiGround: '#e6f2e0', hemiI: 1.45, rim: '#ffe9f3' },
      finale: { top: '#6f7fcf', mid: '#d7a8df', bot: '#ffcfbd', sun: '#ffe4d0', sunI: 1.4, hemiSky: '#e2d8fb', hemiGround: '#f2d2dc', hemiI: 1.4, rim: '#ffdfea', night: 0.6 },
    },
    // One sky per event, as first designed. Events not named here follow their start time.
    events: {
      mehendi: { top: '#9fdccf', mid: '#cdeed0', bot: '#fff3d2', sun: '#fff4da', sunI: 1.5, hemiSky: '#effff2', hemiGround: '#d7eccd', hemiI: 1.3, rim: '#f0fff2' },
      haldi: { top: '#ffcf74', mid: '#ffdf9c', bot: '#fff1c4', sun: '#ffeab8', sunI: 1.6, hemiSky: '#fff6d9', hemiGround: '#f4edc0', hemiI: 1.35, rim: '#fff4cc' },
      sangeet: { top: '#4e4b9c', mid: '#a583d4', bot: '#f7a8c4', sun: '#e8dcff', sunI: 1.15, hemiSky: '#d4ccf6', hemiGround: '#c2a8e0', hemiI: 1.45, rim: '#e0c8ff', night: 1 },
      wedding: { top: '#f38fa8', mid: '#fbbfb4', bot: '#ffe2b0', sun: '#ffdcb0', sunI: 1.55, hemiSky: '#ffe6e2', hemiGround: '#fbdccb', hemiI: 1.35, rim: '#ffe4d6', night: 0.25 },
    },
  },
};

// Which palette this visit uses: ?palette=name for a quick comparison, else the default.
export function paletteName(params) {
  const asked = params?.get('palette');
  return asked && PALETTES[asked] ? asked : DEFAULT_PALETTE;
}
