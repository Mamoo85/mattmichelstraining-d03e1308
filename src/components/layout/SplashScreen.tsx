import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { safeSessionStorage } from "@/lib/browserStorage";

const SESSION_KEY = "m2-splash-shown";

// Dimensions from the RN version
const M_W = 200;
const M_H = 148;
const BAR_H = 32;
const PIL_W = 44;
const PIL_H = M_H - BAR_H; // 116

const springUp = { type: "spring" as const, stiffness: 160, damping: 12 };
const springDrop = { type: "spring" as const, stiffness: 180, damping: 8 };

const SplashScreen = () => {
  const [show, setShow] = useState(() => !safeSessionStorage.getItem(SESSION_KEY));
  const [phase, setPhase] = useState(0); // 0=assemble, 1=flash, 2=sup+tag, 3=crossfade, 4=exit

  useEffect(() => {
    if (!show) return;
    safeSessionStorage.setItem(SESSION_KEY, "1");

    // Phase timeline (cumulative ms)
    const timers = [
      setTimeout(() => setPhase(1), 700),   // flash after pillars+bar land
      setTimeout(() => setPhase(2), 850),   // superscript + tag
      setTimeout(() => setPhase(3), 1400),  // crossfade to done
      setTimeout(() => setPhase(4), 2200),  // exit
      setTimeout(() => setShow(false), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [show]);

  if (!show) return null;

  return (
    <AnimatePresence>
      {phase < 5 && (
        <motion.div
          key="splash"
          initial={{ opacity: 1, scale: 1 }}
          animate={{
            opacity: phase >= 4 ? 0 : 1,
            scale: phase >= 4 ? 1.1 : 1,
          }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Ambient glow */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 240,
              height: 240,
              background: "radial-gradient(circle, hsl(var(--primary) / 0.35) 0%, transparent 70%)",
              filter: "blur(40px)",
              transform: "scaleY(0.4)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 3 ? 0.5 : 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* M-block assembly */}
          <div className="relative" style={{ width: M_W + 50, height: M_H + 50 }}>

            {/* Left pillar — drops UP from below */}
            <motion.div
              className="absolute"
              style={{
                left: 0,
                top: BAR_H,
                width: PIL_W,
                height: PIL_H,
                background: "hsl(var(--primary))",
              }}
              initial={{ y: 220, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...springUp, delay: 0 }}
            />

            {/* Right pillar — drops UP from below */}
            <motion.div
              className="absolute"
              style={{
                left: M_W - PIL_W,
                top: BAR_H,
                width: PIL_W,
                height: PIL_H,
                background: "hsl(var(--primary))",
              }}
              initial={{ y: 220, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...springUp, delay: 0.04 }}
            />

            {/* Crossbar — drops DOWN from above */}
            <motion.div
              className="absolute"
              style={{
                left: 0,
                top: 0,
                width: M_W,
                height: BAR_H,
                background: "hsl(var(--primary))",
              }}
              initial={{ y: -180, opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                scaleY: phase === 1 ? 1.14 : 1,
              }}
              transition={phase === 1
                ? { type: "spring", stiffness: 400, damping: 6, duration: 0.08 }
                : { ...springDrop, delay: 0.145 }
              }
            />

            {/* Flash overlay on crossbar impact */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: 0,
                top: 0,
                width: M_W,
                height: BAR_H,
                background: "#ffffff",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === 1 ? 0.65 : 0 }}
              transition={{ duration: phase === 1 ? 0.05 : 0.15 }}
            />

            {/* Superscript "2" — pops in to the right */}
            <motion.div
              className="absolute flex items-center justify-center"
              style={{
                left: M_W + 4,
                top: -4,
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{
                opacity: phase >= 2 ? 1 : 0,
                scale: phase >= 2 ? 1 : 0.4,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              <span
                className="font-bold leading-none"
                style={{
                  color: "hsl(var(--primary))",
                  fontSize: 36,
                }}
              >
                2
              </span>
            </motion.div>

            {/* "training" text below */}
            <motion.div
              className="absolute w-full text-center"
              style={{
                top: M_H + 12,
                left: 0,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 2 ? 1 : 0 }}
              transition={{ duration: 0.25 }}
            >
              <span
                className="font-bold tracking-widest"
                style={{
                  color: "hsl(var(--primary))",
                  fontSize: 22,
                }}
              >
                training
              </span>
            </motion.div>

            {/* Shine sweep after full assembly */}
            {phase >= 2 && phase < 4 && (
              <motion.div
                className="absolute pointer-events-none z-20"
                style={{
                  left: 0,
                  top: 0,
                  width: M_W,
                  height: M_H,
                  background:
                    "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.4) 40%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0.4) 60%, transparent 75%)",
                }}
                initial={{ x: -M_W * 1.3 }}
                animate={{ x: M_W * 1.3 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
