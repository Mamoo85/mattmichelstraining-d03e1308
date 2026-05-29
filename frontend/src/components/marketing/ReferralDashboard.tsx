import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const ReferralDashboard = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const shareLink = `${window.location.origin}/?ref=${user.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
          <Users size={14} className="text-primary" /> Refer a Friend
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Share your link and help M2 grow — it's completely free to join right now.
        </p>
      </div>

      <div className="bg-primary/10 border border-primary/20 p-4 text-center">
        <span className="text-sm font-black uppercase tracking-widest text-primary">Invite Your Friends!</span>
      </div>

      <div className="bg-card border border-border p-4 space-y-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Your Referral Link</span>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background border border-border p-2.5 text-xs font-mono text-muted-foreground truncate">
            {shareLink}
          </div>
          <button
            onClick={handleCopy}
            className="h-10 w-10 bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-all"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div className="bg-muted p-4 space-y-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block">How It Works</span>
        <div className="space-y-1.5 text-xs text-foreground">
          <p>1. Copy your link and send it to a friend</p>
          <p>2. They sign up — <strong className="text-primary">100% free right now</strong></p>
          <p>3. Coach Matt gets notified and sets them up</p>
        </div>
      </div>
    </div>
  );
};

export default ReferralDashboard;
