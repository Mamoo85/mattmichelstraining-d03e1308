import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Timer, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkoutTimerProps {
  initialElapsed?: number;
  autoStart?: boolean;
  onElapsedChange?: (seconds: number) => void;
}

/**
 * Self-contained workout timer that manages its own state
 * to avoid re-rendering the parent component every second.
 */
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

  // Report elapsed to parent on pause/stop only (not every tick)
  const handleToggle = useCallback(() => {
    setRunning((prev) => {
      if (prev) {
        // Pausing — report current elapsed
        onElapsedChange?.(elapsedRef.current);
      }
      return !prev;
    });
  }, [onElapsedChange]);

  // Expose elapsed on unmount
  useEffect(() => {
    return () => {
      onElapsedChange?.(elapsedRef.current);
    };
  }, [onElapsedChange]);

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-all",
        running
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {running ? <Timer size={14} /> : <Play size={14} />}
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </button>
  );
});

WorkoutTimer.displayName = "WorkoutTimer";

export default WorkoutTimer;
