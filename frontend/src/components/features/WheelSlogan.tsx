import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLOGANS = [
  "Real coaching. Real results.",
  "Train smarter. Get stronger.",
  "Strength Training Fundamentals.",
  "Your kid's secret weapon.",
  "I make athletes, every age.",
];

const WheelSlogan = () => {
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started) return;
    const iv = setInterval(() => {
      setIndex((p) => (p + 1) % SLOGANS.length);
    }, 5000);
    return () => clearInterval(iv);
  }, [started]);

  return (
    <span
      className="inline-flex items-center justify-center text-primary"
      style={{ perspective: 800, minHeight: "1.4em" }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="inline-block text-center"
          initial={{ rotateX: 90, opacity: 0, y: -10 }}
          animate={{ rotateX: 0, opacity: 1, y: 0 }}
          exit={{ rotateX: -90, opacity: 0, y: 10 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ transformStyle: "preserve-3d", transformOrigin: "center center" }}
        >
          {SLOGANS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export default WheelSlogan;
