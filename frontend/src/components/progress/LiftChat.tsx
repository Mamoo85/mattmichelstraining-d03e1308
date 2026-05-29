import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { MessageSquare, Send, Loader2, X, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface LiftMessage {
  id: string;
  message: string;
  sender_role: string;
  sender_id: string;
  is_read: boolean;
  created_at: string;
}

interface LiftChatProps {
  logId: string;
  userId: string;
}

const LiftChat = ({ logId, userId }: LiftChatProps) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [messages, setMessages] = useState<LiftMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("lift_messages" as any)
      .select("*")
      .eq("progress_log_id", logId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as any[]);
  }, [logId]);

  useEffect(() => {
    fetchMessages();

    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [logId, fetchMessages]);

  // Auto-show if there are messages
  useEffect(() => {
    if (messages.length > 0) setShowChat(true);
  }, [messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);

    const { error } = await supabase.from("lift_messages" as any).insert({
      progress_log_id: logId,
      user_id: userId,
      sender_id: user.id,
      sender_role: isAdmin ? "coach" : "athlete",
      message: newMessage.trim(),
    });

    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } else {
      setNewMessage("");
      await fetchMessages();
    }
    setSending(false);
  };

  const unreadCount = messages.filter(
    (m) => !m.is_read && m.sender_id !== user?.id
  ).length;

  return (
    <div className="w-full">
      {/* Toggle button when collapsed and no messages */}
      {!showChat && messages.length === 0 && (
        <button
          onClick={() => setShowChat(true)}
          className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-all mt-1"
        >
          <HelpCircle size={10} />
          {isAdmin ? "Message athlete" : "Ask Matt about this lift"}
        </button>
      )}

      {/* Unread badge for collapsed state */}
      {!showChat && unreadCount > 0 && (
        <button
          onClick={() => setShowChat(true)}
          className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-primary"
        >
          <MessageSquare size={10} />
          {unreadCount} new {unreadCount === 1 ? "reply" : "replies"}
        </button>
      )}

      {showChat && (
        <div className="mt-1.5 border border-border bg-background">
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted border-b border-border">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              {isAdmin ? "Conversation with Athlete" : "Chat with Coach Matt"}
            </span>
            {messages.length === 0 && (
              <button onClick={() => setShowChat(false)} className="text-muted-foreground hover:text-foreground">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Messages */}
          {messages.length > 0 && (
            <div className="max-h-40 overflow-y-auto p-2 space-y-1.5">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-2.5 py-1.5 text-xs leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      {msg.message}
                    </div>
                    <span className="text-[8px] text-muted-foreground font-mono mt-0.5">
                      {msg.sender_role === "coach" ? "Coach Matt" : "You"} · {format(new Date(msg.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-1.5 p-2 border-t border-border">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={isAdmin ? "Reply to athlete..." : "Ask Matt about this lift..."}
              className="flex-1 bg-background border border-border text-xs px-2 h-7 font-mono text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="h-7 w-7 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {sending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiftChat;
