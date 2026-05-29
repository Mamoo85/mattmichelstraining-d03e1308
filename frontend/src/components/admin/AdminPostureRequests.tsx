import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Loader2, Eye, Send, CheckCircle, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AiAssistButton from "./AiAssistButton";

interface PostureRequest {
  id: string;
  user_id: string;
  front_photo_url: string | null;
  side_photo_url: string | null;
  status: string;
  analysis: string | null;
  created_at: string;
  clientName?: string;
  clientEmail?: string;
}

const AdminPostureRequests = () => {
  const [requests, setRequests] = useState<PostureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posture_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const userIds = [...new Set((data as any[]).map((d) => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .in("user_id", userIds);

      const nameMap: Record<string, { name: string; email: string }> = {};
      profiles?.forEach((p) => {
        nameMap[p.user_id] = {
          name: p.athlete_name || p.full_name || "Unknown",
          email: p.email || "",
        };
      });

      setRequests(
        (data as any[]).map((item) => ({
          ...item,
          clientName: nameMap[item.user_id]?.name || "Unknown",
          clientEmail: nameMap[item.user_id]?.email || "",
        }))
      );
    } else {
      setRequests([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const handleSendAnalysis = async (reqId: string) => {
    const analysis = analyses[reqId]?.trim();
    if (!analysis) {
      toast({ title: "Enter analysis first", variant: "destructive" });
      return;
    }
    setSending(reqId);
    const { error } = await supabase
      .from("posture_requests" as any)
      .update({ analysis, status: "sent" } as any)
      .eq("id", reqId);

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      const req = requests.find((r) => r.id === reqId);
      if (req) {
        await supabase.from("notifications").insert({
          user_id: req.user_id,
          type: "posture_analysis",
          title: "Your Posture Analysis is Ready! 📋",
          body: "Coach Matt reviewed your posture photos and sent you a personalized analysis.",
          link: "/dashboard",
        });
      }
      toast({ title: "Analysis sent ✓" });
      setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, analysis, status: "sent" } : r)));
    }
    setSending(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const completed = requests.filter((r) => r.status === "sent");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
            <ImageIcon size={14} className="text-primary" />
            Posture Analysis Requests
          </h2>
          <p className="text-xs text-muted-foreground">
            {pending.length} pending · {completed.length} completed
          </p>
        </div>
        <button onClick={fetch_} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80">
          Refresh
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-8 bg-card border border-border">
          <CheckCircle size={28} className="mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">No pending posture requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((req) => (
            <div key={req.id} className="bg-card border border-border border-l-4 border-l-primary p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-bold text-foreground">{req.clientName}</span>
                  {req.clientEmail && (
                    <span className="text-[10px] text-muted-foreground ml-2">{req.clientEmail}</span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                  {format(new Date(req.created_at), "MMM d, h:mm a")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {req.front_photo_url && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Front</span>
                    <a href={req.front_photo_url} target="_blank" rel="noopener noreferrer">
                      <img src={req.front_photo_url} alt="Front view" className="w-full aspect-[3/4] object-cover border border-border hover:border-primary/40 transition-colors" />
                    </a>
                  </div>
                )}
                {req.side_photo_url && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Side</span>
                    <a href={req.side_photo_url} target="_blank" rel="noopener noreferrer">
                      <img src={req.side_photo_url} alt="Side view" className="w-full aspect-[3/4] object-cover border border-border hover:border-primary/40 transition-colors" />
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-2 items-end">
                <textarea
                  placeholder="Write your posture analysis…"
                  value={analyses[req.id] || ""}
                  onChange={(e) => setAnalyses((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  className="flex-1 bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[80px] resize-none"
                />
                <AiAssistButton
                  type="draft_reply"
                  context={{
                    source: "posture_analysis",
                    frontPhotoUrl: req.front_photo_url,
                    sidePhotoUrl: req.side_photo_url,
                    message: "Analyze this athlete's posture from the front and side photos. Provide specific observations about alignment, muscle imbalances, and corrective recommendations.",
                  }}
                  onResult={(text) => setAnalyses((prev) => ({ ...prev, [req.id]: text }))}
                  label="AI Analyze"
                />
              </div>

              <button
                onClick={() => handleSendAnalysis(req.id)}
                disabled={sending === req.id}
                className="w-full h-11 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending === req.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Send Analysis to Athlete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPostureRequests;
