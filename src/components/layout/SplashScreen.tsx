import { useState, useEffect } from "react";
import { safeSessionStorage } from "@/lib/browserStorage";

const SESSION_KEY = "m2-splash-shown";
const DISPLAY_MS = 2000;

const M_W = 200;
const M_H = 148;
const BAR_H = 32;
const PIL_W = 44;
const PIL_H = M_H - BAR_H;

const SplashScreen = () => {
  const [show, setShow] = useState(() => !safeSessionStorage.getItem(SESSION_KEY));

  useEffect(() => {
    if (!show) return;
    safeSessionStorage.setItem(SESSION_KEY, "1");
    const t = setTimeout(() => setShow(false), DISPLAY_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "hsl(var(--background))" }}
    >
      <div className="relative" style={{ width: M_W + 50, height: M_H + 50 }}>
        {/* Left pillar */}
        <div
          className="absolute"
          style={{
            left: 0,
            top: BAR_H,
            width: PIL_W,
            height: PIL_H,
            background: "linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 50%, hsl(var(--primary)) 100%)",
            boxShadow: "inset 0 2px 8px rgba(255,255,255,0.25), inset 0 -2px 6px rgba(0,0,0,0.2), 0 0 16px hsl(var(--primary) / 0.3)",
          }}
        >
          {/* Gloss highlight */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 40%, transparent 60%)",
              borderRadius: "inherit",
            }}
          />
        </div>

        {/* Right pillar */}
        <div
          className="absolute"
          style={{
            left: M_W - PIL_W,
            top: BAR_H,
            width: PIL_W,
            height: PIL_H,
            background: "linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 50%, hsl(var(--primary)) 100%)",
            boxShadow: "inset 0 2px 8px rgba(255,255,255,0.25), inset 0 -2px 6px rgba(0,0,0,0.2), 0 0 16px hsl(var(--primary) / 0.3)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 40%, transparent 60%)",
            }}
          />
        </div>

        {/* Crossbar */}
        <div
          className="absolute"
          style={{
            left: 0,
            top: 0,
            width: M_W,
            height: BAR_H,
            background: "linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 50%, hsl(var(--primary)) 100%)",
            boxShadow: "inset 0 2px 8px rgba(255,255,255,0.3), inset 0 -2px 6px rgba(0,0,0,0.15), 0 0 20px hsl(var(--primary) / 0.35)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 35%, transparent 55%)",
            }}
          />
        </div>

        {/* Superscript "2" */}
        <div
          className="absolute flex items-center justify-center"
          style={{ left: M_W + 4, top: -4 }}
        >
          <span
            className="font-bold leading-none"
            style={{
              color: "hsl(var(--primary))",
              fontSize: 36,
              textShadow: "0 0 12px hsl(var(--primary) / 0.4)",
            }}
          >
            2
          </span>
        </div>

        {/* "training" text */}
        <div
          className="absolute w-full text-center"
          style={{ top: M_H + 12, left: 0 }}
        >
          <span
            className="font-bold tracking-widest"
            style={{
              color: "hsl(var(--primary))",
              fontSize: 22,
              textShadow: "0 0 10px hsl(var(--primary) / 0.3)",
            }}
          >
            training
          </span>
        </div>

        {/* Ambient glow behind logo */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
            filter: "blur(30px)",
            zIndex: -1,
          }}
        />
      </div>
    </div>
  );
};

export default SplashScreen;
