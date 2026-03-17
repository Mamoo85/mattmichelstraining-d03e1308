import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Loader2, Send, MessageSquare, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface DMThread {
  user_id: string;
  clientName: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
}

interface DirectMessage {
  id: string;
  user_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const AdminDirectMessages = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<DMThread[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchThreads = async () => {
    setLoading(true);
    // Get all DMs grouped by user
    const { data, error } = await supabase
      .from("coach_direct_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    // Group by user_id
    const grouped: Record<string, DirectMessage[]> = {};
    data.forEach((msg: any) => {
      if (!grouped[msg.user_id]) grouped[msg.user_id] = [];
      grouped[msg.user_id].push(msg);
    });

    // Fetch user names
    const userIds = Object.keys(grouped);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, athlete_name")
      .in("user_id", userIds);

    const nameMap: Record<string, string> = {};
    profiles?.forEach((p) => {
      nameMap[p.user_id] = p.athlete_name || p.full_name || "Unknown";
    });

    const threadList: DMThread[] = userIds.map((uid) => {
      const msgs = grouped[uid];
      const unread = msgs.filter((m) => m.sender_role === "athlete" && !m.is_read).length;
      return {
        user_id: uid,
        clientName: nameMap[uid] || "Unknown",
        lastMessage: msgs[0].message,
        lastTime: msgs[0].created_at,
        unreadCount: unread,
      };
    }).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());

    setThreads(threadList);
    setLoading(false);
  };

  useEffect(() => { fetchThreads(); }, []);

  const openThread = async (userId: string) => {
    setSelectedUser(userId);
    const { data } = await supabase
      .from("coach_direct_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    setMessages((data as DirectMessage[]) || []);

    // Mark as read
    await supabase
      .from("coach_direct_messages")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("sender_role", "athlete")
      .eq("is_read", false);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-dm")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "coach_direct_messages",
      }, (payload) => {
        const msg = payload.new as DirectMessage;
        if (selectedUser === msg.user_id) {
          setMessages((prev) => [...prev, msg]);
        }
        fetchThreads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUser]);

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedUser || !user) return;
    setSending(true);
    const { error } = await supabase.from("coach_direct_messages").insert({
      user_id: selectedUser,
      sender_id: user.id,
      sender_role: "coach",
      message: reply.trim(),
    });
    if (!error) {
      setReply("");
      // Refresh thread
      openThread(selectedUser);
    }
    setSending(false);
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
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Direct Messages</h2>
        <p className="text-xs text-muted-foreground">{threads.length} conversation{threads.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Thread list */}
        <div className="space-y-1 md:border-r md:border-border md:pr-4">
          {threads.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare size={24} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
            </div>
          ) : threads.map((t) => (
            <button
              key={t.user_id}
              onClick={() => openThread(t.user_id)}
              className={`w-full text-left p-3 transition-m2 ${
                selectedUser === t.user_id ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{t.clientName}</span>
                {t.unreadCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.unreadCount}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.lastMessage}</p>
              <span className="text-[10px] font-mono text-muted-foreground">
                {format(new Date(t.lastTime), "MMM d, h:mm a")}
              </span>
            </button>
          ))}
        </div>

        {/* Chat view */}
        <div className="md:col-span-2">
          {!selectedUser ? (
            <div className="flex items-center justify-center h-[300px] bg-muted/30">
              <p className="text-sm text-muted-foreground">Select a conversation</p>
            </div>
          ) : (
            <div className="bg-card border border-border flex flex-col h-[400px]">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_role === "coach" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] p-3 ${
                      msg.sender_role === "coach" ? "bg-primary/10 border border-primary/20" : "bg-muted"
                    }`}>
                      <p className="text-sm text-foreground">{msg.message}</p>
                      <span className="text-[10px] font-mono text-muted-foreground mt-1 block">
                        {msg.sender_role === "coach" ? "YOU" : "ATHLETE"} · {format(new Date(msg.created_at), "h:mm a")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendReply())}
                  placeholder="Reply..."
                  className="flex-1 bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                />
                <button
                  onClick={handleSendReply}
                  disabled={sending || !reply.trim()}
                  className="bg-primary text-primary-foreground px-3 py-2 hover:opacity-90 transition-m2 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDirectMessages;
