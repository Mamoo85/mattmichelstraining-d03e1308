import { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface DirectMessage {
  id: string;
  user_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const CoachMessaging = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("coach_direct_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (!error && data) setMessages(data as DirectMessage[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("coach-dm")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "coach_direct_messages",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as DirectMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("coach_direct_messages").insert({
      user_id: user.id,
      sender_id: user.id,
      sender_role: isAdmin ? "coach" : "athlete",
      message: message.trim(),
    });
    if (!error) setMessage("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div>
      <SectionHeader title="Message Matt" timestamp={`${messages.length} messages`} />

      <div className="bg-card shadow-m2 flex flex-col h-[400px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No messages yet. Start a conversation with Matt!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_role === "athlete" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3 ${
                  msg.sender_role === "athlete"
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted"
                }`}>
                  <p className="text-sm text-foreground">{msg.message}</p>
                  <span className="text-[10px] font-mono text-muted-foreground mt-1 block">
                    {msg.sender_role === "coach" ? "MATT" : "YOU"} · {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <input
            type="text"
            placeholder="Message Matt..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="bg-primary text-primary-foreground px-3 py-2 hover:opacity-90 transition-m2 disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachMessaging;
