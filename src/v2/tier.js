// V2's device decisions, all taken from the shared check in src/device.js.
import { invite } from '../config.js';

// Art is shared by every page built from this code (v2 and its variations).
export const ART = '../v2/art/';

// 'lite' loads the small art set (art/<event>/lite/, about a third of the weight),
// fewer petals, and no drifting clouds. High-end devices get the full paintings.
export const artTier = (device) => (device.preset?.smallArt === false ? 'full' : 'lite');

// The track is shared with V1, never copied. Lower tiers get the smaller file.
export function musicSrc(device) {
  if (!invite.music) return '';
  return `../v1/${invite.music}${device.preset?.lowMusic === false ? '' : '-lo'}.mp3`;
}
