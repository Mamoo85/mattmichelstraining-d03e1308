import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionHeader from "./SectionHeader";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
      <div className="bg-card shadow-m2 p-5 text-center">
        <p className="text-sm text-muted-foreground">No protocol assigned yet. Matt's building yours.</p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title={protocolTitle || "Today's Program"} timestamp="Log your weights — Matt reviews every session" />

      {/* Header row */}
      <div className="grid grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_1fr_80px] gap-2 px-3 py-2 bg-muted">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exercise</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sets × Reps</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:block">Coach Notes</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Weight</span>
      </div>

      {exercises.map((ex) => (
        <div
          key={ex.id}
          className="grid grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_1fr_80px] gap-2 px-3 py-3 bg-card hover:bg-secondary/50 transition-m2 border-b border-border items-center"
        >
          <div>
            <span className="text-sm font-semibold text-foreground">{ex.exercise_name}</span>
            {/* Show notes inline on mobile only */}
            {ex.notes && <p className="text-[10px] text-muted-foreground mt-0.5 md:hidden">{ex.notes}</p>}
          </div>
          <span className="text-sm font-mono text-primary">{ex.sets}×{ex.reps}</span>
          {/* Notes column — desktop only */}
          <span className="text-[11px] text-muted-foreground hidden md:block leading-snug">{ex.notes || "—"}</span>
          <input
            type="number"
            placeholder="lbs"
            value={weights[ex.id] || ""}
            onChange={(e) => setWeights({ ...weights, [ex.id]: e.target.value })}
            className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-8 w-full"
          />
        </div>
      ))}

      <div className="flex justify-end mt-4">
        <button
          onClick={logSession}
          className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          Log Session
        </button>
      </div>
    </div>
  );
};

export default ProtocolTable;
