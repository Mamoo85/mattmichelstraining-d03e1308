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
    const t = setTimeout(() => setStarted(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started) return;
    const iv = setInterval(() => {
      setIndex((p) => (p + 1) % SLOGANS.length);
    }, 4000);
    return () => clearInterval(iv);
  }, [started]);

  const slogan = SLOGANS[index];

  return (
    <span className="inline-block text-primary" style={{ perspective: 600 }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="inline-block"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={{
            visible: { transition: { staggerChildren: 0.03 } },
            exit: { opacity: 0, transition: { duration: 0.15 } },
          }}
        >
          {slogan.split("").map((char, i) => (
            <motion.span
              key={`${index}-${i}`}
              className="inline-block"
              style={{ transformStyle: "preserve-3d" }}
              variants={{
                hidden: { rotateX: -90, opacity: 0 },
                visible: {
                  rotateX: 0,
                  opacity: 1,
                  transition: { duration: 0.4, ease: "easeOut" },
                },
              }}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export default WheelSlogan;
