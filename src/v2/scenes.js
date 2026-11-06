// The four paintings. Art lives in public/v2/art/<id>/. Each scene is built from:
//   sky      opaque wash, moves least
//   hills    far land and the ground the dog walks on
//   subject  the main piece, placed by itself so it fits a phone and a desktop alike
//   fg       foreground flowers, tiled with every other copy mirrored so seams match
// `sprites` are small animated pieces pinned to the subject, in shares of its box.
// Motion is CSS only, so it runs on the compositor and costs no script time.
export const SCENES = {
  mehendi: {
    subject: { ar: 1, size: 0.78 },
    // Behind the tree, so the ropes vanish up into the leaves. Pivots at its top edge.
    sprites: [{ src: 'swing.webp', cls: 'sway', back: true, x: 0.665, y: 0.22, w: 0.35, ar: 0.75, style: '--a:1.4deg;--dur:3.8s' }],
    clouds: 3,
    petals: ['p0', 'p3', 'p6', 'p7'],
    paper: '#eef0e0',
  },
  haldi: {
    subject: { ar: 1, size: 0.74 },
    // Marigold strands hung from behind the arch.
    sprites: [
      { src: 'strand0.webp', cls: 'sway', back: true, x: 0.385, y: 0.15, w: 0.042, ar: 0.108, style: '--a:1.8deg;--dur:4.6s' },
      { src: 'strand1.webp', cls: 'sway', back: true, x: 0.47, y: 0.13, w: 0.042, ar: 0.112, style: '--a:-1.5deg;--dur:5.3s;--delay:-2s' },
      { src: 'strand2.webp', cls: 'sway', back: true, x: 0.55, y: 0.14, w: 0.042, ar: 0.108, style: '--a:1.6deg;--dur:4.1s;--delay:-1s' },
      { src: 'strand0.webp', cls: 'sway', back: true, x: 0.625, y: 0.16, w: 0.042, ar: 0.108, style: '--a:-1.9deg;--dur:5.8s;--delay:-3s' },
    ],
    clouds: 2,
    petals: ['p3', 'p4', 'p5', 'p3'],
    paper: '#fbf0d2',
  },
  sangeet: {
    subject: { ar: 1, size: 0.78 },
    // Lanterns hang from behind the canopy, each with a slow pool of light.
    sprites: [
      { glow: true, x: 0.3, y: 0.46, w: 0.24, style: '--dur:3.1s' },
      { glow: true, x: 0.5, y: 0.53, w: 0.3, style: '--dur:4.2s;--delay:-1s' },
      { glow: true, x: 0.7, y: 0.46, w: 0.24, style: '--dur:3.6s;--delay:-2s' },
      { src: 'lantern0.webp', cls: 'sway', back: true, x: 0.3, y: 0.17, w: 0.082, ar: 0.26, style: '--a:2.6deg;--dur:4.4s' },
      { src: 'lantern1.webp', cls: 'sway', back: true, x: 0.5, y: 0.17, w: 0.13, ar: 0.308, style: '--a:-2deg;--dur:5.4s;--delay:-2s' },
      { src: 'lantern2.webp', cls: 'sway', back: true, x: 0.7, y: 0.17, w: 0.082, ar: 0.263, style: '--a:2.3deg;--dur:4.9s;--delay:-1s' },
    ],
    clouds: 2,
    petals: ['p6', 'p7', 'p8', 'p0'],
    paper: '#e6e0ee',
  },
  wedding: {
    subject: { ar: 1, size: 0.74 },
    sprites: [
      { glow: true, x: 0.496, y: 0.74, w: 0.34, style: '--dur:1.9s' },
      { src: 'flame.webp', cls: 'flame', x: 0.496, y: 0.815, w: 0.1, ar: 0.75 },
      { src: 'flame.webp', cls: 'flame b', x: 0.496, y: 0.815, w: 0.082, ar: 0.75 },
    ],
    clouds: 3,
    petals: ['p0', 'p1', 'p3', 'p4'],
    paper: '#f9e7dc',
  },
};
