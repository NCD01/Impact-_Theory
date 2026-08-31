/**
 * audio.js
 *
 * OWNS: every sound the game makes, and the mute state's effect on them.
 *
 * MUST NOT OWN: when a sound should play. The game layer decides that and calls in with
 * an impact energy and a material family; this file decides what that sounds like.
 *
 * WHY THE SOUNDS ARE SYNTHESISED RATHER THAN SOURCED.
 *
 * The brief asks for CC0 audio with every file in the manifest with its licence. This
 * build synthesises every sound with the Web Audio API instead, and the reason is the
 * licence rule rather than laziness: "no asset ships without a licence you read". In an
 * unattended session there is nobody to confirm that a pack found at three in the
 * morning is really CC0, that its own README does not carry an attribution requirement,
 * or that a sample inside it was not lifted from somewhere else. Audio generated from
 * arithmetic has no licence question at all, ships no bytes, and cannot be the thing
 * that makes this game unpublishable.
 *
 * It also earns something the brief's hardest requirement wants. An impact sound built
 * from a noise burst and a tuned resonance can be scaled continuously by impact energy
 * and shaped per material family, so a graze and a square hit on stone are genuinely
 * different sounds rather than the same sample at two volumes.
 *
 * Recorded as decision D-008 in docs/DECISIONS.md.
 *
 * Everything here is created lazily on the first sound, because browsers refuse to start
 * an AudioContext until the user has interacted with the page, and an AudioContext
 * created at load time on a phone stays suspended forever.
 */

import { AUDIO } from '../core/constants.js';

/**
 * Per family voicing for an impact.
 *
 * `freq` is the resonant frequency in hertz, which is what makes wood sound hollow and
 * stone sound dead. `decay` is the seconds the body of the sound takes to fall away.
 * `noise` is how much of the sound is broadband crack rather than tone, so brick and
 * concrete read as gritty while steel reads as a ring.
 */
const VOICES = {
  wood: { freq: 210, decay: 0.16, noise: 0.5, q: 6, tone: 'triangle' },
  brick: { freq: 150, decay: 0.13, noise: 0.75, q: 3, tone: 'square' },
  stone: { freq: 110, decay: 0.12, noise: 0.8, q: 2.5, tone: 'square' },
  concrete: { freq: 128, decay: 0.14, noise: 0.78, q: 2.8, tone: 'square' },
  steel: { freq: 520, decay: 0.55, noise: 0.25, q: 18, tone: 'sine' },
  paintedSteel: { freq: 430, decay: 0.4, noise: 0.35, q: 12, tone: 'sine' },
  rubber: { freq: 90, decay: 0.09, noise: 0.35, q: 4, tone: 'sine' },
};

const DEFAULT_VOICE = { freq: 180, decay: 0.15, noise: 0.6, q: 5, tone: 'triangle' };

/**
 * Creates the audio system.
 *
 * Assumes a browser with Web Audio. If the context cannot be created at all, every
 * method becomes a no-op and `available` is false, so a browser with audio blocked plays
 * the game silently rather than failing to start.
 */
export function createAudio() {
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let master = null;
  let muted = false;
  let available = true;
  let noiseBuffer = null;

  /** Impacts started this frame, reset by the game loop, so a collapse cannot clip. */
  let impactsThisFrame = 0;
  /** Last start time per family, so the same family cannot machine gun. */
  const lastImpactAt = new Map();

  let musicNodes = null;

  /**
   * Creates the context on first use.
   *
   * Must be called from inside a user gesture the first time, or the context starts
   * suspended. The game calls `resume()` from the first tap for exactly that reason.
   */
  function ensure() {
    if (ctx || !available) return ctx;
    try {
      const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Ctor) { available = false; return null; }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : AUDIO.MASTER_GAIN;
      master.connect(ctx.destination);
      noiseBuffer = makeNoiseBuffer(ctx);
    } catch {
      available = false;
      ctx = null;
    }
    return ctx;
  }

  /** One second of white noise, reused by every percussive sound. */
  function makeNoiseBuffer(context) {
    const buf = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /**
   * Resumes a suspended context. Call from the first user gesture.
   * Safe to call repeatedly and when audio is unavailable.
   */
  function resume() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  /** Called once per frame by the game loop, to reset the per frame impact budget. */
  function beginFrame() {
    impactsThisFrame = 0;
  }

  function setMuted(value) {
    muted = value === true;
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0 : AUDIO.MASTER_GAIN, ctx.currentTime, 0.02);
    }
  }

  /**
   * Plays an impact, scaled by energy and voiced by material family.
   *
   * Assumes `energy` is joules from the physics layer. Impacts below the floor are
   * silent, matching the damage floor exactly, so anything that does no damage also
   * makes no sound. Returns false when the sound was declined, which happens when the
   * per frame budget is spent or the same family retriggered too soon; a collapse
   * produces dozens of contacts per frame and playing all of them clips the output into
   * a wall of noise.
   *
   * @param {number} energy Joules.
   * @param {string} familyId
   * @returns {boolean} Whether a sound started.
   */
  function impact(energy, familyId) {
    if (muted || energy < AUDIO.IMPACT_MIN_ENERGY_J) return false;
    if (impactsThisFrame >= AUDIO.MAX_IMPACTS_PER_FRAME) return false;
    const c = ensure();
    if (!c) return false;

    const now = c.currentTime;
    const last = lastImpactAt.get(familyId) ?? -Infinity;
    if (now - last < AUDIO.IMPACT_RETRIGGER_S) return false;
    lastImpactAt.set(familyId, now);
    impactsThisFrame += 1;

    const voice = VOICES[familyId] ?? DEFAULT_VOICE;
    // Loudness rises with energy but flattens out, so a huge hit is clearly bigger than
    // a medium one without a collapse becoming painful. Square root rather than linear.
    const t = Math.min(1, energy / AUDIO.IMPACT_FULL_VOLUME_ENERGY_J);
    const level = Math.min(1, Math.sqrt(t)) * 0.9;
    // A harder hit also rings a little higher, the way a struck object does.
    const freq = voice.freq * (0.85 + t * 0.4);

    const out = c.createGain();
    out.gain.value = level;
    out.connect(master);

    // Percussive noise burst, band passed at the family's resonance.
    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = freq * 2.4;
    band.Q.value = 1.2;
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(voice.noise, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + voice.decay * 0.7);
    noise.connect(band).connect(noiseGain).connect(out);
    noise.start(now);
    noise.stop(now + voice.decay + 0.05);

    // Tuned body, which is what carries the material's identity.
    const osc = c.createOscillator();
    osc.type = voice.tone;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + voice.decay);
    const ring = c.createBiquadFilter();
    ring.type = 'bandpass';
    ring.frequency.value = freq;
    ring.Q.value = voice.q;
    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(1 - voice.noise * 0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + voice.decay);
    osc.connect(ring).connect(oscGain).connect(out);
    osc.start(now);
    osc.stop(now + voice.decay + 0.05);

    return true;
  }

  /** The cannon firing. A low thump with a bright transient on top. */
  function fire() {
    const c = ensure();
    if (!c || muted) return;
    const now = c.currentTime;
    const out = c.createGain();
    out.gain.value = 0.5;
    out.connect(master);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    const g = c.createGain();
    g.gain.setValueAtTime(1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + 0.3);

    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.5, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    noise.connect(hp).connect(ng).connect(out);
    noise.start(now);
    noise.stop(now + 0.12);
  }

  /** A piece breaking apart. Sharper and grittier than an impact. */
  function fracture(familyId) {
    const c = ensure();
    if (!c || muted) return;
    const voice = VOICES[familyId] ?? DEFAULT_VOICE;
    const now = c.currentTime;
    const out = c.createGain();
    out.gain.value = 0.55;
    out.connect(master);

    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.playbackRate.value = 0.7 + Math.random() * 0.6;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(voice.freq * 5, now);
    band.frequency.exponentialRampToValueAtTime(voice.freq * 1.5, now + 0.3);
    band.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.9, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    noise.connect(band).connect(g).connect(out);
    noise.start(now);
    noise.stop(now + 0.36);
  }

  /** A low rumble under a large collapse. Called once per collapse, not per piece. */
  function rumble(intensity = 1) {
    const c = ensure();
    if (!c || muted) return;
    const now = c.currentTime;
    const out = c.createGain();
    out.gain.value = 0.4 * Math.min(1, intensity);
    out.connect(master);

    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, now);
    lp.frequency.exponentialRampToValueAtTime(60, now + 1.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.8, now + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    noise.connect(lp).connect(g).connect(out);
    noise.start(now);
    noise.stop(now + 1.3);
  }

  /** The level cleared sting. A short rising arpeggio, deliberately cheerful. */
  function levelClear() {
    const c = ensure();
    if (!c || muted) return;
    const now = c.currentTime;
    // A major triad plus the octave. Simple, and it reads as a win to a six year old.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = now + i * 0.09;
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  /** A soft descending pair for a failed level. Not a punishment, just a full stop. */
  function levelFailed() {
    const c = ensure();
    if (!c || muted) return;
    const now = c.currentTime;
    [392, 311].forEach((f, i) => {
      const t = now + i * 0.14;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  /** A short blip for an interface press. */
  function uiTap() {
    const c = ensure();
    if (!c || muted) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Starts the background track: a slow two chord pad that loops indefinitely.
   *
   * Deliberately sparse. A repeating melody becomes unbearable on the twentieth replay
   * of a level, and this game is meant to be replayed.
   */
  function startMusic() {
    const c = ensure();
    if (!c || musicNodes) return;
    const gain = c.createGain();
    gain.gain.value = muted ? 0 : AUDIO.MUSIC_GAIN;
    gain.connect(master);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(gain);

    // Two detuned oscillators per note give the pad movement without a sample.
    const voices = [110, 164.81, 220].flatMap((f) => [f, f * 1.004].map((freq) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = 0.12;
      osc.connect(g).connect(lp);
      osc.start();
      return { osc, g };
    }));

    // A slow filter sweep, so the pad breathes rather than sitting still.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 340;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    musicNodes = { gain, voices, lfo };
  }

  function stopMusic() {
    if (!musicNodes || !ctx) return;
    const now = ctx.currentTime;
    musicNodes.gain.gain.setTargetAtTime(0, now, 0.3);
    const nodes = musicNodes;
    musicNodes = null;
    setTimeout(() => {
      for (const v of nodes.voices) { try { v.osc.stop(); } catch { /* already stopped */ } }
      try { nodes.lfo.stop(); } catch { /* already stopped */ }
    }, 1200);
  }

  return {
    resume,
    beginFrame,
    setMuted,
    impact,
    fire,
    fracture,
    rumble,
    levelClear,
    levelFailed,
    uiTap,
    startMusic,
    stopMusic,
    get available() { return available; },
    get muted() { return muted; },
  };
}
