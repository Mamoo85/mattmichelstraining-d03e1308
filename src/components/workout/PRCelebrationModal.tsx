import { useState, useRef, useCallback } from "react";
import { Trophy, Download, Share2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import html2canvas from "html2canvas";
import PRShareCard from "./PRShareCard";
import { toast } from "sonner";

export interface DetectedPR {
  exerciseTitle: string;
  weight: number;
  reps: number;
  prType: "weight" | "volume";
  previousBest?: number;
}

interface PRCelebrationModalProps {
  prs: DetectedPR[];
  athleteName: string;
  date: Date;
  onClose: () => void;
}

const PRCelebrationModal = ({ prs, athleteName, date, onClose }: PRCelebrationModalProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentPR = prs[currentIndex];

  const handleExport = useCallback(async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        width: 1080,
        height: 1080,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1.0)
      );

      if (!blob) throw new Error("Failed to render image");

      const file = new File([blob], `M2-PR-${currentPR.exerciseTitle.replace(/\s+/g, "-")}.png`, {
        type: "image/png",
      });

      // Try native share first (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `New PR: ${currentPR.exerciseTitle}`,
          text: `🏆 NEW PR: ${currentPR.exerciseTitle} - ${currentPR.weight} lbs × ${currentPR.reps} reps | Trained on the M2 Portal`,
          files: [file],
        });
        toast.success("Shared!");
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image saved! Share it on Instagram 📸");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("Failed to export image");
      }
    } finally {
      setExporting(false);
    }
  }, [currentPR, exporting]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Hidden share card for html2canvas */}
      <PRShareCard
        ref={cardRef}
        athleteName={athleteName}
        exerciseName={currentPR.exerciseTitle}
        weight={currentPR.weight}
        reps={currentPR.reps}
        prType={currentPR.prType}
        date={date}
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="w-full max-w-sm"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-2"
        >
          <X size={20} />
        </button>

        {/* Celebration content */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="text-6xl mb-3"
          >
            🏆
          </motion.div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-black text-white uppercase tracking-wider"
          >
            New Personal Record!
          </motion.h2>
        </div>

        {/* PR Card preview */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] border border-primary/30 rounded-lg p-6 mb-4"
        >
          <div className="text-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60">
              {currentPR.prType === "weight" ? "Weight PR" : "Volume PR"}
            </span>
            <h3 className="text-lg font-black text-white uppercase mt-1 mb-3">
              {currentPR.exerciseTitle}
            </h3>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-black text-primary">{currentPR.weight}</span>
              <span className="text-sm text-white/40">lbs</span>
              <span className="text-2xl text-white/20">×</span>
              <span className="text-4xl font-black text-white">{currentPR.reps}</span>
              <span className="text-sm text-white/40">reps</span>
            </div>
            {currentPR.previousBest != null && (
              <p className="text-[10px] text-white/30 mt-2 uppercase tracking-wider">
                Previous best: {currentPR.previousBest} lbs
              </p>
            )}
          </div>
        </motion.div>

        {/* Navigation for multiple PRs */}
        {prs.length > 1 && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="text-white/50 hover:text-white disabled:opacity-20"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-xs text-white/40 font-mono">
              {currentIndex + 1} / {prs.length} PRs
            </span>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(prs.length - 1, i + 1))}
              disabled={currentIndex === prs.length - 1}
              className="text-white/50 hover:text-white disabled:opacity-20"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="space-y-3"
        >
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-primary text-primary-foreground py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 rounded-lg"
          >
            {exporting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Rendering...
              </span>
            ) : (
              <>
                <Share2 size={16} /> Share to Instagram / Save Image
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors"
          >
            Skip — Continue to Summary
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PRCelebrationModal;
