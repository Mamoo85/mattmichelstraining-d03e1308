import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LETTERS = ["M", "²", " ", "T", "R", "A", "I", "N", "I", "N", "G"];

// Each letter drops from a random direction like a Tetris piece
const getRandomStart = (index: number) => {
  const patterns = [
    { x: -30, y: -40, rotate: -90 },   // from top-left
    { x: 0, y: -50, rotate: 0 },       // straight down
    { x: 20, y: -35, rotate: 45 },     // from top-right
    { x: -15, y: -45, rotate: -45 },   // angled left
    { x: 10, y: -40, rotate: 90 },     // rotated right
    { x: 0, y: -55, rotate: 180 },     // flipped
    { x: -25, y: -30, rotate: -135 },  // steep left
    { x: 15, y: -50, rotate: 60 },     // angled
    { x: -10, y: -45, rotate: -60 },   // counter
    { x: 5, y: -40, rotate: 120 },     // wide spin
    { x: 0, y: -35, rotate: -180 },    // full flip
  ];
  return patterns[index % patterns.length];
};

const TetrisLogo = () => {
  const [assembled, setAssembled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAssembled(true), 1800);
    return () => clearTimeout(timer);
  }, []);

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
              ease: [0.23, 1, 0.32, 1], // custom cubic for that "lock in" feel
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

export { TetrisLogo, SloganTicker };
