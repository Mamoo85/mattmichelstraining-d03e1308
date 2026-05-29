import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, Dumbbell } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface ActiveProgramRow {
  id: string;
  program_id: string;
  current_week: number;
  current_day: number;
  block_number: number;
  completed_days: Array<{ week: number; day: number }>;
  program: { title: string; category: string; sport: string | null };
}

const TodaysTrainingCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [program, setProgram] = useState<ActiveProgramRow | null>(null);
  const [totalDays, setTotalDays] = useState(0);
  const [lastSession, setLastSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Get active program
      const { data: ap } = await supabase
        .from("user_active_programs")
        .select("id, program_id, current_week, current_day, block_number, completed_days, training_programs(title, category, sport)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!ap) { setLoading(false); return; }

      const row: ActiveProgramRow = {
        ...(ap as any),
        program: (ap as any).training_programs,
        completed_days: Array.isArray((ap as any).completed_days) ? (ap as any).completed_days : [],
      };
      setProgram(row);

      // Count total unique days in program
      const { count } = await supabase
        .from("program_workouts")
        .select("id", { count: "exact", head: true })
        .eq("program_id", row.program_id);
      // Actually we need unique week/day combos
      const { data: days } = await supabase
        .from("program_workouts")
        .select("week_number, day_number")
        .eq("program_id", row.program_id);
      if (days) {
        const unique = new Set(days.map((d: any) => `${d.week_number}-${d.day_number}`));
        setTotalDays(unique.size);
      }

      // Last session
      const { data: lastLog } = await supabase
        .from("progress_logs")
        .select("logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastLog) {
        setLastSession(formatDistanceToNow(new Date(lastLog.logged_at), { addSuffix: true }));
      }

      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading || !program) return null;

  const completedCount = program.completed_days.length;
  const progressPct = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

  const handleStart = () => {
    // Navigate to dashboard programs tab — the ActiveProgramView will auto-select current week/day
    navigate("/dashboard?tab=programs");
  };

  return (
    <div className="bg-card border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Today's Training</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          Block {program.block_number} · Week {program.current_week} of 8
        </span>
      </div>

      <h3 className="text-sm font-bold text-foreground">{program.program.title}</h3>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{completedCount} / {totalDays} sessions</span>
          <span className="text-[10px] font-bold text-primary">{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {lastSession && (
        <p className="text-[10px] text-muted-foreground">Last session: {lastSession}</p>
      )}

      <button
        onClick={handleStart}
        className="w-full h-10 border-2 border-primary text-primary flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
      >
        <Play size={14} /> Start Day {program.current_day}
      </button>
    </div>
  );
};

export default TodaysTrainingCard;
