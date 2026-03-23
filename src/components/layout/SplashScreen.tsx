import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import m2Logo from "@/assets/m2-logo.jpg";
import { safeSessionStorage } from "@/lib/browserStorage";

const GRID = 5;
const TOTAL = GRID * GRID;
const STAGGER = 0.12;
const DROP_DURATION = 0.7;
const TILES_DONE = TOTAL * STAGGER + DROP_DURATION + 0.3;
const SHINE1_DELAY = TILES_DONE + 0.2;
const SHINE2_DELAY = SHINE1_DELAY + 0.6;
const GLOW_DELAY = TILES_DONE + 0.1;
const FADE_DELAY = SHINE2_DELAY + 1.0;
const SESSION_KEY = "m2-splash-shown";

/** Tetris-style: tiles drop straight down from staggered heights */
const tetrisStart = (col: number, row: number, i: number) => ({
  x: 0,
  y: -800 - row * 60 - Math.abs(Math.sin(i * 5.3)) * 200,
  rotate: (Math.sin(i * 7.1) > 0 ? 1 : -1) * (90 + Math.random() * 90),
});

const SplashScreen = () => {
  const [show, setShow] = useState(() => !safeSessionStorage.getItem(SESSION_KEY));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!show) return;
    safeSessionStorage.setItem(SESSION_KEY, "1");
    const timer = setTimeout(() => setDone(true), FADE_DELAY * 1000 + 600);
    return () => clearTimeout(timer);
  }, [show]);

  // Drop order: column by column, bottom row first (like real Tetris)
  const tiles = useMemo(() => {
    const arr = Array.from({ length: TOTAL }, (_, i) => {
      const row = Math.floor(i / GRID);
      const col = i % GRID;
      const start = tetrisStart(col, row, i);
      // Stagger: process columns left-to-right, within each column bottom row first
      const dropOrder = col * GRID + (GRID - 1 - row);
      return { row, col, ...start, i, dropOrder };
    });
    return arr;
  }, []);

  if (!show || done) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: FADE_DELAY }}
          onAnimationComplete={(def: any) => {
            if (def?.opacity === 0) setDone(true);
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Ambient glow behind logo */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 340,
              height: 340,
              background: "radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.8, 0.5], scale: [0.5, 1.1, 1] }}
            transition={{ delay: GLOW_DELAY, duration: 1.5, ease: "easeOut" }}
          />

          {/* Tetris grid */}
          <div className="relative" style={{ width: 280, height: 280 }}>
            <div className="relative w-full h-full" style={{ perspective: 900 }}>
              {tiles.map(({ row, col, x, y, rotate, i, dropOrder }) => {
                const tileW = 100 / GRID;
                return (
                  <motion.div
                    key={i}
                    initial={{ x, y, rotate, opacity: 0, scale: 0.7 }}
                    animate={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
                    transition={{
                      delay: dropOrder * STAGGER,
                      duration: DROP_DURATION,
                      type: "spring",
                      damping: 14,
                      stiffness: 120,
                      mass: 0.8,
                    }}
                    className="absolute overflow-hidden"
                    style={{
                      width: `${tileW}%`,
                      height: `${tileW}%`,
                      left: `${col * tileW}%`,
                      top: `${row * tileW}%`,
                      borderRadius: 2,
                      boxShadow: "0 0 8px hsl(var(--primary) / 0.15)",
                    }}
                  >
                    {/* Full-color tile — no grey, fully saturated */}
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: `url(${m2Logo})`,
                        backgroundSize: `${GRID * 100}% ${GRID * 100}%`,
                        backgroundPosition: `${(col * 100) / (GRID - 1)}% ${(row * 100) / (GRID - 1)}%`,
                        filter: "saturate(1.3) contrast(1.1) brightness(1.05)",
                      }}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Primary shine sweep */}
            <motion.div
              initial={{ x: "-130%" }}
              animate={{ x: "130%" }}
              transition={{
                delay: SHINE1_DELAY,
                duration: 0.8,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: 2,
                background:
                  "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.5) 40%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.5) 60%, transparent 75%)",
              }}
            />

            {/* Second shine sweep — tighter, brighter */}
            <motion.div
              initial={{ x: "-130%" }}
              animate={{ x: "130%" }}
              transition={{
                delay: SHINE2_DELAY,
                duration: 0.6,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: 2,
                background:
                  "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.3) 44%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.3) 56%, transparent 70%)",
              }}
            />

            {/* Edge glow border that pulses in */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: 2,
                border: "1px solid hsl(var(--primary) / 0.4)",
                boxShadow:
                  "inset 0 0 20px hsl(var(--primary) / 0.1), 0 0 30px hsl(var(--primary) / 0.15)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6] }}
              transition={{ delay: GLOW_DELAY, duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
