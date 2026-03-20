// Web Audio API beep generator — with adjustable master volume (0–2.0) and sound themes
let audioCtx: AudioContext | null = null;
let masterVolume = 1.0;
let currentTheme = "classic";

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

export function setSoundTheme(id: string) {
  currentTheme = id;
}
export function getSoundTheme(): string {
  return currentTheme;
}

/* ── Core beep helper ── */
function beep(freq: number, duration: number, type: OscillatorType = "square", gain = 0.8) {
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

/* ── Sound theme definitions ── */
export interface SoundThemeDef {
  id: string;
  label: string;
  countdown: () => void;
  work: () => void;
  rest: () => void;
  warning: () => void;
  complete: () => void;
}

const themes: SoundThemeDef[] = [
  {
    id: "classic", label: "Classic Beep",
    countdown: () => beep(880, 0.15, "square", 0.95),
    work: () => { beep(1200, 0.5, "sine", 0.95); beep(1200, 0.5, "square", 0.5); },
    rest: () => multiBeep(600, 0.18, "square", 0.95, 2, 200),
    warning: () => multiBeep(1000, 0.1, "sawtooth", 0.9, 3, 150),
    complete: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.4, "sine", 0.8), i * 150)),
  },
  {
    id: "boxing", label: "Boxing Bell",
    countdown: () => beep(400, 0.08, "triangle", 0.9),
    work: () => { beep(800, 0.6, "triangle", 0.95); beep(820, 0.6, "sine", 0.7); },
    rest: () => multiBeep(750, 0.5, "triangle", 0.9, 3, 180),
    warning: () => beep(700, 0.3, "triangle", 0.85),
    complete: () => multiBeep(800, 0.5, "triangle", 0.95, 5, 200),
  },
  {
    id: "whistle", label: "Whistle",
    countdown: () => beep(2200, 0.1, "sine", 0.8),
    work: () => beep(2600, 0.6, "sine", 0.95),
    rest: () => multiBeep(2000, 0.3, "sine", 0.9, 2, 250),
    warning: () => multiBeep(2400, 0.08, "sine", 0.9, 4, 120),
    complete: () => [2000, 2400, 2800, 3200].forEach((f, i) => setTimeout(() => beep(f, 0.3, "sine", 0.8), i * 120)),
  },
  {
    id: "airhorn", label: "Air Horn",
    countdown: () => beep(350, 0.12, "sawtooth", 0.9),
    work: () => { beep(220, 0.8, "sawtooth", 0.95); beep(225, 0.8, "sawtooth", 0.7); },
    rest: () => beep(180, 0.6, "sawtooth", 0.9),
    warning: () => beep(250, 0.4, "sawtooth", 0.85),
    complete: () => multiBeep(220, 0.6, "sawtooth", 0.95, 3, 300),
  },
  {
    id: "buzzer", label: "Buzzer",
    countdown: () => beep(200, 0.15, "square", 0.95),
    work: () => beep(150, 0.7, "square", 0.95),
    rest: () => multiBeep(300, 0.3, "square", 0.9, 2, 200),
    warning: () => multiBeep(250, 0.1, "square", 0.9, 5, 100),
    complete: () => beep(100, 1.0, "square", 0.9),
  },
  {
    id: "chime", label: "Digital Chime",
    countdown: () => beep(1400, 0.12, "sine", 0.85),
    work: () => [1047, 1319, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.3, "sine", 0.85), i * 100)),
    rest: () => [784, 659].forEach((f, i) => setTimeout(() => beep(f, 0.3, "sine", 0.8), i * 150)),
    warning: () => multiBeep(1200, 0.08, "sine", 0.9, 3, 140),
    complete: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.5, "sine", 0.8), i * 180)),
  },
  {
    id: "military", label: "Military",
    countdown: () => beep(500, 0.05, "square", 0.95),
    work: () => multiBeep(600, 0.08, "square", 0.95, 3, 80),
    rest: () => beep(400, 0.4, "square", 0.9),
    warning: () => multiBeep(550, 0.06, "square", 0.95, 5, 60),
    complete: () => multiBeep(700, 0.1, "square", 0.95, 6, 100),
  },
  {
    id: "arcade", label: "Arcade",
    countdown: () => beep(1600, 0.06, "square", 0.85),
    work: () => [800, 1000, 1200, 1600].forEach((f, i) => setTimeout(() => beep(f, 0.08, "square", 0.8), i * 60)),
    rest: () => [1200, 800].forEach((f, i) => setTimeout(() => beep(f, 0.1, "square", 0.8), i * 120)),
    warning: () => [1600, 1200, 1600].forEach((f, i) => setTimeout(() => beep(f, 0.05, "square", 0.9), i * 80)),
    complete: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.12, "square", 0.8), i * 80)),
  },
  {
    id: "zen", label: "Zen Bowl",
    countdown: () => beep(440, 0.3, "sine", 0.6),
    work: () => beep(528, 0.8, "sine", 0.7),
    rest: () => beep(396, 0.8, "sine", 0.6),
    warning: () => beep(480, 0.5, "sine", 0.65),
    complete: () => [396, 440, 528, 660].forEach((f, i) => setTimeout(() => beep(f, 0.8, "sine", 0.6), i * 300)),
  },
  {
    id: "stadium", label: "Stadium Horn",
    countdown: () => beep(300, 0.12, "sawtooth", 0.85),
    work: () => { beep(180, 1.0, "sawtooth", 0.9); beep(185, 1.0, "sawtooth", 0.6); },
    rest: () => beep(160, 0.6, "sawtooth", 0.8),
    warning: () => beep(200, 0.5, "sawtooth", 0.8),
    complete: () => multiBeep(180, 0.8, "sawtooth", 0.9, 3, 400),
  },
  {
    id: "doubletap", label: "Double Tap",
    countdown: () => beep(900, 0.05, "square", 0.9),
    work: () => multiBeep(1100, 0.06, "square", 0.95, 2, 60),
    rest: () => multiBeep(700, 0.06, "square", 0.9, 2, 80),
    warning: () => multiBeep(1000, 0.04, "square", 0.9, 4, 50),
    complete: () => multiBeep(1100, 0.06, "square", 0.95, 6, 70),
  },
  {
    id: "siren", label: "Siren Pulse",
    countdown: () => beep(800, 0.15, "sine", 0.85),
    work: () => { beep(600, 0.3, "sine", 0.9); setTimeout(() => beep(1200, 0.3, "sine", 0.9), 300); },
    rest: () => { beep(1200, 0.3, "sine", 0.8); setTimeout(() => beep(600, 0.3, "sine", 0.8), 300); },
    warning: () => multiBeep(900, 0.1, "sine", 0.85, 4, 120),
    complete: () => [600, 1200, 600, 1200, 600].forEach((f, i) => setTimeout(() => beep(f, 0.2, "sine", 0.8), i * 150)),
  },
  {
    id: "xylophone", label: "Xylophone",
    countdown: () => beep(1568, 0.1, "sine", 0.8),
    work: () => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.15, "sine", 0.8), i * 80)),
    rest: () => [1568, 1175, 784].forEach((f, i) => setTimeout(() => beep(f, 0.15, "sine", 0.75), i * 100)),
    warning: () => [1400, 1568, 1400].forEach((f, i) => setTimeout(() => beep(f, 0.08, "sine", 0.85), i * 90)),
    complete: () => [523, 659, 784, 988, 1175, 1568, 2093].forEach((f, i) => setTimeout(() => beep(f, 0.2, "sine", 0.8), i * 100)),
  },
  {
    id: "drumroll", label: "Drum Roll",
    countdown: () => beep(120, 0.08, "triangle", 0.9),
    work: () => multiBeep(100, 0.03, "triangle", 0.9, 12, 25),
    rest: () => multiBeep(80, 0.04, "triangle", 0.85, 6, 50),
    warning: () => multiBeep(100, 0.03, "triangle", 0.9, 8, 35),
    complete: () => { multiBeep(100, 0.02, "triangle", 0.9, 20, 20); setTimeout(() => beep(200, 0.5, "triangle", 0.95), 420); },
  },
  {
    id: "synthwave", label: "Synth Wave",
    countdown: () => beep(660, 0.12, "sawtooth", 0.7),
    work: () => { beep(440, 0.5, "sawtooth", 0.7); beep(880, 0.5, "sine", 0.5); },
    rest: () => beep(330, 0.5, "sawtooth", 0.6),
    warning: () => multiBeep(660, 0.1, "sawtooth", 0.75, 3, 130),
    complete: () => [330, 440, 660, 880, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.4, "sawtooth", 0.6), i * 200)),
  },
  {
    id: "metalclang", label: "Metal Clang",
    countdown: () => beep(3000, 0.04, "square", 0.9),
    work: () => { beep(2500, 0.08, "square", 0.95); beep(3500, 0.06, "square", 0.7); },
    rest: () => beep(2000, 0.08, "square", 0.9),
    warning: () => multiBeep(3000, 0.03, "square", 0.9, 5, 60),
    complete: () => multiBeep(2500, 0.08, "square", 0.9, 4, 150),
  },
  {
    id: "cricket", label: "Cricket",
    countdown: () => multiBeep(4000, 0.02, "sine", 0.7, 3, 30),
    work: () => multiBeep(4200, 0.02, "sine", 0.8, 8, 25),
    rest: () => multiBeep(3800, 0.02, "sine", 0.7, 4, 40),
    warning: () => multiBeep(4500, 0.015, "sine", 0.8, 10, 20),
    complete: () => multiBeep(4200, 0.02, "sine", 0.8, 20, 30),
  },
  {
    id: "foghorn", label: "Foghorn",
    countdown: () => beep(110, 0.2, "sawtooth", 0.85),
    work: () => { beep(85, 1.2, "sawtooth", 0.95); beep(87, 1.2, "sawtooth", 0.6); },
    rest: () => beep(75, 0.8, "sawtooth", 0.85),
    warning: () => beep(95, 0.5, "sawtooth", 0.85),
    complete: () => multiBeep(85, 1.0, "sawtooth", 0.9, 2, 500),
  },
  {
    id: "laser", label: "Laser",
    countdown: () => beep(3000, 0.08, "sawtooth", 0.8),
    work: () => { beep(4000, 0.15, "sawtooth", 0.9); setTimeout(() => beep(800, 0.15, "sawtooth", 0.7), 50); },
    rest: () => { beep(800, 0.15, "sawtooth", 0.8); setTimeout(() => beep(3000, 0.1, "sawtooth", 0.6), 50); },
    warning: () => multiBeep(3500, 0.06, "sawtooth", 0.85, 3, 100),
    complete: () => [4000, 3000, 2000, 1000, 500].forEach((f, i) => setTimeout(() => beep(f, 0.1, "sawtooth", 0.8), i * 80)),
  },
  {
    id: "sonar", label: "Sonar Ping",
    countdown: () => beep(1500, 0.15, "sine", 0.75),
    work: () => beep(1800, 0.3, "sine", 0.85),
    rest: () => beep(1200, 0.3, "sine", 0.75),
    warning: () => multiBeep(1600, 0.12, "sine", 0.8, 3, 200),
    complete: () => [1200, 1500, 1800, 2100].forEach((f, i) => setTimeout(() => beep(f, 0.25, "sine", 0.75), i * 250)),
  },
];

function getTheme(): SoundThemeDef {
  return themes.find((t) => t.id === currentTheme) || themes[0];
}

export const SOUND_THEMES = themes.map((t) => ({ id: t.id, label: t.label }));

/* ── Public API (delegates to current theme) ── */
export function countdownBeep() { getTheme().countdown(); }
export function workBeep() { getTheme().work(); }
export function restBeep() { getTheme().rest(); }
export function warningBeep() { getTheme().warning(); }
export function completeChime() { getTheme().complete(); }

/** Play a quick test beep at current volume using current theme */
export function testBeep() { getTheme().countdown(); }
