import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar, Dumbbell, Camera, Brain, Zap, Heart, BookOpen } from "lucide-react";

const FULL_TEXT = "Congratulations, you have passed the test.";
const BLINK_DURATION = 2400;
const TYPE_SPEED = 55;
const RAIN_DURATION = 4000; // rain plays for 4s before CTA fades in

const FEATURES = [
  { icon: Dumbbell, title: "200+ Exercise Library", desc: "Every exercise Coach Matt prescribes — with video, cues, and 'the why' behind each one." },
  { icon: Brain, title: "AI Nutrition Scanner", desc: "Snap a photo of your plate. Instant macros. No guessing, no MyFitnessPal headaches." },
  { icon: Camera, title: "Posture Analysis", desc: "Front and side photos → AI-powered breakdown of exactly what's off and how to fix it." },
  { icon: Heart, title: "Fix It Recovery Library", desc: "Matt's personal rehab playbook. The same protocols he uses with D1 athletes and weekend warriors." },
  { icon: Zap, title: "Smart Workout Logger", desc: "Track sets, reps, velocity. Auto-regulate intensity. Your workouts actually adapt to how you feel." },
  { icon: BookOpen, title: "Monthly Focus Plans", desc: "A new training focus every month with exercises, biomechanics tips, and community challenges." },
];

const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* ── Matrix Rain Canvas ────────────────────────────── */
const MatrixRain = ({ active }: { active: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const columnsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    const fontSize = 14;
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const cols = Math.floor(w / fontSize);
    columnsRef.current = Array(cols).fill(0).map(() => Math.random() * -50);

    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      const newCols = Math.floor(w / fontSize);
      columnsRef.current = Array(newCols).fill(0).map(() => Math.random() * -50);
    };
    window.addEventListener("resize", handleResize);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${fontSize}px monospace`;

      columnsRef.current.forEach((y, i) => {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const x = i * fontSize;

        // Lead character is bright white-green
        ctx.fillStyle = "#AAFFAA";
        ctx.fillText(char, x, y * fontSize);

        // Trail characters are classic green
        if (Math.random() > 0.98) {
          ctx.fillStyle = "#00FF41";
        } else {
          ctx.fillStyle = `rgba(0, 255, 65, ${0.3 + Math.random() * 0.5})`;
        }
        ctx.fillText(char, x, y * fontSize);

        if (y * fontSize > h && Math.random() > 0.975) {
          columnsRef.current[i] = 0;
        } else {
          columnsRef.current[i] = y + 1;
        }
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-10 pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
};

/* ── Matrix Ambient Synth ──────────────────────────── */
const useMatrixAudio = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ gain: GainNode; oscillators: OscillatorNode[] } | null>(null);

  const start = useCallback(() => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1.5);
      masterGain.connect(ctx.destination);

      const oscillators: OscillatorNode[] = [];

      // Deep drone
      const drone = ctx.createOscillator();
      drone.type = "sawtooth";
      drone.frequency.setValueAtTime(55, ctx.currentTime);
      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.3, ctx.currentTime);
      const droneFilter = ctx.createBiquadFilter();
      droneFilter.type = "lowpass";
      droneFilter.frequency.setValueAtTime(200, ctx.currentTime);
      drone.connect(droneFilter).connect(droneGain).connect(masterGain);
      drone.start();
      oscillators.push(drone);

      // Eerie pad
      const pad = ctx.createOscillator();
      pad.type = "sine";
      pad.frequency.setValueAtTime(220, ctx.currentTime);
      pad.frequency.linearRampToValueAtTime(233, ctx.currentTime + 4);
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.08, ctx.currentTime);
      pad.connect(padGain).connect(masterGain);
      pad.start();
      oscillators.push(pad);

      // High shimmer
      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.setValueAtTime(880, ctx.currentTime);
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0.02, ctx.currentTime);
      // LFO for shimmer
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.5, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.015, ctx.currentTime);
      lfo.connect(lfoGain).connect(shimmerGain.gain);
      lfo.start();
      shimmer.connect(shimmerGain).connect(masterGain);
      shimmer.start();
      oscillators.push(shimmer, lfo);

      nodesRef.current = { gain: masterGain, oscillators };
    } catch {
      // Web Audio not available
    }
  }, []);

  const stop = useCallback(() => {
    if (!nodesRef.current || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const { gain, oscillators } = nodesRef.current;
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    setTimeout(() => {
      oscillators.forEach((o) => { try { o.stop(); } catch {} });
      ctx.close();
    }, 2500);
  }, []);

  return { start, stop };
};

/* ── Main Component ────────────────────────────────── */
const MatrixEasterEgg = () => {
  const [phase, setPhase] = useState<"blink" | "type" | "rain" | "cta">("blink");
  const [typed, setTyped] = useState("");
  const [showCta, setShowCta] = useState(false);
  const [rainFading, setRainFading] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const { start: startAudio, stop: stopAudio } = useMatrixAudio();

  // Phase 1: blink cursor
  useEffect(() => {
    const t = setTimeout(() => setPhase("type"), BLINK_DURATION);
    return () => clearTimeout(t);
  }, []);

  // Phase 2: typewriter
  useEffect(() => {
    if (phase !== "type") return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(FULL_TEXT.slice(0, i));
      if (i >= FULL_TEXT.length) {
        clearInterval(iv);
        setTimeout(() => setPhase("rain"), 1200);
      }
    }, TYPE_SPEED);
    return () => clearInterval(iv);
  }, [phase]);

  // Phase 3: matrix rain
  useEffect(() => {
    if (phase !== "rain") return;
    startAudio();

    const fadeTimer = setTimeout(() => {
      setRainFading(true);
      setShowCta(true);
      setPhase("cta");
    }, RAIN_DURATION);

    return () => clearTimeout(fadeTimer);
  }, [phase, startAudio]);

  // Stop audio when leaving page
  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  // Scroll to CTA when it appears
  useEffect(() => {
    if (showCta && ctaRef.current) {
      setTimeout(() => ctaRef.current?.scrollIntoView({ behavior: "smooth" }), 600);
    }
  }, [showCta]);

  const rainActive = phase === "rain" || (phase === "cta" && !rainFading);

  return (
    <div className="min-h-screen bg-black text-[#00FF41] selection:bg-[#00FF41]/20">
      {/* Matrix Rain Canvas */}
      <MatrixRain active={phase === "rain" || phase === "cta"} />

      {/* Rain fade-out overlay */}
      <div
        className={`fixed inset-0 z-20 bg-black pointer-events-none transition-opacity duration-[3000ms] ${
          rainFading ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Back button */}
      <Link
        to="/"
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 text-[#00FF41]/60 hover:text-[#00FF41] text-xs font-mono transition-colors"
      >
        <ArrowLeft size={14} />
        Back to safety
      </Link>

      {/* Matrix terminal */}
      <div className={`min-h-screen flex items-center justify-center px-6 relative z-30 transition-opacity duration-1000 ${
        phase === "rain" || phase === "cta" ? "opacity-0 pointer-events-none" : ""
      }`}>
        <div className="font-mono text-xl md:text-3xl lg:text-4xl text-center max-w-3xl">
          {phase === "blink" && (
            <span className="inline-block w-3 h-7 md:h-9 bg-[#00FF41] animate-[cursor-blink_0.8s_step-end_infinite]" />
          )}
          {phase !== "blink" && (
            <>
              {typed}
              <span className="inline-block w-3 h-7 md:h-9 bg-[#00FF41] align-middle ml-0.5 animate-[cursor-blink_0.8s_step-end_infinite]" />
            </>
          )}
        </div>
      </div>

      {/* CTA section — fades in over the rain */}
      <div
        ref={ctaRef}
        className={`relative z-30 transition-all duration-[2000ms] ease-out ${
          showCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16 pointer-events-none"
        }`}
      >
        <div className="max-w-2xl mx-auto px-5 pb-20">
          {/* Matt's note */}
          <div className="border border-[#00FF41]/30 bg-black/80 backdrop-blur-none p-6 md:p-8 mb-10">
            <p className="text-[#00FF41]/60 text-[10px] font-mono uppercase tracking-widest mb-3">
              Encrypted message from Coach Matt
            </p>
            <p className="text-[#00FF41] font-mono text-sm md:text-base leading-relaxed mb-4">
              "You weren't supposed to press that. But since you're clearly the rebellious type… respect.
            </p>
            <p className="text-[#00FF41] font-mono text-sm md:text-base leading-relaxed mb-4">
              Here's the deal: for less than the cost of a single protein shake per week, you get my entire 20+ year playbook. The same exercises I give D1 athletes. The same recovery protocols that have kept my injury count at exactly zero. AI that scans your food and analyzes your posture while you're still in your pajamas.
            </p>
            <p className="text-[#00FF41] font-mono text-sm md:text-base leading-relaxed">
              And when things get real — a shoulder that won't cooperate, a knee that's been gaslighting you for years — you can come see me in person. Pop in once or twice a month. I'll fix what the app can't."
            </p>
          </div>

          {/* Feature grid */}
          <h3 className="text-[#00FF41] font-mono text-xs uppercase tracking-widest mb-5 text-center">
            What $12.99/mo unlocks
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="border border-[#00FF41]/20 bg-black/70 p-4 hover:border-[#00FF41]/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <f.icon size={16} className="text-[#00FF41] flex-shrink-0" />
                  <span className="font-mono text-xs font-bold text-[#00FF41]">{f.title}</span>
                </div>
                <p className="font-mono text-[11px] text-[#00FF41]/70 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Pain hook */}
          <div className="border-l-2 border-[#00FF41]/40 pl-4 mb-10">
            <p className="font-mono text-sm text-[#00FF41]/80 leading-relaxed">
              Everybody's got something that hurts. A shoulder that clicks. A hip that locks up on deadlifts. A knee that's been lying to you since high school.
            </p>
            <p className="font-mono text-sm text-[#00FF41] leading-relaxed mt-3 font-bold">
              I've spent 20+ years fixing people. Zero injuries. 50+ college athletes sent to the next level. This membership is your all-access pass to my playbook — use it from your couch, or come see me when you need the real thing.
            </p>
          </div>

          {/* Primary CTA */}
          <div className="text-center mb-12">
            <Link
              to="/auth?redirect=/trial-welcome"
              className="inline-block bg-[#00FF41] text-black font-mono font-black text-sm md:text-base uppercase tracking-widest px-8 py-4 hover:bg-[#33FF66] hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] transition-all duration-300"
            >
              Start My 14-Day Free Trial
            </Link>
            <p className="font-mono text-[10px] text-[#00FF41]/50 mt-2">
              Credit card required · Cancel anytime · $12.99/mo after trial
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-10">
            <div className="flex-1 h-px bg-[#00FF41]/20" />
            <p className="font-mono text-xs text-[#00FF41]/60 uppercase tracking-widest whitespace-nowrap">
              Or just let me prove it
            </p>
            <div className="flex-1 h-px bg-[#00FF41]/20" />
          </div>

          {/* Schedule CTA */}
          <div className="text-center mb-16">
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 border-2 border-[#00FF41] text-[#00FF41] font-mono font-black text-base md:text-lg uppercase tracking-widest px-10 py-5 hover:bg-[#00FF41] hover:text-black transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,255,65,0.3)]"
            >
              <Calendar size={20} />
              SCHEDULE NOW
            </Link>
          </div>

          {/* Home link */}
          <div className="text-center pb-8">
            <Link
              to="/"
              className="font-mono text-xs text-[#00FF41]/40 hover:text-[#00FF41]/70 transition-colors"
            >
              ← Return to the real world
            </Link>
          </div>
        </div>
      </div>

      {/* Cursor blink keyframes */}
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default MatrixEasterEgg;
