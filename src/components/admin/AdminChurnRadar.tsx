import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, MessageSquare, X, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

interface ChurnAlert {
  id: string;
  user_id: string;
  alert_type: string;
  avg_weekly_logs: number;
  days_since_last_log: number;
  status: string;
  created_at: string;
  full_name?: string;
  email?: string;
  subscription_tier?: string;
}

const TIER_COLORS: Record<string, string> = {
  elite: "bg-primary/20 text-primary",
  pro: "bg-accent/20 text-accent-foreground",
  team: "bg-secondary/20 text-secondary-foreground",
};

const AdminChurnRadar = () => {
  const [alerts, setAlerts] = useState<ChurnAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = useState<ChurnAlert | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("retention_alerts")
      .select("*")
      .eq("status", "active")
      .order("days_since_last_log", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    // Enrich with profile data
    const userIds = data.map((a: any) => a.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, subscription_tier")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    setAlerts(
      (data as any[]).map((a) => ({
        ...a,
        full_name: profileMap.get(a.user_id)?.full_name || "Unknown",
        email: profileMap.get(a.user_id)?.email || "",
        subscription_tier: profileMap.get(a.user_id)?.subscription_tier || "basic",
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleSendCheckin = async (alert: ChurnAlert) => {
    setSendingId(alert.id);
    const name = alert.full_name?.split(" ")[0] || "there";
    const message = `Hey ${name}, noticed you've been quiet this week. Everything good with the programming?`;

    const { error } = await supabase.from("coach_direct_messages").insert({
      user_id: alert.user_id,
      sender_id: (await supabase.auth.getUser()).data.user?.id || "",
      sender_role: "coach",
      message,
    });

    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } else {
      // Mark alert as contacted
      await supabase
        .from("retention_alerts")
        .update({ status: "contacted", resolved_at: new Date().toISOString() })
        .eq("id", alert.id);

      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      toast({ title: "Check-in sent", description: `Message sent to ${alert.full_name}` });
    }
    setSendingId(null);
  };

  const handleDismiss = async () => {
    if (!dismissTarget) return;
    await supabase
      .from("retention_alerts")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", dismissTarget.id);

    setAlerts((prev) => prev.filter((a) => a.id !== dismissTarget.id));
    setDismissTarget(null);
    toast({ title: "Alert dismissed" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-card border border-border p-8 text-center">
        <TrendingDown size={32} className="mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm font-bold text-foreground mb-1">All Clear</p>
        <p className="text-xs text-muted-foreground">No at-risk clients detected. The churn radar runs daily.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={14} className="text-destructive" />
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-destructive">{alerts.length}</span> high-risk client{alerts.length !== 1 ? "s" : ""} detected
        </p>
      </div>

      {alerts.map((alert) => (
        <div key={alert.id} className="bg-card border border-destructive/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-foreground truncate">{alert.full_name}</p>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${TIER_COLORS[alert.subscription_tier || ""] || "bg-muted text-muted-foreground"}`}>
                  {alert.subscription_tier}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{alert.email}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-destructive">{alert.days_since_last_log}d</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">silent</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>Avg: <strong className="text-foreground">{alert.avg_weekly_logs}/wk</strong></span>
            <span>Last 7 days: <strong className="text-destructive">0 logs</strong></span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleSendCheckin(alert)}
              disabled={sendingId === alert.id}
              className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-2 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {sendingId === alert.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <MessageSquare size={12} />
              )}
              Check-In
            </button>
            <button
              onClick={async () => {
                const { error } = await supabase.functions.invoke("ai-churn-preventer", { body: { userId: alert.user_id, action: "extend_trial" } });
                if (!error) { toast({ title: "Trial extended", description: `7-day extension for ${alert.full_name}` }); }
              }}
              className="flex items-center justify-center gap-1.5 border border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-2 hover:text-foreground hover:border-foreground/30 transition-all"
            >
              +7 Days
            </button>
            <button
              onClick={() => setDismissTarget(alert)}
              className="flex items-center justify-center gap-1.5 border border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-2 hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ))}

      <ConfirmActionModal
        open={!!dismissTarget}
        onOpenChange={(open) => { if (!open) setDismissTarget(null); }}
        onConfirm={handleDismiss}
        title="Dismiss Alert"
        description={`Dismiss churn alert for ${dismissTarget?.full_name}? You can still reach out manually later.`}
        confirmLabel="Dismiss"
      />
    </div>
  );
};

export default AdminChurnRadar;
