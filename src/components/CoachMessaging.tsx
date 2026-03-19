import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAiStream } from "@/hooks/useAiStream";
import ReactMarkdown from "react-markdown";

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

  // AI quick answer
  const { stream, streaming, content: aiContent, reset: resetAi } = useAiStream({
    functionName: "ai-athlete-stream",
  });
  const [showAiAnswer, setShowAiAnswer] = useState(false);

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
  }, [messages, aiContent]);

  const handleSend = async () => {
    if (!message.trim() || !user) return;
    setSending(true);
    setShowAiAnswer(false);
    resetAi();
    const { error } = await supabase.from("coach_direct_messages").insert({
      user_id: user.id,
      sender_id: user.id,
      sender_role: isAdmin ? "coach" : "athlete",
      message: message.trim(),
    });
    if (!error) setMessage("");
    setSending(false);
  };

  const handleAiQuickAnswer = async () => {
    if (!message.trim()) return;
    setShowAiAnswer(true);
    resetAi();
    await stream({
      type: "ask_coach",
      context: { message: message.trim() },
    });
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
          ) : messages.length === 0 && !showAiAnswer ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No messages yet. Start a conversation with Matt!</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                💡 Tip: Use the <Sparkles size={10} className="inline text-primary" /> button for an instant AI answer while you wait for Matt's reply.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
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
              ))}

              {/* AI Quick Answer */}
              {showAiAnswer && (aiContent || streaming) && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] p-3 bg-accent/20 border border-accent/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles size={10} className="text-accent-foreground" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-accent-foreground">AI Quick Answer</span>
                    </div>
                    <div className="prose prose-sm max-w-none text-foreground text-xs leading-relaxed">
                      <ReactMarkdown>{aiContent}</ReactMarkdown>
                      {streaming && (
                        <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1.5 block">
                      This is an AI-generated answer. Matt will review your message personally.
                    </span>
                  </div>
                </div>
              )}
            </>
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
          {!isAdmin && message.trim() && (
            <button
              onClick={handleAiQuickAnswer}
              disabled={streaming}
              className="bg-accent text-accent-foreground px-2.5 py-2 hover:opacity-90 transition-m2 disabled:opacity-50"
              title="Get instant AI answer"
            >
              {streaming ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            </button>
          )}
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
