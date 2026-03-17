// Web Audio API beep generator — no external files needed
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function beep(freq: number, duration: number, type: OscillatorType = "square") {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.3;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Three short countdown beeps (3-2-1) */
export function countdownBeep() {
  beep(880, 0.1);
}

/** Long beep — start of WORK */
export function workBeep() {
  beep(1200, 0.4, "sine");
}

/** Double beep — start of REST */
export function restBeep() {
  beep(600, 0.12, "square");
  setTimeout(() => beep(600, 0.12, "square"), 180);
}

/** Triumphant chime — workout complete */
export function completeChime() {
  const ctx = getCtx();
  [523, 659, 784, 1047].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.value = 0.25;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15 * (i + 1) + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + 0.15 * i);
    osc.stop(ctx.currentTime + 0.15 * (i + 1) + 0.4);
  });
}
