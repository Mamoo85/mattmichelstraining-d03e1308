import { useState, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Check, Users } from "lucide-react";

interface ReferEarnCardProps {
  onViewAll: () => void;
}

const ReferEarnCard = memo(({ onViewAll }: ReferEarnCardProps) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const referralLink = user ? `${window.location.origin}/?ref=${user.id}` : "";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Refer a Friend</span>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-1">Free for now</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        Know someone who should be training with M²? Send them your link — it's <strong className="text-primary">completely free</strong> to join right now.
      </p>
      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
      >
        {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Referral Link</>}
      </button>
    </div>
  );
});

ReferEarnCard.displayName = "ReferEarnCard";

export default ReferEarnCard;
