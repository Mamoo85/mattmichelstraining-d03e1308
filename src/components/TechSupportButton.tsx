import { useState } from "react";
import { MessageCircle, Send, X, Loader2, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const TechSupportButton = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replied, setReplied] = useState(false);
  const [autoReply, setAutoReply] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["trial-settings-support"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trial_settings" as any)
        .select("tech_support_auto_reply")
        .eq("id", 1)
        .single();
      return data as any;
    },
    staleTime: 60_000,
  });

  const handleSend = async () => {
    if (!message.trim() || !user) return;
    setSending(true);
    try {
      // Store the support message as a notification for admin
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "tech_support",
        title: "Tech Support Request",
        body: message.trim(),
        link: "/profile",
      });

      // Show the auto-reply from admin settings
      const reply = settings?.tech_support_auto_reply || 
        "Thanks for reaching out! We received your message and will get back to you within 24 hours.";
      setAutoReply(reply);
      setReplied(true);
      setMessage("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(true); setReplied(false); }}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-all"
        title="Tech Support"
      >
        <MessageCircle size={20} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">Tech Support</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <p className="text-xs text-muted-foreground">
                Having a technical issue? Describe your problem below and our support team will get back to you.
              </p>

              {replied && autoReply && (
                <div className="bg-primary/10 border border-primary/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Bot size={12} className="text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Auto-Reply</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{autoReply}</p>
                </div>
              )}

              {!replied && (
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Describe your issue..."
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground resize-y placeholder:text-muted-foreground"
                />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              {replied ? (
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  Close
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {sending ? "Sending…" : "Send Message"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TechSupportButton;
