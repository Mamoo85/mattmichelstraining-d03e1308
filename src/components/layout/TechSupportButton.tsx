import { useState } from "react";
import { Headset, Send, X, Loader2, Bot } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "tech_support",
        title: "Tech Support Request",
        body: message.trim(),
        link: "/profile",
      });

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
      {/* Inline card-style button — sits at the bottom of the profile page */}
      <div className="bg-card border border-border p-5 mt-6">
        <button
          onClick={() => { setOpen(true); setReplied(false); }}
          className="w-full flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Headset size={18} className="text-primary" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-[11px] font-bold uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
              Tech Support
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Having a technical issue? Send us a message.
            </p>
          </div>
          <Send size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Headset size={13} className="text-primary" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">Tech Support</span>
              </div>
              <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Describe your issue
              </p>

              {replied && autoReply && (
                <div className="bg-primary/5 border border-primary/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={12} className="text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">M2 Support</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{autoReply}</p>
                </div>
              )}

              {!replied && (
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Tell us what's going on..."
                  className="resize-none"
                />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              {replied ? (
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
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
