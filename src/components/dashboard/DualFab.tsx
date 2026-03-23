import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { Timer, MessageCircle, Dumbbell } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";
import { safeLocalStorage } from "@/lib/browserStorage";

const CoachChatPanel = lazy(() => import("@/components/dashboard/CoachChatPanel"));
const IntervalTimer = lazy(() => import("@/components/workout/IntervalTimer"));

const HOLD_MS = 400; // longer hold to distinguish from drag
const DRAG_THRESHOLD = 8; // px movement before it's a drag
const ACTIVATE_RADIUS = 40;
const OPTION_DISTANCE = 72;
const POS_KEY = "m2-fab-position";

interface Vec2 { x: number; y: number }

const OPTIONS = [
  { key: "timer", icon: Timer, label: "Timer", angle: -135 },
  { key: "chat", icon: MessageCircle, label: "Chat", angle: -45 },
] as const;

const getSavedPosition = (): Vec2 | null => {
  try {
    const raw = safeLocalStorage.getItem(POS_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw);
    if (typeof pos.x === "number" && typeof pos.y === "number") return pos;
  } catch {}
  return null;
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

const DualFab = () => {
  const { toggleTimer, timerOpen, closeTimer } = useTimer();
  const [expanded, setExpanded] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<Vec2>(() => getSavedPosition() || { x: 16, y: 72 });

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const originRef = useRef<Vec2>({ x: 0, y: 0 });
  const pointerStartRef = useRef<Vec2>({ x: 0, y: 0 });
  const startPosRef = useRef<Vec2>({ x: 0, y: 0 });
  const didExpandRef = useRef(false);
  const isDraggingRef = useRef(false);

  const getOptionPositions = useCallback(() => {
    return OPTIONS.map((o) => {
      const rad = (o.angle * Math.PI) / 180;
      return { key: o.key, dx: Math.cos(rad) * OPTION_DISTANCE, dy: Math.sin(rad) * OPTION_DISTANCE };
    });
  }, []);

  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const savePosition = useCallback((p: Vec2) => {
    try { safeLocalStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    didExpandRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { ...pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = fabRef.current?.getBoundingClientRect();
    if (rect) {
      originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    holdTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        didExpandRef.current = true;
        setExpanded(true);
        setHoveredKey(null);
        try { navigator.vibrate?.(15); } catch {}
      }
    }, HOLD_MS);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Start dragging if moved past threshold and haven't expanded yet
    if (!didExpandRef.current && dist > DRAG_THRESHOLD) {
      clearHold();
      isDraggingRef.current = true;
      setDragging(true);
    }

    if (isDraggingRef.current) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const newX = clamp(startPosRef.current.x + dx, 0, vw - 56);
      const newY = clamp(startPosRef.current.y + dy, 0, vh - 56);
      setPos({ x: newX, y: newY });
      return;
    }

    // Radial menu hover detection
    if (didExpandRef.current) {
      const mdx = e.clientX - originRef.current.x;
      const mdy = e.clientY - originRef.current.y;
      const positions = getOptionPositions();
      let closest: string | null = null;
      let closestDist = Infinity;
      for (const p of positions) {
        const d = Math.sqrt((mdx - p.dx) ** 2 + (mdy - p.dy) ** 2);
        if (d < ACTIVATE_RADIUS && d < closestDist) {
          closest = p.key;
          closestDist = d;
        }
      }
      setHoveredKey(closest);
    }
  }, [getOptionPositions]);

  const handlePointerUp = useCallback(() => {
    clearHold();

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setDragging(false);
      savePosition(pos);
      return;
    }

    if (!didExpandRef.current) {
      // Quick tap → toggle timer
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
  }, [hoveredKey, toggleTimer, pos, savePosition]);

  const handlePointerCancel = useCallback(() => {
    clearHold();
    setExpanded(false);
    setHoveredKey(null);
    didExpandRef.current = false;
    isDraggingRef.current = false;
    setDragging(false);
  }, []);

  useEffect(() => () => clearHold(), []);

  const positions = getOptionPositions();

  return (
    <>
      {chatOpen && (
        <Suspense fallback={null}>
          <CoachChatPanel onClose={() => setChatOpen(false)} />
        </Suspense>
      )}

      {timerOpen && (
        <Suspense fallback={null}>
          <IntervalTimer onClose={closeTimer} />
        </Suspense>
      )}

      {/* Backdrop when expanded */}
      {expanded && <div className="fixed inset-0 z-[49]" />}

      <div
        className="fixed z-50"
        style={{
          left: pos.x,
          top: pos.y,
          transition: dragging ? "none" : "left 0.2s ease, top 0.2s ease",
        }}
      >
        {/* Radial options */}
        {OPTIONS.map((opt, i) => {
          const p = positions[i];
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
                  ? `translate(${p.dx}px, ${p.dy}px) translate(-50%, -50%)`
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
          } ${dragging ? "scale-110 shadow-2xl" : ""}`}
          aria-label="Training tools — tap for timer, hold for options, drag to move"
        >
          <Dumbbell size={22} className={expanded ? "animate-pulse" : ""} />
        </button>
      </div>
    </>
  );
};

export default DualFab;
