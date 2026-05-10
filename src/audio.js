// Phase G — extracted audio helpers.
// First small ESM split out of main.js. All helpers are self-contained Web
// Audio one-shots; they don't read from P/G/level state. The audio context
// is created lazily on first use to comply with browser autoplay policies.
//
// Adding more SFX here over time is the ongoing modularization path —
// keep functions free of game-state dependencies.

let AC = null;

export function getAC() {
  return AC || (AC = new AudioContext());
}

export function sfxHit(hs) {
  const c = getAC(), o = c.createOscillator(), g = c.createGain();
  o.frequency.value = hs ? 950 : 200;
  o.type = 'sine';
  g.gain.setValueAtTime(hs ? .45 : .3, c.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, c.currentTime + (hs ? .11 : .07));
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + .15);
}

export function sfxReload() {
  const c = getAC();
  [[0, 320], [.07, 200], [.14, 260]].forEach(([t, f]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(.25, c.currentTime + t);
    g.gain.exponentialRampToValueAtTime(.001, c.currentTime + t + .035);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + t); o.stop(c.currentTime + t + .05);
  });
}

export function sfxDamage() {
  const c = getAC(), o = c.createOscillator(), g = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = 110;
  g.gain.setValueAtTime(.35, c.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .18);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + .22);
}

export function sfxWaveClear() {
  const c = getAC();
  [440, 554, 660, 880].forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(.2, c.currentTime + i * .1);
    g.gain.exponentialRampToValueAtTime(.001, c.currentTime + i * .1 + .35);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + i * .1); o.stop(c.currentTime + i * .1 + .4);
  });
}
