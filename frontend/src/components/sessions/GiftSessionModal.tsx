import { useState } from "react";
import { Gift, Loader2, X, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface GiftSessionModalProps {
  open: boolean;
  onClose: () => void;
}

const GiftSessionModal = ({ open, onClose }: GiftSessionModalProps) => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!user || !email.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from("gifted_sessions").insert({
        giver_user_id: user.id,
        receiver_email: email.trim().toLowerCase(),
        status: "pending",
      });

      if (error) throw error;

      setSent(true);
      toast({ title: "Session gifted!", description: `A free 30-minute consultation with Coach Matt has been sent to ${email.trim()}.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setSent(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border-2 border-primary/30 p-6 max-w-md w-full mx-4 relative">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        {sent ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">
              Session Gifted!
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              We'll notify <span className="font-bold text-foreground">{email}</span> about their free 30-minute consultation with Coach Matt.
            </p>
            <button
              onClick={handleClose}
              className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground">
                Gift a Session
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Share a <span className="font-bold text-foreground">free 30-minute consultation</span> with Coach Matt. Your friend gets a personal assessment — no strings attached.
            </p>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-4">
              Included with your plan · $50 value
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Friend's Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@email.com"
                  className="w-full"
                />
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !email.trim()}
                className="w-full bg-primary text-primary-foreground py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Send Gift Session
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GiftSessionModal;
