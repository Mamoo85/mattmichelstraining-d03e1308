import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Loader2, Send, CheckCircle, ExternalLink, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AiAssistButton from "./AiAssistButton";

interface ProgramMessage {
  id: string;
  user_id: string;
  program_id: string;
  exercise_name: string;
  week_number: number;
  day_number: number;
  message: string;
  video_url: string | null;
  coach_reply: string | null;
  is_read: boolean;
  created_at: string;
  programTitle?: string;
  clientName?: string;
  clientEmail?: string;
}

const AdminCoachInbox = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ProgramMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [showReplied, setShowReplied] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("program_messages")
      .select("*, training_programs(title)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load inbox", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((d: any) => d.user_id))];
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

      const enriched: ProgramMessage[] = data.map((item: any) => ({
        ...item,
        programTitle: item.training_programs?.title || "Unknown Program",
        clientName: nameMap[item.user_id]?.name || "Unknown",
        clientEmail: nameMap[item.user_id]?.email || "",
      }));
      setMessages(enriched);
    } else {
      setMessages([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleReply = async (msgId: string) => {
    const reply = replies[msgId]?.trim();
    if (!reply) {
      toast({ title: "Enter a reply first", variant: "destructive" });
      return;
    }
    setSending(msgId);
    const { error } = await supabase
      .from("program_messages")
      .update({ coach_reply: reply, is_read: true })
      .eq("id", msgId);

    if (error) {
      toast({ title: "Failed to reply", description: error.message, variant: "destructive" });
    } else {
      // Send notification to athlete
      const msg = messages.find((m) => m.id === msgId);
      if (msg) {
        await supabase.from("notifications").insert({
          user_id: msg.user_id,
          type: "coach_reply",
          title: "Coach Matt Replied",
          body: `Matt replied to your question about ${msg.exercise_name} in ${msg.programTitle}`,
          link: "/dashboard",
        });
      }
      toast({ title: "Reply sent ✓" });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, coach_reply: reply, is_read: true } : m))
      );
      setReplies((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
    }
    setSending(null);
  };

  const markRead = async (msgId: string) => {
    await supabase.from("program_messages").update({ is_read: true }).eq("id", msgId);
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, is_read: true } : m)));
  };

  const unreplied = messages.filter((m) => !m.coach_reply);
  const replied = messages.filter((m) => m.coach_reply);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  const renderMessage = (msg: ProgramMessage) => (
    <div
      key={msg.id}
      className={`bg-card border border-border p-4 space-y-3 ${
        !msg.is_read && !msg.coach_reply ? "border-l-4 border-l-primary" : ""
      }`}
      onClick={() => !msg.is_read && markRead(msg.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-bold text-foreground">{msg.clientName}</span>
          {msg.clientEmail && (
            <span className="text-[10px] text-muted-foreground ml-2">{msg.clientEmail}</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
          {format(new Date(msg.created_at), "MMM d, h:mm a")}
        </span>
      </div>

      {/* Context */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5">
          {msg.programTitle}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest bg-muted text-muted-foreground px-2 py-0.5">
          W{msg.week_number} · D{msg.day_number}
        </span>
        {msg.exercise_name && (
          <span className="text-[9px] font-bold uppercase tracking-widest bg-muted text-muted-foreground px-2 py-0.5">
            {msg.exercise_name}
          </span>
        )}
      </div>

      {/* Message */}
      <div className="bg-muted/50 p-3 text-sm text-foreground/90 leading-relaxed">
        {msg.message}
      </div>

      {/* Video */}
      {msg.video_url && (
        <a
          href={msg.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink size={12} /> View Form Check Video
        </a>
      )}

      {/* Existing reply */}
      {msg.coach_reply && (
        <div className="bg-primary/5 border border-primary/15 p-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary block mb-1">
            Your Reply
          </span>
          <p className="text-sm text-foreground/80">{msg.coach_reply}</p>
        </div>
      )}

      {/* Reply input (only for unreplied) */}
      {!msg.coach_reply && (
        <>
          <textarea
            placeholder="Type your reply…"
            value={replies[msg.id] || ""}
            onChange={(e) => setReplies((prev) => ({ ...prev, [msg.id]: e.target.value }))}
            className="w-full bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[70px] resize-none"
          />
          <button
            onClick={() => handleReply(msg.id)}
            disabled={sending === msg.id}
            className="w-full h-11 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending === msg.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Send Reply
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
            <MessageSquare size={14} className="text-primary" />
            Ask Coach Matt Inbox
          </h2>
          <p className="text-xs text-muted-foreground">
            {unreplied.length} pending · {replied.length} replied
          </p>
        </div>
        <button
          onClick={fetchMessages}
          className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80"
        >
          Refresh
        </button>
      </div>

      {/* Unreplied */}
      {unreplied.length === 0 ? (
        <div className="text-center py-8 bg-card border border-border">
          <CheckCircle size={28} className="mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">No pending messages. You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">{unreplied.map(renderMessage)}</div>
      )}

      {/* Replied (collapsible) */}
      {replied.length > 0 && (
        <div>
          <button
            onClick={() => setShowReplied(!showReplied)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2 mb-2"
          >
            {showReplied ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {replied.length} Replied Message{replied.length !== 1 ? "s" : ""}
          </button>
          {showReplied && <div className="space-y-3">{replied.map(renderMessage)}</div>}
        </div>
      )}
    </div>
  );
};

export default AdminCoachInbox;
