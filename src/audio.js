// Wedding score, synthesised live so there are no audio files to download:
// a tanpura drone, slow strings, and a bansuri line with gliding notes.
// Music only. The invite has no sound effects.
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const BEAT = 0.8;   // seconds; about 75 bpm, unhurried
const LOOP = 64;    // beats

// One chord per 16 beats, voiced low and open.
const CHORDS = [
  { at: 0, notes: [50, 57, 62, 66, 69] },   // D
  { at: 16, notes: [47, 54, 62, 66, 71] },  // Bm
  { at: 32, notes: [43, 55, 62, 67, 71] },  // G
  { at: 48, notes: [45, 57, 61, 64, 69] },  // A
];

// Bansuri phrases: [midi, beats]. Each phrase is one breath.
const PHRASES = [
  { at: 2, notes: [[74, 2], [76, 1], [78, 3], [76, 1], [74, 3]] },
  { at: 17, notes: [[78, 2], [81, 2], [83, 1], [81, 3], [78, 2], [76, 2]] },
  { at: 33, notes: [[81, 2], [83, 1], [86, 3], [85, 1], [83, 1], [81, 4]] },
  { at: 49, notes: [[78, 2], [76, 1], [74, 1], [71, 3], [73, 1], [74, 6]] },
];

// Tanpura cycle: Pa, Sa, Sa, low Sa.
const DRONE = [57, 62, 62, 50];

export class Music {
  // `track` is an optional recording (see config.js). It replaces the synth.
  constructor(track = '') {
    this.ctx = null;
    this.on = true;
    this.timer = null;
    this.cursor = 0;   // next loop index to schedule
    this.track = null;
    if (track) {
      this.track = Object.assign(new window.Audio(track), { loop: true, volume: 0, preload: 'auto' });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.track.pause();
        else if (this.on && this.started) this.track.play().catch(() => {});
      });
    }
  }

  fadeTrack(to, seconds) {
    clearInterval(this.fade);
    const a = this.track, from = a.volume, t0 = performance.now();
    this.fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
      a.volume = from + (to - from) * k;
      if (k === 1) clearInterval(this.fade);
    }, 50);
  }

  unlock() {
    if (this.track) return;
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.connect(new AC());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.ctx.suspend();
      else if (this.on) this.ctx.resume();
    });
  }

  // Split from unlock() so the score can also render offline for level checks.
  connect(c) {
    this.ctx = c;
    this.master = c.createGain();
    this.master.gain.value = this.on ? 1 : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.master.connect(comp);
    comp.connect(c.destination);

    const len = c.sampleRate * 3.8, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb = c.createConvolver();
    this.verb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.5;
    this.verb.connect(wet);
    wet.connect(this.master);

    this.bus = c.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(this.master);
    this.bus.connect(this.verb);

    // Bright harmonic stack for the tanpura's buzzing bridge
    const real = new Float32Array(16), imag = new Float32Array(16);
    for (let i = 1; i < 16; i++) imag[i] = 1 / Math.pow(i, 0.85);
    this.buzz = c.createPeriodicWave(real, imag);

    // Reusable breath noise for the flute
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.breath = nb;
  }

  toggle() {
    this.on = !this.on;
    if (this.track) {
      if (this.on) this.track.play().catch(() => {});
      else this.track.pause();
      return this.on;
    }
    if (this.ctx) {
      this.master.gain.setTargetAtTime(this.on ? 1 : 0, this.ctx.currentTime, 0.15);
      if (this.on) this.ctx.resume();
    }
    return this.on;
  }

  tanpura(midi, t, vel) {
    const c = this.ctx, dur = 5.5;
    const o = c.createOscillator();
    o.setPeriodicWave(this.buzz);
    o.frequency.value = hz(midi);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(420, t);
    f.frequency.linearRampToValueAtTime(1500, t + 0.9);
    f.frequency.exponentialRampToValueAtTime(320, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + dur);
  }

  strings(notes, t, dur) {
    const c = this.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 760;
    f.Q.value = 0.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.32);
    g.gain.setValueAtTime(0.05, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
    f.connect(g); g.connect(this.bus);
    for (const m of notes) for (const det of [-5, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = det;
      o.connect(f);
      o.start(t); o.stop(t + dur + 2.6);
    }
  }

  bansuri(notes, t) {
    const c = this.ctx;
    let total = 0;
    for (const [, b] of notes) total += b * BEAT;
    const end = t + total;

    const o = c.createOscillator();
    o.type = 'triangle';
    const body = c.createOscillator();
    body.type = 'sine';
    // Slides between notes, the bansuri's meend
    let at = t, from = hz(notes[0][0] - 1);
    for (const [m, b] of notes) {
      for (const { frequency: f } of [o, body]) {
        f.setValueAtTime(from, at);
        f.exponentialRampToValueAtTime(hz(m), at + 0.16);
      }
      from = hz(m);
      at += b * BEAT;
    }

    // Vibrato that arrives late in the breath
    const vib = c.createOscillator();
    vib.frequency.value = 4.6;
    const vd = c.createGain();
    vd.gain.setValueAtTime(0, t);
    vd.gain.linearRampToValueAtTime(11, t + 1.6);
    vib.connect(vd);
    vd.connect(o.detune);
    vd.connect(body.detune);

    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2100;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.32);
    g.gain.setValueAtTime(0.12, end - 1.2);
    g.gain.linearRampToValueAtTime(0, end + 0.5);
    const og = c.createGain();
    og.gain.value = 0.45;
    o.connect(og); og.connect(tone);
    body.connect(tone);
    tone.connect(g);
    g.connect(this.bus);

    // Air across the embouchure
    const n = c.createBufferSource();
    n.buffer = this.breath;
    n.loop = true;
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = hz(notes[0][0]) * 2;
    nf.Q.value = 1.4;
    const ng = c.createGain();
    ng.gain.value = 0.035;
    n.connect(nf); nf.connect(ng); ng.connect(g);

    for (const s of [o, body, vib, n]) { s.start(t); s.stop(end + 0.6); }
  }

  scheduleLoop(start) {
    for (let b = 0; b < LOOP; b += 2) this.tanpura(DRONE[(b / 2) % 4], start + b * BEAT, 0.075);
    for (const ch of CHORDS) this.strings(ch.notes, start + ch.at * BEAT, 16 * BEAT);
    for (const p of PHRASES) this.bansuri(p.notes, start + p.at * BEAT);
  }

  startMusic() {
    if (this.track) {
      if (this.started || !this.on) return;
      this.started = true;
      this.track.play().then(() => this.fadeTrack(0.7, 5)).catch(() => { this.started = false; });
      return;
    }
    if (!this.ctx || this.timer) return;
    const c = this.ctx;
    this.bus.gain.setValueAtTime(0, c.currentTime);
    this.bus.gain.linearRampToValueAtTime(0.85, c.currentTime + 7);
    this.start = c.currentTime + 0.1;
    const pump = () => {
      // Queue one loop ahead. Each loop is 51 seconds, so this is rarely busy.
      while (this.start + this.cursor * LOOP * BEAT < c.currentTime + 8) {
        this.scheduleLoop(this.start + this.cursor * LOOP * BEAT);
        this.cursor++;
      }
    };
    pump();
    this.timer = setInterval(pump, 2000);
  }
}
