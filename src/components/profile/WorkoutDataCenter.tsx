import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, FileText, Download, Dumbbell, Activity, Calendar,
  MapPin, ChevronDown, ChevronUp, Printer
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WorkoutSheet {
  id: string;
  title: string;
  description: string | null;
  exercises: any[];
  created_at: string;
  source_type: string;
}

interface ActivityLog {
  id: string;
  description: string;
  activity_type: string;
  intensity: string | null;
  duration_minutes: number | null;
  ai_summary: string | null;
  logged_at: string;
}

interface CheckIn {
  id: string;
  location: string;
  created_at: string;
}

interface ProgressLog {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  sets: number;
  logged_at: string;
}

const WorkoutDataCenter = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<WorkoutSheet[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [wRes, aRes, cRes, pRes] = await Promise.all([
        supabase.from("community_workouts").select("id, title, description, exercises, created_at, source_type").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("activity_logs").select("id, description, activity_type, intensity, duration_minutes, ai_summary, logged_at").eq("user_id", user.id).order("logged_at", { ascending: false }),
        supabase.from("studio_checkins" as any).select("id, location, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("progress_logs" as any).select("id, exercise_name, weight, reps, sets, logged_at").eq("user_id", user.id).order("logged_at", { ascending: false }),
      ]);
      setWorkouts((wRes.data || []) as any);
      setActivities(aRes.data as any[] || []);
      setCheckins(cRes.data as any[] || []);
      setProgressLogs(pRes.data as any[] || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const toggleWorkout = (id: string) => {
    setExpandedWorkouts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const printBlankWorksheet = useCallback(() => {
    const rows = Array.from({ length: 9 }, (_, i) => i + 1);
    let html = `
      <html><head>
      <style>
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: system-ui, sans-serif; max-width: 750px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
        h1 { font-size: 20px; border-bottom: 3px solid #f97316; padding-bottom: 6px; margin-bottom: 4px; }
        .meta { font-size: 11px; color: #737373; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d4d4d4; padding: 10px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; }
        td { height: 32px; font-size: 12px; }
        .num { width: 30px; text-align: center; font-weight: 700; color: #a3a3a3; }
        .exercise { width: 35%; }
        .sets, .reps, .weight { width: 10%; text-align: center; }
        .notes { width: 25%; }
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #a3a3a3; }
      </style>
      </head><body>
      <h1>🏋️ Workout Log Sheet</h1>
      <p class="meta">Name: ________________________ &nbsp;&nbsp; Date: ________________________</p>
      <table>
        <tr><th class="num">#</th><th class="exercise">Exercise</th><th class="sets">Sets</th><th class="reps">Reps</th><th class="weight">Weight</th><th class="notes">Notes</th></tr>
        ${rows.map(n => `<tr><td class="num">${n}</td><td class="exercise"></td><td class="sets"></td><td class="reps"></td><td class="weight"></td><td class="notes"></td></tr>`).join("")}
      </table>
      <p class="footer">M² Training — mattmichelstraining.com</p>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  }, []);

  const generatePDF = useCallback(async () => {
    if (!user) return;
    setPrinting(true);
    try {
      // Build printable HTML
      const profile = await supabase.from("profiles").select("full_name, athlete_name, email").eq("user_id", user.id).single();
      const name = profile.data?.athlete_name || profile.data?.full_name || "Athlete";

      let html = `
        <html><head>
        <link rel="stylesheet" href="/print.css" />
        <style>
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
          h1 { font-size: 22px; border-bottom: 3px solid #f97316; padding-bottom: 8px; }
          h2 { font-size: 16px; color: #f97316; margin-top: 24px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
          h3 { font-size: 13px; margin: 12px 0 4px; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 12px; }
          th, td { border: 1px solid #d4d4d4; padding: 6px 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
          .meta { font-size: 11px; color: #737373; }
          .badge { display: inline-block; background: #f97316; color: white; padding: 2px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-right: 6px; }
          .section { page-break-inside: avoid; }
        </style>
        </head><body>
        <h1>🏋️ ${name} — Workout History</h1>
        <p class="meta">Generated ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")} · ${workouts.length} workout sheets · ${progressLogs.length} lift logs · ${activities.length} activities · ${checkins.length} check-ins</p>
      `;

      // Workout Sheets
      if (workouts.length > 0) {
        html += `<h2>📋 Workout Sheets (${workouts.length})</h2>`;
        workouts.forEach(w => {
          const exercises = Array.isArray(w.exercises) ? w.exercises : [];
          html += `<div class="section"><h3>${w.title} <span class="meta">— ${format(new Date(w.created_at), "MMM d, yyyy")}</span></h3>`;
          if (w.description) html += `<p class="meta">${w.description}</p>`;
          if (exercises.length > 0) {
            html += `<table><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th><th>Notes</th></tr>`;
            exercises.forEach((ex: any) => {
              html += `<tr><td>${ex.title || ex.name || "—"}</td><td>${ex.sets || "—"}</td><td>${ex.reps || "—"}</td><td>${ex.weight || "—"}</td><td>${ex.notes || ""}</td></tr>`;
            });
            html += `</table>`;
          }
          html += `</div>`;
        });
      }

      // Lift Logs
      if (progressLogs.length > 0) {
        html += `<h2>📊 Lift Logs (${progressLogs.length})</h2>`;
        html += `<table><tr><th>Date</th><th>Exercise</th><th>Weight</th><th>Reps</th><th>Sets</th></tr>`;
        progressLogs.forEach(l => {
          html += `<tr><td>${format(new Date(l.logged_at), "MMM d, yyyy")}</td><td>${l.exercise_name}</td><td>${l.weight} lbs</td><td>${l.reps}</td><td>${l.sets}</td></tr>`;
        });
        html += `</table>`;
      }

      // Activity Logs
      if (activities.length > 0) {
        html += `<h2>🏃 Activity Logs (${activities.length})</h2>`;
        html += `<table><tr><th>Date</th><th>Type</th><th>Intensity</th><th>Duration</th><th>Summary</th></tr>`;
        activities.forEach(a => {
          html += `<tr><td>${format(new Date(a.logged_at), "MMM d, yyyy")}</td><td>${a.activity_type}</td><td>${a.intensity || "—"}</td><td>${a.duration_minutes ? a.duration_minutes + " min" : "—"}</td><td>${a.ai_summary || a.description?.slice(0, 60) || "—"}</td></tr>`;
        });
        html += `</table>`;
      }

      // Check-ins
      if (checkins.length > 0) {
        html += `<h2>📍 Studio Check-Ins (${checkins.length})</h2>`;
        html += `<table><tr><th>Date</th><th>Location</th></tr>`;
        checkins.forEach(c => {
          html += `<tr><td>${format(new Date(c.created_at), "MMM d, yyyy h:mm a")}</td><td>${c.location || "Studio"}</td></tr>`;
        });
        html += `</table>`;
      }

      html += `<p class="meta" style="margin-top: 32px; text-align: center;">M² Training — mattmichelstraining.com</p></body></html>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
    } catch (e: any) {
      toast({ title: "PDF Error", description: e.message, variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  }, [user, workouts, progressLogs, activities, checkins]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with PDF button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-foreground">Data Center</h2>
          <p className="text-[10px] text-muted-foreground">
            {workouts.length} workout sheets · {progressLogs.length} lift logs · {activities.length} activities · {checkins.length} check-ins
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={printBlankWorksheet}
            className="flex items-center gap-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
            style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}
          >
            <FileText size={12} />
            Blank Sheet
          </button>
          <button
            onClick={generatePDF}
            disabled={printing}
            className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
          >
            {printing ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
            Print History
          </button>
        </div>
      </div>

      {/* Workout Sheets Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Dumbbell size={14} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
            Workout Sheets ({workouts.length})
          </h3>
        </div>
        {workouts.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground text-center">No workout sheets yet. Use Quick Log with exercise details to create them.</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y divide-border">
              {workouts.map(w => {
                const exercises = Array.isArray(w.exercises) ? w.exercises : [];
                return (
                  <Collapsible key={w.id} open={expandedWorkouts.has(w.id)} onOpenChange={() => toggleWorkout(w.id)}>
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 text-left">
                        <span className="text-xs font-bold text-foreground">{w.title}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-muted-foreground font-mono">{format(new Date(w.created_at), "MMM d, yyyy")}</span>
                          <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{exercises.length} exercises</span>
                          {w.source_type === "ai_quick_log" && (
                            <span className="text-[9px] bg-primary/10 px-1.5 py-0.5 rounded text-primary font-bold">AI Generated</span>
                          )}
                        </div>
                      </div>
                      {expandedWorkouts.has(w.id) ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-3">
                        {w.description && <p className="text-[10px] text-muted-foreground mb-2">{w.description}</p>}
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1 font-bold uppercase tracking-wider">Exercise</th>
                              <th className="text-center py-1 font-bold uppercase tracking-wider">Sets</th>
                              <th className="text-center py-1 font-bold uppercase tracking-wider">Reps</th>
                              <th className="text-center py-1 font-bold uppercase tracking-wider">Weight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exercises.map((ex: any, i: number) => (
                              <tr key={i} className="border-t border-border/50">
                                <td className="py-1.5 text-foreground font-medium">{ex.title || ex.name || "—"}</td>
                                <td className="py-1.5 text-center font-mono text-muted-foreground">{ex.sets || "—"}</td>
                                <td className="py-1.5 text-center font-mono text-muted-foreground">{ex.reps || "—"}</td>
                                <td className="py-1.5 text-center font-mono text-primary">{ex.weight || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Recent Lift Logs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
            Lift Logs ({progressLogs.length})
          </h3>
        </div>
        {progressLogs.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground text-center">No lift logs yet.</p>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="divide-y divide-border">
              {progressLogs.slice(0, 50).map(l => (
                <div key={l.id} className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground">{l.exercise_name}</span>
                    <span className="text-[9px] text-muted-foreground ml-2 font-mono">
                      {l.sets}×{l.reps} @ {l.weight} lbs
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground">{format(new Date(l.logged_at), "MMM d")}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Activity Logs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Activity size={14} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
            Activity Logs ({activities.length})
          </h3>
        </div>
        {activities.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground text-center">No activities logged yet.</p>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="divide-y divide-border">
              {activities.slice(0, 50).map(a => (
                <div key={a.id} className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground capitalize">{a.activity_type}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{format(new Date(a.logged_at), "MMM d")}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{a.ai_summary || a.description}</p>
                  <div className="flex gap-2 mt-0.5 text-[9px] text-muted-foreground">
                    {a.intensity && <span>Intensity: {a.intensity}</span>}
                    {a.duration_minutes && <span>• {a.duration_minutes} min</span>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Check-ins */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <MapPin size={14} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
            Studio Check-Ins ({checkins.length})
          </h3>
        </div>
        {checkins.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground text-center">No check-ins yet.</p>
        ) : (
          <ScrollArea className="max-h-[200px]">
            <div className="divide-y divide-border">
              {checkins.map(c => (
                <div key={c.id} className="px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={10} className="text-primary" />
                    <span className="text-xs text-foreground">{c.location || "Studio"}</span>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default WorkoutDataCenter;
