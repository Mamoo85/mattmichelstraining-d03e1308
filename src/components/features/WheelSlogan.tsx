import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLOGANS = [
  "Real coaching.\nReal results.",
  "Train smarter.\nGet stronger.",
  "Strength Training\nFundamentals.",
  "Your kid's\nsecret weapon.",
  "I make athletes,\nevery age.",
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

  const slogan = SLOGANS[index];

  return (
    <span
      className="inline-flex flex-col items-center text-primary"
      style={{ perspective: 800, minHeight: "2.6em" }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="inline-block whitespace-pre-line text-center"
          initial={{ rotateX: 90, opacity: 0, y: -20 }}
          animate={{ rotateX: 0, opacity: 1, y: 0 }}
          exit={{ rotateX: -90, opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ transformStyle: "preserve-3d", transformOrigin: "center center" }}
        >
          {slogan}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export default WheelSlogan;
