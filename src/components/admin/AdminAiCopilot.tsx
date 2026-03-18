import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Brain, Loader2, AlertTriangle, Ghost, Send, RefreshCw, CheckCircle, Trash2 } from "lucide-react";

interface StagnationInsight {
  name: string;
  exercise: string;
  lastWeight: number;
  weeksSince: number;
  suggestedMessage: string;
}

interface GhostTrialInsight {
  name: string;
  email: string;
  daysSinceSignup: number;
  draftMessage: string;
}

interface Insights {
  stagnation: StagnationInsight[];
  ghost_trials: GhostTrialInsight[];
}

const AdminAiCopilot = () => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [sentMessages, setSentMessages] = useState<Set<string>>(new Set());

  const runAnalysis = async () => {
    setLoading(true);
    setSentMessages(new Set());
    try {
      // Fetch athlete data: progress logs from last 6 weeks + profiles
      const sixWeeksAgo = new Date();
      sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

      const [logsRes, profilesRes, trialRes, workoutCountRes] = await Promise.all([
        supabase
          .from("progress_logs")
          .select("user_id, exercise_name, weight, logged_at")
          .gte("logged_at", sixWeeksAgo.toISOString())
          .order("logged_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("user_id, full_name, athlete_name, email, subscription_tier"),
        supabase
          .from("profiles")
          .select("user_id, full_name, athlete_name, email, trial_started_at")
          .not("trial_started_at", "is", null),
        supabase
          .from("workout_logs")
          .select("user_id, date")
          .gte("date", sixWeeksAgo.toISOString()),
      ]);

      const profiles = profilesRes.data || [];
      const logs = logsRes.data || [];
      const trialProfiles = trialRes.data || [];
      const workoutLogs = workoutCountRes.data || [];

      // Build athlete summaries for AI
      const profileMap: Record<string, any> = {};
      profiles.forEach((p) => {
        profileMap[p.user_id] = {
          name: p.athlete_name || p.full_name || "Unknown",
          email: p.email,
          tier: p.subscription_tier,
        };
      });

      // Group logs by user + exercise, find max weight per week
      const athleteData: Record<string, any> = {};
      logs.forEach((l) => {
        if (!athleteData[l.user_id]) athleteData[l.user_id] = {};
        if (!athleteData[l.user_id][l.exercise_name]) athleteData[l.user_id][l.exercise_name] = [];
        athleteData[l.user_id][l.exercise_name].push({ weight: l.weight, date: l.logged_at });
      });

      const athletes = Object.entries(athleteData).map(([uid, exercises]) => ({
        name: profileMap[uid]?.name || "Unknown",
        email: profileMap[uid]?.email || "",
        tier: profileMap[uid]?.tier || "free",
        exercises: Object.entries(exercises as Record<string, any[]>).map(([name, entries]) => ({
          name,
          entries: entries.map((e) => ({ weight: e.weight, date: e.date })),
        })),
      }));

      // Trial users with workout counts
      const workoutCountByUser: Record<string, number> = {};
      workoutLogs.forEach((w) => {
        workoutCountByUser[w.user_id] = (workoutCountByUser[w.user_id] || 0) + 1;
      });

      const today = new Date();
      const trialUsers = trialProfiles
        .filter((t) => {
          if (!t.trial_started_at) return false;
          const daysSince = Math.floor((today.getTime() - new Date(t.trial_started_at).getTime()) / 86400000);
          return daysSince >= 4 && daysSince <= 7;
        })
        .map((t) => ({
          name: t.athlete_name || t.full_name || "Unknown",
          email: t.email,
          daysSinceSignup: Math.floor((today.getTime() - new Date(t.trial_started_at!).getTime()) / 86400000),
          workoutCount: workoutCountByUser[t.user_id] || 0,
        }))
        .filter((t) => t.workoutCount === 0);

      // Call AI
      const { data, error } = await supabase.functions.invoke("ai-admin-assist", {
        body: {
          type: "ai_copilot",
          context: {
            athletes: athletes.slice(0, 50), // limit payload
            trialUsers,
            today: today.toISOString().split("T")[0],
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      let parsed: Insights;
      try {
        const raw = data?.result || "{}";
        parsed = typeof raw === "string" ? JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()) : raw;
      } catch {
        parsed = { stagnation: [], ghost_trials: [] };
      }

      setInsights(parsed);
      toast({ title: "AI Copilot analysis complete" });
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const markSent = (key: string) => {
    setSentMessages((prev) => new Set([...prev, key]));
    toast({ title: "Message approved ✓", description: "Marked as sent. Send via your preferred channel." });
  };

  const totalInsights = insights ? (insights.stagnation?.length || 0) + (insights.ghost_trials?.length || 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-primary" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">AI Copilot</h3>
            <p className="text-[10px] text-muted-foreground">Automated athlete monitoring & engagement checks</p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? "Analyzing…" : "Run Analysis"}
        </button>
      </div>

      {!insights && !loading && (
        <div className="bg-card border border-border p-8 text-center">
          <Brain size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-foreground font-bold mb-1">No insights yet</p>
          <p className="text-[11px] text-muted-foreground">Click "Run Analysis" to scan your athlete roster for stagnation and disengaged trial users.</p>
        </div>
      )}

      {insights && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border p-4 text-center">
              <AlertTriangle size={18} className="mx-auto text-amber-500 mb-1" />
              <span className="text-2xl font-black text-foreground">{insights.stagnation?.length || 0}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plateaued Athletes</p>
            </div>
            <div className="bg-card border border-border p-4 text-center">
              <Ghost size={18} className="mx-auto text-red-500 mb-1" />
              <span className="text-2xl font-black text-foreground">{insights.ghost_trials?.length || 0}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ghost Trials</p>
            </div>
          </div>

          {/* Stagnation */}
          {insights.stagnation && insights.stagnation.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500" /> Client Stagnation Alerts
              </h4>
              {insights.stagnation.map((s, i) => {
                const key = `stag-${i}`;
                const isSent = sentMessages.has(key);
                return (
                  <div key={key} className="bg-card border border-border border-l-4 border-l-amber-500 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">{s.name}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-400 px-2 py-0.5">
                        {s.weeksSince}+ weeks flat
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">{s.exercise}</span> stuck at {s.lastWeight} lbs
                    </p>
                    <div className="bg-muted p-3 text-xs text-foreground/90 italic">
                      "{s.suggestedMessage}"
                    </div>
                    <button
                      onClick={() => markSent(key)}
                      disabled={isSent}
                      className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                        isSent
                          ? "bg-green-600/20 text-green-400"
                          : "bg-primary text-primary-foreground hover:opacity-90"
                      }`}
                    >
                      {isSent ? <><CheckCircle size={12} /> Approved</> : <><Send size={12} /> Approve & Send</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ghost Trials */}
          {insights.ghost_trials && insights.ghost_trials.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-1.5">
                <Ghost size={12} className="text-red-500" /> Ghost Trial Check-Ins
              </h4>
              {insights.ghost_trials.map((g, i) => {
                const key = `ghost-${i}`;
                const isSent = sentMessages.has(key);
                return (
                  <div key={key} className="bg-card border border-border border-l-4 border-l-red-500 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-foreground">{g.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{g.email}</span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 px-2 py-0.5">
                        Day {g.daysSinceSignup} · 0 workouts
                      </span>
                    </div>
                    <div className="bg-muted p-3 text-xs text-foreground/90 italic">
                      "{g.draftMessage}"
                    </div>
                    <button
                      onClick={() => markSent(key)}
                      disabled={isSent}
                      className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                        isSent
                          ? "bg-green-600/20 text-green-400"
                          : "bg-primary text-primary-foreground hover:opacity-90"
                      }`}
                    >
                      {isSent ? <><CheckCircle size={12} /> Approved</> : <><Send size={12} /> Approve & Send</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {totalInsights === 0 && (
            <div className="bg-card border border-border p-8 text-center">
              <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm font-bold text-foreground">All clear!</p>
              <p className="text-[11px] text-muted-foreground">No stagnation or disengaged trial users detected.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAiCopilot;
