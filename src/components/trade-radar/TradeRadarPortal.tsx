import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import DWASuiteNav from "@/components/shared/DWASuiteNav";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import EmptyDashboardState from "@/components/shared/EmptyDashboardState";
import MortgageRadarTerritoryPicker from "@/components/mortgage/MortgageRadarTerritoryPicker";
import TradeRadarLeadCard, { TradeRadarLead } from "@/components/trade-radar/TradeRadarLeadCard";
import LeadActionBar from "@/components/trade-radar/LeadActionBar";
import { Wrench, Lock, Bell, TrendingUp, Calendar, Target, MapPin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Lead = TradeRadarLead & {
  full_name: string | null;
  signal_count: number | null;
  created_at: string;
};

type Client = {
  id: string;
  email: string;
  business_name: string | null;
  zip_codes: string[];
  trial_ends_at: string | null;
};

export type SignalTypeOption = {
  /** Maps to trade_radar_leads.signal_type value (snake_case) */
  value: string;
  /** Human label shown in tab */
  label: string;
};

interface TradeRadarPortalProps {
  vertical: string;
  productLabel: string;
  /** Suggested signal type filter tabs (intersected with what's actually in the data) */
  signalTypes: SignalTypeOption[];
  /** Landing page path for "not enrolled" CTA */
  landingPath: string;
}


export default function TradeRadarPortal({
  vertical,
  productLabel,
  signalTypes,
  landingPath,
}: TradeRadarPortalProps) {
  const clientEmail = new URLSearchParams(window.location.search).get("email") || "";
  const dashboardToken = new URLSearchParams(window.location.search).get("token") || "";

  const [authError, setAuthError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [actions, setActions] = useState<Record<string, { status: string; snooze_until: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [activeSignalType, setActiveSignalType] = useState<string>("all");
  const [notEnrolled, setNotEnrolled] = useState(false);

  useEffect(() => {
    (async () => {
      if (!clientEmail || !dashboardToken) {
        setAuthError("No dashboard link found. Check your weekly digest email.");
        setLoading(false);
        return;
      }

      // Verify magic-link token (same HMAC system as Mortgage Radar)
      const { data: authData } = await supabase.functions.invoke("verify-dashboard-token", {
        body: { email: clientEmail, token: dashboardToken },
      });
      if (!(authData as any)?.valid) {
        setAuthError(
          (authData as any)?.reason === "expired"
            ? "Your dashboard link has expired — request a new one from your weekly digest email."
            : "Invalid dashboard link — request a new one from your weekly digest email."
        );
        setLoading(false);
        return;
      }

      // Resolve trade client row by email + vertical
      const { data: clientRow } = await (supabase.from as any)("trade_radar_clients")
        .select("id, email, business_name, zip_codes, trial_ends_at")
        .eq("email", clientEmail.toLowerCase())
        .eq("vertical", vertical)
        .eq("active", true)
        .maybeSingle();

      if (!clientRow) {
        setNotEnrolled(true);
        setLoading(false);
        return;
      }
      setClient(clientRow as Client);

      // Pull leads for this vertical, filtered by client's zip_codes (last 14 days)
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      let query = (supabase.from as any)("trade_radar_leads")
        .select(
          "id, full_name, address, city, zip, signal_type, signal_detail, signal_date, score, signal_count, suggested_opener, best_call_window, estimated_value, street_view_url, created_at"
        )
        .eq("vertical", vertical)
        .gte("created_at", since)
        .order("score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      if (clientRow.zip_codes?.length) {
        query = query.in("zip", clientRow.zip_codes);
      }

      const { data, error } = await query;
      if (error) {
        toast.error("Could not load leads");
        console.warn("[TradeRadarPortal] lead query failed", error);
      } else {
        const rows = (data as Lead[]) || [];
        setLeads(rows);
        // Load this client's actions for those leads
        if (rows.length) {
          const ids = rows.map((r) => r.id);
          const { data: actData } = await (supabase.from as any)("trade_radar_lead_actions")
            .select("lead_id, status, snooze_until")
            .eq("client_id", clientRow.id)
            .in("lead_id", ids);
          const map: Record<string, { status: string; snooze_until: string | null }> = {};
          (actData || []).forEach((a: any) => {
            map[a.lead_id] = { status: a.status, snooze_until: a.snooze_until };
          });
          setActions(map);
        }
      }
      setLoading(false);
    })();
  }, [clientEmail, dashboardToken, vertical]);

  // Intersect configured signal types with what's actually in the data
  const availableTypes = useMemo(() => {
    const inData = new Set(leads.map((l) => l.signal_type).filter(Boolean) as string[]);
    return signalTypes.filter((s) => inData.has(s.value));
  }, [leads, signalTypes]);

  const filtered = useMemo(() => {
    if (activeSignalType === "all") return leads;
    return leads.filter((l) => l.signal_type === activeSignalType);
  }, [leads, activeSignalType]);

  // "This week" stats — last 7 days
  const weeklyStats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const recent = leads.filter((l) => new Date(l.created_at).getTime() >= sevenDaysAgo);
    return {
      leadsFound: recent.length,
      hotLeads: recent.filter((l) => l.score >= 8).length,
      zipsMonitored: client?.zip_codes?.length ?? 0,
    };
  }, [leads, client]);

  // Auth / enrollment guards
  if (authError) {
    return (
      <div className="min-h-screen bg-[#030711] text-foreground">
        <SEOHead title={`My ${productLabel} — Subscriber Dashboard`} description={`Daily ${productLabel} leads from public records.`} />
        <DWASuiteNav activeProduct="contractor_leads" email={clientEmail || undefined} />
        <div className="max-w-7xl mx-auto px-4 py-24 flex items-center justify-center">
          <div className="bg-[#0a1628] border border-red-900 rounded-xl p-8 text-center max-w-md w-full">
            <Lock className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-white font-semibold mb-2">Access denied</p>
            <p className="text-sm text-[#94a3b8]">{authError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (notEnrolled) {
    return (
      <div className="min-h-screen bg-[#030711] text-foreground">
        <SEOHead title={`My ${productLabel} — Subscriber Dashboard`} description={`Daily ${productLabel} leads.`} />
        <DWASuiteNav activeProduct="contractor_leads" email={clientEmail || undefined} />
        <div className="max-w-2xl mx-auto px-4 py-24">
          <Card className="bg-[#0a1628] border-[#1e3a5f]">
            <CardContent className="p-8 text-center">
              <Wrench className="w-10 h-10 text-[#00d4ff] mx-auto mb-3" />
              <p className="text-white font-bold text-lg mb-2">You're not enrolled in {productLabel}</p>
              <p className="text-sm text-[#94a3b8] mb-6">
                Start your trial to start receiving daily homeowner intent signals in your service area.
              </p>
              <a href={landingPath}>
                <Button className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
                  Start {productLabel} trial
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030711] text-foreground">
      <SEOHead
        title={`My ${productLabel} — Subscriber Dashboard`}
        description={`Daily ${productLabel} leads matched to your service area.`}
      />
      <DWASuiteNav activeProduct="contractor_leads" email={clientEmail || undefined} />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight text-white">My {productLabel}</span>
          </div>
          <a href="tel:+13139921219" className="text-sm text-[#00d4ff] font-semibold">
            (313) 992-1219
          </a>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* This week summary */}
        <div className="mb-6">
          <h2 className="text-[10px] uppercase tracking-widest text-[#00d4ff] font-bold mb-2 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> This week
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-gradient-to-br from-[#0a1628] to-[#0a1628]/60 border-[#00d4ff]/40 shadow-[0_0_32px_-10px_rgba(0,212,255,0.5)]">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1.5 font-bold flex items-center gap-1">
                  <Target className="w-3 h-3" /> Hot leads
                </p>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{weeklyStats.hotLeads}</p>
                <p className="text-[11px] text-[#94a3b8] mt-2">Score 8+ — call today</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0a1628] border-[#1e3a5f]">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5 font-bold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Leads found
                </p>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{weeklyStats.leadsFound}</p>
                <p className="text-[11px] text-[#64748b] mt-2">Last 7 days</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0a1628] border-[#1e3a5f]">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5 font-bold flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> ZIPs monitored
                </p>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{weeklyStats.zipsMonitored}</p>
                <p className="text-[11px] text-[#64748b] mt-2">Your service area</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Signal type filter tabs */}
        {leads.length > 0 && (
          <Tabs value={activeSignalType} onValueChange={setActiveSignalType} className="mb-5">
            <TabsList className="bg-[#0a1628] border border-[#1e3a5f] flex-wrap h-auto">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-[#00d4ff] data-[state=active]:text-black text-[#94a3b8]"
              >
                All ({leads.length})
              </TabsTrigger>
              {availableTypes.map((s) => {
                const count = leads.filter((l) => l.signal_type === s.value).length;
                return (
                  <TabsTrigger
                    key={s.value}
                    value={s.value}
                    className="data-[state=active]:bg-[#00d4ff] data-[state=active]:text-black text-[#94a3b8]"
                  >
                    {s.label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        )}

        {/* Lead list */}
        {loading ? (
          <p className="text-[#94a3b8]">Loading leads…</p>
        ) : filtered.length === 0 ? (
          leads.length === 0 ? (
            <EmptyDashboardState
              productName={productLabel}
              etaText="Our scanner runs daily at 8 AM ET. First leads usually appear within 24–48 hours of enrollment."
              checklist={[
                "Service area ZIP codes saved",
                "Public-records scanners running daily",
                "Signal sources monitored hourly",
                "Weekly digest email queued",
              ]}
              setupGuideHref="mailto:matt@detroitwebagent.com?subject=Trade%20Radar%20setup"
            />
          ) : (
            <Card className="bg-[#0a1628] border-[#1e3a5f]">
              <CardContent className="p-8 text-center">
                <Bell className="w-8 h-8 text-[#00d4ff] mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">No leads match this filter</p>
                <p className="text-sm text-[#94a3b8]">Try selecting "All" to see every lead in your area.</p>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="grid gap-5">
            {filtered.map((l) => {
              const a = actions[l.id];
              return (
                <TradeRadarLeadCard
                  key={l.id}
                  lead={l}
                  actionBar={
                    client ? (
                      <LeadActionBar
                        leadId={l.id}
                        clientId={client.id}
                        product="trade"
                        initialStatus={(a?.status as any) || "new"}
                        initialSnoozeUntil={a?.snooze_until || null}
                      />
                    ) : null
                  }
                />
              );
            })}
          </div>
        )}

        {/* Territory picker — reused from Mortgage Radar (preview UI; ZIP saves persisted via support) */}
        <div className="mt-12">
          <h2 className="text-sm uppercase tracking-widest text-[#94a3b8] font-bold mb-3 px-4">
            Manage your territory
          </h2>
          <p className="text-xs text-[#64748b] px-4 mb-2 max-w-3xl">
            Preview ZIP availability below. To add or remove ZIPs from your active subscription, reply to your
            weekly digest or text <a href="sms:+13139921219" className="text-[#00d4ff] font-semibold">(313) 992-1219</a>.
          </p>
          <MortgageRadarTerritoryPicker />
        </div>

        <p className="text-[10px] text-[#64748b] text-center mt-10 max-w-2xl mx-auto">
          {productLabel} uses public records and behavioral signals only. We do not access, purchase, or resell
          credit-bureau trigger leads. All outreach is your responsibility and must comply with TCPA + CAN-SPAM.
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
