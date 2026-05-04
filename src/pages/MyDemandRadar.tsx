import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import DWASuiteNav from "@/components/shared/DWASuiteNav";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import EmptyDashboardState from "@/components/shared/EmptyDashboardState";
import { Activity, MapPin, TrendingUp, Building2, Lock, Download, Phone } from "lucide-react";

type Signal = {
  id: string;
  company_name: string;
  industry: string | null;
  location: string | null;
  county: string | null;
  signal_type: string | null;
  human_summary: string | null;
  recommended_pitch: string | null;
  signal_strength_tier: string | null;
  confidence: number | null;
  detected_at: string | null;
  hiring_count: number | null;
  hiring_roles: string[] | null;
  predicted_needs: string[] | null;
  source_urls: string[] | null;
};

type Client = {
  id: string;
  email: string;
  company_name: string;
  territory_counties: string[] | null;
};

function tierColor(tier: string | null): string {
  if (tier === "hot") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (tier === "warm") return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
}

function exportCSV(signals: Signal[]) {
  const header = ["Company", "Industry", "Location", "County", "Signal", "Confidence", "Detected", "Summary"];
  const rows = signals.map((s) => [
    s.company_name,
    s.industry || "",
    s.location || "",
    s.county || "",
    s.signal_type || "",
    s.confidence?.toString() || "",
    s.detected_at?.slice(0, 10) || "",
    (s.human_summary || "").replace(/"/g, "'").slice(0, 200),
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `demand-radar-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MyDemandRadar() {
  const clientEmail = new URLSearchParams(window.location.search).get("email") || "";
  const dashboardToken = new URLSearchParams(window.location.search).get("token") || "";

  const [client, setClient] = useState<Client | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!clientEmail) {
        setError("No email in URL — open from your weekly digest.");
        setLoading(false);
        return;
      }

      // Optional token verification (skipped if no token in URL — admin preview)
      if (dashboardToken) {
        const { data: authData } = await supabase.functions.invoke("verify-dashboard-token", {
          body: { email: clientEmail, token: dashboardToken },
        });
        if (!(authData as any)?.valid) {
          setError("Invalid or expired dashboard link.");
          setLoading(false);
          return;
        }
      }

      const { data: c } = await (supabase.from as any)("industry_pulse_clients")
        .select("id, email, company_name, territory_counties")
        .eq("email", clientEmail.toLowerCase())
        .eq("active", true)
        .maybeSingle();

      if (!c) {
        setError("No Demand Radar subscription found for this email.");
        setLoading(false);
        return;
      }
      setClient(c as Client);

      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      let q = (supabase.from as any)("industry_pulse_signals")
        .select("id, company_name, industry, location, county, signal_type, human_summary, recommended_pitch, signal_strength_tier, confidence, detected_at, hiring_count, hiring_roles, predicted_needs, source_urls")
        .gte("detected_at", since)
        .order("confidence", { ascending: false, nullsFirst: false })
        .order("detected_at", { ascending: false })
        .limit(200);

      if (c.territory_counties?.length) {
        q = q.in("county", c.territory_counties);
      }

      const { data, error: serr } = await q;
      if (serr) {
        toast.error("Could not load signals");
        console.warn("[MyDemandRadar] signal query failed", serr);
      } else {
        setSignals((data as Signal[]) || []);
      }
      setLoading(false);
    })();
  }, [clientEmail, dashboardToken]);

  const stats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const recent = signals.filter((s) => s.detected_at && new Date(s.detected_at).getTime() >= sevenDaysAgo);
    return {
      hot: signals.filter((s) => s.signal_strength_tier === "hot").length,
      thisWeek: recent.length,
      counties: client?.territory_counties?.length ?? 0,
    };
  }, [signals, client]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#030711] text-foreground">
        <SEOHead title="My Demand Radar — Subscriber Dashboard" description="Demand intel feed" />
        <DWASuiteNav activeProduct="industry_pulse" email={clientEmail || undefined} />
        <div className="max-w-2xl mx-auto px-4 py-24">
          <Card className="bg-[#0a1628] border-red-900">
            <CardContent className="p-8 text-center">
              <Lock className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-2">Access denied</p>
              <p className="text-sm text-[#94a3b8]">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030711] text-foreground">
      <SEOHead title="My Demand Radar — Subscriber Dashboard" description="Companies in your county showing buying intent." />
      <DWASuiteNav activeProduct="industry_pulse" email={clientEmail || undefined} />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight text-white">My Demand Radar</span>
          </div>
          <a href="tel:+13139921219" className="text-sm text-[#00d4ff] font-semibold">(313) 992-1219</a>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-gradient-to-br from-[#0a1628] to-[#0a1628]/60 border-[#00d4ff]/40">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1.5 font-bold">Hot signals</p>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{stats.hot}</p>
              <p className="text-[11px] text-[#94a3b8] mt-2">Highest intent — call today</p>
            </CardContent>
          </Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5 font-bold">This week</p>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{stats.thisWeek}</p>
              <p className="text-[11px] text-[#64748b] mt-2">Signals detected</p>
            </CardContent>
          </Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5 font-bold">Counties</p>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{stats.counties}</p>
              <p className="text-[11px] text-[#64748b] mt-2">Your territory</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white">Signal feed (last 30 days)</h2>
          {signals.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportCSV(signals)}
              className="border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/10 h-8 text-xs"
            >
              <Download className="w-3 h-3 mr-1.5" />
              Export CSV
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-[#94a3b8]">Loading signals…</p>
        ) : signals.length === 0 ? (
          <EmptyDashboardState
            productName="Demand Radar"
            etaText="Our scanner runs daily. First signals usually appear within 48 hours of enrollment."
            checklist={[
              "Territory counties saved",
              "Industry filters configured",
              "Daily scanner running",
              "Weekly digest queued",
            ]}
            setupGuideHref="mailto:matt@detroitwebagent.com?subject=Demand%20Radar%20setup"
          />
        ) : (
          <div className="grid gap-3">
            {signals.map((s) => (
              <Card key={s.id} className="bg-[#0a1628] border-[#1e3a5f] hover:border-[#00d4ff]/40 transition">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {s.signal_strength_tier && (
                          <Badge variant="outline" className={tierColor(s.signal_strength_tier)}>
                            {s.signal_strength_tier.toUpperCase()}
                          </Badge>
                        )}
                        {s.signal_type && (
                          <Badge variant="outline" className="bg-[#00d4ff]/10 border-[#00d4ff]/30 text-[#00d4ff]">
                            {s.signal_type}
                          </Badge>
                        )}
                        {s.confidence != null && (
                          <span className="text-[11px] text-[#64748b] font-mono">
                            {Math.round(s.confidence * 100)}% conf
                          </span>
                        )}
                      </div>
                      <p className="text-white font-bold flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#00d4ff]" />
                        {s.company_name}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-[#94a3b8]">
                        {s.industry && <span>{s.industry}</span>}
                        {s.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {s.location}
                          </span>
                        )}
                        {s.hiring_count && s.hiring_count > 0 && (
                          <span className="flex items-center gap-1 text-amber-400">
                            <TrendingUp className="w-3 h-3" /> {s.hiring_count} hiring
                          </span>
                        )}
                      </div>
                      {s.human_summary && (
                        <p className="text-sm text-[#cbd5e1] mt-2 leading-relaxed">{s.human_summary}</p>
                      )}
                      {s.recommended_pitch && (
                        <div className="mt-3 rounded-lg border border-[#00d4ff]/15 bg-[#00d4ff]/5 p-3">
                          <p className="text-[10px] uppercase tracking-widest text-[#00d4ff]/70 font-bold mb-1">
                            Suggested opener
                          </p>
                          <p className="text-sm text-white/85 italic">"{s.recommended_pitch}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-[10px] text-[#64748b] text-center mt-10 max-w-2xl mx-auto">
          Demand Radar uses public records, news, and hiring signals only. All outreach is your responsibility
          and must comply with TCPA + CAN-SPAM.
        </p>
      </section>

      {clientEmail && (
        <div className="py-6 text-center border-t border-[#1e3a5f]/40">
          <ManageBillingButton email={clientEmail} />
        </div>
      )}
    </div>
  );
}
