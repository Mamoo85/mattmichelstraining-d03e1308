import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LETTERS = ["M", "²", " ", "T", "R", "A", "I", "N", "I", "N", "G"];

// Each letter drops from a random direction like a Tetris piece
const getRandomStart = (index: number) => {
  const patterns = [
    { x: -30, y: -40, rotate: -90 },
    { x: 0, y: -50, rotate: 0 },
    { x: 20, y: -35, rotate: 45 },
    { x: -15, y: -45, rotate: -45 },
    { x: 10, y: -40, rotate: 90 },
    { x: 0, y: -55, rotate: 180 },
    { x: -25, y: -30, rotate: -135 },
    { x: 15, y: -50, rotate: 60 },
    { x: -10, y: -45, rotate: -60 },
    { x: 5, y: -40, rotate: 120 },
    { x: 0, y: -35, rotate: -180 },
  ];
  return patterns[index % patterns.length];
};

const TetrisLogo = () => {
  return (
    <span className="text-primary font-bold text-sm tracking-display inline-flex">
      {LETTERS.map((letter, i) => {
        if (letter === " ") return <span key={i} className="w-1" />;
        const start = getRandomStart(i);
        return (
          <motion.span
            key={i}
            initial={{
              opacity: 0,
              x: start.x,
              y: start.y,
              rotate: start.rotate,
            }}
            animate={{
              opacity: 1,
              x: 0,
              y: 0,
              rotate: 0,
            }}
            transition={{
              delay: 0.08 * i + 0.2,
              duration: 0.5,
              ease: [0.23, 1, 0.32, 1],
            }}
            className="inline-block"
          >
            {letter}
          </motion.span>
        );
      })}
    </span>
  );
};

const SLOGANS = [
  "REAL TRAINING, REAL RESULTS",
  "THE SMART WAY TO TRAIN",
  "FIX WHAT'S BROKEN",
  "REAL STRENGTH",
];

const SloganTicker = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[12px] overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.23, 1, 0.32, 1],
          }}
          className="text-[9px] text-muted-foreground tracking-wider block absolute whitespace-nowrap"
        >
          {SLOGANS[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

/* ── Smart Slogan for Hero ── */

const PARENT_SLOGAN = "50+ college athletes. Zero injuries.\nYour kid could be next.";
const ATHLETE_SLOGAN = "Train Smarter. Get Strong. Bet.";

const isLikelyParent = (): boolean => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  // Evenings (6pm-6am) & weekends → parent
  if (day === 0 || day === 6) return true;
  if (hour >= 18 || hour < 6) return true;
  return false;
};

const SmartSlogan = () => {
  const parentFirst = isLikelyParent();
  const slogans = parentFirst
    ? [PARENT_SLOGAN, ATHLETE_SLOGAN]
    : [ATHLETE_SLOGAN, PARENT_SLOGAN];

  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Wait 6 seconds before starting to cycle
    const startTimer = setTimeout(() => {
      setStarted(true);
    }, 6000);
    return () => clearTimeout(startTimer);
  }, []);

  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % 2);
    }, 8000);
    return () => clearInterval(interval);
  }, [started]);

  return (
    <div className="min-h-[5rem] md:min-h-[6rem] flex items-center justify-center overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.h1
          key={index}
          initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -30, filter: "blur(6px)" }}
          transition={{
            duration: 0.5,
            ease: [0.23, 1, 0.32, 1],
          }}
          className="text-xl md:text-4xl lg:text-5xl font-bold tracking-display text-foreground leading-snug text-center whitespace-pre-line"
        >
          {slogans[index]}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
};

export { TetrisLogo, SloganTicker, SmartSlogan };
