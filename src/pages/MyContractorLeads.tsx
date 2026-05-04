import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/layout/SEOHead";
import {
  Phone, CheckCircle2, XCircle, Loader2, MapPin,
  Wrench, TrendingUp, RefreshCw, AlertTriangle, Star,
  Gift, ShoppingBag, ChevronDown, ChevronUp, Sparkles, Hammer,
} from "lucide-react";
import LeadProbabilityCard from "@/components/contractor/LeadProbabilityCard";
import FreeBoostCard from "@/components/contractor/FreeBoostCard";
import DWASuiteNav from "@/components/shared/DWASuiteNav";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import EmptyDashboardState from "@/components/shared/EmptyDashboardState";
import OnboardingChecklist from "@/components/shared/OnboardingChecklist";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  project_type: string | null;
  source: string;
  status: string;
  contractor_feedback: "called" | "hired" | "bad_lead" | null;
  bad_lead_flagged_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  this_month: number;
  called: number;
  hired: number;
  bad_lead: number;
  pending_feedback: number;
}

interface Contractor {
  id: string;
  email: string;
  business_name: string;
  trade: string;
  city: string;
  state: string;
  active: boolean;
  member_since: string;
  free_dead_leads_used: number;
  free_dead_leads_quota: number;
}

interface BundledServices {
  missed_call: boolean;
  reviews: boolean;
  afterjob: boolean;
}

interface UpgradeOption {
  key: string;
  name: string;
  tagline: string;
  standalone: number;
  bundled: number;
  checkout_path: string;
}

interface DashboardData {
  contractor: Contractor;
  stats: Stats;
  leads: Lead[];
  bundled_services?: BundledServices;
  available_upgrades?: UpgradeOption[];
}

const FEEDBACK_CONFIG = {
  called:   { label: "Called",    icon: Phone,        color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  hired:    { label: "Hired ✓",   icon: CheckCircle2, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  bad_lead: { label: "Disputed",  icon: AlertTriangle, color: "bg-red-500/20 text-red-400 border-red-500/30" },
} as const;

export default function MyContractorLeads() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = useState<Record<string, Lead["contractor_feedback"]>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "hired" | "called" | "bad_lead">("all");
  const [shopOpen, setShopOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contractor-leads-dashboard`;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const fetchData = async () => {
    if (!token) { setError("No dashboard token provided"); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${base}?token=${token}`, { headers: { apikey: apiKey } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load dashboard");
      }
      const json: DashboardData = await res.json();
      setData(json);
      // Seed local feedback state from server
      const seed: Record<string, Lead["contractor_feedback"]> = {};
      for (const l of json.leads) { if (l.contractor_feedback) seed[l.id] = l.contractor_feedback; }
      setLocalFeedback(seed);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const logFeedback = async (leadId: string, feedback: Lead["contractor_feedback"]) => {
    if (!token || !feedback) return;
    setFeedbackLoading(leadId + feedback);
    setLocalFeedback(prev => ({ ...prev, [leadId]: feedback }));
    try {
      await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ token, lead_id: leadId, feedback }),
      });
    } catch { /* keep optimistic */ }
    setFeedbackLoading(null);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.leads.filter(l => {
      const fb = localFeedback[l.id] ?? l.contractor_feedback;
      if (filter === "pending") return !fb;
      if (filter === "hired") return fb === "hired";
      if (filter === "called") return fb === "called";
      if (filter === "bad_lead") return fb === "bad_lead";
      return true;
    });
  }, [data, localFeedback, filter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030711] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#030711] flex items-center justify-center px-4">
        <div className="text-center">
          <Wrench className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Access Denied</h2>
          <p className="text-white/50 text-sm">{error || "Invalid or expired dashboard link."}</p>
          <a href="sms:+13139921219" className="text-[#00d4ff] text-sm mt-4 inline-block hover:underline">
            Text Matt for help →
          </a>
        </div>
      </div>
    );
  }

  const { contractor, stats } = data;
  const tradeLabel = contractor.trade.charAt(0).toUpperCase() + contractor.trade.slice(1);

  return (
    <>
      <SEOHead
        title={`My Leads — ${contractor.business_name}`}
        description="Your exclusive contractor lead dashboard"
      />
      <DWASuiteNav activeProduct="contractor_leads" email={data?.contractor?.email} />
      <div className="min-h-screen bg-[#030711] text-white">
        {/* Header */}
        <header className="border-b border-white/5 bg-[#0a1628]/90 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-sm font-bold text-white">{contractor.business_name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-white/40">Detroit Lead Network</p>
                <span className="text-[10px] text-white/20">·</span>
                <span className="flex items-center gap-1 text-[10px]">
                  <MapPin className="h-2.5 w-2.5 text-[#00d4ff]" />
                  <span className="text-[#00d4ff]">{tradeLabel} · {contractor.city}, {contractor.state}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {contractor.active && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">● Active</Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={fetchData}
                className="border-white/10 text-white/50 hover:bg-white/5 text-xs h-8"
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <OnboardingChecklist
            product="Contractor Leads"
            steps={[
              { id: "auth", label: "Dashboard link verified", done: !!contractor, hint: "Open from your welcome email." },
              { id: "leads", label: "First lead delivered", done: stats.total > 0, hint: "Leads delivered as they hit your trade + city." },
              { id: "called", label: "First lead called", done: stats.called > 0 || stats.hired > 0, hint: "Tap the Call button on any lead." },
              { id: "hired", label: "First job won", done: stats.hired > 0, hint: "Mark Hired so we tune your scoring." },
            ]}
          />
          {/* Shipping Upgrades banner */}
          {!bannerDismissed && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
              <Hammer className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-300 text-xs font-bold mb-0.5">🚧 Brand new dashboard — shipping upgrades daily</p>
                <p className="text-amber-200/70 text-[11px] leading-relaxed">
                  Bear with us as we make this better every day. Got an idea or hit a bug? Text Matt at (313) 992-1219 — he reads every message.
                </p>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-amber-400/40 hover:text-amber-400 text-xs"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* Included Free — bundled bonus services (OPT-IN) */}
          {data.bundled_services && (
            <div className="bg-gradient-to-br from-emerald-500/10 to-[#0f1f35] border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-emerald-300">Free Bonuses — Opt In Anytime</h2>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] ml-auto">
                  $163/mo value · $0
                </Badge>
              </div>
              <p className="text-white/50 text-[11px] mb-3 leading-relaxed">
                These are <span className="text-emerald-300 font-semibold">100% optional</span> and bundled free with your lead plan. Turn any of them on/off anytime — no card needed, no extra charge ever.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    key: "missed_call",
                    active: data.bundled_services.missed_call,
                    label: "Missed Call Text-Back",
                    value: "$99/mo",
                    desc: "If a caller goes to voicemail, an auto-text fires in 5 seconds so they don't bounce to a competitor.",
                    example: `"Hey, this is ${data.contractor?.business_name || "your business"} — sorry I missed your call. What can I help with? I'll call back ASAP."`,
                  },
                  {
                    key: "reviews",
                    active: data.bundled_services.reviews,
                    label: "Review Monitor",
                    value: "$25/mo",
                    desc: "Alerts you the second a new Google review hits + drafts a reply for you to copy/paste.",
                    example: `"⭐ New 5★ from Sarah K: 'Fast, clean install.' Suggested reply: 'Thanks Sarah! Glad we got it done quick — call us anytime.'"`,
                  },
                  {
                    key: "afterjob",
                    active: data.bundled_services.afterjob,
                    label: "Quote Follow-Up Drip",
                    value: "$39/mo",
                    desc: "If a quote doesn't book within 48 hrs, auto-texts the homeowner a polite nudge so it doesn't go cold.",
                    example: `"Hi Mike — checking in on the panel quote from Tuesday. Any questions I can answer? Happy to lock you in this week. — ${data.contractor?.business_name || "your business"}"`,
                  },
                ].map(b => (
                  <div key={b.key} className="bg-[#0a1628]/60 border border-white/5 rounded-lg p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white text-xs font-bold">{b.label}</p>
                      {b.active ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]">● ON</Badge>
                      ) : (
                        <Badge className="bg-white/5 text-white/40 border-white/10 text-[9px]">OFF</Badge>
                      )}
                    </div>
                    <p className="text-emerald-400/70 text-[10px] font-bold mb-1">{b.value} value · FREE</p>
                    <p className="text-white/60 text-[10px] leading-relaxed mb-2">{b.desc}</p>
                    <div className="bg-black/30 border-l-2 border-emerald-500/40 px-2 py-1.5 rounded mb-2">
                      <p className="text-white/40 text-[9px] uppercase tracking-wide mb-0.5">Example:</p>
                      <p className="text-emerald-200/80 text-[10px] italic leading-snug">{b.example}</p>
                    </div>
                    <a
                      href={`mailto:matt@detroitwebagent.com?subject=${encodeURIComponent(`${b.active ? "Pause" : "Turn on"} ${b.label}`)}&body=${encodeURIComponent(`Hey Matt — please ${b.active ? "pause" : "activate"} ${b.label} on my account.`)}`}
                      className={`mt-auto text-center text-[10px] font-semibold rounded-md px-2 py-1.5 transition ${
                        b.active
                          ? "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                          : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40"
                      }`}
                    >
                      {b.active ? "Turn off" : "Turn on (free)"}
                    </a>
                  </div>
                ))}
              </div>
              <p className="text-white/30 text-[10px] mt-3 text-center">
                Opt out anytime — text Matt at (313) 992-1219 or tap the button on any card. No charge either way.
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: "Total Leads",   value: stats.total,           color: "text-white" },
              { label: "This Month",    value: stats.this_month,       color: "text-[#00d4ff]" },
              { label: "Called",        value: stats.called,           color: "text-blue-400" },
              { label: "Hired",         value: stats.hired,            color: "text-emerald-400" },
              { label: "Disputed",      value: stats.bad_lead,         color: "text-red-400" },
              { label: "Need Action",   value: stats.pending_feedback, color: "text-amber-400" },
            ].map(s => (
              <div key={s.label} className="bg-[#0f1f35] border border-white/10 rounded-lg p-3 text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-white/40 uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Hire rate callout */}
          {stats.total > 0 && (
            <div className="bg-[#0a1f0a] border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <Star className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-400">
                <strong>{stats.hired}</strong> hire{stats.hired !== 1 ? "s" : ""} from {stats.total} leads
                {stats.total > 0 && (
                  <span className="text-emerald-400/60 ml-2">
                    ({Math.round((stats.hired / stats.total) * 100)}% close rate)
                  </span>
                )}
                {stats.pending_feedback > 0 && (
                  <span className="text-amber-400 ml-3">· {stats.pending_feedback} need your feedback</span>
                )}
              </p>
            </div>
          )}

          {/* Free dead-lead boost quota */}
          <FreeBoostCard
            contractorId={contractor.id}
            used={contractor.free_dead_leads_used}
            quota={contractor.free_dead_leads_quota}
          />

          {/* Lead probability / boost upsell */}
          <LeadProbabilityCard
            contractorId={contractor.id}
            email={contractor.email}
            leadsLast30={stats.this_month}
          />

          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { id: "all",      label: `All (${stats.total})` },
              { id: "pending",  label: `Need Action (${stats.pending_feedback})` },
              { id: "hired",    label: `Hired (${stats.hired})` },
              { id: "called",   label: `Called (${stats.called})` },
              { id: "bad_lead", label: `Disputed (${stats.bad_lead})` },
            ] as const).map(f => (
              <Button
                key={f.id}
                size="sm"
                variant={filter === f.id ? "default" : "outline"}
                onClick={() => setFilter(f.id)}
                className={`h-7 text-xs ${filter === f.id ? "bg-[#00d4ff] text-black" : "border-white/10 text-white/50 hover:bg-white/5"}`}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Lead list */}
          {filtered.length === 0 ? (
            stats.total === 0 ? (
              <EmptyDashboardState
                productName="Contractor Lead Network"
                etaText="Your subscription is live. Most contractors get their first qualified homeowner lead within 5–10 days as our marketing engines pick up search demand in your trade + city."
                checklist={[
                  "Trade and service area locked in",
                  "Lead-routing SMS active",
                  "Marketing engines indexing your trade",
                  "First-look priority enabled",
                ]}
                setupGuideHref="mailto:matt@detroitwebagent.com?subject=Contractor%20Leads%20setup"
              />
            ) : (
              <div className="bg-[#0f1f35] border border-white/10 rounded-xl py-16 text-center">
                <TrendingUp className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No leads match this filter.</p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {filtered.map(lead => {
                const fb = localFeedback[lead.id] ?? lead.contractor_feedback;
                const fbConfig = fb ? FEEDBACK_CONFIG[fb] : null;
                return (
                  <div
                    key={lead.id}
                    className={`bg-[#0f1f35] border rounded-xl p-4 ${
                      fb === "hired" ? "border-emerald-500/30" :
                      fb === "bad_lead" ? "border-red-500/20" :
                      fb === "called" ? "border-blue-500/20" :
                      "border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-bold text-sm">{lead.name}</h3>
                          {fbConfig && (
                            <Badge className={`text-[10px] ${fbConfig.color}`}>{fbConfig.label}</Badge>
                          )}
                          {lead.bad_lead_flagged_at && (
                            <Badge className="text-[10px] bg-red-500/10 text-red-400/70 border-red-500/20">
                              Matt notified
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/40 mb-2">
                          <a href={`tel:${lead.phone}`} className="text-[#00d4ff] hover:underline flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" /> {lead.phone}
                          </a>
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="text-white/50 hover:text-white/70">
                              {lead.email}
                            </a>
                          )}
                          <span>📅 {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          {lead.project_type && <span>🔧 {lead.project_type}</span>}
                        </div>

                        {lead.message && (
                          <p className="text-[11px] text-white/50 leading-relaxed mb-3 italic">
                            "{lead.message}"
                          </p>
                        )}

                        {/* Action buttons — only show if no feedback yet */}
                        {!fb ? (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                            <span className="text-[10px] text-white/30 self-center">Update status:</span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={feedbackLoading === lead.id + "called"}
                              onClick={() => logFeedback(lead.id, "called")}
                              className="h-7 text-[11px] border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            >
                              <Phone className="h-3 w-3 mr-1" /> Called
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={feedbackLoading === lead.id + "hired"}
                              onClick={() => logFeedback(lead.id, "hired")}
                              className="h-7 text-[11px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Hired
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={feedbackLoading === lead.id + "bad_lead"}
                              onClick={() => logFeedback(lead.id, "bad_lead")}
                              className="h-7 text-[11px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                              title="Flag for Matt to review — we'll follow up"
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Bad Lead
                            </Button>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-white/5">
                            <button
                              onClick={() => setLocalFeedback(prev => { const n = { ...prev }; delete n[lead.id]; return n; })}
                              className="text-[10px] text-white/20 hover:text-white/40 transition-colors"
                            >
                              undo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bad lead disclaimer */}
          {stats.bad_lead > 0 && (
            <p className="text-[10px] text-white/20 text-center">
              Disputed leads are reviewed by Matt within 24 hours. Credit issued if confirmed bogus.
            </p>
          )}

          {/* Upgrade Shop — bundle-discounted DWA add-ons */}
          {data.available_upgrades && data.available_upgrades.length > 0 && (
            <div className="bg-[#0f1f35] border border-[#00d4ff]/20 rounded-xl overflow-hidden">
              <button
                onClick={() => setShopOpen(o => !o)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <ShoppingBag className="h-4 w-4 text-[#00d4ff]" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-white">Upgrade Shop</p>
                  <p className="text-[10px] text-white/40">Add-ons at 30% off — exclusive to lead network clients</p>
                </div>
                <Badge className="bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/30 text-[9px]">
                  <Sparkles className="h-2.5 w-2.5 mr-1" /> Bundle pricing
                </Badge>
                {shopOpen ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
              </button>

              {shopOpen && (
                <div className="border-t border-white/5 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.available_upgrades.map(u => {
                    const savings = u.standalone - u.bundled;
                    const upgradeUrl = `${u.checkout_path}?prefilled_email=${encodeURIComponent(data.contractor.email)}&bundle_discount=lead_network`;
                    return (
                      <div key={u.key} className="bg-[#0a1628]/60 border border-white/5 rounded-lg p-4 hover:border-[#00d4ff]/30 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-white text-sm font-bold">{u.name}</p>
                            <p className="text-white/50 text-[11px] mt-0.5 leading-relaxed">{u.tagline}</p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-3 mb-3">
                          <span className="text-white/30 line-through text-xs">${u.standalone}</span>
                          <span className="text-[#00d4ff] text-xl font-black">${u.bundled}</span>
                          <span className="text-white/40 text-[11px]">/mo</span>
                          <span className="text-emerald-400/80 text-[10px] ml-auto font-bold">save ${savings}/mo</span>
                        </div>
                        <a href={upgradeUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" className="w-full h-8 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 text-xs">
                            Add to my plan →
                          </Button>
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="py-8 border-t border-white/5 text-center space-y-3">
          <p className="text-white/20 text-[10px]">Detroit Web Agency — Contractor Lead Network</p>
          {contractor?.email && <ManageBillingButton email={contractor.email} />}
          <a href="sms:+13139921219" className="text-[#00d4ff]/40 text-[10px] hover:text-[#00d4ff] mt-1 block">
            Questions? Text Matt at (313) 992-1219
          </a>
        </footer>
      </div>
    </>
  );
}
