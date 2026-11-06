// The two V2 decisions that depend on the device. Kept in one small file so they can
// be pointed at src/device.js when that lands: artTier() is the only thing to replace.
import { invite } from '../config.js';

// Art is shared by every page built from this code (v2 and its variations).
export const ART = '../v2/art/';

// 'lite' loads the small art set (art/<event>/lite/, about a third of the weight),
// fewer petals, and no drifting clouds. Anything unknown is treated as capable.
export function artTier(params) {
  if (params.has('low')) return 'lite';
  if (params.has('full')) return 'full';
  const save = navigator.connection?.saveData;
  const memory = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  return save || memory <= 3 || cores <= 4 ? 'lite' : 'full';
}

// config.music is either a file, or a base path with `.mp3` and `-lo.mp3` versions.
// The track is shared with V1, never copied.
export function musicSrc(tier) {
  const m = invite.music;
  if (!m) return '';
  if (/\.[a-z0-9]+$/i.test(m)) return `../v1/${m}`;
  const stem = m.split('/').pop();
  return `../v1/${m.slice(0, -stem.length)}${stem}${tier === 'lite' ? '-lo' : ''}.mp3`;
}
