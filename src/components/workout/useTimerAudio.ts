// Web Audio API beep generator — LOUD enough to cut through music
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function beep(freq: number, duration: number, type: OscillatorType = "square", gain = 0.8) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  // Add a compressor so it punches through background audio
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 0;
  compressor.ratio.value = 20;
  compressor.attack.value = 0;
  compressor.release.value = 0.05;

  osc.type = type;
  osc.frequency.value = freq;
  gainNode.gain.value = gain;
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gainNode).connect(compressor).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Loud countdown beep (3-2-1) */
export function countdownBeep() {
  beep(880, 0.15, "square", 0.9);
}

/** Long beep — start of WORK */
export function workBeep() {
  // Double-layered for volume
  beep(1200, 0.5, "sine", 0.9);
  beep(1200, 0.5, "square", 0.4);
}

/** Double beep — start of REST */
export function restBeep() {
  beep(600, 0.18, "square", 0.9);
  setTimeout(() => beep(600, 0.18, "square", 0.9), 200);
}

/** Triumphant chime — workout complete */
export function completeChime() {
  const ctx = getCtx();
  [523, 659, 784, 1047].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.value = 0.7;
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15 * (i + 1) + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + 0.15 * i);
    osc.stop(ctx.currentTime + 0.15 * (i + 1) + 0.5);
  });
}
