import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";
import { getLevelInfo } from "@/hooks/usePoints";

interface LevelUpCelebrationProps {
  levelKey: string | null;
  onDismiss: () => void;
}

const LEVEL_EMOJIS: Record<string, string> = {
  grinder: "🔥",
  competitor: "⚡",
  beast: "💪",
  legend: "👑",
};

const LevelUpCelebration = ({ levelKey, onDismiss }: LevelUpCelebrationProps) => {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

  useEffect(() => {
    if (!levelKey) return;
    // Generate burst particles
    const p = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 300,
      y: (Math.random() - 0.5) * 300 - 100,
      delay: Math.random() * 0.3,
    }));
    setParticles(p);

    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [levelKey, onDismiss]);

  if (!levelKey) return null;

  const level = getLevelInfo(
    levelKey === "grinder" ? 500 : levelKey === "competitor" ? 1500 : levelKey === "beast" ? 4000 : 10000
  );
  const emoji = LEVEL_EMOJIS[levelKey] || "🎉";

  return (
    <AnimatePresence>
      {levelKey && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-auto"
            onClick={onDismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Particles */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute w-2 h-2 bg-primary rounded-full"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
              transition={{ duration: 1.2, delay: p.delay, ease: "easeOut" }}
            />
          ))}

          {/* Card */}
          <motion.div
            className="relative z-10 bg-card border-2 border-primary shadow-2xl px-8 py-10 max-w-sm w-full mx-4 text-center pointer-events-auto"
            initial={{ scale: 0.3, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 15, stiffness: 200 }}
          >
            {/* Pulsing glow ring */}
            <motion.div
              className="absolute inset-0 border-2 border-primary/30"
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Trophy icon */}
            <motion.div
              className="mx-auto w-16 h-16 bg-primary/15 flex items-center justify-center mb-4"
              animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <Trophy size={32} className="text-primary" />
            </motion.div>

            {/* Emoji */}
            <motion.div
              className="text-5xl mb-3"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.4, 1] }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {emoji}
            </motion.div>

            <motion.p
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Level Up!
            </motion.p>

            <motion.h2
              className={`text-2xl font-black uppercase tracking-wider ${level.color} mb-2`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {level.label}
            </motion.h2>

            <motion.p
              className="text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              You've reached a new rank. Keep grinding!
            </motion.p>

            <motion.button
              onClick={onDismiss}
              className="mt-6 px-6 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              Let's Go
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LevelUpCelebration;
