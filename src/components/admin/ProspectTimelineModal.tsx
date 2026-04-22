/**
 * ProspectTimelineModal — per-prospect event timeline.
 *
 * Surfaces a unified, chronological event log for a single prospect so an admin
 * can see the full journey at a glance:
 *   - Link clicked / email opened   (from prospect_email_log)
 *   - Email sent / drip step        (from prospect_email_log + lead_activities)
 *   - Signup started                (lead_activities type="signup_started")
 *   - Account created               (lead_activities type="account_created")
 *   - Profile completed             (lead_activities type="profile_completed")
 *   - Paid                          (lead_activities type="paid" or "deal_won")
 *   - Plus any other lead_activities (notes, calls, stage changes, etc.)
 *
 * Data sources are read-only; nothing here mutates the prospect.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  MousePointerClick,
  Mail,
  MailOpen,
  UserPlus,
  UserCheck,
  CheckCircle2,
  DollarSign,
  MessageSquare,
  Phone,
  Calendar,
  Zap,
  Target,
  Eye,
  Trophy,
  AlertTriangle,
  FileText,
  Activity,
} from "lucide-react";

// ── Funnel stage definitions (the canonical 5 the user asked about) ───────────
const FUNNEL_STAGES = [
  { key: "link_clicked",      label: "Link clicked",      icon: MousePointerClick, color: "#06b6d4" },
  { key: "signup_started",    label: "Signup started",    icon: UserPlus,          color: "#a855f7" },
  { key: "account_created",   label: "Account created",   icon: UserCheck,         color: "#3b82f6" },
  { key: "profile_completed", label: "Profile completed", icon: CheckCircle2,      color: "#f59e0b" },
  { key: "paid",              label: "Paid",              icon: DollarSign,        color: "#10b981" },
];

// Map any lead_activities.type → display config
const ACTIVITY_TYPES: Record<string, { icon: any; color: string; label: string }> = {
  link_clicked:      { icon: MousePointerClick, color: "#06b6d4", label: "Link clicked" },
  email_sent:        { icon: Mail,              color: "#3b82f6", label: "Email sent" },
  email_opened:      { icon: MailOpen,          color: "#06b6d4", label: "Email opened" },
  reply_received:    { icon: MessageSquare,     color: "#10b981", label: "Replied" },
  call_logged:       { icon: Phone,             color: "#f59e0b", label: "Call logged" },
  note:              { icon: MessageSquare,     color: "#6b7280", label: "Note" },
  meeting_booked:    { icon: Calendar,          color: "#e8621a", label: "Meeting booked" },
  stage_changed:     { icon: Zap,               color: "#a855f7", label: "Stage changed" },
  audited:           { icon: Target,            color: "#06b6d4", label: "Site audited" },
  researched:        { icon: Eye,               color: "#06b6d4", label: "Visitor identified" },
  signup_started:    { icon: UserPlus,          color: "#a855f7", label: "Signup started" },
  account_created:   { icon: UserCheck,         color: "#3b82f6", label: "Account created" },
  profile_completed: { icon: CheckCircle2,      color: "#f59e0b", label: "Profile completed" },
  paid:              { icon: DollarSign,        color: "#10b981", label: "Paid 💰" },
  deal_won:          { icon: Trophy,            color: "#10b981", label: "Deal won 🎉" },
  deal_lost:         { icon: AlertTriangle,     color: "#ef4444", label: "Deal lost" },
};

interface TimelineEvent {
  id: string;
  type: string;
  at: string;            // ISO
  content?: string | null;
  meta?: Record<string, any>;
}

interface ProspectTimelineModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProspectTimelineModal({
  open,
  onClose,
  leadId,
  leadName,
}: ProspectTimelineModalProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [activitiesRes, emailLogRes] = await Promise.all([
          (supabase as any)
            .from("lead_activities")
            .select("id, type, content, metadata, created_at")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(200),
          (supabase as any)
            .from("prospect_email_log")
            .select("id, subject, drip_step, status, sent_at, opened_at, clicked_at")
            .eq("pipeline_lead_id", leadId)
            .order("sent_at", { ascending: false })
            .limit(50),
        ]);

        if (cancelled) return;

        const merged: TimelineEvent[] = [];

        // lead_activities → timeline events
        for (const a of activitiesRes.data || []) {
          merged.push({
            id: `act-${a.id}`,
            type: a.type,
            at: a.created_at,
            content: a.content,
            meta: a.metadata || {},
          });
        }

        // prospect_email_log → derive sent/opened/clicked events
        for (const e of emailLogRes.data || []) {
          if (e.sent_at) {
            merged.push({
              id: `mail-sent-${e.id}`,
              type: "email_sent",
              at: e.sent_at,
              content: e.subject ? `${e.subject}${e.drip_step ? ` (step ${e.drip_step})` : ""}` : null,
            });
          }
          if (e.opened_at) {
            merged.push({
              id: `mail-open-${e.id}`,
              type: "email_opened",
              at: e.opened_at,
              content: e.subject || null,
            });
          }
          if (e.clicked_at) {
            merged.push({
              id: `mail-click-${e.id}`,
              type: "link_clicked",
              at: e.clicked_at,
              content: e.subject ? `Clicked link in: ${e.subject}` : "Clicked email link",
            });
          }
        }

        merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setEvents(merged);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, leadId]);

  // Compute funnel checklist + last update
  const funnelStatus = FUNNEL_STAGES.map((s) => {
    const hit =
      s.key === "link_clicked"
        ? events.find((e) => e.type === "link_clicked")
        : events.find((e) => e.type === s.key || (s.key === "paid" && e.type === "deal_won"));
    return { ...s, at: hit?.at || null };
  });

  const lastUpdate = events[0]?.at || null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity size={18} className="text-primary" />
            Timeline — {leadName}
          </DialogTitle>
          <DialogDescription>
            {lastUpdate ? (
              <>Last update <span className="text-foreground font-medium">{timeAgo(lastUpdate)}</span> · {new Date(lastUpdate).toLocaleString()}</>
            ) : (
              "No activity recorded yet."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Funnel checklist */}
        <div className="grid grid-cols-5 gap-2 py-3 border-y border-border/40">
          {funnelStatus.map((s) => {
            const Icon = s.icon;
            const reached = !!s.at;
            return (
              <div
                key={s.key}
                className="flex flex-col items-center text-center gap-1 px-1"
                title={s.at ? `${s.label} — ${new Date(s.at).toLocaleString()}` : `${s.label} — not yet`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: reached ? `${s.color}20` : "transparent",
                    border: `1px solid ${reached ? s.color : "hsl(var(--border))"}`,
                  }}
                >
                  <Icon size={14} style={{ color: reached ? s.color : "hsl(var(--muted-foreground))" }} />
                </div>
                <span className="text-[10px] leading-tight" style={{ color: reached ? s.color : "hsl(var(--muted-foreground))" }}>
                  {s.label}
                </span>
                {s.at && <span className="text-[9px] text-muted-foreground">{timeAgo(s.at)}</span>}
              </div>
            );
          })}
        </div>

        {/* Event list */}
        <div className="space-y-2 mt-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading timeline…
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-3">
              Failed to load timeline: {error}
            </div>
          )}
          {!loading && !error && events.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No events yet for this prospect. Send an email or log activity to populate the timeline.
            </div>
          )}
          {!loading &&
            events.map((e) => {
              const cfg = ACTIVITY_TYPES[e.type] || {
                icon: FileText,
                color: "#6b7280",
                label: e.type.replace(/_/g, " "),
              };
              const Icon = cfg.icon;
              return (
                <div
                  key={e.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40 hover:border-border transition-colors"
                >
                  <div
                    className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${cfg.color}20` }}
                  >
                    <Icon size={13} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                        {timeAgo(e.at)}
                      </Badge>
                    </div>
                    {e.content && (
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">{e.content}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {new Date(e.at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
