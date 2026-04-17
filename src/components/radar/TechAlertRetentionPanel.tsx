import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Gift, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  clientId: string;
  clientEmail?: string;
}

/**
 * Batch 3 TR-13/14/15 — drop-in panel for MyTechAlert.
 * Shows: ROI saved badge, weekly "ones you missed" digest, referral hook.
 */
export const TechAlertRetentionPanel = ({ clientId, clientEmail }: Props) => {
  const [hires, setHires] = useState(0);
  const [missed, setMissed] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    void loadStats();
  }, [clientId]);

  const loadStats = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: hireRows }, { data: missedRows }, { data: refRow }] = await Promise.all([
      supabase
        .from("hire_alert_client_candidates")
        .select("id")
        .eq("client_id", clientId)
        .eq("client_action", "hired"),
      supabase
        .from("hire_alert_client_candidates")
        .select("id, candidate_id, hire_alert_candidates(name, role, score, location)")
        .eq("client_id", clientId)
        .is("client_action", null)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("radar_referral_codes")
        .select("code")
        .eq("owner_type", "hire_alert")
        .eq("owner_id", clientId)
        .maybeSingle(),
    ]);

    setHires(hireRows?.length || 0);
    setMissed(missedRows || []);
    setReferralCode(refRow?.code || null);
  };

  const generateReferralCode = async () => {
    const code = `TA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { error } = await supabase.from("radar_referral_codes").insert({
      code,
      owner_type: "hire_alert",
      owner_id: clientId,
      owner_email: clientEmail,
      reward_type: "free_month",
    });
    if (error) {
      toast.error("Could not generate code");
      return;
    }
    setReferralCode(code);
    toast.success("Referral code created!");
  };

  const copyReferralLink = () => {
    if (!referralCode) return;
    const link = `https://detroitwebagent.com/hire-alert?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied");
  };

  const savedVsLinkedIn = hires * 8000;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ROI badge */}
      <Card className="p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span className="text-xs uppercase tracking-wide text-emerald-300">ROI vs LinkedIn Recruiter</span>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-emerald-100">
          ${savedVsLinkedIn.toLocaleString()}
        </div>
        <div className="text-xs text-emerald-200/70 mt-1">
          {hires} hire{hires === 1 ? "" : "s"} × $8k avg agency fee saved
        </div>
      </Card>

      {/* Missed candidates */}
      <Card className="p-5 bg-card/50 border-border md:col-span-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Ones you missed (7d)</div>
        {missed.length === 0 ? (
          <div className="text-sm text-muted-foreground">All caught up. ✅</div>
        ) : (
          <div className="space-y-1.5">
            {missed.slice(0, 3).map((m: any) => (
              <div key={m.id} className="text-xs flex items-center justify-between gap-2">
                <span className="truncate">{m.hire_alert_candidates?.name || "Candidate"} — {m.hire_alert_candidates?.role}</span>
                <Badge variant="outline" className="text-[10px]">{m.hire_alert_candidates?.score}/10</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Referral hook */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-wide text-primary">Refer & get 1 month free</span>
        </div>
        {referralCode ? (
          <>
            <div className="text-sm font-mono mb-2">{referralCode}</div>
            <Button size="sm" variant="outline" onClick={copyReferralLink} className="w-full">
              <Copy className="h-3 w-3 mr-1" /> Copy referral link
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={generateReferralCode} className="w-full">
            Get my referral code
          </Button>
        )}
      </Card>
    </div>
  );
};
