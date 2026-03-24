import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { X, Play, Pause, RotateCcw, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  countdownBeep, workBeep, restBeep, warningBeep, completeChime,
  setMasterVolume, getMasterVolume, testBeep,
} from "./useTimerAudio";

function vibrate(pattern: number | number[]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

type Phase = "idle" | "prep" | "work" | "rest" | "done";

export interface TimerConfig {
  prep: number;
  work: number;
  rest: number;
  rounds: number;
  warning: number;
}

const PRESETS: { label: string; config: TimerConfig }[] = [
  { label: "Tabata", config: { prep: 10, work: 20, rest: 10, rounds: 8, warning: 5 } },
  { label: "EMOM", config: { prep: 10, work: 60, rest: 0, rounds: 10, warning: 10 } },
  { label: "Boxing", config: { prep: 10, work: 180, rest: 60, rounds: 12, warning: 10 } },
];

/* ── Random visual skins ── */
interface TimerSkin {
  name: string;
  icon: string;
  idle: string;
  prep: string;
  work: string;
  rest: string;
  done: string;
  accent: string;
  ring: string;
}

const SKINS: TimerSkin[] = [
  { name: "M² Performance", icon: "🏋️", idle: "#0d0d0d", prep: "#92400e", work: "#15803d", rest: "#b91c1c", done: "#ea580c", accent: "#f97316", ring: "#f97316" },
  { name: "Wild Tiger", icon: "🐯", idle: "#1c1208", prep: "#92400e", work: "#c2410c", rest: "#78350f", done: "#d97706", accent: "#fbbf24", ring: "#f59e0b" },
  { name: "Deep Space", icon: "🚀", idle: "#030318", prep: "#4c1d95", work: "#155e75", rest: "#312e81", done: "#0891b2", accent: "#22d3ee", ring: "#06b6d4" },
  { name: "Cobra Strike", icon: "🐍", idle: "#022c22", prep: "#3f6212", work: "#166534", rest: "#134e4a", done: "#65a30d", accent: "#a3e635", ring: "#84cc16" },
  { name: "Supernova", icon: "✨", idle: "#1a0526", prep: "#86198f", work: "#c2410c", rest: "#581c87", done: "#d946ef", accent: "#e879f9", ring: "#d946ef" },
  { name: "Arctic Wolf", icon: "❄️", idle: "#0c1929", prep: "#0369a1", work: "#0f766e", rest: "#1e3a5f", done: "#0ea5e9", accent: "#7dd3fc", ring: "#38bdf8" },
];

function getRandomSkin(): TimerSkin {
  return SKINS[Math.floor(Math.random() * SKINS.length)];
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

/* ── Inline editable value ── */
const EditableValue = forwardRef<HTMLButtonElement, {
  value: number; onChange: (v: number) => void; isTime?: boolean; disabled?: boolean;
}>(({ value, onChange, isTime, disabled }, _ref) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => { if (disabled) return; setDraft(String(value)); setEditing(true); };
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 0) onChange(isTime ? Math.min(n, 3600) : Math.max(1, Math.min(n, 999)));
  };

  if (editing) {
    return (
      <input ref={inputRef} type="number" inputMode="numeric" value={draft}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="font-mono text-sm font-bold text-white w-12 text-center bg-white/10 border border-white/30 outline-none px-1 py-1 rounded"
      />
    );
  }
  return (
    <button onClick={startEdit}
      className="font-mono text-sm font-bold text-white w-12 text-center hover:text-white/60 transition-colors cursor-text tabular-nums">
      {isTime ? formatTime(value) : value}
    </button>
  );
});
EditableValue.displayName = "EditableValue";

interface IntervalTimerProps {
  onClose: () => void;
  initialConfig?: TimerConfig;
  exercises?: string[];
  isCircuit?: boolean;
}

const IntervalTimer = ({ onClose, initialConfig, exercises: circuitExercises, isCircuit }: IntervalTimerProps) => {
  const [config, setConfig] = useState<TimerConfig>(initialConfig ?? { prep: 5, work: 45, rest: 15, rounds: 5, warning: 10 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [volume, setVolume] = useState(() => getMasterVolume() * 100);
  const [warningFired, setWarningFired] = useState(false);
  const [skin] = useState<TimerSkin>(() => getRandomSkin());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetTimeRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const secondsRef = useRef(0);
  const roundRef = useRef(0);
  const configRef = useRef(config);
  const warningFiredRef = useRef(false);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { secondsRef.current = secondsLeft; }, [secondsLeft]);
  useEffect(() => { roundRef.current = currentRound; }, [currentRound]);
  useEffect(() => { warningFiredRef.current = warningFired; }, [warningFired]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const transitionPhase = useCallback((nextPhase: Phase, duration: number, round: number) => {
    setPhase(nextPhase);
    setSecondsLeft(duration);
    setCurrentRound(round);
    setWarningFired(false);
    warningFiredRef.current = false;
    secondsRef.current = duration;
    phaseRef.current = nextPhase;
    roundRef.current = round;

    if (nextPhase === "work") { workBeep(); vibrate(300); }
    else if (nextPhase === "rest") { restBeep(); vibrate([100, 80, 100]); }
    else if (nextPhase === "done") {
      completeChime(); vibrate([100, 60, 100, 60, 300]);
      stopInterval(); setRunning(false);
    }
  }, [stopInterval]);

  const tick = useCallback(() => {
    const s = secondsRef.current;
    const p = phaseRef.current;
    const r = roundRef.current;
    const c = configRef.current;

    if (s <= 0) {
      if (p === "prep") transitionPhase("work", c.work, 1);
      else if (p === "work") {
        if (c.rest > 0) transitionPhase("rest", c.rest, r);
        else if (r < c.rounds) transitionPhase("work", c.work, r + 1);
        else transitionPhase("done", 0, r);
      } else if (p === "rest") {
        if (r < c.rounds) transitionPhase("work", c.work, r + 1);
        else transitionPhase("done", 0, r);
      }
      return;
    }

    if (p === "work" && c.warning > 0 && s === c.warning && !warningFiredRef.current) {
      warningBeep(); vibrate(200);
      warningFiredRef.current = true;
      setWarningFired(true);
    }

    if (s <= 3 && s > 0) { countdownBeep(); vibrate(50); }

    const next = s - 1;
    secondsRef.current = next;
    setSecondsLeft(next);
  }, [transitionPhase]);

  const startTimer = useCallback(() => {
    if (phase === "idle" || phase === "done") transitionPhase("prep", config.prep, 0);
    setRunning(true);
    stopInterval();
    targetTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      if (Date.now() - targetTimeRef.current >= 1000) {
        targetTimeRef.current += 1000;
        tick();
      }
    }, 100);
  }, [phase, config, tick, transitionPhase, stopInterval]);

  const pauseTimer = useCallback(() => { setRunning(false); stopInterval(); }, [stopInterval]);

  const resetTimer = useCallback(() => {
    stopInterval(); setRunning(false); setPhase("idle"); setSecondsLeft(0); setCurrentRound(0);
  }, [stopInterval]);

  // Wake Lock
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const acquire = async () => {
      if (running && "wakeLock" in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request("screen"); } catch {}
      }
    };
    const release = () => { wakeLockRef.current?.release(); wakeLockRef.current = null; };
    if (running) acquire(); else release();
    return release;
  }, [running]);

  useEffect(() => () => stopInterval(), [stopInterval]);

  const adjust = (field: keyof TimerConfig, delta: number) => {
    if (running) return;
    setConfig((c) => ({ ...c, [field]: Math.max(field === "rounds" ? 1 : 0, c[field] + delta) }));
  };

  const setField = (field: keyof TimerConfig, value: number) => {
    if (running) return;
    setConfig((c) => ({ ...c, [field]: value }));
  };

  const isSetup = phase === "idle" || phase === "done";
  const displayTime = isSetup ? formatTime(config.work) : formatTime(secondsLeft);

  // Progress ring
  const totalWorkoutSeconds = config.rounds * (config.work + config.rest) + config.prep;
  const elapsedSeconds = (() => {
    if (phase === "idle") return 0;
    if (phase === "done") return totalWorkoutSeconds;
    const completedRounds = Math.max(0, currentRound - 1);
    const roundTime = config.work + config.rest;
    let elapsed = config.prep - (phase === "prep" ? secondsLeft : 0);
    if (phase !== "prep") {
      elapsed = config.prep + completedRounds * roundTime;
      if (phase === "work") elapsed += config.work - secondsLeft;
      if (phase === "rest") elapsed += config.work + (config.rest - secondsLeft);
    }
    return elapsed;
  })();
  const totalProgress = totalWorkoutSeconds > 0 ? (elapsedSeconds / totalWorkoutSeconds) : 0;

  const inWarningZone = phase === "work" && config.warning > 0 && secondsLeft <= config.warning && secondsLeft > 0;

  const phaseColor = phase === "work" ? skin.accent : phase === "rest" ? "#ef4444" : phase === "prep" ? "#eab308" : skin.accent;
  const phaseLabel = phase === "idle" ? "READY" : phase === "prep" ? "GET READY" : phase === "work" ? "WORK" : phase === "rest" ? "REST" : "COMPLETE";

  // SVG ring
  const RING_R = 110;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C * (1 - totalProgress);

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col overflow-hidden"
      style={{ background: skin[phase === "done" ? "done" : phase === "idle" ? "idle" : phase] || skin.idle }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{skin.icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">{skin.name}</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Main timer area */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
        {/* Progress ring */}
        <div className="relative">
          <svg width="260" height="260" viewBox="0 0 260 260" className="drop-shadow-lg">
            {/* Track */}
            <circle cx="130" cy="130" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            {/* Progress */}
            <circle
              cx="130" cy="130" r={RING_R} fill="none"
              stroke={phaseColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 130 130)"
              className="transition-all duration-300"
              style={{ filter: `drop-shadow(0 0 8px ${phaseColor}50)` }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1"
              style={{ color: phaseColor }}
            >
              {phaseLabel}
            </span>

            {phase !== "done" ? (
              <>
                <span
                  className={cn(
                    "font-mono text-6xl font-black text-white tabular-nums leading-none",
                    inWarningZone && "animate-pulse"
                  )}
                  style={inWarningZone ? { color: "#fbbf24" } : undefined}
                >
                  {displayTime}
                </span>
                <span className="font-mono text-xs text-white/40 mt-2 tabular-nums">
                  {currentRound > 0 ? `${currentRound} / ${config.rounds}` : `${config.rounds} rounds`}
                </span>
              </>
            ) : (
              <>
                <span className="text-4xl mb-1">{skin.icon}</span>
                <span className="text-sm font-black text-white uppercase tracking-wide">
                  {config.rounds} Rounds Done
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Controls — compact, single viewport */}
      <div className="shrink-0 px-4 pb-4 pt-2 space-y-2">
        {/* Config row — only in setup */}
        {isSetup && (
          <>
            <div className="flex gap-1.5">
              {([
                { key: "prep" as const, label: "PREP", isTime: true },
                { key: "work" as const, label: "WORK", isTime: true },
                { key: "rest" as const, label: "REST", isTime: true },
                { key: "rounds" as const, label: "RND", isTime: false },
              ]).map(({ key, label, isTime }) => (
                <div key={key} className="flex-1 flex flex-col items-center gap-1 bg-white/5 rounded-lg py-2">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">{label}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => adjust(key, isTime && config[key] >= 30 ? -5 : -1)}
                      className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white text-lg font-bold"
                    >−</button>
                    <EditableValue value={config[key]} onChange={(v) => setField(key, v)} isTime={isTime} disabled={running} />
                    <button
                      onClick={() => adjust(key, isTime && config[key] >= 25 ? 5 : 1)}
                      className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white text-lg font-bold"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Presets + volume in one row */}
            <div className="flex items-center gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => setConfig(p.config)}
                  className="flex-1 py-2 bg-white/5 text-white/50 text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-colors rounded-lg">
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-2">
                <Volume2 size={12} className="text-white/30" />
                <input type="range" min={0} max={200} step={5} value={volume}
                  onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMasterVolume(v / 100); }}
                  className="w-12 h-1 accent-white/50 cursor-pointer" />
                <button onClick={testBeep} className="text-[10px] text-white/30 hover:text-white/60">🔊</button>
              </div>
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!running ? (
            <button onClick={startTimer}
              className="flex-1 h-14 rounded-xl text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
              style={{ background: phaseColor, boxShadow: `0 0 20px ${phaseColor}40` }}
            >
              <Play size={18} fill="white" />
              {phase === "done" ? "AGAIN" : "START"}
            </button>
          ) : (
            <button onClick={pauseTimer}
              className="flex-1 h-14 rounded-xl bg-yellow-600 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-yellow-500 transition-all active:scale-[0.97]">
              <Pause size={18} fill="white" />
              PAUSE
            </button>
          )}
          <button onClick={resetTimer}
            className="h-14 w-14 rounded-xl bg-white/10 text-white/50 flex items-center justify-center hover:text-white hover:bg-white/15 transition-colors">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntervalTimer;
export { PRESETS };
