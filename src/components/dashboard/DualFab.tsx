import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { MessageCircle, Dumbbell } from "lucide-react";
import { safeLocalStorage } from "@/lib/browserStorage";

const CoachChatPanel = lazy(() => import("@/components/dashboard/CoachChatPanel"));

const DRAG_THRESHOLD = 8;
const POS_KEY = "m2-fab-position";

interface Vec2 { x: number; y: number }

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
  const [chatOpen, setChatOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<Vec2>(() => getSavedPosition() || { x: 16, y: 72 });

  const fabRef = useRef<HTMLButtonElement>(null);
  const pointerStartRef = useRef<Vec2>({ x: 0, y: 0 });
  const startPosRef = useRef<Vec2>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const savePosition = useCallback((p: Vec2) => {
    try { safeLocalStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { ...pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!isDraggingRef.current && dist > DRAG_THRESHOLD) {
      isDraggingRef.current = true;
      setDragging(true);
    }

    if (isDraggingRef.current) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const newX = clamp(startPosRef.current.x + dx, 0, vw - 56);
      const newY = clamp(startPosRef.current.y + dy, 0, vh - 56);
      setPos({ x: newX, y: newY });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setDragging(false);
      savePosition(pos);
      return;
    }
    // Quick tap → open chat
    setChatOpen(true);
  }, [pos, savePosition]);

  const handlePointerCancel = useCallback(() => {
    isDraggingRef.current = false;
    setDragging(false);
  }, []);

  return (
    <>
      {chatOpen && (
        <Suspense fallback={null}>
          <CoachChatPanel onClose={() => setChatOpen(false)} />
        </Suspense>
      )}

      <div
        className="fixed z-50"
        style={{
          left: pos.x,
          top: pos.y,
          transition: dragging ? "none" : "left 0.2s ease, top 0.2s ease",
        }}
      >
        <button
          ref={fabRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={`relative w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center select-none touch-none transition-all duration-200 hover:opacity-90 ${
            dragging ? "scale-110 shadow-2xl" : ""
          }`}
          aria-label="Chat with coach"
        >
          <MessageCircle size={18} />
        </button>
      </div>
    </>
  );
};

export default DualFab;
