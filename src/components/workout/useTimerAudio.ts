// Web Audio API beep generator — with adjustable master volume (0–2.0)
let audioCtx: AudioContext | null = null;
let masterVolume = 1.0;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/** Set the master volume multiplier (0.0 = mute, 1.0 = normal, 2.0 = max boost) */
export function setMasterVolume(v: number) {
  masterVolume = Math.max(0, Math.min(2.0, v));
}

export function getMasterVolume(): number {
  return masterVolume;
}

function beep(freq: number, duration: number, type: OscillatorType = "square", gain = 0.8) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  // Compressor to punch through background audio
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 0;
  compressor.ratio.value = 20;
  compressor.attack.value = 0;
  compressor.release.value = 0.05;

  osc.type = type;
  osc.frequency.value = freq;
  const effectiveGain = Math.min(gain * masterVolume, 1.0);
  gainNode.gain.value = effectiveGain;
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gainNode).connect(compressor).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Loud countdown beep (3-2-1) */
export function countdownBeep() {
  beep(880, 0.15, "square", 0.95);
}

/** Long beep — start of WORK */
export function workBeep() {
  // Triple-layered for maximum volume
  beep(1200, 0.5, "sine", 0.95);
  beep(1200, 0.5, "square", 0.5);
  beep(1200, 0.5, "sawtooth", 0.3);
}

/** Double beep — start of REST */
export function restBeep() {
  beep(600, 0.18, "square", 0.95);
  setTimeout(() => beep(600, 0.18, "square", 0.95), 200);
}

/** Triumphant chime — workout complete */
export function completeChime() {
  const ctx = getCtx();
  [523, 659, 784, 1047].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const effectiveGain = Math.min(0.8 * masterVolume, 1.0);
    gain.gain.value = effectiveGain;
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15 * (i + 1) + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + 0.15 * i);
    osc.stop(ctx.currentTime + 0.15 * (i + 1) + 0.5);
  });
}

/** Play a quick test beep at current volume */
export function testBeep() {
  beep(1000, 0.25, "square", 0.9);
}
