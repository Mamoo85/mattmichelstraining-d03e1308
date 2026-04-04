import { useEffect, useState, useCallback } from "react";
import { Trophy, Share2, X, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PRCelebrationProps {
  exerciseName: string;
  newWeight: number;
  previousBest: number;
  reps?: number;
  pointsAwarded?: number;
  onDismiss: () => void;
  onShare?: () => void;
}

const CONFETTI_COLORS = [
  "#f97316", "#22c55e", "#eab308", "#ef4444", "#3b82f6", "#a855f7", "#ec4899",
];

const ConfettiPiece = ({ index }: { index: number }) => {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = Math.random() * 100;
  const delay = Math.random() * 0.8;
  const duration = 1.5 + Math.random() * 1.5;
  const size = 6 + Math.random() * 6;
  const rotation = Math.random() * 360;

  return (
    <div
      className="absolute top-0 pointer-events-none"
      style={{
        left: `${left}%`,
        width: size,
        height: size * (Math.random() > 0.5 ? 1 : 2.5),
        background: color,
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
        animation: `confetti-fall ${duration}s ease-out ${delay}s forwards`,
        transform: `rotate(${rotation}deg)`,
        opacity: 0,
      }}
    />
  );
};

const PRCelebration = ({
  exerciseName,
  newWeight,
  previousBest,
  reps,
  pointsAwarded = 50,
  onDismiss,
  onShare,
}: PRCelebrationProps) => {
  const [visible, setVisible] = useState(true);
  const improvement = previousBest > 0 ? newWeight - previousBest : 0;

  // No auto-dismiss — user must tap/click to close

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 400);
  }, [onDismiss]);

  const handleShare = useCallback(() => {
    if (onShare) {
      onShare();
    } else if (navigator.share) {
      navigator.share({
        title: `New PR: ${exerciseName}`,
        text: `Just hit ${newWeight} lbs on ${exerciseName}! 🏆 ${improvement > 0 ? `+${improvement} lbs over my previous best!` : "First PR logged!"} #M2Training`,
      }).catch(() => {});
    }
  }, [onShare, exerciseName, newWeight, improvement]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
          onClick={handleDismiss}
        >
          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 60 }).map((_, i) => (
              <ConfettiPiece key={i} index={i} />
            ))}
          </div>

          {/* Card */}
          <motion.div
            initial={{ scale: 0.5, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 200 }}
            className="relative mx-6 max-w-sm w-full rounded-3xl p-6 text-center space-y-4"
            style={{
              background: "linear-gradient(160deg, rgba(249,115,22,0.15), rgba(34,197,94,0.1), rgba(10,10,10,0.95))",
              border: "2px solid rgba(249,115,22,0.4)",
              boxShadow: "0 0 60px rgba(249,115,22,0.2), 0 0 120px rgba(249,115,22,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <X size={14} style={{ color: "#737373" }} />
            </button>

            {/* Trophy icon */}
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: "spring", damping: 10, stiffness: 200 }}
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(249,115,22,0.3), rgba(234,179,8,0.2))",
                boxShadow: "0 0 40px rgba(249,115,22,0.3)",
              }}
            >
              <Trophy size={40} style={{ color: "#f97316" }} />
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: "#fafafa" }}>
                NEW PR! 🔥
              </h2>
              <p className="text-sm font-bold mt-1" style={{ color: "#f97316" }}>
                {exerciseName}
              </p>
            </motion.div>

            {/* Weight display */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", damping: 12 }}
              className="py-4"
            >
              <p className="text-5xl font-black" style={{ color: "#fafafa" }}>
                {newWeight}
                <span className="text-lg ml-1" style={{ color: "#a3a3a3" }}>lbs</span>
              </p>
              {reps && (
                <p className="text-xs mt-1" style={{ color: "#737373" }}>
                  × {reps} reps
                </p>
              )}
            </motion.div>

            {/* Improvement */}
            {improvement > 0 && (
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <span className="text-xs font-bold" style={{ color: "#22c55e" }}>
                  ↑ +{improvement} lbs over previous best ({previousBest} lbs)
                </span>
              </motion.div>
            )}
            {previousBest === 0 && (
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}
              >
                <Star size={12} style={{ color: "#f97316" }} />
                <span className="text-xs font-bold" style={{ color: "#f97316" }}>
                  First recorded lift!
                </span>
              </motion.div>
            )}

            {/* Points */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex items-center justify-center gap-1"
            >
              <span className="text-xs font-bold" style={{ color: "#eab308" }}>+{pointsAwarded} M2 Points earned</span>
            </motion.div>

            {/* Share button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="pt-2 space-y-2"
            >
              <button
                onClick={handleShare}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff" }}
              >
                <Share2 size={16} /> Share Your PR
              </button>
              <button
                onClick={handleDismiss}
                className="w-full py-2 text-xs font-bold uppercase tracking-widest transition-colors"
                style={{ color: "#525252" }}
              >
                Dismiss
              </button>
            </motion.div>
          </motion.div>

          {/* Confetti CSS */}
          <style>{`
            @keyframes confetti-fall {
              0% { opacity: 1; transform: translateY(-20px) rotate(0deg); }
              100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PRCelebration;
