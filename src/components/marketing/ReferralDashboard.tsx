import { useState, useEffect } from "react";
import { Copy, Check, Gift, Users, Award, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface ReferralData {
  code: string;
  total_referrals: number;
  credits_earned: number;
  credits_redeemed: number;
}

interface Conversion {
  id: string;
  subscription_tier: string | null;
  credited: boolean;
  created_at: string;
}

const ReferralDashboard = () => {
  const { user } = useAuth();
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: refData }, { data: convData }] = await Promise.all([
      supabase
        .from("referral_codes")
        .select("code, total_referrals, credits_earned, credits_redeemed")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("referral_conversions")
        .select("id, subscription_tier, credited, created_at")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (refData) setReferral(refData as any);
    if (convData) setConversions(convData as any[]);
    setLoading(false);
  };

  const handleCopy = (type: "code" | "link") => {
    if (!referral) return;
    const text = type === "code"
      ? referral.code
      : `${window.location.origin}/?ref=${referral.code}`;
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast({ title: type === "code" ? "Code copied!" : "Link copied!" });
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground p-4 text-center">Loading referral info…</p>;
  }

  if (!referral) {
    return (
      <div className="text-center py-8">
        <Gift size={24} className="mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">Your referral code is being generated…</p>
      </div>
    );
  }

  const pendingCredits = referral.credits_earned - referral.credits_redeemed;
  const shareLink = `${window.location.origin}/?ref=${referral.code}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
          <Gift size={14} className="text-primary" /> Refer & Earn
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Share your code → friend gets 10% off first month → you earn a free month credit
        </p>
      </div>

      {/* Code + Link */}
      <div className="bg-card border border-border p-4 space-y-3">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Your Referral Code</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background border border-primary/30 p-3 text-center">
              <span className="text-lg font-mono font-black tracking-wider text-primary">{referral.code}</span>
            </div>
            <button
              onClick={() => handleCopy("code")}
              className="h-12 w-12 bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-all"
            >
              {copied === "code" ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Shareable Link</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background border border-border p-2.5 text-xs font-mono text-muted-foreground truncate">
              {shareLink}
            </div>
            <button
              onClick={() => handleCopy("link")}
              className="h-10 w-10 bg-muted text-foreground flex items-center justify-center hover:bg-muted/80 transition-all"
            >
              {copied === "link" ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border p-3 text-center">
          <Users size={14} className="mx-auto text-primary mb-1" />
          <span className="text-xl font-mono font-bold text-foreground block">{referral.total_referrals}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Referrals</span>
        </div>
        <div className="bg-card border border-border p-3 text-center">
          <Award size={14} className="mx-auto text-primary mb-1" />
          <span className="text-xl font-mono font-bold text-foreground block">{referral.credits_earned}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Months Earned</span>
        </div>
        <div className="bg-primary/10 border border-primary/20 p-3 text-center">
          <Gift size={14} className="mx-auto text-primary mb-1" />
          <span className="text-xl font-mono font-bold text-primary block">{pendingCredits}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary/70">Available</span>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-muted p-4 space-y-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block">How It Works</span>
        <div className="space-y-1.5 text-xs text-foreground">
          <p>1. Share your code or link with a friend</p>
          <p>2. They get <strong className="text-primary">10% off</strong> their first month</p>
          <p>3. You earn a <strong className="text-primary">free month credit</strong> when they subscribe</p>
          <p>4. Credits stack — refer more, train free longer</p>
        </div>
      </div>

      {/* Conversion history */}
      {conversions.length > 0 && (
        <div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Referral History</span>
          <div className="bg-card border border-border divide-y divide-border">
            {conversions.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3">
                <div>
                  <span className="text-xs font-bold text-foreground">
                    {c.subscription_tier ? `M² ${c.subscription_tier.charAt(0).toUpperCase() + c.subscription_tier.slice(1)}` : "Subscription"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${c.credited ? "text-primary" : "text-muted-foreground"}`}>
                  {c.credited ? "✓ Credited" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralDashboard;
