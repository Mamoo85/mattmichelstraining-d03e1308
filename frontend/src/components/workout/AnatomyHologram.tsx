import { memo, useEffect, useState } from "react";
import { X, Activity, Trophy, Dumbbell, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AnatomyHologramProps {
  exerciseTitle: string;
  exerciseId?: string;
  onClose: () => void;
}

interface PRData {
  heaviestWeight: number;
  maxVolume: number;
  bestReps: number;
  totalSets: number;
}

const AnatomyHologram = memo(({ exerciseTitle, exerciseId, onClose }: AnatomyHologramProps) => {
  const { user } = useAuth();
  const [prData, setPrData] = useState<PRData | null>(null);
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);

  // Fetch reference image from exercise_library
  useEffect(() => {
    if (!exerciseId && !exerciseTitle) return;
    const query = exerciseId
      ? supabase.from("exercise_library").select("image_url").eq("id", exerciseId).maybeSingle()
      : supabase.from("exercise_library").select("image_url").ilike("title", exerciseTitle).limit(1).maybeSingle();
    query.then(({ data }) => {
      if (data?.image_url) setRefImageUrl(data.image_url);
    });
  }, [exerciseId, exerciseTitle]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("progress_logs")
      .select("weight, reps")
      .eq("user_id", user.id)
      .eq("exercise_name", exerciseTitle)
      .then(({ data }) => {
        if (!data || data.length === 0) { setPrData(null); return; }
        let heaviest = 0, maxVol = 0, bestReps = 0;
        for (const row of data as any[]) {
          const w = row.weight || 0;
          const r = row.reps || 0;
          if (w > heaviest) heaviest = w;
          if (w * r > maxVol) maxVol = w * r;
          if (r > bestReps) bestReps = r;
        }
        setPrData({ heaviestWeight: heaviest, maxVolume: maxVol, bestReps, totalSets: data.length });
      });
  }, [user, exerciseTitle]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#020202] border border-white/[0.06] rounded-t-2xl sm:rounded-2xl overflow-hidden animate-fadeIn max-h-[90vh] flex flex-col">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>

        {/* ─── HOLOGRAM DISPLAY ─── */}
        <div
          className="h-[300px] w-full flex items-center justify-center relative overflow-hidden"
          style={{
            background: "radial-gradient(circle at center, hsl(185 100% 48% / 0.08), transparent 60%)",
          }}
        >
          {/* Scan lines overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, white 2px, white 3px)",
            }}
          />

          {/* Floating tech data points */}
          <span className="absolute top-4 left-4 font-mono text-[9px] text-[hsl(var(--synth-cyan))]/40 tracking-widest">[SYS.OPT]</span>
          <span className="absolute top-4 right-12 font-mono text-[9px] text-[hsl(var(--synth-cyan))]/40 tracking-widest">TGT: PRIMARY</span>
          <span className="absolute bottom-4 left-4 font-mono text-[9px] text-muted-foreground/30 tracking-widest">BIOMECH.SCAN</span>
          <span className="absolute bottom-4 right-4 font-mono text-[9px] text-muted-foreground/30 tracking-widest">v2.4.1</span>

          {/* Corner brackets */}
          <div className="absolute top-8 left-8 w-6 h-6 border-t border-l border-[hsl(var(--synth-cyan))]/20" />
          <div className="absolute top-8 right-8 w-6 h-6 border-t border-r border-[hsl(var(--synth-cyan))]/20" />
          <div className="absolute bottom-8 left-8 w-6 h-6 border-b border-l border-[hsl(var(--synth-cyan))]/20" />
          <div className="absolute bottom-8 right-8 w-6 h-6 border-b border-r border-[hsl(var(--synth-cyan))]/20" />

          {/* Reference image or fallback icon */}
          {refImageUrl ? (
            <img
              src={refImageUrl}
              alt={exerciseTitle}
              className="max-h-[240px] max-w-[80%] object-contain relative z-[1]"
              style={{ filter: "drop-shadow(0 0 20px hsl(185 100% 48% / 0.2))" }}
              onError={() => setRefImageUrl(null)}
            />
          ) : (
            <Activity
              size={140}
              strokeWidth={0.8}
              className="text-[hsl(var(--synth-cyan))]"
              style={{ filter: "drop-shadow(0 0 20px hsl(185 100% 48% / 0.3))" }}
            />
          )}
        </div>

        {/* ─── EXERCISE INFO & PR DISPLAY ─── */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Exercise Name */}
          <div className="text-center">
            <h2
              className="text-xl font-bold text-foreground tracking-tight"
              style={{ textShadow: "0 0 20px hsl(185 100% 48% / 0.15)" }}
            >
              {exerciseTitle}
            </h2>
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className="h-px flex-1 max-w-[40px] bg-gradient-to-r from-transparent to-[hsl(var(--synth-cyan))]/20" />
              <span className="font-mono text-[9px] text-muted-foreground/40 tracking-widest uppercase">Analysis</span>
              <span className="h-px flex-1 max-w-[40px] bg-gradient-to-l from-transparent to-[hsl(var(--synth-cyan))]/20" />
            </div>
          </div>

          {/* PR Badge */}
          {prData && prData.heaviestWeight > 0 && (
            <div className="flex items-center justify-center">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30"
                style={{ boxShadow: "var(--synth-glow-orange)" }}
              >
                <Trophy size={14} className="text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wide">Personal Record</span>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          {prData && prData.heaviestWeight > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <StatBlock
                icon={<Dumbbell size={14} />}
                label="Heaviest Weight"
                value={`${prData.heaviestWeight} lbs`}
              />
              <StatBlock
                icon={<TrendingUp size={14} />}
                label="Max Volume"
                value={`${prData.maxVolume.toLocaleString()} lbs`}
              />
              <StatBlock
                icon={<Activity size={14} />}
                label="Best Reps"
                value={String(prData.bestReps)}
              />
              <StatBlock
                icon={<Trophy size={14} />}
                label="Total Sets Logged"
                value={String(prData.totalSets)}
              />
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground/50 font-mono">NO HISTORY DATA</p>
              <p className="text-[10px] text-muted-foreground/30 mt-1">Complete sets to build your record</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/** Terminal-style stat block */
const StatBlock = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
    <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground/50">
      {icon}
      <span className="font-mono text-[9px] uppercase tracking-widest">{label}</span>
    </div>
    <span
      className="text-lg font-bold font-mono text-foreground"
      style={{ textShadow: "0 0 10px hsl(185 100% 48% / 0.1)" }}
    >
      {value}
    </span>
  </div>
);

AnatomyHologram.displayName = "AnatomyHologram";

export default AnatomyHologram;
