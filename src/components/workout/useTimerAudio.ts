// Web Audio API — single clean sound set, no themes
let audioCtx: AudioContext | null = null;
let masterVolume = 1.0;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function setMasterVolume(v: number) {
  masterVolume = Math.max(0, Math.min(2.0, v));
}
export function getMasterVolume(): number {
  return masterVolume;
}

function beep(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.8) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
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

function multiBeep(freq: number, dur: number, type: OscillatorType, gain: number, count: number, gap: number) {
  for (let i = 0; i < count; i++) setTimeout(() => beep(freq, dur, type, gain), i * gap);
}

/* Clean, minimal sound set */
export function countdownBeep() { beep(880, 0.12, "sine", 0.9); }
export function workBeep() { beep(1200, 0.4, "sine", 0.95); }
export function restBeep() { multiBeep(600, 0.15, "sine", 0.9, 2, 180); }
export function warningBeep() { multiBeep(1000, 0.08, "sine", 0.85, 3, 140); }
export function completeChime() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.35, "sine", 0.8), i * 140));
}
export function testBeep() { countdownBeep(); }
