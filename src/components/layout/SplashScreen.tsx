import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import m2Logo from "@/assets/m2-logo.jpg";
import { safeSessionStorage } from "@/lib/browserStorage";

const GRID = 5;
const TOTAL = GRID * GRID;
const STAGGER = 0.06;
const DROP_DURATION = 0.6;
const SHINE_DELAY = TOTAL * STAGGER + DROP_DURATION + 0.3; // after all tiles land
const FADE_DELAY = SHINE_DELAY + 0.9;
const SESSION_KEY = "m2-splash-shown";

const randomStart = (seed: number) => ({
  x: (Math.sin(seed * 13.7) * 300),
  y: -600 - Math.abs(Math.cos(seed * 7.3) * 400),
  rotate: Math.sin(seed * 11.1) * 270,
});

const SplashScreen = () => {
  const [show, setShow] = useState(() => {
    return !safeSessionStorage.getItem(SESSION_KEY);
  });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!show) return;
    safeSessionStorage.setItem(SESSION_KEY, "1");
    const timer = setTimeout(() => setDone(true), FADE_DELAY * 1000 + 400);
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
          transition={{ duration: 0.4, delay: FADE_DELAY }}
          onAnimationComplete={(def: any) => {
            if (def?.opacity === 0) setDone(true);
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Tetris grid */}
          <div className="relative" style={{ width: 260, height: 260 }}>
            {/* Perspective wrapper */}
            <div
              className="relative w-full h-full"
              style={{ perspective: 800 }}
            >
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
                      stiffness: 120,
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
                duration: 0.8,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="absolute inset-0 pointer-events-none rounded-lg"
              style={{
                background:
                  "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.35) 55%, transparent 70%)",
              }}
            />
          </div>

          {/* Brand text */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: SHINE_DELAY - 0.2, duration: 0.5 }}
            className="absolute bottom-[28%] text-xs tracking-widest text-muted-foreground font-brand"
          >
            M² TRAINING
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
