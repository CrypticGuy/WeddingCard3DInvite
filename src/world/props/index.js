// Dioramas load on demand: each is its own chunk, fetched as the guest approaches it.
export { place } from './common.js';

export const loaders = {
  mehendi: () => import('./mehendi.js').then((m) => m.buildMehendi),
  haldi: () => import('./haldi.js').then((m) => m.buildHaldi),
  sangeet: () => import('./sangeet.js').then((m) => m.buildSangeet),
  wedding: () => import('./wedding.js').then((m) => m.buildWedding),
};

// Footprints are known up front, so plants can avoid a diorama that has not loaded yet.
export const RADIUS = { mehendi: 3.4, haldi: 3.5, sangeet: 3.8, wedding: 3.5 };
