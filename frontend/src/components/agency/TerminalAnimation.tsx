import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const LINES = [
  { text: "$ Initializing gap analysis engine...", delay: 400 },
  { text: "> DNS lookup: detroitbusiness.com → 104.21.XX.XX", delay: 600 },
  { text: "> SSL certificate: ⚠ Expires in 12 days", delay: 500, warn: true },
  { text: "> Mobile responsiveness: FAIL — viewport not configured", delay: 700, error: true },
  { text: "> PageSpeed score: 34/100 (Critical)", delay: 600, error: true },
  { text: "> SEO crawl: 7 broken links, missing meta descriptions", delay: 800, warn: true },
  { text: "> Local pack presence: NOT FOUND in Google Maps 3-pack", delay: 700, error: true },
  { text: "> Competitor scan: 3 competitors outranking for 'plumber detroit'", delay: 900, warn: true },
  { text: "", delay: 300 },
  { text: "═══════════════════════════════════════════════", delay: 200 },
  { text: "  ANALYSIS COMPLETE — 4 Critical Issues Found", delay: 0, highlight: true },
  { text: "═══════════════════════════════════════════════", delay: 0 },
];

const TerminalAnimation = () => {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started || visibleLines >= LINES.length) return;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), LINES[visibleLines]?.delay ?? 500);
    return () => clearTimeout(timer);
  }, [started, visibleLines]);

  const done = visibleLines >= LINES.length;

  return (
    <section ref={ref} className="py-20">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
            See Our Systems In Action
          </h2>
          <p style={{ color: "#64748b" }}>This is what happens behind the scenes when we scan a website.</p>
        </div>

        <div className="relative rounded-xl overflow-hidden" style={{ background: "#0c0c14", border: "1px solid rgba(148,163,184,0.1)" }}>
          {/* CRT scanline overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 relative" style={{ background: "rgba(15,23,42,0.8)", borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#eab308" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#22c55e" }} />
            <span className="ml-3 text-xs font-mono" style={{ color: "#475569" }}>detroit-web-agency — gap-analysis v3.2</span>
          </div>

          {/* Terminal body */}
          <div className="p-5 md:p-6 font-mono text-sm leading-7 min-h-[320px] relative" style={{ color: "#94a3b8" }}>
            {LINES.slice(0, visibleLines).map((line, i) => (
              <div key={i} style={{
                color: line.error ? "#f87171" : line.warn ? "#facc15" : line.highlight ? "#22d3ee" : "#94a3b8",
                fontWeight: line.highlight ? 800 : 400,
                textAlign: line.highlight ? "center" : undefined,
                textShadow: line.highlight ? "0 0 20px rgba(34,211,238,0.4)" : undefined,
              }}>
                {line.text}
              </div>
            ))}
            {!done && (
              <span
                className="inline-block w-2 h-4"
                style={{
                  background: "#22d3ee",
                  animation: "terminal-cursor 0.7s step-start infinite",
                }}
              />
            )}
          </div>
        </div>

        <style>{`
          @keyframes terminal-cursor {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>

        {done && (
          <div className="text-center mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button asChild size="lg" className="px-10 py-6 text-base font-bold rounded-lg" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}>
              <Link to="/ai-website-audit">
                Get Your Free Diagnostic <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default TerminalAnimation;
