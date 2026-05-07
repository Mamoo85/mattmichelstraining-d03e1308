import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEOHead from "@/components/layout/SEOHead";
import DWASuiteNav from "@/components/shared/DWASuiteNav";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import EmptyDashboardState from "@/components/shared/EmptyDashboardState";
import OnboardingChecklist from "@/components/shared/OnboardingChecklist";
import MortgageRadarTerritoryPicker from "@/components/mortgage/MortgageRadarTerritoryPicker";
import TradeRadarLeadCard, { TradeRadarLead } from "@/components/trade-radar/TradeRadarLeadCard";
import LeadActionBar from "@/components/trade-radar/LeadActionBar";
import RadarExportBar from "@/components/shared/RadarExportBar";
import CrmWebhookSettings from "@/components/shared/CrmWebhookSettings";
import { Wrench, Lock, Bell, TrendingUp, Calendar, Target, MapPin, ShieldCheck, Mail } from "lucide-react";
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
  const searchParams = new URLSearchParams(window.location.search);
  const clientEmail = searchParams.get("email") || "";
  const dashboardToken = searchParams.get("token") || "";
  const legacyTrial = searchParams.get("trial") || "";
  const justPurchased = searchParams.get("trial") === "success";

  const [authError, setAuthError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [actions, setActions] = useState<Record<string, { status: string; snooze_until: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [activeSignalType, setActiveSignalType] = useState<string>("all");
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [rescuing, setRescuing] = useState(false);
  const [rescueSent, setRescueSent] = useState(false);

  async function requestFreshLink() {
    if (!clientEmail) {
      const { toast } = await import("sonner");
      toast.error("Open the link from your trial email, or text Matt at (313) 992-1219.");
      return;
    }
    setRescuing(true);
    try {
      const productKey = `${vertical}_radar`;
      const { error } = await supabase.functions.invoke("start-radar-trial", {
        body: { email: clientEmail, product: productKey, source: "rescue_link" },
      });
      if (error) throw error;
      setRescueSent(true);
      const { toast } = await import("sonner");
      toast.success("Fresh login link sent — check your email.");
    } catch (e: any) {
      const { toast } = await import("sonner");
      toast.error(e?.message || "Couldn't send link — text Matt at (313) 992-1219.");
    } finally {
      setRescuing(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!dashboardToken && !clientEmail && !legacyTrial && !justPurchased) {
        setAuthError("No dashboard link found. Check your weekly digest email.");
        setLoading(false);
        return;
      }

      const { data: dashboardData, error: dashboardError } = await supabase.functions.invoke("trade-radar-dashboard", {
        body: { email: clientEmail || undefined, token: dashboardToken || undefined, trial: legacyTrial || undefined, vertical },
      });

      if (dashboardError || (dashboardData as any)?.error) {
        const code = (dashboardData as any)?.error;
        if (code === "not_enrolled") {
          setNotEnrolled(true);
        } else {
          setAuthError(code === "invalid_or_expired_link"
            ? "Your dashboard link is invalid or expired — request a new one below."
            : "Could not load this dashboard link. Text Matt at (313) 992-1219 and we'll fix it now.");
        }
        setLoading(false);
        return;
      }

      const clientRow = (dashboardData as any)?.client as Client | undefined;
      const rows = ((dashboardData as any)?.leads as Lead[]) || [];
      const actData = ((dashboardData as any)?.actions as any[]) || [];
      if (!clientRow) {
        setNotEnrolled(true);
        setLoading(false);
        return;
      }
      setClient(clientRow);
      setLeads(rows);
      const map: Record<string, { status: string; snooze_until: string | null }> = {};
      actData.forEach((a: any) => {
        map[a.lead_id] = { status: a.status, snooze_until: a.snooze_until };
      });
      setActions(map);
      setLoading(false);
    })();
  }, [clientEmail, dashboardToken, legacyTrial, vertical]);

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
  if (justPurchased && authError) {
    return (
      <div className="min-h-screen bg-[#030711] text-foreground flex items-center justify-center px-4">
        <SEOHead title={`${productLabel} — Welcome!`} description={`Your ${productLabel} account is being set up.`} />
        <div className="bg-[#0a1628] border border-[#00d4ff33] rounded-xl p-10 text-center max-w-md w-full">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-white font-bold text-xl mb-3">Payment confirmed!</h2>
          <p className="text-[#94a3b8] text-sm mb-4">
            Your <strong className="text-white">{productLabel}</strong> account is being activated. Check your email — we're sending you a one-click login link right now.
          </p>
          <p className="text-[#64748b] text-xs">Didn't get it? Text Matt at (313) 992-1219 and we'll sort it out in minutes.</p>
        </div>
      </div>
    );
  }

  if (authError || notEnrolled) {
    const isAccessIssue = !!authError;
    return (
      <div className="min-h-screen bg-[#030711] text-foreground">
        <SEOHead title={`My ${productLabel} — Subscriber Dashboard`} description={`Daily ${productLabel} leads from public records.`} />
        <DWASuiteNav activeProduct="contractor_leads" email={clientEmail || undefined} />
        <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
          <Card className="bg-[#0a1628] border-[#1e3a5f]">
            <CardContent className="p-8 text-center">
              {isAccessIssue ? (
                <Lock className="w-10 h-10 text-red-400 mx-auto mb-3" />
              ) : (
                <Wrench className="w-10 h-10 text-[#00d4ff] mx-auto mb-3" />
              )}
              <p className="text-white font-bold text-lg mb-2">
                {isAccessIssue ? "We couldn't open this dashboard" : `You're not enrolled in ${productLabel}`}
              </p>
              <p className="text-sm text-[#94a3b8] mb-6">
                {isAccessIssue
                  ? authError
                  : "Start your trial to start receiving daily homeowner intent signals in your service area."}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {clientEmail ? (
                  <Button
                    onClick={requestFreshLink}
                    disabled={rescuing || rescueSent}
                    className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold"
                  >
                    {rescueSent ? "Link sent — check email" : rescuing ? "Sending…" : `Email me a fresh ${productLabel} link`}
                  </Button>
                ) : (
                  <a href={landingPath}>
                    <Button className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
                      Start {productLabel} trial
                    </Button>
                  </a>
                )}
                <a href="/my-trials">
                  <Button variant="outline" className="border-[#1e3a5f] text-[#94a3b8] hover:text-white">
                    View all my trials
                  </Button>
                </a>
              </div>
              <p className="text-[11px] text-[#64748b] mt-5">
                Or text Matt at <a href="sms:+13139921219" className="text-[#00d4ff]">(313) 992-1219</a> and he'll fix it in minutes.
              </p>
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
        <OnboardingChecklist
          product={productLabel}
          storageKey={`trade-radar-${vertical}`}
          steps={[
            { id: "auth", label: "Dashboard link verified", done: !!client, hint: "Open this page from your weekly digest email." },
            { id: "leads", label: "First leads delivered", done: leads.length > 0, hint: "Scanner runs daily at 8am ET." },
            { id: "hot", label: "First hot lead (score 8+)", done: weeklyStats.hotLeads > 0, hint: "Highest-intent signals — call today." },
            { id: "outreach", label: "First outreach sent", done: Object.values(actions).some((a) => a.status === "called" || a.status === "emailed"), hint: "Use the action bar on any lead." },
          ]}
        />
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
              sampleLead={{
                title: `Homeowner — ${productLabel} signal`,
                address: "1842 Maplewood Dr, Grosse Pointe, MI 48230",
                signal: "Permit pulled 2 days ago · public records match",
                score: 8,
                opener: `Saw the recent permit activity on Maplewood — wanted to reach out before someone else does. We handle ${productLabel.toLowerCase()} work in your area and can be out this week.`,
              }}
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
          <>
            <div className="mb-4">
              <RadarExportBar
                radar="growth"
                records={filtered.map((l) => ({
                  id: l.id,
                  full_name: l.full_name,
                  signal_type: l.signal_type,
                  vertical,
                  score: l.score,
                  city: (l as any).city ?? null,
                  recommended_pitch: l.suggested_opener ?? null,
                  detected_at: l.signal_date ?? l.created_at,
                  source_url: (l as any).source_url ?? null,
                }))}
                clientId={client?.id}
                businessName={client?.business_name ?? undefined}
              />
            </div>
            <div className="grid gap-5">
              {filtered.map((l) => {
                const a = actions[l.id];
                const isClaimed = a?.status === "called" || a?.status === "won";
                return (
                  <TradeRadarLeadCard
                    key={l.id}
                    lead={l}
                    claimed={isClaimed}
                    onClaim={async (lead) => {
                      if (!client) return;
                      const { error } = await (supabase.from as any)("trade_radar_lead_actions").upsert({
                        client_id: client.id,
                        lead_id: lead.id,
                        status: "called",
                      }, { onConflict: "client_id,lead_id" });
                      if (error) {
                        const { toast } = await import("sonner");
                        toast.error("Couldn't claim lead — text Matt at (313) 992-1219");
                        return;
                      }
                      setActions((prev) => ({ ...prev, [lead.id]: { status: "called", snooze_until: null } }));
                      const { toast } = await import("sonner");
                      toast.success("Lead claimed — call the owner now");
                    }}
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
          </>
        )}

        {/* Lead Quality Guarantee */}
        <div className="mt-10 bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#00d4ff] flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-white">Lead Quality Guarantee</h2>
              <p className="text-sm text-[#94a3b8] mt-1 leading-relaxed">
                Every lead is sourced from verified public records. If a lead doesn't meet our quality standards, request a credit — no questions asked.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {[
              { label: "Invalid address", detail: "Property address doesn't exist or can't be located" },
              { label: "Duplicate lead", detail: "Same address already delivered within the last 30 days" },
              { label: "Out-of-area lead", detail: "ZIP code falls outside your subscribed service area" },
              { label: "Wrong signal", detail: "Permit or record clearly mismatched to your trade vertical" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2 bg-[#030711] border border-[#1e3a5f]/60 rounded-lg px-3 py-2.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00d4ff] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-white">{item.label}</p>
                  <p className="text-[11px] text-[#64748b] leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <a
            href={`mailto:matt@detroitwebagent.com?subject=${encodeURIComponent(`Lead Credit Request — ${productLabel}`)}&body=${encodeURIComponent(`Hi Matt,\n\nI'd like to request a credit for a lead that didn't meet quality standards.\n\nProduct: ${productLabel}\nLead address: [paste address here]\nReason: [invalid address / duplicate / out-of-area / wrong signal]\n\nDetails:\n[describe the issue]\n\nThanks`)}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#00d4ff] hover:text-white transition-colors border border-[#00d4ff]/40 hover:border-white/40 rounded-lg px-4 py-2"
          >
            <Mail className="w-4 h-4" />
            Request a lead credit →
          </a>
          <p className="text-[10px] text-[#64748b] mt-3">
            Credits issued as a one-month deduction on your next billing cycle. One credit request per lead.
          </p>
        </div>

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

      {client && (
        <section className="max-w-3xl mx-auto px-4 py-8 border-t border-[#1e3a5f]/40">
          <CrmWebhookSettings table="trade_radar_clients" clientId={client.id} brand="dwa" />
        </section>
      )}

      {clientEmail && (
        <div className="py-6 text-center border-t border-[#1e3a5f]/40">
          <ManageBillingButton email={clientEmail} />
        </div>
      )}
    </div>
  );
}
