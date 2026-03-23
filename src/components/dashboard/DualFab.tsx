import { useState, useRef, useCallback, useEffect } from "react";
import { Timer, MessageCircle, Dumbbell } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";
import CoachChatPanel from "@/components/dashboard/CoachChatPanel";

const HOLD_MS = 300;
const ACTIVATE_RADIUS = 40; // px from option center to count as "over"

interface Vec2 { x: number; y: number }

const OPTIONS = [
  { key: "timer", icon: Timer, label: "Timer", angle: -135 },   // top-left
  { key: "chat", icon: MessageCircle, label: "Chat", angle: -45 }, // top-right
] as const;

const OPTION_DISTANCE = 72; // px from center

const DualFab = () => {
  const { toggleTimer } = useTimer();
  const [expanded, setExpanded] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const originRef = useRef<Vec2>({ x: 0, y: 0 });
  const didExpandRef = useRef(false);
  const isPointerDownRef = useRef(false);

  const getOptionPositions = useCallback(() => {
    return OPTIONS.map((o) => {
      const rad = (o.angle * Math.PI) / 180;
      return {
        key: o.key,
        dx: Math.cos(rad) * OPTION_DISTANCE,
        dy: Math.sin(rad) * OPTION_DISTANCE,
      };
    });
  }, []);

  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    didExpandRef.current = false;
    const rect = fabRef.current?.getBoundingClientRect();
    if (rect) {
      originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    holdTimerRef.current = setTimeout(() => {
      didExpandRef.current = true;
      setExpanded(true);
      setHoveredKey(null);
      try { navigator.vibrate?.(15); } catch {}
    }, HOLD_MS);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!didExpandRef.current) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    const positions = getOptionPositions();
    let closest: string | null = null;
    let closestDist = Infinity;
    for (const p of positions) {
      const dist = Math.sqrt((dx - p.dx) ** 2 + (dy - p.dy) ** 2);
      if (dist < ACTIVATE_RADIUS && dist < closestDist) {
        closest = p.key;
        closestDist = dist;
      }
    }
    setHoveredKey(closest);
  }, [getOptionPositions]);

  const handlePointerUp = useCallback(() => {
    clearHold();
    isPointerDownRef.current = false;

    if (!didExpandRef.current) {
      // Quick tap → open timer
      toggleTimer();
      return;
    }

    setExpanded(false);

    if (hoveredKey === "timer") {
      try { navigator.vibrate?.(10); } catch {}
      toggleTimer();
    } else if (hoveredKey === "chat") {
      try { navigator.vibrate?.(10); } catch {}
      setChatOpen(true);
    }
    setHoveredKey(null);
    didExpandRef.current = false;
  }, [hoveredKey, toggleTimer]);

  const handlePointerCancel = useCallback(() => {
    clearHold();
    setExpanded(false);
    setHoveredKey(null);
    didExpandRef.current = false;
    isPointerDownRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearHold(), []);

  const positions = getOptionPositions();

  if (chatOpen) {
    return <CoachChatPanel onClose={() => setChatOpen(false)} />;
  }

  return (
    <>
      {/* Backdrop when expanded */}
      {expanded && (
        <div className="fixed inset-0 z-[49]" />
      )}

      <div className="fixed bottom-16 left-6 z-50">
        {/* Radial options */}
        {OPTIONS.map((opt, i) => {
          const pos = positions[i];
          const isHovered = hoveredKey === opt.key;
          const Icon = opt.icon;
          return (
            <div
              key={opt.key}
              className={`absolute flex flex-col items-center gap-1 transition-all duration-200 pointer-events-none ${
                expanded ? "opacity-100 scale-100" : "opacity-0 scale-50"
              }`}
              style={{
                transform: expanded
                  ? `translate(${pos.dx}px, ${pos.dy}px) translate(-50%, -50%)`
                  : "translate(-50%, -50%)",
                left: "50%",
                top: "50%",
              }}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 ${
                  isHovered
                    ? "bg-primary text-primary-foreground scale-125"
                    : "bg-card text-foreground border border-border"
                }`}
              >
                <Icon size={20} />
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150 ${
                  isHovered ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {opt.label}
              </span>
            </div>
          );
        })}

        {/* Main FAB */}
        <button
          ref={fabRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={`relative w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center select-none touch-none transition-all duration-200 ${
            expanded ? "scale-90 ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : "hover:opacity-90"
          }`}
          aria-label="Training tools — hold and slide"
        >
          <Dumbbell size={22} className={expanded ? "animate-pulse" : ""} />
        </button>
      </div>
    </>
  );
};

export default DualFab;
