import { useState } from "react";
import { Sparkles, Loader2, FileText, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface ClientForReport {
  user_id: string;
  label: string;
}

const AdminParentReports = () => {
  const [clients, setClients] = useState<ClientForReport[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchClients = async () => {
    if (clients.length > 0) return;
    setLoadingClients(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, athlete_name, email")
      .order("created_at", { ascending: false });
    if (data) {
      setClients(
        data.map((p: any) => ({
          user_id: p.user_id,
          label: p.athlete_name || p.full_name || p.email || p.user_id.slice(0, 8),
        }))
      );
    }
    setLoadingClients(false);
  };

  const handleGenerate = async () => {
    if (!selectedClient) {
      toast({ title: "Select an athlete", variant: "destructive" });
      return;
    }
    setLoading(true);
    setReport(null);

    try {
      // Gather all context for this athlete
      const [profileRes, workoutRes, progressRes, programRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", selectedClient).single(),
        supabase.from("workout_logs").select("date, sleep_hours, energy, soreness").eq("user_id", selectedClient).order("date", { ascending: false }).limit(14),
        supabase.from("progress_logs").select("exercise_name, weight, reps, logged_at").eq("user_id", selectedClient).order("logged_at", { ascending: false }).limit(10),
        supabase.from("user_active_programs").select("program_id, training_programs(title)").eq("user_id", selectedClient).eq("status", "active"),
      ]);

      const profile = profileRes.data;
      const workouts = workoutRes.data || [];
      const lifts = progressRes.data || [];
      const programs = programRes.data || [];

      const avgSleep = workouts.filter((w: any) => w.sleep_hours).length > 0
        ? (workouts.reduce((s: number, w: any) => s + (Number(w.sleep_hours) || 0), 0) / workouts.filter((w: any) => w.sleep_hours).length).toFixed(1)
        : null;
      const avgEnergy = workouts.filter((w: any) => w.energy).length > 0
        ? (workouts.reduce((s: number, w: any) => s + (Number(w.energy) || 0), 0) / workouts.filter((w: any) => w.energy).length).toFixed(1)
        : null;
      const avgSoreness = workouts.filter((w: any) => w.soreness).length > 0
        ? (workouts.reduce((s: number, w: any) => s + (Number(w.soreness) || 0), 0) / workouts.filter((w: any) => w.soreness).length).toFixed(1)
        : null;

      const recentLifts = lifts.slice(0, 5).map((l: any) => `${l.exercise_name}: ${l.weight}lbs x${l.reps}`).join(", ");

      const { data, error } = await supabase.functions.invoke("ai-admin-assist", {
        body: {
          type: "parent_report",
          context: {
            athleteName: profile?.athlete_name || profile?.full_name || "Athlete",
            tier: profile?.subscription_tier || "free",
            joinDate: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown",
            totalWorkouts: workouts.length,
            recentWorkouts: workouts.filter((w: any) => {
              const d = new Date(w.date);
              const twoWeeksAgo = new Date();
              twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
              return d >= twoWeeksAgo;
            }).length,
            activePrograms: programs.map((p: any) => (p as any).training_programs?.title).filter(Boolean).join(", ") || "None",
            avgSleep: avgSleep ? `${avgSleep} hrs` : null,
            avgEnergy: avgEnergy ? `${avgEnergy}/10` : null,
            avgSoreness: avgSoreness ? `${avgSoreness}/10` : null,
            recentLifts: recentLifts || null,
            flaggedCount: 0,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReport(data.result);
      toast({ title: "Report generated!", description: "Review, edit, and send to the parent." });
    } catch (e: any) {
      toast({ title: "Report generation failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }
  };

  return (
    <div className="bg-card shadow-m2 p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">AI Parent Progress Reports</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Generate a personalized progress report for a parent. The AI analyzes their child's workout data, recovery metrics, and program activity.
      </p>

      <div className="flex gap-2 mb-4">
        <select
          value={selectedClient}
          onChange={(e) => { setSelectedClient(e.target.value); setReport(null); }}
          onFocus={fetchClients}
          className="flex-1 bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{loadingClients ? "Loading athletes..." : "Select athlete..."}</option>
          {clients.map((c) => (
            <option key={c.user_id} value={c.user_id}>{c.label}</option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={loading || !selectedClient}
          className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Generate
        </button>
      </div>

      {report && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Generated Report</span>
            <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-m2">
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="bg-background border border-border p-4 prose prose-sm max-w-none text-foreground text-xs leading-relaxed">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminParentReports;
