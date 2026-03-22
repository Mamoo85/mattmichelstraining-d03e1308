import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { X, Minus, Plus, Play, Pause, RotateCcw, Volume2 } from "lucide-react";
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

const phaseColors: Record<Phase, string> = {
  idle: "bg-card",
  prep: "bg-yellow-600",
  work: "bg-green-700",
  rest: "bg-red-700",
  done: "bg-primary",
};

const phaseLabels: Record<Phase, string> = {
  idle: "READY",
  prep: "PREP",
  work: "WORK",
  rest: "REST",
  done: "DONE!",
};

const COACH_MESSAGES = [
  "Beast mode. That's how it's done. 🔥",
  "Crushed it. No shortcuts, no excuses.",
  "That's the work right there. Earned, not given.",
  "Another one in the bank. You're building something.",
  "Nothing worth having comes easy. You just proved it.",
  "Relentless. That's your superpower.",
  "Champions train when nobody's watching. You just did.",
  "The grind doesn't lie. Neither do your results.",
  "You showed up. You finished. That's 90% of the battle.",
  "One more session stronger than yesterday. Keep stacking.",
];

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

/* ── Editable number field ── */
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
        className="font-mono text-lg font-bold text-foreground w-16 text-center tabular-nums bg-background border border-primary outline-none px-1 py-0.5 min-h-[44px]"
      />
    );
  }
  return (
    <button onClick={startEdit}
      className="font-mono text-lg font-bold text-foreground w-16 text-center tabular-nums hover:text-primary transition-colors cursor-text min-h-[44px] min-w-[44px]">
      {isTime ? formatTime(value) : value}
    </button>
  );
});
EditableValue.displayName = "EditableValue";

interface IntervalTimerProps {
  onClose: () => void;
  initialConfig?: TimerConfig;
}

const IntervalTimer = ({ onClose, initialConfig }: IntervalTimerProps) => {
  const [config, setConfig] = useState<TimerConfig>(initialConfig ?? { prep: 5, work: 45, rest: 15, rounds: 5, warning: 10 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [volume, setVolume] = useState(() => getMasterVolume() * 100);
  const [coachMsg] = useState(() => COACH_MESSAGES[Math.floor(Math.random() * COACH_MESSAGES.length)]);
  const [warningFired, setWarningFired] = useState(false);

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

  // Progress
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
  const totalProgress = totalWorkoutSeconds > 0 ? (elapsedSeconds / totalWorkoutSeconds) * 100 : 0;

  const roundProgress = (() => {
    if (phase === "prep" || phase === "idle" || phase === "done") return 0;
    const roundTotal = config.work + config.rest;
    if (roundTotal === 0) return 0;
    const inRound = phase === "work" ? (config.work - secondsLeft) : (config.work + config.rest - secondsLeft);
    return (inRound / roundTotal) * 100;
  })();

  const inWarningZone = phase === "work" && config.warning > 0 && secondsLeft <= config.warning && secondsLeft > 0;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col animate-slide-in-right" style={{ animationDuration: "0.25s" }}>
      {/* Header */}
      <button onClick={onClose}
        className="flex items-center justify-between px-4 bg-card border-b border-border shrink-0"
        style={{ minHeight: 56 }}>
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Interval Timer</span>
        <span className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <span className="text-xs font-bold uppercase tracking-widest">Exit</span>
          <X size={22} />
        </span>
      </button>

      {/* Timer display */}
      <div className={cn(
        "flex-1 flex flex-col items-center justify-center relative transition-colors duration-300",
        phaseColors[phase],
        inWarningZone && "animate-pulse"
      )}>
        {inWarningZone && (
          <div className="absolute inset-0 border-4 border-yellow-400/60 pointer-events-none animate-pulse" />
        )}

        <span className="text-sm font-bold uppercase tracking-[0.3em] text-white/80 mb-1">
          {phaseLabels[phase]}
        </span>
        {phase !== "done" && (
          <span className="text-xs font-mono text-white/60 mb-2">
            Round {String(currentRound).padStart(3, "0")} / {String(config.rounds).padStart(3, "0")}
          </span>
        )}

        <span className={cn(
          "font-mono text-[min(30vw,160px)] leading-none font-black text-white tabular-nums drop-shadow-lg",
          inWarningZone && "text-yellow-300"
        )}>
          {phase === "done" ? "" : displayTime}
        </span>

        {inWarningZone && (
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-300 mt-2 animate-pulse">
            ⚡ {secondsLeft}s remaining
          </span>
        )}

        {!isSetup && !inWarningZone && (
          <div className="w-full px-6 mt-4 space-y-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Round Progress</span>
              <div className="w-full h-2 bg-black/30 mt-1 overflow-hidden">
                <div className="h-full bg-white/70 transition-all duration-300" style={{ width: `${roundProgress}%` }} />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Total Workout</span>
              <div className="w-full h-2 bg-black/30 mt-1 overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${totalProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Completion screen */}
        {phase === "done" && (
          <div className="flex flex-col items-center text-center px-6 max-w-sm">
            <span className="text-5xl mb-3">🔥</span>
            <span className="text-2xl font-black text-white uppercase tracking-wide mb-2">
              All {config.rounds} Rounds Complete
            </span>
            <p className="text-base font-bold text-white/90 mb-4 italic">
              "{coachMsg}"
            </p>
            <div className="bg-black/30 border border-white/20 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Coach Matt Says</p>
              <p className="text-sm text-white/90 leading-relaxed">
                Next session — flip the script. Go from endurance to strength, or strength to endurance. 
                Balance builds champions. That's the M² way.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-background p-4 space-y-3 overflow-y-auto max-h-[55vh]">
        {isSetup && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "prep" as const, label: "Prep", isTime: true },
                { key: "work" as const, label: "Work", isTime: true },
                { key: "rest" as const, label: "Rest", isTime: true },
                { key: "rounds" as const, label: "Rounds", isTime: false },
              ]).map(({ key, label, isTime }) => (
                <div key={key} className="bg-card border border-border p-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => adjust(key, isTime && config[key] >= 30 ? -5 : -1)}
                      className="w-10 h-10 flex items-center justify-center bg-muted text-foreground hover:bg-muted-foreground/20 transition-colors active:scale-95">
                      <Minus size={18} />
                    </button>
                    <EditableValue value={config[key]} onChange={(v) => setField(key, v)} isTime={isTime} disabled={running} />
                    <button onClick={() => adjust(key, isTime && config[key] >= 25 ? 5 : 1)}
                      className="w-10 h-10 flex items-center justify-center bg-muted text-foreground hover:bg-muted-foreground/20 transition-colors active:scale-95">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Warning time */}
            <div className="bg-card border border-border p-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-yellow-500 text-sm">⚡</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Warning (sec before end)</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => adjust("warning", -1)}
                  className="w-10 h-10 flex items-center justify-center bg-muted text-foreground hover:bg-muted-foreground/20 transition-colors active:scale-95">
                  <Minus size={18} />
                </button>
                <EditableValue value={config.warning} onChange={(v) => setField("warning", v)} isTime={false} disabled={running} />
                <button onClick={() => adjust("warning", 1)}
                  className="w-10 h-10 flex items-center justify-center bg-muted text-foreground hover:bg-muted-foreground/20 transition-colors active:scale-95">
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Volume */}
            <div className="bg-card border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Volume2 size={14} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Volume</span>
                </div>
                <span className="font-mono text-sm font-bold text-foreground tabular-nums">{Math.round(volume)}%</span>
              </div>
              <input type="range" min={0} max={200} step={5} value={volume}
                onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMasterVolume(v / 100); }}
                className="w-full h-3 accent-primary cursor-pointer" />
              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>MUTE</span><span>100%</span><span>200% BOOST</span>
              </div>
              <button onClick={testBeep}
                className="w-full py-2 bg-muted text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted-foreground/20 transition-colors border border-border">
                🔊 Test Sound
              </button>
            </div>

            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => setConfig(p.config)}
                  className="flex-1 py-3 bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors border border-border">
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2">
          {!running ? (
            <button onClick={startTimer}
              className="flex-1 h-16 bg-green-700 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-green-600 transition-colors active:scale-[0.98]">
              <Play size={22} fill="white" />
              {phase === "done" ? "RESTART" : "START"}
            </button>
          ) : (
            <button onClick={pauseTimer}
              className="flex-1 h-16 bg-yellow-600 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-500 transition-colors active:scale-[0.98]">
              <Pause size={22} fill="white" />
              PAUSE
            </button>
          )}
          <button onClick={resetTimer}
            className="h-16 px-6 bg-muted text-muted-foreground text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:text-foreground transition-colors">
            <RotateCcw size={18} />
            RESET
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntervalTimer;
export { PRESETS };
