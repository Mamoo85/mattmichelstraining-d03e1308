import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionHeader from "@/components/shared/SectionHeader";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Exercise {
  id: string;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  rpe: number | null;
  notes: string | null;
  sort_order: number;
}

const ProtocolTable = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [protocolTitle, setProtocolTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [logSuccess, setLogSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProtocol = async () => {
      const { data: protocols } = await supabase
        .from("protocols")
        .select("id, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (protocols && protocols.length > 0) {
        setProtocolTitle(protocols[0].title);
        const { data: exs } = await supabase
          .from("protocol_exercises")
          .select("*")
          .eq("protocol_id", protocols[0].id)
          .order("sort_order");
        if (exs) setExercises(exs);
      }
      setLoading(false);
    };
    fetchProtocol();
  }, [user]);

  const logSession = async () => {
    if (!user) return;
    const entries = Object.entries(weights).filter(([, v]) => v && parseFloat(v) > 0);
    if (entries.length === 0) {
      toast({ title: "Log at least one weight", variant: "destructive" });
      return;
    }

    for (const [id, w] of entries) {
      const ex = exercises.find((e) => e.id === id);
      if (!ex) continue;
      const weight = parseFloat(w);
      const reps = parseInt(ex.reps || "1");
      const estimated1rm = Math.round(weight * (1 + reps / 30) * 10) / 10;

      await supabase.from("progress_logs").insert({
        user_id: user.id,
        exercise_name: ex.exercise_name,
        weight,
        reps,
        estimated_1rm: estimated1rm,
      });
    }
    toast({ title: "Session logged", description: "Nice work. Matt sees this." });
    setWeights({});
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 500);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="bg-card/80 rounded-2xl shadow-lg p-8 text-center">
        <p className="text-sm text-muted-foreground">No protocol assigned yet. Matt's building yours.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title={protocolTitle || "Today's Program"} timestamp="Log your weights — Matt reviews every session" />

      {/* Exercise Cards */}
      <div className="space-y-3">
        {exercises.map((ex, i) => (
          <div
            key={ex.id}
            className="rounded-2xl bg-gradient-to-b from-card to-card/80 border border-white/[0.06] shadow-lg overflow-hidden transition-all hover:shadow-xl"
          >
            <div className="flex items-center gap-3 p-4">
              <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-base font-bold text-foreground block leading-tight">{ex.exercise_name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    {ex.sets}×{ex.reps}
                  </span>
                  {ex.rpe && (
                    <span className="text-[11px] text-muted-foreground">RPE {ex.rpe}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  placeholder="lbs"
                  value={weights[ex.id] || ""}
                  onChange={(e) => setWeights({ ...weights, [ex.id]: e.target.value })}
                  className={cn(
                    "bg-background/60 border border-white/[0.08] rounded-xl text-center font-mono text-primary text-sm",
                    "focus:ring-2 focus:ring-primary/40 outline-none h-12 w-20 transition-all",
                    "placeholder:text-muted-foreground/30"
                  )}
                />
              </div>
            </div>
            {ex.notes && (
              <div className="px-4 pb-3 -mt-1">
                <p className="text-[11px] text-muted-foreground leading-relaxed pl-12">{ex.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={logSession}
        className={cn(
          "w-full py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all duration-300",
          "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
          "hover:shadow-[0_0_24px_hsl(var(--primary)/0.4)] hover:brightness-110",
          "active:scale-[0.98]",
          logSuccess && "animate-log-success"
        )}
      >
        Log Session
      </button>
    </div>
  );
};

export default ProtocolTable;
