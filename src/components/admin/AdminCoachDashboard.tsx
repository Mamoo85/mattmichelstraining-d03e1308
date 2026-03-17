import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Loader2, ExternalLink, Send, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AiAssistButton from "./AiAssistButton";

interface FlaggedItem {
  id: string;
  log_id: string;
  exercise_id: string;
  sets_reps_weight: any;
  client_notes: string | null;
  video_url: string | null;
  flag_for_coach: boolean;
  coach_reply: string | null;
  created_at: string;
  exercise_library: { title: string } | null;
  workout_logs: { date: string; user_id: string; session_notes: string | null } | null;
  clientName?: string;
}

const AdminCoachDashboard = () => {
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const fetchFlagged = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("logged_exercises")
      .select("*, exercise_library(title), workout_logs(date, user_id, session_notes)")
      .eq("flag_for_coach", true)
      .is("coach_reply", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      // Fetch client names
      const userIds = [...new Set(data.map((d: any) => d.workout_logs?.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name")
        .in("user_id", userIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        nameMap[p.user_id] = p.athlete_name || p.full_name || "Unknown";
      });

      const enriched = data.map((item: any) => ({
        ...item,
        clientName: nameMap[item.workout_logs?.user_id] || "Unknown",
      }));
      setItems(enriched);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFlagged();
  }, []);

  const handleSendReply = async (itemId: string) => {
    const reply = replies[itemId]?.trim();
    if (!reply) {
      toast({ title: "Enter feedback first", variant: "destructive" });
      return;
    }
    setSending(itemId);
    const { error } = await supabase
      .from("logged_exercises")
      .update({ coach_reply: reply })
      .eq("id", itemId);

    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Feedback sent ✓" });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setReplies((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
    setSending(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Needs Review</h2>
          <p className="text-xs text-muted-foreground">{items.length} flagged exercise{items.length !== 1 ? "s" : ""} awaiting feedback</p>
        </div>
        <button onClick={fetchFlagged} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80">
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border">
          <CheckCircle size={32} className="mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">All caught up! No exercises need review.</p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="bg-card border border-border border-l-4 border-l-primary p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-sm font-bold text-foreground">{item.clientName}</span>
                <span className="text-xs text-muted-foreground ml-2 font-mono">
                  {item.workout_logs?.date ? format(new Date(item.workout_logs.date), "MMM d, yyyy") : "—"}
                </span>
              </div>
            </div>

            {/* Exercise */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                {item.exercise_library?.title || "Unknown Exercise"}
              </span>
              <div className="font-mono text-sm text-foreground mt-1">
                {(item.sets_reps_weight as any[])?.map((s: any, i: number) => (
                  <span key={i}>
                    {i > 0 && <span className="text-muted-foreground mx-1">·</span>}
                    {s.weight} × {s.reps}
                  </span>
                ))}
              </div>
            </div>

            {/* Notes */}
            {item.client_notes && (
              <div className="bg-muted p-2 text-xs text-foreground/80">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">Client Notes</span>
                {item.client_notes}
              </div>
            )}

            {/* Video */}
            {item.video_url && (
              <a
                href={item.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink size={12} /> Form Check Video
              </a>
            )}

            {/* Reply input */}
            <div className="flex gap-2 items-end">
              <textarea
                placeholder="Your feedback…"
                value={replies[item.id] || ""}
                onChange={(e) => setReplies((prev) => ({ ...prev, [item.id]: e.target.value }))}
                className="flex-1 bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[60px] resize-none"
              />
              <AiAssistButton
                type="coach_reply"
                context={{
                  exerciseName: item.exercise_library?.title || "Unknown",
                  setsRepsWeight: JSON.stringify(item.sets_reps_weight),
                  clientNotes: item.client_notes,
                  hasVideo: !!item.video_url,
                }}
                onResult={(text) => setReplies((prev) => ({ ...prev, [item.id]: text }))}
                label="AI Draft"
              />
            </div>
            <button
              onClick={() => handleSendReply(item.id)}
              disabled={sending === item.id}
              className="w-full h-11 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending === item.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send Feedback
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default AdminCoachDashboard;
