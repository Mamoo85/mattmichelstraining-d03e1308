import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Timer, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkoutTimerProps {
  initialElapsed?: number;
  autoStart?: boolean;
  onElapsedChange?: (seconds: number) => void;
}

const WorkoutTimer = memo(({ initialElapsed = 0, autoStart = false, onElapsedChange }: WorkoutTimerProps) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsed);
  const [running, setRunning] = useState(autoStart);
  const elapsedRef = useRef(elapsedSeconds);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const handleToggle = useCallback(() => {
    setRunning((prev) => {
      if (prev) onElapsedChange?.(elapsedRef.current);
      return !prev;
    });
  }, [onElapsedChange]);

  useEffect(() => {
    return () => { onElapsedChange?.(elapsedRef.current); };
  }, [onElapsedChange]);

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold tracking-wide transition-all",
        running
          ? "bg-transparent"
          : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
      style={running ? {
        color: "hsl(var(--synth-cyan))",
        textShadow: "var(--synth-glow-cyan)",
      } : undefined}
    >
      {running ? <Pause size={14} /> : <Play size={14} />}
      <span className="font-mono tabular-nums">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </button>
  );
});

WorkoutTimer.displayName = "WorkoutTimer";

export default WorkoutTimer;
