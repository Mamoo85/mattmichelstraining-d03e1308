import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  ShieldCheck, Loader2, CheckCircle, XCircle, Clock, ChevronDown,
  Sparkles, Pencil, User, Filter, RefreshCw
} from "lucide-react";

interface QueueItem {
  id: string;
  action_type: string;
  target_user_id: string | null;
  context: Record<string, any>;
  ai_result: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_notes: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  form_check: "Form Check",
  draft_reply: "Coach Draft Reply",
  coach_reply: "Coach Reply",
  newsletter: "Newsletter Draft",
  program_reply: "Program Reply",
  exercise_sub: "Exercise Substitution",
  exercise_substitution: "Exercise Substitution",
  recovery_advisor: "Recovery Advisor",
  recovery_advice: "Recovery Advice",
  ask_coach: "Ask Coach Matt",
  program_generate: "Program Generator",
  intake_analyzer: "Intake Analyzer",
  copilot: "AI Copilot",
  blog_draft: "Blog Draft",
  exercise: "Exercise Entry",
  promo_suggest: "Promo Suggestion",
  protocol: "Protocol",
  site_content: "Site Content",
  batch_site_content: "Batch Site Content",
  client_summary: "Client Summary",
  schedule_suggest: "Schedule Suggestion",
  parent_report: "Parent Report",
  welcome_drip: "🎉 Welcome Drip",
  weekly_recap: "📊 Weekly Recap",
  upsell_nudge: "💰 Upsell Nudge",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400",
  approved: "text-emerald-400",
  rejected: "text-destructive",
};

/** Convert raw AI result (which may be JSON) into readable markdown */
function formatAiResult(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return raw;
  try {
    const parsed = JSON.parse(trimmed);
    return jsonToMarkdown(parsed);
  } catch {
    return raw;
  }
}

function jsonToMarkdown(data: any, _depth = 0): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (typeof data === "number" || typeof data === "boolean") return String(data);

  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === "object" && item !== null) return jsonToMarkdown(item, _depth);
      return `- ${item}`;
    }).join("\n\n");
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());

    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      lines.push(`### ${label}`);
      value.forEach((item: any, i: number) => {
        const name = item.name || item.title || item.exercise || `Item ${i + 1}`;
        lines.push(`**${name}**`);
        const subLines: string[] = [];
        for (const [k, v] of Object.entries(item)) {
          if (["name", "title"].includes(k)) continue;
          const subLabel = k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
          subLines.push(`- **${subLabel}:** ${v}`);
        }
        lines.push(subLines.join("\n"));
      });
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`**${label}:** ${value.join(", ")}`);
    } else if (typeof value === "object" && value !== null) {
      lines.push(`### ${label}`);
      lines.push(jsonToMarkdown(value, _depth + 1));
    } else if (typeof value === "string" && value.length > 0) {
      lines.push(`**${label}:** ${value}`);
    } else if (typeof value === "number") {
      lines.push(`**${label}:** ${value}`);
    }
  }
  return lines.join("\n\n");
}

const AdminAiQueue = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => { fetchQueue(); }, [filter]);

  const fetchQueue = async () => {
    setLoading(true);
    let query = supabase
      .from("ai_action_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      // silent in production
    }
    setItems((data as QueueItem[]) || []);
    setLoading(false);
  };

  const handleApprove = async (item: QueueItem) => {
    setProcessing(item.id);
    try {
      const finalText = editingId === item.id ? editText : item.ai_result;

      // Update queue status
      const { error } = await supabase
        .from("ai_action_queue")
        .update({
          status: "approved",
          ai_result: finalText,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          admin_notes: adminNotes || null,
        })
        .eq("id", item.id);

      if (error) throw error;

      // Deliver the result based on action type
      await deliverApprovedAction(item, finalText);

      toast({ title: "Approved & delivered", description: `${ACTION_LABELS[item.action_type] || item.action_type} has been approved.` });
      setEditingId(null);
      setAdminNotes("");
      fetchQueue();
    } catch (e: any) {
      toast({ title: "Approval failed", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (item: QueueItem) => {
    setProcessing(item.id);
    try {
      const { error } = await supabase
        .from("ai_action_queue")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          admin_notes: adminNotes || "Rejected by admin",
        })
        .eq("id", item.id);

      if (error) throw error;
      toast({ title: "Rejected", description: "AI action has been rejected." });
      setAdminNotes("");
      fetchQueue();
    } catch (e: any) {
      toast({ title: "Rejection failed", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const deliverApprovedAction = async (item: QueueItem, text: string) => {
    // For athlete-facing actions, create a notification so the athlete can see the response
    if (item.target_user_id && ["recovery_advice", "recovery_advisor", "exercise_sub", "exercise_substitution", "intake_analyzer", "form_check", "draft_reply", "coach_reply", "program_reply", "welcome_drip", "weekly_recap", "upsell_nudge"].includes(item.action_type)) {
      const titleMap: Record<string, string> = {
        welcome_drip: "Welcome to M² Training!",
        weekly_recap: "Your Weekly Training Recap",
        upsell_nudge: "Level Up Your Training",
      };
      await supabase.from("notifications").insert({
        user_id: item.target_user_id,
        type: item.action_type === "welcome_drip" ? "welcome" : item.action_type === "weekly_recap" ? "recap" : item.action_type === "upsell_nudge" ? "upsell" : "ai_response",
        title: titleMap[item.action_type] || `${ACTION_LABELS[item.action_type] || "AI"} Response Ready`,
        body: text.slice(0, 500),
        link: item.action_type === "upsell_nudge" ? "/pricing" : "/dashboard",
      });
    }

    // For draft_reply on flagged exercises, update the coach_reply field
    if ((item.action_type === "draft_reply" || item.action_type === "coach_reply") && item.context.exerciseLogId) {
      await supabase
        .from("logged_exercises")
        .update({ coach_reply: text })
        .eq("id", item.context.exerciseLogId);
    }

    // For draft_reply on program messages, update the coach_reply
    if ((item.action_type === "draft_reply" || item.action_type === "program_reply") && item.context.messageId) {
      await supabase
        .from("program_messages")
        .update({ coach_reply: text })
        .eq("id", item.context.messageId);
    }

    // For promo suggestions, create the promos in the DB
    if (item.action_type === "promo_suggest") {
      try {
        const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const promos = JSON.parse(cleaned);
        if (Array.isArray(promos)) {
          for (const promo of promos) {
            await supabase.from("promotions").insert({
              code: (promo.code || "").trim().toUpperCase(),
              description: promo.description || "",
              discount_type: promo.discount_type || "percent",
              discount_value: promo.discount_value || 0,
              applies_to: promo.applies_to || "all",
            });
          }
          toast({ title: "Promotions created", description: `${promos.length} promo codes added to the database.` });
        }
      } catch {
        toast({ title: "Couldn't auto-create promos", description: "Approved but failed to parse — create manually.", variant: "destructive" });
      }
    }

    // Admin-only actions (newsletter, site content, etc.) just get the text copied
    if (["newsletter", "site_content", "batch_site_content", "blog_draft"].includes(item.action_type)) {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard", description: "Approved text copied — paste where needed." });
      } catch {
        // Clipboard may fail silently in some contexts
      }
    }
  };

  const startEdit = (item: QueueItem) => {
    setEditingId(item.id);
    setEditText(item.ai_result);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const getContextSummary = (item: QueueItem) => {
    const c = item.context;
    const parts: string[] = [];
    if (c.exerciseName) parts.push(c.exerciseName);
    if (c.athleteName) parts.push(`for ${c.athleteName}`);
    if (c.topic) parts.push(c.topic);
    if (c.rawIdea) parts.push(c.rawIdea.slice(0, 60));
    if (c.title) parts.push(c.title);
    return parts.join(" · ") || "No context";
  };

  const pendingCount = items.filter(i => i.status === "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            AI Approval Queue
          </h2>
          {pendingCount > 0 && (
            <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchQueue} className="p-2 text-muted-foreground hover:text-foreground transition-m2">
            <RefreshCw size={14} />
          </button>
          <div className="flex gap-1">
            {(["pending", "approved", "rejected", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-primary" size={24} />
          <span className="ml-2 text-sm text-muted-foreground">Loading queue…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card shadow-m2 p-8 text-center">
          <ShieldCheck size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "pending" ? "No pending AI actions — all clear!" : `No ${filter} actions found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const isEditing = editingId === item.id;
            const isProcessing = processing === item.id;

            return (
              <div key={item.id} className="bg-card shadow-m2 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-m2"
                >
                  <Sparkles size={14} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {ACTION_LABELS[item.action_type] || item.action_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(item.created_at)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">
                      {getContextSummary(item)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase ${STATUS_COLORS[item.status] || "text-muted-foreground"}`}>
                      {item.status}
                    </span>
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3">
                    {/* Context details */}
                    <div className="bg-muted/30 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                        Context
                      </span>
                      <div className="text-xs text-foreground space-y-1">
                        {item.context.exerciseName && <div><strong>Exercise:</strong> {item.context.exerciseName}</div>}
                        {item.context.athleteName && <div><strong>Athlete:</strong> {item.context.athleteName}</div>}
                        {item.context.clientNotes && <div><strong>Client Notes:</strong> {item.context.clientNotes}</div>}
                        {item.context.topic && <div><strong>Topic:</strong> {item.context.topic}</div>}
                        {item.context.reason && <div><strong>Reason:</strong> {item.context.reason}</div>}
                        {item.context.message && <div><strong>Message:</strong> {item.context.message}</div>}
                        {item.context.rawIdea && <div><strong>Raw Idea:</strong> {item.context.rawIdea}</div>}
                      </div>
                    </div>

                    {/* AI Result */}
                    <div className="border-l-2 border-primary p-3 bg-primary/5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">
                        AI Generated Response
                      </span>
                      {isEditing ? (
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-background border border-border p-3 text-sm text-foreground min-h-[200px] font-mono"
                        />
                      ) : (
                        <div className="prose prose-sm prose-invert max-w-none text-foreground">
                          <ReactMarkdown>{formatAiResult(item.ai_result)}</ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Admin notes */}
                    {item.status === "pending" && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                          Admin Notes (optional)
                        </label>
                        <input
                          type="text"
                          value={expandedId === item.id ? adminNotes : ""}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground"
                          placeholder="Add a note about this decision…"
                        />
                      </div>
                    )}

                    {/* Reviewed info */}
                    {item.reviewed_at && (
                      <div className="text-[10px] text-muted-foreground">
                        Reviewed {formatDate(item.reviewed_at)}
                        {item.admin_notes && <span> · Note: {item.admin_notes}</span>}
                      </div>
                    )}

                    {/* Actions */}
                    {item.status === "pending" && (
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => handleApprove(item)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-m2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                          Approve & Deliver
                        </button>
                        <button
                          onClick={() => handleReject(item)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 bg-destructive text-destructive-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 disabled:opacity-50"
                        >
                          <XCircle size={12} />
                          Reject
                        </button>
                        {!isEditing ? (
                          <button
                            onClick={() => startEdit(item)}
                            className="flex items-center gap-1.5 bg-muted text-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-muted/80 transition-m2"
                          >
                            <Pencil size={12} />
                            Edit Before Approving
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1.5 bg-muted text-muted-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-m2"
                          >
                            Cancel Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAiQueue;
