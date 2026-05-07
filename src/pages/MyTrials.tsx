import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import DWASuiteNav from "@/components/shared/DWASuiteNav";
import { Clock, ExternalLink, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Trial = {
  id: string;
  product: string;
  label: string;
  status: string;
  trial_started_at: string;
  expires_at: string;
  converted_at: string | null;
  last_login_at: string | null;
  dashboard_url: string;
  days_remaining: number | null;
  zip_codes: string[] | null;
};

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

function statusBadge(t: Trial) {
  if (t.status === "converted") return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1" />Converted</Badge>;
  if (t.status === "founder") return <Badge className="bg-[#00d4ff] text-[#030711] hover:bg-[#00d4ff]"><CheckCircle2 className="w-3 h-3 mr-1" />Founder</Badge>;
  if (t.status === "expired" || (t.days_remaining !== null && t.days_remaining < 0)) {
    return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
  }
  if (t.status === "revoked") return <Badge variant="destructive">Revoked</Badge>;
  if (t.days_remaining !== null && t.days_remaining <= 2) {
    return <Badge className="bg-amber-600 hover:bg-amber-600"><AlertTriangle className="w-3 h-3 mr-1" />{t.days_remaining}d left</Badge>;
  }
  return <Badge className="bg-blue-600 hover:bg-blue-600"><Clock className="w-3 h-3 mr-1" />{t.days_remaining}d left</Badge>;
}

export default function MyTrials() {
  const params = new URLSearchParams(window.location.search);
  const initialEmail = params.get("email") || localStorage.getItem("dwa_trials_email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [trials, setTrials] = useState<Trial[] | null>(null);

  const load = async (e?: string) => {
    const target = (e ?? email).trim();
    if (!target) {
      toast.error("Enter your email");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-my-trials", { body: { email: target } });
      if (error) throw error;
      setTrials((data as any)?.trials || []);
      localStorage.setItem("dwa_trials_email", target);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't load trials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (initialEmail) load(initialEmail); /* eslint-disable-next-line */ }, []);

  const active = (trials || []).filter(t => t.status === "active" && (t.days_remaining ?? -1) >= 0);
  const expired = (trials || []).filter(t => t.status === "expired" || (t.status === "active" && (t.days_remaining ?? 0) < 0));
  const other = (trials || []).filter(t => !["active", "expired"].includes(t.status));

  return (
    <div className="min-h-screen bg-[#030711] text-foreground">
      <SEOHead title="My Trials — DWA Dashboards" description="View all your active 7-day trial dashboards and expiration dates." />
      <DWASuiteNav email={email || undefined} />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">My Trials</h1>
            <p className="text-sm text-[#94a3b8] mt-0.5">Every dashboard you're enrolled in and when each trial expires.</p>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <Card className="bg-[#0a1628] border-[#1e3a5f] mb-6">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-[#94a3b8] block mb-1">Your email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-[#030711] border-[#1e3a5f] text-white"
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
            </div>
            <Button onClick={() => load()} disabled={loading} className="bg-[#00d4ff] text-[#030711] hover:bg-[#00d4ff]/90">
              {loading ? "Loading…" : "Load my trials"}
            </Button>
          </CardContent>
        </Card>

        {trials === null && (
          <p className="text-sm text-[#64748b] text-center py-12">Enter your email to see your enrolled dashboards.</p>
        )}

        {trials !== null && trials.length === 0 && (
          <Card className="bg-[#0a1628] border-[#1e3a5f]">
            <CardContent className="p-8 text-center">
              <p className="text-white font-semibold mb-1">No trials found for this email.</p>
              <p className="text-sm text-[#94a3b8]">Double-check the address you used at signup, or text Matt at (313) 992-1219.</p>
            </CardContent>
          </Card>
        )}

        {!!active.length && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-widest text-[#00d4ff] font-bold mb-3">Active ({active.length})</h2>
            <div className="grid grid-cols-1 gap-3">
              {active.map(t => <TrialRow key={t.id} t={t} />)}
            </div>
          </div>
        )}

        {!!other.length && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-widest text-[#94a3b8] font-bold mb-3">Converted / Founder ({other.length})</h2>
            <div className="grid grid-cols-1 gap-3">
              {other.map(t => <TrialRow key={t.id} t={t} />)}
            </div>
          </div>
        )}

        {!!expired.length && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-widest text-red-400 font-bold mb-3">Expired ({expired.length})</h2>
            <div className="grid grid-cols-1 gap-3">
              {expired.map(t => <TrialRow key={t.id} t={t} />)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function TrialRow({ t }: { t: Trial }) {
  return (
    <Card className="bg-[#0a1628] border-[#1e3a5f] hover:border-[#00d4ff]/40 transition-colors">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-white truncate">{t.label}</p>
            {statusBadge(t)}
          </div>
          <p className="text-xs text-[#94a3b8]">
            Started {fmtDate(t.trial_started_at)} · Expires <span className="text-white">{fmtDate(t.expires_at)}</span>
            {t.last_login_at && <> · Last opened {fmtDate(t.last_login_at)}</>}
          </p>
          {t.zip_codes && t.zip_codes.length > 0 && (
            <p className="text-[11px] text-[#64748b] mt-1">ZIPs: {t.zip_codes.slice(0, 6).join(", ")}{t.zip_codes.length > 6 && ` +${t.zip_codes.length - 6}`}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/10 hover:text-[#00d4ff]">
          <a href={t.dashboard_url}>Open <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></a>
        </Button>
      </CardContent>
    </Card>
  );
}
