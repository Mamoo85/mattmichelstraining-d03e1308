import { useEffect, useState, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Gift, Copy, Check } from "lucide-react";

interface ReferEarnCardProps {
  onViewAll: () => void;
}

const ReferEarnCard = memo(({ onViewAll }: ReferEarnCardProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCode((data as any).code);
      });
  }, [user]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`);
    setCopied(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Gift size={14} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Refer & Earn</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        Know an athlete who needs real coaching? Send them your link. They get their first month of M² Basic <strong className="text-primary">free</strong>, and you get a <strong className="text-primary">free month</strong> added to your subscription.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
        >
          {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Referral Link</>}
        </button>
        <button
          onClick={onViewAll}
          className="border border-primary/30 text-primary px-3 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-all shrink-0"
        >
          Details
        </button>
      </div>
    </div>
  );
});

ReferEarnCard.displayName = "ReferEarnCard";

export default ReferEarnCard;
