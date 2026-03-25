import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, ShoppingBag, Truck, Star, RotateCcw, Ruler } from "lucide-react";

import merchTee from "@/assets/merch-classic-tee.png";
import merchLongSleeve from "@/assets/merch-long-sleeve.png";
import merchTank from "@/assets/merch-tank.png";
import merchCrewneck from "@/assets/merch-crewneck.png";
import merchHoodie from "@/assets/merch-hoodie.png";
import merchSnapback from "@/assets/merch-snapback.png";
import merchBeanie from "@/assets/merch-beanie.png";
import merchYouthHoodie from "@/assets/merch-youth-hoodie.png";

const FULL_TEXT = "You weren't supposed to find this.";
const BLINK_DURATION = 2000;
const TYPE_SPEED = 50;
const RAIN_DURATION = 3500;

const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const BONFIRE_STORE = "https://www.bonfire.com/store/m2-training/";

const ALL_PRODUCTS = [
  { name: "Premium Pullover Hoodie", price: "$66.49", img: merchHoodie, url: "https://www.bonfire.com/m2-classics/?productType=79372160-4724-45ba-b119-518d097bfbe3", tag: "Best Seller", category: "Tops" },
  { name: "Premium Unisex Tee", price: "$28.49", img: merchTee, url: "https://www.bonfire.com/m2-classics/?productType=bacf6cd6-b53d-469c-ab96-02afe5b15f71", tag: "Classic", category: "Tops" },
  { name: "Crewneck Sweatshirt", price: "$38.49", img: merchCrewneck, url: "https://www.bonfire.com/m2-classics/?productType=b2ffe678-62bc-415a-be70-acc2e9b75bbc", tag: "New", category: "Tops" },
  { name: "Long Sleeve Tee", price: "$33.49", img: merchLongSleeve, url: "https://www.bonfire.com/m2-classics/?productType=b65f9374-447d-40a6-a17c-ecbc2c823eda", category: "Tops" },
  { name: "Cotton Tank", price: "$29.49", img: merchTank, url: "https://www.bonfire.com/m2-classics/?productType=440c2166-9c34-4487-abf4-fcb388e889cb", category: "Tops" },
  { name: "Youth Hoodie", price: "$39.99", img: merchYouthHoodie, url: "https://www.bonfire.com/m2-classics/?productType=02f7d820-80e5-4fc5-9292-f4eeccd35b55", tag: "Youth", category: "Tops" },
  { name: "Snapback Hat", price: "$28.49", img: merchSnapback, url: "https://www.bonfire.com/m2-hats/?productType=24b76e56-b4e7-4478-babe-7e5cad23dbb9", category: "Accessories" },
  { name: "Cuffed Beanie", price: "$26.49", img: merchBeanie, url: "https://www.bonfire.com/m2-hats/?productType=f612e17e-71da-49e5-aa7f-f547c501e167", category: "Accessories" },
];

const SIZE_CHART = [
  { size: "S", chest: '34-36"', waist: '28-30"' },
  { size: "M", chest: '38-40"', waist: '32-34"' },
  { size: "L", chest: '42-44"', waist: '36-38"' },
  { size: "XL", chest: '46-48"', waist: '40-42"' },
  { size: "2XL", chest: '50-52"', waist: '44-46"' },
  { size: "3XL", chest: '54-56"', waist: '48-50"' },
];

/* ── Matrix Rain Canvas ─── */
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
        ctx.fillStyle = `rgba(0, 255, 65, ${0.3 + Math.random() * 0.5})`;
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
  return <canvas ref={canvasRef} className="fixed inset-0 z-10 pointer-events-none" />;
};

/* ── Ambient Audio ─── */
const useMatrixAudio = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ gain: GainNode; oscillators: OscillatorNode[] } | null>(null);

  const start = useCallback(() => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.5);
      masterGain.connect(ctx.destination);
      const oscillators: OscillatorNode[] = [];

      const drone = ctx.createOscillator();
      drone.type = "sawtooth";
      drone.frequency.setValueAtTime(55, ctx.currentTime);
      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.25, ctx.currentTime);
      const droneFilter = ctx.createBiquadFilter();
      droneFilter.type = "lowpass";
      droneFilter.frequency.setValueAtTime(180, ctx.currentTime);
      drone.connect(droneFilter).connect(droneGain).connect(masterGain);
      drone.start();
      oscillators.push(drone);

      nodesRef.current = { gain: masterGain, oscillators };
    } catch {}
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

/* ── Main Component ─── */
const MatrixMerch = () => {
  const [phase, setPhase] = useState<"blink" | "type" | "rain" | "shop">("blink");
  const [typed, setTyped] = useState("");
  const [showShop, setShowShop] = useState(false);
  const [rainFading, setRainFading] = useState(false);
  const shopRef = useRef<HTMLDivElement>(null);
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
        setTimeout(() => setPhase("rain"), 1000);
      }
    }, TYPE_SPEED);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase !== "rain") return;
    startAudio();
    const t = setTimeout(() => {
      setRainFading(true);
      setShowShop(true);
      setPhase("shop");
    }, RAIN_DURATION);
    return () => clearTimeout(t);
  }, [phase, startAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  useEffect(() => {
    if (showShop && shopRef.current) {
      setTimeout(() => shopRef.current?.scrollIntoView({ behavior: "smooth" }), 600);
    }
  }, [showShop]);

  return (
    <div className="min-h-screen bg-black text-[#33FF33] selection:bg-[#33FF33]/20 crt-merch">
      <MatrixRain active={phase === "rain" || phase === "shop"} />

      {/* Rain fade */}
      <div className={`fixed inset-0 z-20 bg-black pointer-events-none transition-opacity duration-[3000ms] ${rainFading ? "opacity-100" : "opacity-0"}`} />

      {/* ESC */}
      <Link
        to="/"
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 text-[#33FF33]/60 hover:text-[#33FF33] text-xs font-mono transition-colors"
      >
        <ArrowLeft size={14} /> [ESC] EXIT
      </Link>

      {/* CRT bezel */}
      <div className="fixed inset-0 z-[5] pointer-events-none border-[12px] md:border-[20px] border-[#1a1a1a] rounded-[8px] shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]" />

      {/* Terminal */}
      <div className={`min-h-screen flex items-center justify-center px-6 relative z-30 transition-opacity duration-1000 ${
        phase === "rain" || phase === "shop" ? "opacity-0 pointer-events-none" : ""
      }`}>
        <div className="max-w-3xl w-full">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="font-mono text-[10px] text-[#33FF33]/40 ml-2 tracking-wider">m2training@merch:~</span>
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

      {/* ═══ MERCH SHOP — fades in over rain ═══ */}
      <div
        ref={shopRef}
        className={`relative z-30 transition-all duration-[2000ms] ease-out ${
          showShop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16 pointer-events-none"
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 pb-20">
          {/* Header message */}
          <div className="border border-[#33FF33]/30 bg-black/90 p-6 md:p-8 mb-8 shadow-[0_0_20px_rgba(51,255,51,0.05)] text-center">
            <p className="text-[#33FF33]/50 text-[10px] font-mono uppercase tracking-[0.3em] mb-4">
              ▌ incoming_transmission // merch_vault
            </p>
            <p className="text-[#33FF33] font-mono text-2xl md:text-4xl font-black mb-4 leading-tight">
              NOW YOU HAVE TO BUY
            </p>
            <p className="text-[#33FF33] font-mono text-lg md:text-xl mb-2">
              or it's bad luck, probably.
            </p>
            <p className="text-[#33FF33]/50 font-mono text-xs mt-4">
              &gt; Look, you clicked the secret link. The Matrix showed you the gear.
              <br />&gt; It would be cosmically irresponsible to leave empty-handed.
              <br />&gt; Don't anger the algorithm. Just pick a hoodie.
            </p>
          </div>

          {/* Info strip */}
          <div className="border border-[#33FF33]/15 bg-black/60 mb-6">
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 py-3 px-4">
              {[
                { icon: Truck, text: "Free shipping over $60" },
                { icon: Star, text: "Premium prints" },
                { icon: RotateCcw, text: "Easy returns" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-[10px] text-[#33FF33]/60 font-mono">
                  <Icon size={12} className="text-[#33FF33]" />
                  <span className="uppercase tracking-wider">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Product Grid — Matrix styled */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {ALL_PRODUCTS.map((item, i) => (
              <a
                key={item.name}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group relative border border-[#33FF33]/15 bg-black/80 hover:border-[#33FF33]/50 hover:bg-[#33FF33]/[0.03] overflow-hidden transition-all duration-300"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {item.tag && (
                  <span className="absolute top-2 left-2 z-10 bg-[#33FF33] text-black text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5">
                    {item.tag}
                  </span>
                )}
                <div className="aspect-square bg-[#0a0a0a] overflow-hidden">
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-[#33FF33]/40">
                    {item.category}
                  </span>
                  <h3 className="text-xs font-mono font-bold text-[#33FF33] group-hover:text-[#66FF66] transition-colors mt-0.5 leading-tight">
                    {item.name}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-base font-mono font-black text-[#33FF33]">{item.price}</span>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-[#33FF33]/40 group-hover:text-[#33FF33] transition-colors flex items-center gap-1">
                      Buy <ExternalLink size={9} />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Browse all CTA */}
          <div className="text-center mb-10">
            <a
              href={BONFIRE_STORE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#33FF33] text-black font-mono font-black text-sm uppercase tracking-widest px-8 py-4 hover:bg-[#66FF66] hover:shadow-[0_0_40px_rgba(51,255,51,0.4)] transition-all duration-300"
            >
              <ShoppingBag size={16} /> Browse Full Collection
            </a>
            <p className="font-mono text-[10px] text-[#33FF33]/30 mt-3">
              "I didn't buy anything from the secret Matrix merch page" — said no legend ever
            </p>
          </div>

          {/* Size Guide */}
          <div className="border border-[#33FF33]/15 bg-black/80 p-5 md:p-7 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Ruler size={14} className="text-[#33FF33]" />
              <h3 className="font-mono text-sm font-bold text-[#33FF33] uppercase tracking-widest">
                Size Guide
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full max-w-md text-sm font-mono">
                <thead>
                  <tr className="border-b border-[#33FF33]/20">
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-[#33FF33]">Size</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-[#33FF33]">Chest</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-[#33FF33]">Waist</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZE_CHART.map((row) => (
                    <tr key={row.size} className="border-b border-[#33FF33]/10 hover:bg-[#33FF33]/[0.03] transition-colors">
                      <td className="py-2 px-3 font-bold text-[#33FF33]">{row.size}</td>
                      <td className="py-2 px-3 text-[#33FF33]/60">{row.chest}</td>
                      <td className="py-2 px-3 text-[#33FF33]/60">{row.waist}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .crt-merch {
          background: radial-gradient(ellipse at center, #0a0a0a 0%, #000000 80%);
        }
        .crt-merch::before {
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
        .crt-merch::after {
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

export default MatrixMerch;
