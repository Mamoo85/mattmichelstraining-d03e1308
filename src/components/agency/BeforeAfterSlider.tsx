import { useState, useRef, useCallback } from "react";

const BeforeAfterSlider = () => {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  const onPointerDown = () => { dragging.current = true; };
  const onPointerUp = () => { dragging.current = false; };
  const onPointerMove = (e: React.PointerEvent) => { if (dragging.current) updatePosition(e.clientX); };

  return (
    <section className="py-20">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
            The Transformation
          </h2>
          <p style={{ color: "#64748b" }}>Drag the slider to see what we build.</p>
        </div>

        <div
          ref={containerRef}
          className="relative w-full aspect-[16/10] rounded-xl overflow-hidden cursor-col-resize select-none touch-none"
          style={{ border: "1px solid rgba(148,163,184,0.1)" }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerMove={onPointerMove}
        >
          {/* "After" — full background */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0d1117, #0a1628)" }}>
            <div className="text-center p-8">
              <div className="text-6xl mb-4">🚀</div>
              <div className="text-xl font-black mb-2" style={{ color: "#22d3ee" }}>AFTER</div>
              <div className="text-sm font-semibold" style={{ color: "#cbd5e1" }}>Mobile-Optimized Lead Engine</div>
              <div className="mt-4 space-y-2 text-xs" style={{ color: "#64748b" }}>
                <div>✅ PageSpeed: 97/100</div>
                <div>✅ Click-to-Call Active</div>
                <div>✅ SEO Optimized</div>
                <div>✅ 24/7 Lead Capture</div>
              </div>
            </div>
          </div>

          {/* "Before" — clipped overlay */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a0a0a, #2a1515)", clipPath: `inset(0 ${100 - position}% 0 0)` }}>
            <div className="text-center p-8">
              <div className="text-6xl mb-4">💀</div>
              <div className="text-xl font-black mb-2" style={{ color: "#f87171" }}>BEFORE</div>
              <div className="text-sm font-semibold" style={{ color: "#fca5a5" }}>Broken Mobile Site</div>
              <div className="mt-4 space-y-2 text-xs" style={{ color: "#94a3b8" }}>
                <div>❌ PageSpeed: 23/100</div>
                <div>❌ No Click-to-Call</div>
                <div>❌ No SEO Setup</div>
                <div>❌ Losing Leads Daily</div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="absolute top-0 bottom-0 w-1" style={{ left: `${position}%`, background: "#22d3ee", boxShadow: "0 0 12px rgba(34,211,238,0.5)" }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#22d3ee", boxShadow: "0 0 20px rgba(34,211,238,0.4)" }}>
              <span className="text-xs font-black" style={{ color: "#020617" }}>⇔</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BeforeAfterSlider;
