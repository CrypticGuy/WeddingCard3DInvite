// Dioramas load on demand: each is its own chunk, fetched as the guest approaches it.
// Keyed by event id (src/config.js). An event whose id is not here gets no diorama.
export { place } from './common.js';

export const loaders = {
  mehendi: () => import('./mehendi.js').then((m) => m.buildMehendi),
  wedding: () => import('./wedding.js').then((m) => m.buildWedding),
  reception: () => import('./reception.js').then((m) => m.buildReception),
};

// Footprints are known up front, so plants can avoid a diorama that has not loaded yet.
export const RADIUS = { mehendi: 3.4, wedding: 3.5, reception: 3.9 };
