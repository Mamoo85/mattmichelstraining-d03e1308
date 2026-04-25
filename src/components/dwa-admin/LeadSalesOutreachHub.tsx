import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, RefreshCw, Sparkles, Send, Printer, Mail, MapPin,
  BarChart2, Clock, CheckCircle2, AlertTriangle, Users, Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────

type Prospect = {
  id: string;
  nmls_id: string | null;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  fax_number: string | null;
  city: string | null;
  state: string | null;
  warmth_score: number | null;
  opt_out_fax: boolean;
  opt_out_email: boolean;
  last_outreach_at: string | null;
  enriched_at: string | null;
};

type Lead = {
  id: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  signal_type: string;
  score: number;
  created_at: string;
};

type Campaign = {
  id: string;
  channel: string;
  created_at: string;
  prospect_count: number;
  sent_count: number;
  response_count: number;
  status: string;
};

type Channel = "email" | "fax" | "postcard";

// ─── Odds table ──────────────────────────────────────────────────────────

const ODDS: Record<Channel, { rate: string; cost: string; compliance: string; icon: React.ReactNode }> = {
  fax:      { rate: "5–8% response",  cost: "~$0.07/send", compliance: "JFPA opt-out required — baked in", icon: <Printer className="w-4 h-4" /> },
  postcard: { rate: "4–6% response",  cost: "~$0.82/send", compliance: "No B2B regs",                       icon: <MapPin  className="w-4 h-4" /> },
  email:    { rate: "2–3% response",  cost: "Free",        compliance: "CAN-SPAM footer — baked in",         icon: <Mail    className="w-4 h-4" /> },
};

const CHANNEL_LABELS: Record<Channel, string> = { fax: "Fax", postcard: "Postcard", email: "Email" };

function recommendation(prospectCount: number): Channel {
  if (prospectCount <= 25) return "postcard"; // high-touch
  if (prospectCount <= 100) return "fax";
  return "email"; // volume
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const SIGNAL_COLORS: Record<string, string> = {
  lis_pendens:          "bg-red-500/20 text-red-400 border-red-500/30",
  high_equity_renovation: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  new_llc:              "bg-purple-500/20 text-purple-400 border-purple-500/30",
  fsbo:                 "bg-blue-500/20 text-blue-400 border-blue-500/30",
  divorce_filing:       "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

function warmthColor(score: number | null) {
  if (!score) return "text-[#64748b]";
  if (score >= 7) return "text-green-400";
  if (score >= 4) return "text-amber-400";
  return "text-red-400";
}

// ─── Component ────────────────────────────────────────────────────────────

export default function LeadSalesOutreachHub() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"prospects" | "campaign" | "history">("prospects");

  // Campaign builder state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [channel, setChannel] = useState<Channel>("postcard");
  const [sending, setSending] = useState(false);
  const [refreshingNMLS, setRefreshingNMLS] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────

  const { data: prospects = [], isLoading: loadingP } = useQuery({
    queryKey: ["lo-prospects"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("marketplace_prospects")
        .select("id,nmls_id,full_name,company_name,email,phone,fax_number,city,state,warmth_score,opt_out_fax,opt_out_email,last_outreach_at,enriched_at")
        .order("warmth_score", { ascending: false })
        .limit(200);
      return (data || []) as Prospect[];
    },
  });

  const { data: leads = [], isLoading: loadingL } = useQuery({
    queryKey: ["mr-leads-outreach"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("mortgage_radar_leads")
        .select("id,address,city,zip,signal_type,score,created_at")
        .gte("score", 7)
        .order("score", { ascending: false })
        .limit(50);
      return (data || []) as Lead[];
    },
  });

  const { data: campaigns = [], isLoading: loadingC } = useQuery({
    queryKey: ["lo-campaigns"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("lo_outreach_campaigns")
        .select("id,channel,created_at,prospect_count,sent_count,response_count,status")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []) as Campaign[];
    },
  });

  // ── Actions ───────────────────────────────────────────────────────────

  const refreshNMLS = async () => {
    setRefreshingNMLS(true);
    try {
      const { data, error } = await supabase.functions.invoke("find-lo-prospects");
      if (error) throw error;
      toast.success(`NMLS refresh: ${data?.inserted ?? 0} new prospects added`);
      qc.invalidateQueries({ queryKey: ["lo-prospects"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "NMLS refresh failed");
    } finally {
      setRefreshingNMLS(false);
    }
  };

  const enrichOne = async (id: string) => {
    setEnrichingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-lo-prospect", { body: { prospect_ids: [id] } });
      if (error) throw error;
      toast.success(data?.enriched > 0 ? "Prospect enriched" : "No enrichment data found");
      qc.invalidateQueries({ queryKey: ["lo-prospects"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setEnrichingId(null);
    }
  };

  const sendBlast = async () => {
    if (!selectedLeads.length || !selectedProspects.length) {
      toast.error("Select at least 1 lead and 1 prospect");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-outreach-blast", {
        body: { lead_ids: selectedLeads, prospect_ids: selectedProspects, channel },
      });
      if (error) throw error;
      toast.success(`Blast sent — ${data?.sent ?? 0} ${channel} sends fired`);
      setSelectedLeads([]);
      setSelectedProspects([]);
      qc.invalidateQueries({ queryKey: ["lo-campaigns"] });
      setTab("history");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Blast failed");
    } finally {
      setSending(false);
    }
  };

  const toggleLead = (id: string) =>
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleProspect = (id: string) =>
    setSelectedProspects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const rec = recommendation(selectedProspects.length || prospects.length);
  const totalCost = selectedProspects.length > 0
    ? channel === "email" ? "Free"
    : channel === "fax" ? `~$${(selectedProspects.length * 0.07).toFixed(2)}`
    : `~$${(selectedProspects.length * 0.82).toFixed(2)}`
    : "—";

  // ── Render ────────────────────────────────────────────────────────────

  const tabs = [
    { key: "prospects", label: `Prospects (${prospects.length})` },
    { key: "campaign",  label: "Campaign Builder" },
    { key: "history",   label: `History (${campaigns.length})` },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Zap className="w-5 h-5 text-amber-400" />
        <div>
          <h2 className="text-lg font-bold text-white">LO Outreach — Sell Your Leads</h2>
          <p className="text-xs text-[#94a3b8]">Find loan officers who need these leads. Fax, postcard, or email — one click.</p>
        </div>
        <Button onClick={refreshNMLS} disabled={refreshingNMLS} size="sm" className="ml-auto bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
          {refreshingNMLS ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh from NMLS
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1e3a5f]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "text-[#00d4ff] border-b-2 border-[#00d4ff]"
                : "text-[#64748b] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROSPECTS TAB ── */}
      {tab === "prospects" && (
        <div>
          {loadingP ? (
            <div className="flex items-center gap-2 text-[#94a3b8] py-8"><Loader2 className="w-4 h-4 animate-spin" />Loading prospects…</div>
          ) : prospects.length === 0 ? (
            <div className="text-center py-12 text-[#94a3b8]">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-white">No prospects yet</p>
              <p className="text-sm mt-1">Click "Refresh from NMLS" to pull Michigan MLOs from the federal database.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#00d4ff] text-left text-xs uppercase tracking-widest border-b border-[#1e3a5f]">
                    <th className="py-2 pr-4">Name</th>
                    <th className="pr-4">Company</th>
                    <th className="pr-4">Contact</th>
                    <th className="pr-4">Warmth</th>
                    <th className="pr-4">Last reach</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map(p => (
                    <tr key={p.id} className="border-b border-[#1e3a5f]/50 hover:bg-[#1e3a5f]/20 transition-colors">
                      <td className="py-2 pr-4 text-white font-medium">
                        {p.full_name || <span className="text-[#64748b]">Unknown</span>}
                        {p.nmls_id && <span className="ml-2 text-xs text-[#64748b]">#{p.nmls_id}</span>}
                      </td>
                      <td className="pr-4 text-[#cbd5e1]">{p.company_name || "—"}</td>
                      <td className="pr-4 text-xs text-[#94a3b8]">
                        <div>{p.email || <span className="text-[#475569]">no email</span>}</div>
                        <div>{p.fax_number || <span className="text-[#475569]">no fax</span>}</div>
                      </td>
                      <td className={`pr-4 font-bold ${warmthColor(p.warmth_score)}`}>
                        {p.warmth_score ?? "—"}
                      </td>
                      <td className="pr-4 text-[#64748b] text-xs">
                        {p.last_outreach_at
                          ? new Date(p.last_outreach_at).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td>
                        {!p.enriched_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => enrichOne(p.id)}
                            disabled={enrichingId === p.id}
                            className="border-[#1e3a5f] text-white hover:bg-[#1e3a5f]/40 h-7 text-xs"
                          >
                            {enrichingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                            Enrich
                          </Button>
                        )}
                        {p.opt_out_fax && p.opt_out_email && (
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">opted out</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CAMPAIGN BUILDER TAB ── */}
      {tab === "campaign" && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: select leads */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#00d4ff]">1. Pick leads to advertise</p>
            <p className="text-[10px] text-[#64748b]">Showing score ≥7 only</p>
            <div className="max-h-64 overflow-y-auto space-y-1 border border-[#1e3a5f] rounded-lg p-2 bg-[#0a1628]">
              {loadingL ? <Loader2 className="w-4 h-4 animate-spin text-[#94a3b8]" /> : leads.map(l => (
                <label key={l.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-[#1e3a5f]/30 rounded px-1">
                  <input
                    type="checkbox"
                    checked={selectedLeads.includes(l.id)}
                    onChange={() => toggleLead(l.id)}
                    className="accent-[#00d4ff]"
                  />
                  <span className="text-xs text-white flex-1 truncate">{l.address || l.city || "—"}</span>
                  <Badge className={`text-[9px] shrink-0 ${SIGNAL_COLORS[l.signal_type] || "bg-[#1e3a5f] text-[#94a3b8]"}`}>
                    {l.signal_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-[#00d4ff] font-bold text-xs">{l.score}</span>
                </label>
              ))}
              {leads.length === 0 && !loadingL && <p className="text-xs text-[#64748b] p-2">No leads with score ≥7 yet. Run the scanner first.</p>}
            </div>
            <p className="text-xs text-[#94a3b8]">{selectedLeads.length} lead{selectedLeads.length !== 1 ? "s" : ""} selected</p>
          </div>

          {/* Middle: select prospects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-[#00d4ff]">2. Pick target LOs</p>
              <Button
                size="sm"
                variant="outline"
                disabled={!!enrichingId || prospects.length === 0}
                onClick={async () => {
                  const visible = prospects.filter(p => !p.opt_out_fax || !p.opt_out_email).slice(0, 25);
                  if (!visible.length) return;
                  setEnrichingId("__bulk__");
                  try {
                    const { data, error } = await supabase.functions.invoke("enrich-lo-prospect", {
                      body: { prospect_ids: visible.map(v => v.id) },
                    });
                    if (error) throw error;
                    toast.success(`Enriched ${data?.enriched ?? 0}/${visible.length} prospects`);
                    qc.invalidateQueries({ queryKey: ["lo-prospects"] });
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Bulk enrich failed");
                  } finally {
                    setEnrichingId(null);
                  }
                }}
                className="border-[#1e3a5f] text-[10px] text-white h-6 px-2"
              >
                {enrichingId === "__bulk__" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Enrich visible
              </Button>
            </div>
            <p className="text-[10px] text-[#64748b]">Sorted by warmth score</p>
            <div className="max-h-64 overflow-y-auto space-y-1 border border-[#1e3a5f] rounded-lg p-2 bg-[#0a1628]">
              {loadingP ? <Loader2 className="w-4 h-4 animate-spin text-[#94a3b8]" /> : prospects.filter(p => !p.opt_out_fax || !p.opt_out_email).map(p => (
                <div key={p.id} className="flex items-center gap-2 py-1 hover:bg-[#1e3a5f]/30 rounded px-1">
                  <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedProspects.includes(p.id)}
                      onChange={() => toggleProspect(p.id)}
                      className="accent-[#00d4ff]"
                    />
                    <span className="text-xs text-white flex-1 truncate">{p.full_name || p.company_name || "—"}</span>
                    <span className={`text-xs font-bold ${warmthColor(p.warmth_score)}`}>{p.warmth_score ?? "?"}</span>
                  </label>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); enrichOne(p.id); }}
                    disabled={enrichingId === p.id}
                    title="Enrich this prospect"
                    className="text-[#00d4ff] hover:text-amber-400 disabled:opacity-50 shrink-0"
                  >
                    {enrichingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  </button>
                </div>
              ))}
              {prospects.length === 0 && !loadingP && <p className="text-xs text-[#64748b] p-2">No prospects. Refresh from NMLS first.</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedProspects(prospects.filter(p => !p.opt_out_fax || !p.opt_out_email).map(p => p.id))} className="border-[#1e3a5f] text-xs text-white h-7">Select all</Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedProspects([])} className="border-[#1e3a5f] text-xs text-white h-7">Clear</Button>
              <span className="text-xs text-[#94a3b8] self-center">{selectedProspects.length} selected</span>
            </div>
          </div>

          {/* Right: channel + odds + send */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#00d4ff]">3. Channel + send</p>

            {/* Channel picker */}
            <div className="space-y-2">
              {(["postcard", "fax", "email"] as Channel[]).map(ch => {
                const o = ODDS[ch];
                const isRec = rec === ch;
                return (
                  <label key={ch} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    channel === ch ? "border-[#00d4ff] bg-[#00d4ff]/5" : "border-[#1e3a5f] bg-[#0a1628] hover:border-[#1e3a5f]/80"
                  }`}>
                    <input type="radio" name="channel" value={ch} checked={channel === ch} onChange={() => setChannel(ch)} className="mt-0.5 accent-[#00d4ff]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{CHANNEL_LABELS[ch]}</span>
                        {isRec && <Badge className="bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/20 text-[9px]">RECOMMENDED</Badge>}
                      </div>
                      <div className="text-xs text-amber-400">{o.rate}</div>
                      <div className="text-xs text-[#64748b]">{o.cost} · {o.compliance}</div>
                    </div>
                    <span className="text-[#64748b]">{o.icon}</span>
                  </label>
                );
              })}
              <div className="text-xs text-[#64748b] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                SMS disabled for cold prospects — TCPA requires prior written consent
              </div>
            </div>

            {/* Cost summary */}
            {selectedProspects.length > 0 && (
              <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between text-[#94a3b8]"><span>Recipients</span><span className="text-white">{selectedProspects.length}</span></div>
                <div className="flex justify-between text-[#94a3b8]"><span>Est. cost</span><span className="text-white">{totalCost}</span></div>
                <div className="flex justify-between text-[#94a3b8]"><span>Est. responses</span>
                  <span className="text-green-400">
                    {channel === "fax" ? Math.round(selectedProspects.length * 0.065)
                     : channel === "postcard" ? Math.round(selectedProspects.length * 0.05)
                     : Math.round(selectedProspects.length * 0.025)} likely
                  </span>
                </div>
              </div>
            )}

            <Button
              onClick={sendBlast}
              disabled={sending || !selectedLeads.length || !selectedProspects.length}
              className="w-full bg-amber-500 text-black hover:bg-amber-400 font-bold"
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sending ? "Sending…" : `Send ${channel} blast to ${selectedProspects.length} LO${selectedProspects.length !== 1 ? "s" : ""}`}
            </Button>

            {(!selectedLeads.length || !selectedProspects.length) && (
              <p className="text-xs text-[#64748b] text-center">Select leads and prospects to enable send</p>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div>
          {loadingC ? (
            <div className="flex items-center gap-2 text-[#94a3b8] py-8"><Loader2 className="w-4 h-4 animate-spin" />Loading campaigns…</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-[#94a3b8]">
              <BarChart2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-white">No campaigns yet</p>
              <p className="text-sm mt-1">Run your first blast in the Campaign Builder tab.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#00d4ff] text-xs uppercase tracking-widest border-b border-[#1e3a5f]">
                    <th className="py-2 pr-4 text-left">Date</th>
                    <th className="pr-4 text-left">Channel</th>
                    <th className="pr-4 text-right">Sent</th>
                    <th className="pr-4 text-right">Responses</th>
                    <th className="pr-4 text-right">Rate</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => {
                    const rate = c.sent_count > 0 ? ((c.response_count / c.sent_count) * 100).toFixed(1) : "—";
                    return (
                      <tr key={c.id} className="border-b border-[#1e3a5f]/50">
                        <td className="py-2 pr-4 text-[#94a3b8]">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="pr-4">
                          <Badge className="bg-[#1e3a5f] text-[#94a3b8] border-[#1e3a5f] capitalize">{c.channel}</Badge>
                        </td>
                        <td className="pr-4 text-right text-white">{c.sent_count}/{c.prospect_count}</td>
                        <td className="pr-4 text-right text-green-400">{c.response_count}</td>
                        <td className="pr-4 text-right text-amber-400">{rate}%</td>
                        <td>
                          {c.status === "completed"
                            ? <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 className="w-3 h-3" />Done</span>
                            : <span className="flex items-center gap-1 text-amber-400 text-xs"><Clock className="w-3 h-3" />{c.status}</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
