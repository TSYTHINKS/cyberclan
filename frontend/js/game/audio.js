/**
 * Audio Module — Web Audio API sound system
 * Procedurally generates all game sounds (no external files needed)
 */

const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let ambientOscillators = [];
  let enabled = true;

  /** Initialize audio context (must be called after user gesture) */
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(ctx.destination);
    startAmbient();
  }

  /** Create a gain node connected to master */
  function gain(vol = 1) {
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(masterGain);
    return g;
  }

  /** Play a simple oscillator tone */
  function playTone(freq, type, duration, vol = 0.3, startDelay = 0) {
    if (!ctx || !enabled) return;
    const osc = ctx.createOscillator();
    const g = gain(vol);
    osc.connect(g);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
    g.gain.setValueAtTime(vol, ctx.currentTime + startDelay);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);
    osc.start(ctx.currentTime + startDelay);
    osc.stop(ctx.currentTime + startDelay + duration);
  }

  /** White noise buffer */
  function makeNoise(duration) {
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Play noise burst (impacts, footsteps) */
  function playNoise(duration, vol = 0.2, filterFreq = 2000) {
    if (!ctx || !enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = gain(vol);
    src.connect(filter);
    filter.connect(g);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.start();
    src.stop(ctx.currentTime + duration + 0.01);
  }

  // ─── Sound Effects ──────────────────────────────────────────────────────

  /** Gunshot: sharp noise + low thump */
  function playGunshot() {
    if (!ctx || !enabled) return;
    playNoise(0.08, 0.6, 800);   // crack
    playTone(80, 'sine', 0.15, 0.4); // body thump
    // High pitched crack
    playTone(1200, 'sawtooth', 0.05, 0.2);
  }

  /** Sword swing: whoosh */
  function playSwordSwing() {
    if (!ctx || !enabled) return;
    const osc = ctx.createOscillator();
    const g = gain(0.25);
    osc.connect(g);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    playNoise(0.2, 0.15, 3000); // air whoosh
  }

  /** Hit confirmation: sharp ping */
  function playHit() {
    if (!ctx || !enabled) return;
    playTone(800, 'sine', 0.1, 0.3);
    playTone(600, 'sine', 0.05, 0.15, 0.05);
  }

  /** Footstep: low thud */
  let lastFootstep = 0;
  function playFootstep() {
    if (!ctx || !enabled) return;
    const now = Date.now();
    if (now - lastFootstep < 300) return; // debounce
    lastFootstep = now;
    playNoise(0.06, 0.12, 200);
    playTone(60, 'sine', 0.08, 0.2);
  }

  /** Damage taken: low impact */
  function playDamage() {
    if (!ctx || !enabled) return;
    playNoise(0.15, 0.5, 500);
    playTone(120, 'sawtooth', 0.2, 0.3);
  }

  /** Victory jingle */
  function playVictory() {
    if (!ctx || !enabled) return;
    [523, 659, 784, 1047].forEach((f, i) => playTone(f, 'sine', 0.3, 0.4, i * 0.15));
  }

  /** Defeat sound */
  function playDefeat() {
    if (!ctx || !enabled) return;
    [400, 300, 200].forEach((f, i) => playTone(f, 'sawtooth', 0.4, 0.3, i * 0.2));
  }

  /** Cyberpunk ambient drone */
  function startAmbient() {
    if (!ctx) return;
    // Low drone
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo  = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const ambGain = ctx.createGain();

    osc1.type = 'sawtooth'; osc1.frequency.value = 55;
    osc2.type = 'sine';     osc2.frequency.value = 82.5;
    lfo.type  = 'sine';     lfo.frequency.value = 0.1;

    lfoGain.gain.value = 10;
    ambGain.gain.value = 0.04;

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    osc1.connect(ambGain);
    osc2.connect(ambGain);
    ambGain.connect(masterGain);

    osc1.start(); osc2.start(); lfo.start();
    ambientOscillators = [osc1, osc2, lfo];
  }

  function setEnabled(v) {
    enabled = v;
    if (masterGain) masterGain.gain.value = v ? 0.4 : 0;
  }

  return {
    init, setEnabled,
    playGunshot, playSwordSwing, playHit, playFootstep,
    playDamage, playVictory, playDefeat
  };
})();
