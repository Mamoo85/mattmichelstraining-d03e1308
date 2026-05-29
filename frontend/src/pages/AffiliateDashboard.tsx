import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppNavbar from "@/components/layout/AppNavbar";
import { Copy, Check, DollarSign, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

const COMMISSION_BY_TIER: Record<string, string> = {
  basic: "$15",
  foundation: "$20",
  custom: "$25",
  team_elite: "$30",
};

const AffiliateDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const referralLink = user ? `https://mattmichelstraining.com?ref=${user.id}` : "";

  const { data: referralData } = useQuery({
    queryKey: ["affiliate-dashboard", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: code } = await supabase
        .from("referral_codes")
        .select("total_referrals, credits_earned, code")
        .eq("user_id", user!.id)
        .maybeSingle();

      const { data: conversions } = await supabase
        .from("referral_conversions")
        .select("id, subscription_tier, created_at")
        .eq("referrer_user_id", user!.id)
        .order("created_at", { ascending: false });

      const { data: commissions } = await supabase
        .from("affiliate_commissions" as any)
        .select("commission_amount_cents, status, created_at, tier")
        .eq("referrer_user_id", user!.id)
        .order("created_at", { ascending: false });

      return { code, conversions: conversions || [], commissions: (commissions as any[]) || [] };
    },
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it and earn cash for every signup." });
    setTimeout(() => setCopied(false), 2500);
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth?redirect=/affiliate" replace />;

  const totalEarned = (referralData?.commissions || []).reduce(
    (s: number, c: any) => s + (c.commission_amount_cents || 0), 0
  );
  const pendingEarned = (referralData?.commissions || [])
    .filter((c: any) => c.status === "pending" || c.status === "approved")
    .reduce((s: number, c: any) => s + (c.commission_amount_cents || 0), 0);

  const totalReferrals = referralData?.code?.total_referrals || 0;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Referral Dashboard — M2 Training</title>
      </Helmet>
      <AppNavbar />
      <div className="container max-w-2xl pt-20 pb-16 space-y-8">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">Referral Earnings</h1>
          <p className="text-sm text-muted-foreground">Share your link. Earn cash for every member you bring in.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Earned", value: `$${(totalEarned / 100).toFixed(0)}`, icon: DollarSign, color: "text-green-500" },
            { label: "Pending Payout", value: `$${(pendingEarned / 100).toFixed(0)}`, icon: TrendingUp, color: "text-primary" },
            { label: "Referrals", value: String(totalReferrals), icon: Users, color: "text-blue-500" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border p-4 text-center">
                <Icon size={16} className={`${s.color} mx-auto mb-1`} />
                <div className="text-2xl font-black text-foreground">{s.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Your Link */}
        <div className="bg-card border border-border p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Your Referral Link</h2>
          <div className="flex gap-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 bg-muted/30 border border-border text-xs px-3 py-2 text-foreground font-mono"
            />
            <Button size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Anyone who signs up using this link earns you a cash commission.
          </p>
        </div>

        {/* Commission Rates */}
        <div className="bg-card border border-border p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">What You Earn</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(COMMISSION_BY_TIER).map(([tier, amount]) => (
              <div key={tier} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground capitalize">{tier.replace("_", " ")} Plan</span>
                <span className="text-sm font-black text-green-500">{amount}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Payouts sent monthly via Venmo, PayPal, or check. No cap on earnings.
          </p>
        </div>

        {/* Conversion History */}
        {referralData && referralData.conversions.length > 0 && (
          <div className="bg-card border border-border p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Conversion History</h2>
            <div className="space-y-2">
              {referralData.conversions.map((c: any) => {
                const commission = referralData.commissions.find(
                  (cm: any) => cm.created_at === c.created_at || cm.tier === c.subscription_tier
                );
                return (
                  <div key={c.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <div>
                      <div className="text-xs font-semibold text-foreground capitalize">
                        {c.subscription_tier?.replace("_", " ")} Plan
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-green-500">
                        {commission ? `$${(commission.commission_amount_cents / 100).toFixed(0)}` : COMMISSION_BY_TIER[c.subscription_tier] || "$15"}
                      </div>
                      <div className="text-[10px] text-muted-foreground capitalize">
                        {commission?.status || "processing"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {referralData?.conversions.length === 0 && (
          <div className="bg-card border border-border p-8 text-center">
            <Users size={28} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground font-semibold mb-1">No conversions yet</p>
            <p className="text-xs text-muted-foreground">
              Share your link with friends, teammates, or parents. Each signup puts cash in your pocket.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AffiliateDashboard;
