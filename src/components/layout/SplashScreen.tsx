import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import m2Logo from "@/assets/m2-logo.jpg";
import { safeSessionStorage } from "@/lib/browserStorage";

const GRID = 5;
const TOTAL = GRID * GRID;
const STAGGER = 0.09;
const DROP_DURATION = 0.8;
const TILES_DONE = TOTAL * STAGGER + DROP_DURATION + 0.4;
const SHINE_DELAY = TILES_DONE + 0.3;
const TEXT_START = TILES_DONE + 0.1;
const FADE_DELAY = SHINE_DELAY + 1.2;
const SESSION_KEY = "m2-splash-shown";

const BRAND_LETTERS = ["M", "²", " ", "T", "R", "A", "I", "N", "I", "N", "G"];

const randomStart = (seed: number) => ({
  x: Math.sin(seed * 13.7) * 300,
  y: -600 - Math.abs(Math.cos(seed * 7.3) * 400),
  rotate: Math.sin(seed * 11.1) * 270,
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

  const tiles = useMemo(() => {
    return Array.from({ length: TOTAL }, (_, i) => {
      const row = Math.floor(i / GRID);
      const col = i % GRID;
      const start = randomStart(i);
      return { row, col, ...start, i };
    });
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
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Tetris grid */}
          <div className="relative" style={{ width: 260, height: 260 }}>
            <div className="relative w-full h-full" style={{ perspective: 800 }}>
              {tiles.map(({ row, col, x, y, rotate, i }) => {
                const tileW = 100 / GRID;
                return (
                  <motion.div
                    key={i}
                    initial={{ x, y, rotate, opacity: 0, scale: 0.6 }}
                    animate={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
                    transition={{
                      delay: i * STAGGER,
                      duration: DROP_DURATION,
                      type: "spring",
                      damping: 18,
                      stiffness: 100,
                    }}
                    className="absolute rounded-sm overflow-hidden"
                    style={{
                      width: `${tileW}%`,
                      height: `${tileW}%`,
                      left: `${col * tileW}%`,
                      top: `${row * tileW}%`,
                    }}
                  >
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: `url(${m2Logo})`,
                        backgroundSize: `${GRID * 100}% ${GRID * 100}%`,
                        backgroundPosition: `${(col * 100) / (GRID - 1)}% ${(row * 100) / (GRID - 1)}%`,
                      }}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Shine sweep overlay */}
            <motion.div
              initial={{ x: "-120%" }}
              animate={{ x: "120%" }}
              transition={{
                delay: SHINE_DELAY,
                duration: 1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="absolute inset-0 pointer-events-none rounded-lg"
              style={{
                background:
                  "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.35) 55%, transparent 70%)",
              }}
            />
          </div>

          {/* Brand text — each letter animates in */}
          <div className="flex items-center justify-center">
            {BRAND_LETTERS.map((letter, i) => {
              if (letter === " ") return <span key={i} className="w-1.5" />;
              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 12, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: TEXT_START + i * 0.07,
                    duration: 0.4,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  className="text-sm tracking-[0.2em] text-muted-foreground font-brand inline-block"
                >
                  {letter}
                </motion.span>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
