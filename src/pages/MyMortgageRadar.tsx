import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import DWASuiteNav from "@/components/shared/DWASuiteNav";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import LeadGuaranteeBar from "@/components/shared/LeadGuaranteeBar";
import CrmWebhookSettings from "@/components/shared/CrmWebhookSettings";
import EmptyDashboardState from "@/components/shared/EmptyDashboardState";
import { Home, Lock, Bell, Download, Send, Check, X, List, Map as MapIcon, Columns } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MortgageRadarMap from "@/components/mortgage/MortgageRadarMap";
import MortgageRadarPipeline from "@/components/mortgage/MortgageRadarPipeline";
import MortgageRadarWelcome from "@/components/mortgage/MortgageRadarWelcome";
import MortgageRadarSeedLead from "@/components/mortgage/MortgageRadarSeedLead";
import MortgageLeadCard, { MortgageLeadCardSkeleton } from "@/components/mortgage/MortgageLeadCard";
import RadarExportBar from "@/components/shared/RadarExportBar";
import OnboardingChecklist from "@/components/shared/OnboardingChecklist";

type Lead = {
  id: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  signal_type: string;
  signal_source: string;
  signal_detail: string | null;
  signal_date: string | null;
  score: number;
  signal_count: number | null;
  suggested_opener: string | null;
  best_call_window: string | null;
  created_at: string;
  pipeline_stage?: string | null;
  street_view_url?: string | null;
  intel_highlights?: any;
  year_built?: number | null;
  building_sqft?: number | null;
  last_sale_price_cents?: number | null;
  last_sale_date?: string | null;
  estimated_equity?: number | null;
  equity_range_low_cents?: number | null;
  equity_range_high_cents?: number | null;
  human_summary?: string | null;
  signal_history?: any;
};

type Outreach = {
  id: string;
  lead_id: string;
  channel: string;
  draft_subject: string | null;
  draft_body: string;
  approved_body: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  sent_at: string | null;
  send_error: string | null;
};

export default function MyMortgageRadar() {
  const params = new URLSearchParams(window.location.search);
  const clientEmail = params.get("email") || "";
  const dashboardToken = params.get("token") || "";
  const justPurchased = params.get("trial") === "success" || params.get("success") === "1";
  const [authError, setAuthError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftFor, setDraftFor] = useState<Lead | null>(null);
  const [draftChannel, setDraftChannel] = useState<"sms" | "email" | "call_note">("sms");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [filterScore, setFilterScore] = useState<number>(0);
  const [filterZip, setFilterZip] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!clientEmail) {
        setAuthError("No dashboard link found. Check your weekly digest email.");
        setLoading(false);
        return;
      }
      if (!dashboardToken) {
        setAuthError("Invalid dashboard link — request a new one from your weekly digest email.");
        setLoading(false);
        return;
      }
      const { data: authData } = await supabase.functions.invoke("verify-dashboard-token", {
        body: { email: clientEmail, token: dashboardToken },
      });
      if (!(authData as any)?.valid) {
        const reason = (authData as any)?.reason === "expired"
          ? "Your dashboard link has expired — request a new one from your weekly digest email."
          : "Invalid dashboard link — request a new one from your weekly digest email.";
        setAuthError(reason);
        setLoading(false);
        return;
      }

      // Token valid — load lead data
      let resolvedClientId = clientId;
      if (clientEmail && !resolvedClientId) {
        const { data: clientRow } = await (supabase.from as any)("mortgage_radar_clients")
          .select("id")
          .eq("email", clientEmail.toLowerCase())
          .eq("active", true)
          .maybeSingle();
        resolvedClientId = clientRow?.id || null;
        if (resolvedClientId) setClientId(resolvedClientId);
      }

      const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
      let query = (supabase.from as any)("mortgage_radar_leads")
        .select("id, full_name, address, city, zip, phone, email, signal_type, signal_source, signal_detail, signal_date, score, signal_count, suggested_opener, best_call_window, created_at, pipeline_stage, street_view_url, intel_highlights, year_built, building_sqft, last_sale_price_cents, last_sale_date, estimated_equity, equity_range_low_cents, equity_range_high_cents, human_summary, signal_history")
        .gte("created_at", since)
        .order("score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      // Filter by client's ZIPs if we found their record
      if (resolvedClientId) {
        const { data: clientData } = await (supabase.from as any)("mortgage_radar_clients")
          .select("zip_codes")
          .eq("id", resolvedClientId)
          .maybeSingle();
        if (clientData?.zip_codes?.length) {
          query = query.in("zip", clientData.zip_codes);
        }
      }

      const { data, error } = await query;
      if (error) {
        toast.error("Could not load leads — check your dashboard link");
      } else {
        setLeads(data || []);
      }
      setLoading(false);
      // Load outreach queue
      if (resolvedClientId) {
        try {
          const { data: orData } = await supabase.functions.invoke("mortgage-radar-outreach", {
            body: { action: "list", client_id: resolvedClientId },
          });
          if (orData?.outreach) setOutreach(orData.outreach);
        } catch {
          // outreach is optional UI; ignore
        }
      }
    })();
  }, [clientEmail, dashboardToken]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (filterScore > 0 && l.score < filterScore) return false;
      if (filterZip && (l.zip || "").indexOf(filterZip.trim()) === -1) return false;
      if (filterType && l.signal_type !== filterType) return false;
      return true;
    });
  }, [leads, filterScore, filterZip, filterType]);

  const hotCount = useMemo(() => filtered.filter(l => l.score >= 9).length, [filtered]);
  const warmCount = useMemo(() => filtered.filter(l => l.score >= 7 && l.score < 9).length, [filtered]);
  const types = useMemo(() => Array.from(new Set(leads.map(l => l.signal_type))), [leads]);

  const markWorking = async (lead: Lead) => {
    const prevStage = lead.pipeline_stage || "active";
    setLeads(prev => prev.map(x => x.id === lead.id ? { ...x, pipeline_stage: "working" } : x));
    const { error } = await (supabase.from as any)("mortgage_radar_leads")
      .update({ pipeline_stage: "working" })
      .eq("id", lead.id);
    if (error) {
      setLeads(prev => prev.map(x => x.id === lead.id ? { ...x, pipeline_stage: prevStage } : x));
      toast.error("Couldn't mark working — try again");
      return;
    }
    toast.success("Marked as working");
  };

  const exportCsv = () => {
    if (!filtered.length) {
      toast.error("No leads to export");
      return;
    }
    const headers = ["Score", "Address", "City", "ZIP", "Name", "Phone", "Email", "Signal", "Source", "Detail", "Best Call Window", "Suggested Opener", "Detected"];
    const rows = filtered.map(l => [
      l.score,
      l.address || "",
      l.city || "",
      l.zip || "",
      l.full_name || "",
      l.phone || "",
      l.email || "",
      l.signal_type,
      l.signal_source,
      (l.signal_detail || "").replace(/\s+/g, " "),
      l.best_call_window || "",
      (l.suggested_opener || "")
        .replace(/\{name\}/g, l.full_name || "there")
        .replace(/\{address\}/g, l.address || "your property"),
      l.signal_date || l.created_at?.slice(0, 10) || "",
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mortgage-radar-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} leads`);
  };

  const openDraft = (l: Lead, channel: "sms" | "email" | "call_note") => {
    setDraftFor(l);
    setDraftChannel(channel);
    const body = (l.suggested_opener || "")
      .replace(/\{name\}/g, l.full_name || "there")
      .replace(/\{address\}/g, l.address || "your property");
    setDraftBody(body);
    setDraftSubject(channel === "email" ? `Quick question about ${l.address || "your property"}` : "");
  };

  const submitDraft = async () => {
    if (!draftFor || !draftBody.trim()) {
      toast.error("Draft body required");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("mortgage-radar-outreach", {
        body: {
          action: "create",
          lead_id: draftFor.id,
          client_id: clientId || "",
          channel: draftChannel,
          draft_subject: draftSubject || undefined,
          draft_body: draftBody,
        },
      });
      if (error) throw error;
      toast.success("Draft queued for your approval");
      setOutreach(prev => [data.outreach, ...prev]);
      setDraftFor(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to queue draft");
    }
  };

  const approveAndSend = async (id: string, send: boolean) => {
    try {
      const { error } = await supabase.functions.invoke("mortgage-radar-outreach", {
        body: { action: "approve", outreach_id: id, send_now: send },
      });
      if (error) throw error;
      toast.success(send ? "Approved & sent" : "Approved");
      setOutreach(prev => prev.map(o => o.id === id ? { ...o, status: send ? "sent" : "approved", sent_at: send ? new Date().toISOString() : null } : o));
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const rejectDraft = async (id: string) => {
    try {
      await supabase.functions.invoke("mortgage-radar-outreach", {
        body: { action: "reject", outreach_id: id },
      });
      setOutreach(prev => prev.map(o => o.id === id ? { ...o, status: "rejected" } : o));
      toast.success("Draft rejected");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const pendingApproval = outreach.filter(o => o.status === "pending_approval" || o.status === "approved");

  if (authError) {
    if (justPurchased) {
      return (
        <div className="min-h-screen bg-[#030711] text-foreground flex items-center justify-center px-4">
          <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-8 text-center max-w-md w-full">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-white text-xl font-bold mb-2">Payment confirmed!</p>
            <p className="text-[#94a3b8] text-sm leading-relaxed mb-4">
              Your <strong className="text-white">Mortgage Radar</strong> account is being activated. Check your email — we're sending you a one-click login link right now.
            </p>
            <p className="text-[#64748b] text-xs">Didn't get it? Text Matt at (313) 992-1219 and we'll sort it out in minutes.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#030711] text-foreground">
        <SEOHead title="My Mortgage Radar — Loan Officer Dashboard" description="Daily in-market mortgage leads from public records." />
        <DWASuiteNav activeProduct="mortgage_radar" email={clientEmail || undefined} />
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

  return (
    <div className="min-h-screen bg-[#030711] text-foreground">
      <SEOHead title="My Mortgage Radar — Loan Officer Dashboard" description="Daily in-market mortgage leads from public records." />
      <DWASuiteNav activeProduct="mortgage_radar" email={clientEmail || undefined} />
      <MortgageRadarWelcome />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight text-white">My Mortgage Radar</span>
          </div>
          <a href="tel:+13139921219" className="text-sm text-[#00d4ff] font-semibold">(313) 992-1219</a>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <OnboardingChecklist
          product="Mortgage Radar"
          steps={[
            { id: "auth", label: "Dashboard link verified", done: !!clientId, hint: "Open this page from your weekly digest email." },
            { id: "leads", label: "First leads delivered", done: leads.length > 0, hint: "Scanner runs daily at 8am ET." },
            { id: "hot", label: "First hot lead (score 9+)", done: hotCount > 0, hint: "Highest-intent in-market signal." },
            { id: "outreach", label: "First outreach sent", done: outreach.length > 0, hint: "Use the Reach Out button on any lead." },
          ]}
        />
        {/* KPI cards with hero glow — explicit 1-2-3 hierarchy */}
        <div className="relative mb-5 sm:mb-6">
          <div
            className="absolute inset-0 rounded-2xl opacity-40 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(0,212,255,0.18), transparent 70%)" }}
          />
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tier 1 — biggest, glowing, ranked #1 */}
            <Card
              className="bg-gradient-to-br from-[#0a1628] to-[#0a1628]/60 border-[#00d4ff]/40 shadow-[0_0_32px_-10px_rgba(0,212,255,0.5)] sm:col-span-1 relative overflow-hidden"
              title="Highest-intent mortgage signals from public records — call these first."
            >
              <span className="absolute top-2 right-2 text-[9px] font-black text-[#00d4ff]/70 uppercase tracking-widest">#1 Priority</span>
              <CardContent className="p-5">
                <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1.5 font-bold">● Hot leads (9–10)</p>
                <p className="text-4xl sm:text-5xl font-black text-white tabular-nums leading-none">{hotCount}</p>
                <p className="text-[11px] text-[#94a3b8] mt-2">Highest-intent in-market — call today</p>
              </CardContent>
            </Card>
            {/* Tier 2 */}
            <Card
              className="bg-[#0a1628] border-[#1e3a5f] hover:border-[#00d4ff]/30 transition-colors"
              title="Worth a same-week call — moderate-intent prospects."
            >
              <CardContent className="p-5">
                <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5 font-bold">○ Warm (7–8)</p>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{warmCount}</p>
                <p className="text-[11px] text-[#64748b] mt-2">Worth a same-week call</p>
              </CardContent>
            </Card>
            {/* Tier 3 */}
            <Card
              className="bg-[#0a1628] border-[#1e3a5f] hover:border-[#00d4ff]/30 transition-colors"
              title="Total leads matching your filters."
            >
              <CardContent className="p-5">
                <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5 font-bold">Total filtered</p>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{filtered.length}</p>
                <p className="text-[11px] text-[#64748b] mt-2">Matching your criteria</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sticky filter + Export bar — stays visible while scrolling lead list */}
        <div className="sticky top-[60px] z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 mb-5 bg-[#030711]/95 backdrop-blur border-y border-[#1e3a5f]">
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <div className="flex-1 min-w-[110px]">
              <label className="text-[10px] uppercase tracking-widest text-[#94a3b8] block mb-1">Min score</label>
              <select
                value={filterScore}
                onChange={(e) => setFilterScore(Number(e.target.value))}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-md h-10 sm:h-9 px-2 text-white text-sm"
              >
                <option value={0}>All</option>
                <option value={7}>7+ (warm)</option>
                <option value={9}>9+ (hot)</option>
              </select>
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className="text-[10px] uppercase tracking-widest text-[#94a3b8] block mb-1">ZIP</label>
              <Input value={filterZip} onChange={(e) => setFilterZip(e.target.value)} placeholder="48226" className="bg-[#0a1628] border-[#1e3a5f] text-white h-10 sm:h-9" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] uppercase tracking-widest text-[#94a3b8] block mb-1">Signal type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-md h-10 sm:h-9 px-2 text-white text-sm"
              >
                <option value="">All</option>
                {types.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <Button onClick={exportCsv} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold h-10 sm:h-9 w-full sm:w-auto">
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Approval queue */}
        {pendingApproval.length > 0 && (
          <Card className="bg-[#0a1628] border-[#00d4ff] mb-6">
            <CardHeader><CardTitle className="text-white text-base">📋 Approval queue ({pendingApproval.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingApproval.map(o => (
                <div key={o.id} className="bg-[#030711] border border-[#1e3a5f] rounded p-3">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-[#00d4ff]">{o.channel} · {o.status}</span>
                    {o.send_error && <span className="text-[10px] text-red-400">{o.send_error}</span>}
                  </div>
                  {o.draft_subject && <p className="text-sm text-white font-semibold mb-1">{o.draft_subject}</p>}
                  <p className="text-sm text-[#cbd5e1] whitespace-pre-wrap mb-3">{o.approved_body || o.draft_body}</p>
                  {o.status === "pending_approval" && (
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => approveAndSend(o.id, true)} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
                        <Send className="w-3 h-3 mr-1" /> Approve & Send
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => approveAndSend(o.id, false)} className="border-[#1e3a5f] text-white hover:bg-[#1e3a5f]/40">
                        <Check className="w-3 h-3 mr-1" /> Approve only
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejectDraft(o.id)} className="border-red-900 text-red-400 hover:bg-red-950/40">
                        <X className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <MortgageLeadCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="bg-[#0a1628] border border-[#1e3a5f] mb-4">
              <TabsTrigger value="list" className="data-[state=active]:bg-[#00d4ff] data-[state=active]:text-black text-[#94a3b8] gap-1.5">
                <List className="w-3.5 h-3.5" /> List
              </TabsTrigger>
              <TabsTrigger value="map" className="data-[state=active]:bg-[#00d4ff] data-[state=active]:text-black text-[#94a3b8] gap-1.5">
                <MapIcon className="w-3.5 h-3.5" /> Map
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="data-[state=active]:bg-[#00d4ff] data-[state=active]:text-black text-[#94a3b8] gap-1.5">
                <Columns className="w-3.5 h-3.5" /> Pipeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-0">
              {filtered.length === 0 ? (
                leads.length === 0 ? (
                  <>
                    <MortgageRadarSeedLead />
                    <EmptyDashboardState
                      productName="Mortgage Radar"
                      etaText="We're scanning property records, life-event signals, and rate-trigger data daily. First leads usually appear within 48 hours."
                      checklist={[
                        "Service area zip codes saved",
                        "Public-records scanners running daily",
                        "Behavioral & life-event signals being monitored",
                        "Weekly digest email queued",
                      ]}
                      setupGuideHref="mailto:matt@detroitwebagent.com?subject=Mortgage%20Radar%20setup"
                      sampleLead={{
                        title: "Refi candidate — rate trigger",
                        address: "2914 Lakeshore Dr, St. Clair Shores, MI 48080",
                        signal: "Originated 2019 @ 6.8% · current rate would save $340/mo",
                        score: 9,
                        opener: "Hi — saw your 2019 mortgage is sitting around 6.8%. Quick math says you could drop ~$340/mo at today's rates. 5-min call this week to walk through it?",
                      }}
                    />
                  </>
                ) : (
                  <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-8 text-center">
                    <Bell className="w-8 h-8 text-[#00d4ff] mx-auto mb-3" />
                    <p className="text-white font-semibold mb-1">No leads match your filters</p>
                    <p className="text-sm text-[#94a3b8]">Try lowering the score threshold or clearing the ZIP filter.</p>
                  </CardContent></Card>
                )
              ) : (
                <>
                <div className="mb-4">
                  <RadarExportBar
                    radar="growth"
                    records={filtered.map((l) => ({
                      id: l.id,
                      full_name: l.full_name,
                      name: l.address,
                      city: l.city,
                      signal_type: l.signal_type,
                      score: l.score,
                      phone: l.phone,
                      email: l.email,
                      recommended_pitch: l.suggested_opener,
                      detected_at: l.signal_date ?? l.created_at,
                    }))}
                    clientId={clientId ?? undefined}
                  />
                </div>
                <div className="grid gap-4">
                  {filtered.map((l) => (
                    <MortgageLeadCard
                      key={l.id}
                      lead={l}
                      clientId={clientId}
                      onMarkWorking={markWorking}
                      onDraftSms={(lead) => openDraft(lead, "sms")}
                      onDraftEmail={(lead) => openDraft(lead, "email")}
                    />
                  ))}
                </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="map" className="mt-0">
              <MortgageRadarMap leads={filtered} />
            </TabsContent>

            <TabsContent value="pipeline" className="mt-0">
              <MortgageRadarPipeline
                leads={filtered}
                onChange={(id, stage) =>
                  setLeads(prev => prev.map(l => l.id === id ? { ...l, pipeline_stage: stage } : l))
                }
              />
            </TabsContent>
          </Tabs>
        )}

        <p className="text-[10px] text-[#64748b] text-center mt-10 max-w-2xl mx-auto">
          Mortgage Radar uses public records and behavioral signals only. We do not access, purchase, or resell credit-bureau trigger leads. Every outreach requires your explicit approval before send (TCPA + FCRA).{" "}
          <a href="/mortgage-radar-compliance" className="text-[#00d4ff]/60 hover:text-[#00d4ff] underline transition-colors">
            View full compliance disclosure →
          </a>
        </p>

        {/* Add-on suite */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-[#0a1628] border border-[#00d4ff20] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-[#00d4ff]" />
              <p className="text-white font-bold text-sm">Add-Ons — 20% Off for Mortgage Radar Clients</p>
              <span className="ml-auto text-[10px] font-bold text-[#00d4ff] bg-[#00d4ff10] border border-[#00d4ff30] px-2 py-0.5 rounded-full">Bundle pricing</span>
            </div>
            <p className="text-[#64748b] text-[11px] mb-4">Combine these with Mortgage Radar and everything runs from one relationship.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: "Growth Radar", tagline: "SAM.gov contract awards + permit surges = LO sales triggers", price: 159, was: 199, path: "/industry-pulse" },
                { name: "TechAlert", tagline: "Licensed tradespeople entering the market — cash-out refi angle", price: 119, was: 149, path: "/hire-alert" },
                { name: "SiteRadar", tagline: "See which businesses visit your website — real-time intel", price: 39, was: 49, path: "/visitor-intel" },
                { name: "Missed Call Text-Back", tagline: "Auto-texts any referral or lead that hits your voicemail", price: 79, was: 99, path: "/missed-call-catch" },
              ].map(a => (
                <div key={a.name} className="bg-[#030711] border border-[#1e3a5f] rounded-lg p-3">
                  <p className="text-white font-bold text-xs mb-0.5">{a.name}</p>
                  <p className="text-[#475569] text-[10px] leading-relaxed mb-2">{a.tagline}</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-[#475569] line-through text-[10px]">${a.was}/mo</span>
                    <span className="text-[#00d4ff] font-black text-lg">${a.price}</span>
                    <span className="text-[#475569] text-[10px]">/mo</span>
                    <span className="text-[#22c55e] text-[10px] ml-auto">save ${a.was - a.price}</span>
                  </div>
                  <a href={`${a.path}?bundle=mortgage_radar`} className="block text-center text-[10px] font-bold text-[#00d4ff] border border-[#00d4ff30] rounded-md py-1 hover:bg-[#00d4ff10] transition-colors no-underline">Add →</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {clientId && (
        <section className="max-w-3xl mx-auto px-4 py-8 border-t border-[#1e3a5f]/40">
          <CrmWebhookSettings table="mortgage_radar_clients" clientId={clientId} brand="dwa" />
        </section>
      )}

      {clientEmail && (
        <div className="py-6 text-center border-t border-[#1e3a5f]/40">
          <ManageBillingButton email={clientEmail} />
        </div>
      )}

      {/* Draft modal — LO must explicitly submit, then approve in queue before send */}
      {draftFor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setDraftFor(null)}>
          <Card className="max-w-lg w-full bg-[#0a1628] border-[#1e3a5f]" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-white">Draft outreach — {draftChannel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {draftChannel === "email" && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#94a3b8] block mb-1">Subject</label>
                  <Input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} className="bg-[#030711] border-[#1e3a5f] text-white" />
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#94a3b8] block mb-1">Message body</label>
                <Textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} rows={6} className="bg-[#030711] border-[#1e3a5f] text-[#cbd5e1]" />
              </div>
              <p className="text-[10px] text-[#64748b]">This will be added to your approval queue. Nothing sends until you click "Approve & Send".</p>
              <div className="flex gap-2">
                <Button onClick={submitDraft} className="flex-1 bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
                  Queue for approval
                </Button>
                <Button variant="outline" onClick={() => setDraftFor(null)} className="border-[#1e3a5f] text-white">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="max-w-5xl mx-auto px-4 pb-10">
        <LeadGuaranteeBar productName="Mortgage Radar" />
      </div>
    </div>
  );
}
