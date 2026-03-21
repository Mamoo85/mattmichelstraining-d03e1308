import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar, Dumbbell, Camera, Brain, Zap, Heart, BookOpen } from "lucide-react";

const FULL_TEXT = "Congratulations, you have passed the test.";
const BLINK_DURATION = 2400;
const TYPE_SPEED = 55;
const RAIN_DURATION = 4000;

const FEATURES = [
  { icon: Camera, title: "Snap → Fix", desc: "Take a photo mid-set. The AI sees what's off and rewrites your next workout around it. Your program adapts to YOU, not the other way around." },
  { icon: Heart, title: "Fix It Library", desc: "Matt's personal recovery playbook — the same protocols that keep his athletes on the field instead of on the bench." },
  { icon: Brain, title: "AI Nutrition Scanner", desc: "Point your phone at your plate. Instant macros. No barcode scanning, no food diary busywork." },
  { icon: Dumbbell, title: "200+ Exercise Vault", desc: "Every exercise Matt prescribes — with video, coaching cues, and the 'why' behind each rep." },
  { icon: Zap, title: "Smart Logger", desc: "Tracks your sets, reps, and velocity. Auto-adjusts intensity based on how you actually feel that day." },
  { icon: BookOpen, title: "Monthly Focus", desc: "New training theme every month. Biomechanics breakdowns, community challenges, and structured progressions." },
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

        ctx.fillStyle = "#AAFFAA";
        ctx.fillText(char, x, y * fontSize);

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

      const pad = ctx.createOscillator();
      pad.type = "sine";
      pad.frequency.setValueAtTime(220, ctx.currentTime);
      pad.frequency.linearRampToValueAtTime(233, ctx.currentTime + 4);
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.08, ctx.currentTime);
      pad.connect(padGain).connect(masterGain);
      pad.start();
      oscillators.push(pad);

      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.setValueAtTime(880, ctx.currentTime);
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0.02, ctx.currentTime);
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

  useEffect(() => {
    const t = setTimeout(() => setPhase("type"), BLINK_DURATION);
    return () => clearTimeout(t);
  }, []);

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

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  useEffect(() => {
    if (showCta && ctaRef.current) {
      setTimeout(() => ctaRef.current?.scrollIntoView({ behavior: "smooth" }), 600);
    }
  }, [showCta]);

  return (
    <div className="min-h-screen bg-black text-[#33FF33] selection:bg-[#33FF33]/20 crt-screen">
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
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 text-[#33FF33]/60 hover:text-[#33FF33] text-xs font-mono transition-colors"
      >
        <ArrowLeft size={14} />
        [ESC] EXIT
      </Link>

      {/* CRT bezel frame */}
      <div className="fixed inset-0 z-[5] pointer-events-none border-[12px] md:border-[20px] border-[#1a1a1a] rounded-[8px] shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]" />

      {/* Terminal phase */}
      <div className={`min-h-screen flex items-center justify-center px-6 relative z-30 transition-opacity duration-1000 ${
        phase === "rain" || phase === "cta" ? "opacity-0 pointer-events-none" : ""
      }`}>
        <div className="max-w-3xl w-full">
          {/* Terminal header bar */}
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="font-mono text-[10px] text-[#33FF33]/40 ml-2 tracking-wider">m2training@system:~</span>
          </div>
          <div className="border border-[#33FF33]/20 bg-black/90 p-6 md:p-10">
            <div className="font-mono text-xl md:text-3xl lg:text-4xl text-center">
              {phase === "blink" && (
                <span className="inline-block w-3 h-7 md:h-9 bg-[#33FF33] animate-[cursor-blink_0.8s_step-end_infinite]" />
              )}
              {phase !== "blink" && (
                <>
                  {typed}
                  <span className="inline-block w-3 h-7 md:h-9 bg-[#33FF33] align-middle ml-0.5 animate-[cursor-blink_0.8s_step-end_infinite]" />
                </>
              )}
            </div>
          </div>
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
          {/* Matt's personal note */}
          <div className="border border-[#33FF33]/30 bg-black/90 p-6 md:p-8 mb-10 shadow-[0_0_20px_rgba(51,255,51,0.05)]">
            <p className="text-[#33FF33]/50 text-[10px] font-mono uppercase tracking-[0.3em] mb-4">
              ▌ incoming_transmission // coach_matt
            </p>
            <p className="text-[#33FF33] font-mono text-sm md:text-base leading-relaxed mb-4">
              &gt; You weren't supposed to press that.
              <br />&gt; But since you did… I like you already.
            </p>
            <p className="text-[#33FF33]/90 font-mono text-sm md:text-base leading-relaxed mb-4">
              Look — for $12.99 a month you get everything I use with my in-person clients. The same exercise library. The same recovery protocols. The same "Fix It" playbook I've spent 20 years building. You can literally point your phone at your plate and get instant macros, or snap a photo of your form mid-set and the app rewrites your next workout around what it sees. Your program adapts to YOUR body. That's not a gimmick — that's the future of training and you'd have it in your pocket.
            </p>
            <p className="text-[#33FF33]/90 font-mono text-sm md:text-base leading-relaxed mb-4">
              Here's the thing nobody wants to admit: everybody's got something. That shoulder that clicks when you reach overhead. That hip that locks up every deadlift day. That knee you've been "managing" for three years. You're not managing it. You're ignoring it. And it's getting worse.
            </p>
            <p className="text-[#33FF33]/90 font-mono text-sm md:text-base leading-relaxed mb-4">
              I'm literally known for fixing people. That's what I do. And with the membership, you get full access to every protocol, every method, every weird trick I've picked up over two decades of putting athletes back together. Use them on your own, follow along in the app — and when you really need hands on it, come see me once or twice a month in person. That's the move.
            </p>
            <p className="text-[#33FF33] font-mono text-sm md:text-base leading-relaxed font-bold">
              &gt; It's the perfect setup if you can't commit to a set schedule
              <br />&gt; but still want a coach who actually gives a damn.
            </p>
          </div>

          {/* Feature grid */}
          <h3 className="text-[#33FF33]/60 font-mono text-[10px] uppercase tracking-[0.3em] mb-5 text-center">
            ┌── WHAT YOU GET ──┐
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="border border-[#33FF33]/15 bg-black/80 p-4 hover:border-[#33FF33]/40 hover:bg-[#33FF33]/[0.03] transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <f.icon size={14} className="text-[#33FF33] flex-shrink-0" />
                  <span className="font-mono text-xs font-bold text-[#33FF33]">{f.title}</span>
                </div>
                <p className="font-mono text-[11px] text-[#33FF33]/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <div className="text-center mb-12">
            <Link
              to="/auth?redirect=/trial-welcome"
              className="inline-block bg-[#33FF33] text-black font-mono font-black text-sm md:text-base uppercase tracking-widest px-8 py-4 hover:bg-[#66FF66] hover:shadow-[0_0_40px_rgba(51,255,51,0.4)] transition-all duration-300"
            >
              Start My 14-Day Free Trial
            </Link>
            <p className="font-mono text-[10px] text-[#33FF33]/40 mt-2">
              Credit card required · Cancel anytime · $12.99/mo after trial
            </p>
          </div>

          {/* Transition — personal, then prove it */}
          <div className="border-l-2 border-[#33FF33]/30 pl-4 mb-8">
            <p className="font-mono text-sm text-[#33FF33]/80 leading-relaxed">
              If you don't believe me — and honestly, why would you, you just met me on a secret page you weren't supposed to find —
            </p>
            <p className="font-mono text-sm text-[#33FF33] leading-relaxed mt-3 font-bold">
              then let me prove it.
            </p>
          </div>

          {/* I'LL PROVE IT */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-px bg-[#33FF33]/20" />
            <div className="flex-1 h-px bg-[#33FF33]/20" />
          </div>

          <div className="text-center mb-4">
            <p className="font-mono text-2xl md:text-3xl font-black text-[#33FF33] tracking-tight animate-[pulse_2s_ease-in-out_infinite]">
              I'LL PROVE IT.
            </p>
            <p className="font-mono text-xs text-[#33FF33]/50 mt-2">
              Book one session. If I can't find the thing everyone else missed, you owe me nothing.
            </p>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-[#33FF33]/20" />
            <div className="flex-1 h-px bg-[#33FF33]/20" />
          </div>

          {/* Schedule CTA */}
          <div className="text-center mb-16">
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 border-2 border-[#33FF33] text-[#33FF33] font-mono font-black text-base md:text-lg uppercase tracking-widest px-10 py-5 hover:bg-[#33FF33] hover:text-black transition-all duration-300 hover:shadow-[0_0_40px_rgba(51,255,51,0.3)]"
            >
              <Calendar size={20} />
              SCHEDULE NOW
            </Link>
          </div>

          {/* Home link */}
          <div className="text-center pb-8">
            <Link
              to="/"
              className="font-mono text-xs text-[#33FF33]/30 hover:text-[#33FF33]/60 transition-colors"
            >
              ← return_to_reality
            </Link>
          </div>
        </div>
      </div>

      {/* CRT styles */}
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .crt-screen {
          background: radial-gradient(ellipse at center, #0a0a0a 0%, #000000 80%);
        }
        .crt-screen::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 55;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0) 0px,
            rgba(0, 0, 0, 0) 1px,
            rgba(0, 0, 0, 0.15) 1px,
            rgba(0, 0, 0, 0.15) 2px
          );
        }
        .crt-screen::after {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 54;
          pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%);
        }
      `}</style>
    </div>
  );
};

export default MatrixEasterEgg;
