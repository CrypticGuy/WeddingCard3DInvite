// Sky by time of day. Each event's sky comes from the hour it starts at the venue, so a
// morning event gets a clear blue and an evening one a dusk or a night. Plain data, like
// palettes.js. An event can pick its own with `sky: 19.5` or `sky: 'dusk'` in src/config.js.
import { invite } from '../config.js';

// Keyframes by hour, 24h clock. Hours before the first or after the last use that end.
// Fields are the same as a palette mood (see palettes.js); sunEl after dusk is the moon.
export const SKY_TIMES = [
  { at: 10, name: 'morning', top: '#bfe3fb', mid: '#e9f6fb', bot: '#fff8e6', sun: '#fff6dc', sunI: 1.65, hemiSky: '#f7fcff', hemiGround: '#e9f4dc', hemiI: 1.4, rim: '#f4fbff', night: 0, sunEl: 0.75 },
  { at: 15, name: 'afternoon', top: '#a9d6f5', mid: '#dff0f5', bot: '#fff3d6', sun: '#fff1cf', sunI: 1.6, hemiSky: '#f6fbff', hemiGround: '#e6f2d8', hemiI: 1.4, rim: '#fff6e6', night: 0, sunEl: 0.55 },
  { at: 17.5, name: 'golden', top: '#f6c98f', mid: '#fddcb0', bot: '#fff0cf', sun: '#ffd9a0', sunI: 1.5, hemiSky: '#fff0dc', hemiGround: '#f3e3c4', hemiI: 1.35, rim: '#ffe8c4', night: 0.1, sunEl: 0.25 },
  { at: 18.5, name: 'sunset', top: '#e88fa0', mid: '#f9b9a4', bot: '#ffdcae', sun: '#ffc9a0', sunI: 1.4, hemiSky: '#ffe2da', hemiGround: '#f2d3c6', hemiI: 1.35, rim: '#ffd9c8', night: 0.3, sunEl: 0.1 },
  { at: 19.5, name: 'dusk', top: '#6a6fc0', mid: '#b996d6', bot: '#f6b3c2', sun: '#e9dcff', sunI: 1.2, hemiSky: '#ddd3f6', hemiGround: '#cdb4e0', hemiI: 1.4, rim: '#e4d0ff', night: 0.7, sunEl: 0.3 },
  { at: 21, name: 'night', top: '#2f3a7c', mid: '#6f6bb8', bot: '#c79ad0', sun: '#dfe4ff', sunI: 1.05, hemiSky: '#cfd2f4', hemiGround: '#b7a9dc', hemiI: 1.45, rim: '#d6d0ff', night: 1, sunEl: 0.5 },
];

// The local hour, as a decimal, that an event starts at in the venue's time zone.
export function skyHour(event, timeZone = invite.timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(event.start));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') + get('minute') / 60;
}

// The hour an event's sky should show: its own `sky` (an hour or a keyframe name), or its start.
export function skyTime(event, keys = SKY_TIMES) {
  if (typeof event.sky === 'number') return event.sky;
  if (typeof event.sky === 'string') {
    const k = keys.find((x) => x.name === event.sky);
    if (k) return k.at;
  }
  return skyHour(event);
}

// The two keyframes either side of an hour, and how far between them it is.
export function skySpan(keys, hour) {
  if (hour <= keys[0].at) return { a: 0, b: 0, t: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    if (hour <= keys[i + 1].at) return { a: i, b: i + 1, t: (hour - keys[i].at) / (keys[i + 1].at - keys[i].at) };
  }
  const last = keys.length - 1;
  return { a: last, b: last, t: 0 };
}
