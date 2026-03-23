import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { safeSessionStorage } from "@/lib/browserStorage";

const SESSION_KEY = "m2-splash-shown";
const FADE_OUT_DELAY = 2.4; // total time before fade-out starts

const dropVariant = (delay: number) => ({
  initial: { y: -200, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay },
  },
});

const slideVariant = {
  initial: { x: 50, opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" as const, delay: 0.7 },
  },
};

const SplashScreen = () => {
  const [show, setShow] = useState(() => !safeSessionStorage.getItem(SESSION_KEY));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!show) return;
    safeSessionStorage.setItem(SESSION_KEY, "1");
    const timer = setTimeout(() => setDone(true), FADE_OUT_DELAY * 1000 + 600);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show || done) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: FADE_OUT_DELAY }}
          onAnimationComplete={(def: any) => {
            if (def?.opacity === 0) setDone(true);
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Ambient glow */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 280,
              height: 280,
              background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.7, 0.4], scale: [0.5, 1.1, 1] }}
            transition={{ delay: 1.0, duration: 1.5, ease: "easeOut" }}
          />

          {/* M² letterform — 160×160 container */}
          <div className="relative" style={{ width: 160, height: 160 }}>
            {/* Left vertical bar of M */}
            <motion.div
              {...dropVariant(0.1)}
              className="absolute bottom-0 left-0"
              style={{
                width: 40,
                height: 160,
                background: "hsl(var(--foreground))",
                boxShadow: "0 0 20px hsl(var(--foreground) / 0.15)",
              }}
            />

            {/* Right vertical bar of M */}
            <motion.div
              {...dropVariant(0.3)}
              className="absolute bottom-0"
              style={{
                right: 40,
                width: 40,
                height: 160,
                background: "hsl(var(--foreground))",
                boxShadow: "0 0 20px hsl(var(--foreground) / 0.15)",
              }}
            />

            {/* Top crossbar (primary/red) */}
            <motion.div
              {...dropVariant(0.5)}
              className="absolute top-0 z-10"
              style={{
                left: 40,
                width: 80,
                height: 40,
                background: "hsl(var(--primary))",
                boxShadow: "0 0 24px hsl(var(--primary) / 0.4)",
              }}
            />

            {/* Superscript "2" block */}
            <motion.div
              {...slideVariant}
              className="absolute bottom-0 right-0 z-10 flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                background: "hsl(var(--primary))",
                boxShadow: "0 0 24px hsl(var(--primary) / 0.4)",
              }}
            >
              <span
                className="font-black text-2xl leading-none"
                style={{ color: "hsl(var(--primary-foreground))" }}
              >
                2
              </span>
            </motion.div>

            {/* Shine sweep after assembly */}
            <motion.div
              initial={{ x: "-130%" }}
              animate={{ x: "130%" }}
              transition={{ delay: 1.4, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                background:
                  "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.45) 40%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.45) 60%, transparent 75%)",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
