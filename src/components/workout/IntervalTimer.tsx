import { useState, useRef, useCallback, useEffect } from "react";
import { X, Timer, Minus, Plus, Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { countdownBeep, workBeep, restBeep, completeChime } from "./useTimerAudio";

function vibrate(pattern: number | number[]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

type Phase = "idle" | "prep" | "work" | "rest" | "done";

interface TimerConfig {
  prep: number;
  work: number;
  rest: number;
  rounds: number;
}

const PRESETS: { label: string; config: TimerConfig }[] = [
  { label: "Tabata", config: { prep: 10, work: 20, rest: 10, rounds: 8 } },
  { label: "EMOM", config: { prep: 10, work: 60, rest: 0, rounds: 10 } },
  { label: "Boxing", config: { prep: 10, work: 180, rest: 60, rounds: 12 } },
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

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const IntervalTimer = ({ onClose }: { onClose: () => void }) => {
  const [config, setConfig] = useState<TimerConfig>({ prep: 5, work: 45, rest: 15, rounds: 5 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);

  // Robust interval using target timestamps instead of naive decrement
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetTimeRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const secondsRef = useRef(0);
  const roundRef = useRef(0);
  const configRef = useRef(config);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { secondsRef.current = secondsLeft; }, [secondsLeft]);
  useEffect(() => { roundRef.current = currentRound; }, [currentRound]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const transitionPhase = useCallback((nextPhase: Phase, duration: number, round: number) => {
    setPhase(nextPhase);
    setSecondsLeft(duration);
    setCurrentRound(round);
    secondsRef.current = duration;
    phaseRef.current = nextPhase;
    roundRef.current = round;

    if (nextPhase === "work") { workBeep(); vibrate(300); }
    else if (nextPhase === "rest") { restBeep(); vibrate([100, 80, 100]); }
    else if (nextPhase === "done") {
      completeChime();
      vibrate([100, 60, 100, 60, 300]);
      stopInterval();
      setRunning(false);
    }
  }, [stopInterval]);

  const tick = useCallback(() => {
    const s = secondsRef.current;
    const p = phaseRef.current;
    const r = roundRef.current;
    const c = configRef.current;

    if (s <= 0) {
      // Transition to next phase
      if (p === "prep") {
        transitionPhase("work", c.work, 1);
      } else if (p === "work") {
        if (c.rest > 0) {
          transitionPhase("rest", c.rest, r);
        } else if (r < c.rounds) {
          transitionPhase("work", c.work, r + 1);
        } else {
          transitionPhase("done", 0, r);
        }
      } else if (p === "rest") {
        if (r < c.rounds) {
          transitionPhase("work", c.work, r + 1);
        } else {
          transitionPhase("done", 0, r);
        }
      }
      return;
    }

    // Countdown beeps for last 3 seconds
    if (s <= 3 && s > 0) { countdownBeep(); vibrate(50); }

    const next = s - 1;
    secondsRef.current = next;
    setSecondsLeft(next);
  }, [transitionPhase]);

  const startTimer = useCallback(() => {
    // Unlock audio context on first user gesture
    if (phase === "idle" || phase === "done") {
      transitionPhase("prep", config.prep, 0);
    }
    setRunning(true);
    stopInterval();
    targetTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      // Drift-corrected: measure real elapsed time
      const now = Date.now();
      const elapsed = now - targetTimeRef.current;
      if (elapsed >= 1000) {
        targetTimeRef.current += 1000;
        tick();
      }
    }, 100); // Check every 100ms for accuracy even when throttled
  }, [phase, config, tick, transitionPhase, stopInterval]);

  const pauseTimer = useCallback(() => {
    setRunning(false);
    stopInterval();
  }, [stopInterval]);

  const resetTimer = useCallback(() => {
    stopInterval();
    setRunning(false);
    setPhase("idle");
    setSecondsLeft(0);
    setCurrentRound(0);
  }, [stopInterval]);

  // Wake Lock: keep screen on while timer is running
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const acquireWakeLock = async () => {
      if (running && "wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch { /* user denied or not supported */ }
      }
    };
    const releaseWakeLock = () => {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };

    if (running) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
    return releaseWakeLock;
  }, [running]);

  // Cleanup on unmount
  useEffect(() => () => stopInterval(), [stopInterval]);

  const adjust = (field: keyof TimerConfig, delta: number) => {
    if (running) return;
    setConfig((c) => ({
      ...c,
      [field]: Math.max(field === "rounds" ? 1 : 0, c[field] + delta),
    }));
  };

  const isSetup = phase === "idle" || phase === "done";
  const displayTime = isSetup ? formatTime(config.work) : formatTime(secondsLeft);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col animate-slide-in-right" style={{ animationDuration: "0.25s" }}>
      {/* Timer display — top half */}
      <div className={cn("flex-1 flex flex-col items-center justify-center relative transition-colors duration-300", phaseColors[phase])}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/30 text-white hover:bg-black/50 transition-colors"
        >
          <X size={24} />
        </button>

        <span className="text-sm font-bold uppercase tracking-[0.3em] text-white/80 mb-2">
          {phaseLabels[phase]}
          {(phase === "prep" || phase === "work" || phase === "rest") && ` · Round ${currentRound}/${config.rounds}`}
        </span>

        <span className="font-mono text-[min(30vw,160px)] leading-none font-black text-white tabular-nums drop-shadow-lg">
          {displayTime}
        </span>

        {phase === "done" && (
          <span className="mt-4 text-lg font-bold text-white/90 uppercase tracking-widest">
            🔥 All {config.rounds} rounds complete
          </span>
        )}
      </div>

      {/* Controls — bottom half */}
      <div className="bg-background p-4 space-y-4 overflow-y-auto max-h-[55vh]">
        {/* Setup fields */}
        {isSetup && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "prep" as const, label: "Prep", unit: "s" },
                { key: "work" as const, label: "Work", unit: "s" },
                { key: "rest" as const, label: "Rest", unit: "s" },
                { key: "rounds" as const, label: "Rounds", unit: "" },
              ]).map(({ key, label, unit }) => (
                <div key={key} className="bg-card border border-border p-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjust(key, key === "work" && config[key] >= 30 ? -5 : key === "rest" && config[key] >= 10 ? -5 : -1)}
                      className="w-9 h-9 flex items-center justify-center bg-muted text-foreground hover:bg-muted-foreground/20 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-mono text-lg font-bold text-foreground w-12 text-center tabular-nums">
                      {key === "work" || key === "rest" || key === "prep"
                        ? formatTime(config[key])
                        : config[key]}
                    </span>
                    <button
                      onClick={() => adjust(key, key === "work" && config[key] >= 25 ? 5 : key === "rest" && config[key] >= 5 ? 5 : 1)}
                      className="w-9 h-9 flex items-center justify-center bg-muted text-foreground hover:bg-muted-foreground/20 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Presets */}
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setConfig(p.config)}
                  className="flex-1 py-3 bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors border border-border"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Control buttons */}
        <div className="flex gap-2">
          {!running ? (
            <button
              onClick={startTimer}
              className="flex-1 h-16 bg-green-700 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-green-600 transition-colors"
            >
              <Play size={22} fill="white" />
              {phase === "done" ? "RESTART" : "START"}
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="flex-1 h-16 bg-yellow-600 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-500 transition-colors"
            >
              <Pause size={22} fill="white" />
              PAUSE
            </button>
          )}
          <button
            onClick={resetTimer}
            className="h-16 px-6 bg-muted text-muted-foreground text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:text-foreground transition-colors"
          >
            <RotateCcw size={18} />
            RESET
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntervalTimer;
