import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";
import {
  Loader2,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Mail,
  MailOpen,
  Send,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ParentMessage {
  id: string;
  parent_email: string;
  parent_name: string | null;
  child_user_id: string | null;
  subject: string;
  body: string;
  sentiment: string;
  is_urgent: boolean;
  urgent_reason: string | null;
  is_read: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const SENTIMENT_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  positive: {
    icon: <CheckCircle2 size={12} />,
    label: "Positive",
    className: "bg-green-500/15 text-green-600 dark:text-green-400",
  },
  negative: {
    icon: <AlertTriangle size={12} />,
    label: "Negative",
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  neutral: {
    icon: <Minus size={12} />,
    label: "Neutral",
    className: "bg-muted text-muted-foreground",
  },
};

const AdminParentInbox = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ParentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "urgent" | "unread">("all");
  const [childNames, setChildNames] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ParentMessage | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parent_inbox")
      .select("*")
      .eq("is_deleted", false)
      .order("is_urgent", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load messages", variant: "destructive" });
    } else if (data) {
      setMessages(data as ParentMessage[]);

      const childIds = [...new Set(data.filter((m: any) => m.child_user_id).map((m: any) => m.child_user_id))];
      if (childIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, athlete_name, full_name")
          .in("user_id", childIds);
        if (profiles) {
          const map: Record<string, string> = {};
          profiles.forEach((p: any) => {
            map[p.user_id] = p.athlete_name || p.full_name || "Unknown";
          });
          setChildNames(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const markRead = async (id: string) => {
    await supabase.from("parent_inbox").update({ is_read: true }).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: true } : m)));
  };

  const sendReply = async (msg: ParentMessage) => {
    const text = replyText[msg.id]?.trim();
    if (!text) return;

    setReplying(msg.id);
    try {
      await supabase
        .from("parent_inbox")
        .update({ admin_reply: text, replied_at: new Date().toISOString(), is_read: true })
        .eq("id", msg.id);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, admin_reply: text, replied_at: new Date().toISOString(), is_read: true } : m
        )
      );
      setReplyText((prev) => ({ ...prev, [msg.id]: "" }));
      toast({ title: "Reply saved", description: "Copy and send via your email client." });
    } catch {
      toast({ title: "Failed to save reply", variant: "destructive" });
    } finally {
      setReplying(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;

    // Move to trash
    await supabase.from("admin_trash" as any).insert({
      original_table: "parent_inbox",
      original_id: deleteTarget.id,
      deleted_by: user.id,
      original_data: deleteTarget as any,
      label: `Parent message: ${deleteTarget.subject || deleteTarget.parent_email}`,
    });

    // Soft-delete
    await supabase.from("parent_inbox").update({ is_deleted: true } as any).eq("id", deleteTarget.id);

    setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast({ title: "Moved to trash", description: "Can be restored within 30 days." });
  };

  const filtered = messages.filter((m) => {
    if (filter === "urgent") return m.is_urgent;
    if (filter === "unread") return !m.is_read;
    return true;
  });

  const urgentCount = messages.filter((m) => m.is_urgent && !m.is_read).length;
  const unreadCount = messages.filter((m) => !m.is_read).length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-card shadow-m2 px-4 py-3 flex items-center gap-2">
          <Inbox size={14} className="text-primary" />
          <span className="text-xs font-bold text-foreground">{messages.length}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Total</span>
        </div>
        {urgentCount > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-center gap-2 animate-pulse">
            <AlertTriangle size={14} className="text-destructive" />
            <span className="text-xs font-bold text-destructive">{urgentCount}</span>
            <span className="text-[10px] text-destructive uppercase tracking-widest font-bold">Urgent</span>
          </div>
        )}
        <div className="bg-card shadow-m2 px-4 py-3 flex items-center gap-2">
          <Mail size={14} className="text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">{unreadCount}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Unread</span>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-1">
        {(["all", "urgent", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "urgent" ? `Urgent (${messages.filter((m) => m.is_urgent).length})` : f === "unread" ? `Unread (${unreadCount})` : "All"}
          </button>
        ))}
      </div>

      {/* Message list */}
      {filtered.length === 0 ? (
        <div className="bg-card shadow-m2 p-8 text-center">
          <Inbox size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No messages {filter !== "all" ? `matching "${filter}" filter` : "yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg) => {
            const isExpanded = expandedId === msg.id;
            const sentimentCfg = SENTIMENT_CONFIG[msg.sentiment] || SENTIMENT_CONFIG.neutral;

            return (
              <div
                key={msg.id}
                className={`bg-card shadow-m2 overflow-hidden transition-all ${
                  msg.is_urgent ? "border-l-4 border-l-destructive" : ""
                } ${!msg.is_read ? "ring-1 ring-primary/30" : ""}`}
              >
                {/* Header */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : msg.id);
                    if (!msg.is_read) markRead(msg.id);
                  }}
                  className="w-full p-4 flex items-start justify-between text-left hover:bg-accent/30 transition-m2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {msg.is_urgent && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-destructive text-destructive-foreground px-2 py-0.5 animate-pulse">
                          🚨 Urgent — Requires Matt
                        </span>
                      )}
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 flex items-center gap-1 ${sentimentCfg.className}`}>
                        {sentimentCfg.icon} {sentimentCfg.label}
                      </span>
                      {!msg.is_read && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/15 text-primary px-2 py-0.5">New</span>
                      )}
                      {msg.admin_reply && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-green-500/15 text-green-600 px-2 py-0.5">Replied</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.is_read ? (
                        <MailOpen size={14} className="text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Mail size={14} className="text-primary flex-shrink-0" />
                      )}
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {msg.subject || "(No subject)"}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>{msg.parent_name || msg.parent_email}</span>
                      {msg.child_user_id && childNames[msg.child_user_id] && (
                        <>
                          <span>·</span>
                          <span className="text-primary">
                            Parent of {childNames[msg.child_user_id]}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {msg.is_urgent && msg.urgent_reason && (
                      <div className="bg-destructive/10 border border-destructive/20 p-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-destructive block mb-1">
                          Flagged Because
                        </span>
                        <p className="text-xs text-foreground">{msg.urgent_reason}</p>
                      </div>
                    )}

                    <div className="bg-background border border-border p-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                        Message
                      </span>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    </div>

                    {msg.admin_reply && (
                      <div className="bg-primary/5 border-l-2 border-primary p-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
                          Your Reply
                        </span>
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{msg.admin_reply}</p>
                        <span className="text-[9px] text-muted-foreground mt-1 block">
                          {msg.replied_at && formatDistanceToNow(new Date(msg.replied_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}

                    {/* Reply box */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
                        Reply (saved for reference — send via email)
                      </span>
                      <textarea
                        value={replyText[msg.id] || ""}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [msg.id]: e.target.value }))}
                        placeholder="Draft your reply to this parent..."
                        className="w-full bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[80px] resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <a
                          href={`mailto:${msg.parent_email}?subject=Re: ${encodeURIComponent(msg.subject)}`}
                          className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-m2"
                        >
                          Open in Email Client →
                        </a>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeleteTarget(msg)}
                            className="flex items-center gap-1.5 border border-destructive/30 text-destructive px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-destructive/10 transition-m2"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                          <button
                            onClick={() => sendReply(msg)}
                            disabled={!replyText[msg.id]?.trim() || replying === msg.id}
                            className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
                          >
                            {replying === msg.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Save Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmActionModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleDelete}
        title="Delete Message"
        description={`Move this message from ${deleteTarget?.parent_name || deleteTarget?.parent_email} to trash? It can be restored within 30 days.`}
        confirmLabel="Move to Trash"
      />
    </div>
  );
};

export default AdminParentInbox;
