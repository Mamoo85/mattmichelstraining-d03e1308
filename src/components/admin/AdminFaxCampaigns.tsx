/**
 * AdminFaxCampaigns — DWA Admin tab
 * Mirrors AdminPostcardCampaigns. 4 sub-tabs:
 *   🎯 Find Prospects · 📋 Prospects · 📠 Campaigns (send/diagnose/resend) · 📊 Conversions
 *
 * Honest pipeline: Phaxio sends, fax_send_log tracks every attempt, diagnose +
 * resend failed mirror the postcard system.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

type Segment = "nursing_home" | "medical" | "municipal" | "industrial" | "legal" | "school";

const SEGMENTS: { value: Segment; label: string; auto: boolean }[] = [
  { value: "nursing_home", label: "🏥 Nursing Homes (CMS auto-pull)", auto: true },
  { value: "medical", label: "⚕️ Medical Practices (NPI auto-pull)", auto: true },
  { value: "municipal", label: "🏛️ Municipal Offices (manual)", auto: false },
  { value: "industrial", label: "🏭 Industrial / Manufacturing (manual)", auto: false },
  { value: "legal", label: "⚖️ Law Firms (manual)", auto: false },
  { value: "school", label: "🎓 Schools / Districts (manual)", auto: false },
];

// Find-prospects audiences (from targeting-prospect-scraper) → fax segment
type FindAudience = "supply_house" | "nursing_home" | "healthcare_staffing" | "trades_staffing" | "industrial_mfg" | "senior_care";
const FIND_AUDIENCES: { value: FindAudience; label: string }[] = [
  { value: "supply_house", label: "🔧 Supply Houses (Demand Radar pitch)" },
  { value: "nursing_home", label: "🏥 Nursing Homes (TechAlert nursing pitch)" },
  { value: "healthcare_staffing", label: "⚕️ Healthcare Staffing Agencies" },
  { value: "trades_staffing", label: "🛠️ Trades Staffing Agencies" },
  { value: "industrial_mfg", label: "🏭 Industrial Manufacturers" },
  { value: "senior_care", label: "👵 Senior Care Facilities" },
];
const COUNTIES = ["Wayne", "Oakland", "Macomb", "Kent", "Ingham", "Washtenaw", "Genesee", "Kalamazoo", "Saginaw", "Muskegon"];

const COST_PER_FAX = 0.07;

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-300",
  sent: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
  skipped_opt_out: "bg-amber-500/20 text-amber-300",
};

interface Campaign {
  id: string;
  name: string;
  target_segment: string;
  audience_type: string | null;
  status: string;
  total_sent: number | null;
  total_cost: number | null;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

export default function AdminFaxCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [sendLogs, setSendLogs] = useState<Record<string, any[]>>({});

  const [name, setName] = useState("");
  const [segment, setSegment] = useState<Segment>("nursing_home");
  const [subject, setSubject] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagnosing, setDiagnosing] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Find prospects state
  const [findAudience, setFindAudience] = useState<FindAudience>("supply_house");
  const [findCounty, setFindCounty] = useState("Oakland");
  const [finding, setFinding] = useState(false);

  // Prospect filter
  const [prospectFilter, setProspectFilter] = useState<string>("all");

  async function loadAll() {
    const [c, p, cv, sl] = await Promise.all([
      supabase.from("fax_campaigns" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("fax_prospects" as any).select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("fax_conversions" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("fax_send_log" as any).select("*").order("sent_at", { ascending: false }).limit(2000),
    ]);
    setCampaigns(((c.data as any[]) || []) as Campaign[]);
    setProspects((p.data as any[]) || []);
    setConversions((cv.data as any[]) || []);
    const grouped: Record<string, any[]> = {};
    ((sl.data as any[]) || []).forEach((row: any) => {
      const cid = row.campaign_id || "_unassigned";
      if (!grouped[cid]) grouped[cid] = [];
      grouped[cid].push(row);
    });
    setSendLogs(grouped);
  }

  useEffect(() => { loadAll(); }, []);

  async function findProspects() {
    setFinding(true);
    toast.info(`Searching ${findAudience} in ${findCounty} County…`);
    const { data, error } = await supabase.functions.invoke("targeting-prospect-scraper", {
      body: { audience_type: findAudience, county: findCounty, limit: 50, mode: "fax" },
    });
    setFinding(false);
    if (error) { toast.error(`Search failed: ${error.message}`); return; }
    toast.success(`Found ${data?.found || 0} · Added ${data?.fax_prospects_added || 0} new fax prospects`);
    loadAll();
  }

  async function pullProspects() {
    setBusy(true);
    toast.info("Pulling fresh prospects from public source…");
    const { data, error } = await supabase.functions.invoke("fax-prospect-finder", {
      body: { segment, limit: 100 },
    });
    setBusy(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success(`Found ${data?.found || 0} · Inserted ${data?.inserted || 0} new · ${data?.duplicates || 0} dupes`);
    loadAll();
  }

  async function createCampaign() {
    if (!name.trim() || !messageHtml.trim()) {
      toast.error("Name and message HTML are required.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("fax_campaigns" as any).insert({
      name, target_segment: segment, audience_type: segment,
      subject, message_html: messageHtml, status: "draft",
    });
    setBusy(false);
    if (error) { toast.error(`❌ ${error.message}`); return; }
    setName(""); setSubject(""); setMessageHtml("");
    toast.success("✅ Campaign saved as draft");
    loadAll();
  }

  async function diagnose(id: string) {
    setDiagnosing(id);
    const { data, error } = await supabase.functions.invoke("send-fax-phaxio", {
      body: { campaign_id: id, dry_run: true },
    });
    setDiagnosing(null);
    if (error) { toast.error(`Diagnose failed: ${error.message}`); return; }
    if (data?.error) { toast.error(`❌ ${data.error}`); return; }
    const lines = [
      `📍 Segment: ${data.campaign_segment}`,
      `   ${data.prospects_in_segment} prospects total`,
      `   ✅ ${data.ready_to_send} ready to send`,
      `   ⚠️ ${data.no_fax_number} have no fax number`,
      `   📨 ${data.already_sent} already sent`,
      ``,
      `🔑 Sinch Fax API: ${data.phaxio_api_ok ? "✅ Working" : "❌ FAILED"}`,
      data.phaxio_error ? `   Error: ${String(data.phaxio_error).slice(0, 140)}` : ``,
      ``,
      `💰 Month so far: ${data.month_sent_so_far} sent · ${data.month_remaining} remaining of cap`,
      `💸 If sent now: $${data.estimated_cost_if_sent}`,
    ].filter(Boolean).join("\n");
    toast.message("Diagnose result", { description: lines, duration: 30000 });
    console.log("[Fax Diagnose]", data);
  }

  async function sendCampaign(id: string) {
    const ready = ((sendLogs[id] || []).length === 0);
    if (!confirm(`Send fax campaign now? This is irreversible.${ready ? "" : "\n\n(Note: this campaign already has send-log entries — running again will only send to prospects that haven't been faxed yet.)"}`)) return;
    setSending(id);
    toast.info("Sending faxes via Sinch…");
    const { data, error } = await supabase.functions.invoke("send-fax-phaxio", {
      body: { campaign_id: id },
    });
    setSending(null);
    if (error) { toast.error(`Send failed: ${error.message}`); }
    else if (!data?.success) { toast.error(`❌ ${data?.error || data?.last_error || "Zero faxes sent"}`); }
    else { toast.success(`✅ ${data.sent} sent · ${data.failed} failed · $${data.cost}`); }
    loadAll();
  }

  async function resendFailed(id: string) {
    const failedRows = (sendLogs[id] || []).filter((r: any) => r.status === "failed");
    if (!failedRows.length) { toast.info("No failed sends to resend"); return; }
    if (!confirm(`Resend ${failedRows.length} failed faxes? Cost: $${(failedRows.length * COST_PER_FAX).toFixed(2)}`)) return;
    setResending(id);
    const prospect_ids = failedRows.map((r: any) => r.prospect_id).filter(Boolean);
    const { data, error } = await supabase.functions.invoke("send-fax-phaxio", {
      body: { campaign_id: id, prospect_ids },
    });
    setResending(null);
    if (error) { toast.error(`Resend failed: ${error.message}`); }
    else { toast.success(`Resend: ${data?.sent || 0} sent · ${data?.failed || 0} failed`); loadAll(); }
  }

  const segmentMeta = SEGMENTS.find(s => s.value === segment);
  const filteredProspects = prospectFilter === "all"
    ? prospects
    : prospects.filter((p: any) => (p.segment || p.audience_type) === prospectFilter);

  return (
    <div className="space-y-6 text-white">
      <div>
        <h2 className="text-xl font-bold">📠 Fax Campaigns (Sinch)</h2>
        <p className="text-white/50 text-sm mt-1">
          B2B faxes to verified public business numbers · multi-offer footer w/ landing URL ·
          TCPA opt-out · caps: 200/run · 1000/month · ${COST_PER_FAX}/fax
        </p>
      </div>

      <Tabs defaultValue="find" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="find">🎯 Find Prospects</TabsTrigger>
          <TabsTrigger value="prospects">📋 Prospects ({prospects.length})</TabsTrigger>
          <TabsTrigger value="campaigns">📠 Campaigns ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="conversions">📊 Conversions ({conversions.length})</TabsTrigger>
        </TabsList>

        {/* ── Find Prospects ── */}
        <TabsContent value="find" className="space-y-4">
          <Card className="bg-[#0f1f35] border-white/10">
            <CardHeader>
              <CardTitle className="text-sm text-white/70 uppercase tracking-wide flex items-center gap-2">
                <Search className="w-4 h-4" /> Search any audience + county → fax_prospects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select value={findAudience} onChange={e => setFindAudience(e.target.value as FindAudience)}
                  className="bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white">
                  {FIND_AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <select value={findCounty} onChange={e => setFindCounty(e.target.value)}
                  className="bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white">
                  {COUNTIES.map(c => <option key={c} value={c}>{c} County</option>)}
                </select>
                <Button onClick={findProspects} disabled={finding}
                  className="bg-[#00d4ff] text-[#0a1628] font-bold hover:bg-[#00b8e0]">
                  {finding ? "Searching…" : "🔍 Find & Save"}
                </Button>
              </div>
              <p className="text-xs text-white/50">
                Pulls real businesses from public directories (CMS, NPI, SAM.gov, Sonar) and writes them
                to <code className="text-[#00d4ff]">fax_prospects</code> tagged with the audience type.
                Only rows with a verified fax number are added.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1f35] border-white/10">
            <CardHeader>
              <CardTitle className="text-sm text-white/70 uppercase tracking-wide">Federal-source pulls (CMS / NPI)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={segment} onChange={e => setSegment(e.target.value as Segment)}
                  className="bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white">
                  {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <Button onClick={pullProspects} disabled={busy || !segmentMeta?.auto}
                  variant="outline" className="border-white/20">
                  {busy ? "Pulling…" : segmentMeta?.auto ? `🔄 Pull ${segment} Prospects` : "Manual segment — add via DB"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Prospects ── */}
        <TabsContent value="prospects" className="space-y-4">
          <Card className="bg-[#0f1f35] border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-white/70 uppercase tracking-wide">All Fax Prospects</CardTitle>
              <select value={prospectFilter} onChange={e => setProspectFilter(e.target.value)}
                className="bg-[#0a1628] border border-white/10 rounded px-3 py-1.5 text-xs text-white">
                <option value="all">All segments</option>
                {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                {FIND_AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-xs uppercase text-white/40 text-left">
                    <tr>
                      <th className="px-3 py-2">Business</th>
                      <th className="px-3 py-2">Fax</th>
                      <th className="px-3 py-2">Segment</th>
                      <th className="px-3 py-2">City</th>
                      <th className="px-3 py-2">County</th>
                      <th className="px-3 py-2">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProspects.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-white/30">No prospects yet — use Find Prospects.</td></tr>
                    )}
                    {filteredProspects.slice(0, 200).map((p: any) => (
                      <tr key={p.id} className="border-t border-white/5">
                        <td className="px-3 py-2">{p.business_name}</td>
                        <td className="px-3 py-2 text-white/70 font-mono text-xs">{p.fax_number}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{p.segment}{p.audience_type ? ` · ${p.audience_type}` : ""}</Badge></td>
                        <td className="px-3 py-2 text-white/60">{p.city}</td>
                        <td className="px-3 py-2 text-white/60">{p.county || "—"}</td>
                        <td className="px-3 py-2">
                          {p.fax_sent_at
                            ? <span className="text-emerald-300 text-xs">{new Date(p.fax_sent_at).toLocaleDateString()}</span>
                            : <span className="text-white/30 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Campaigns ── */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* New campaign builder */}
          <Card className="bg-[#0f1f35] border-white/10">
            <CardHeader><CardTitle className="text-sm text-white/70 uppercase tracking-wide">New Campaign</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Campaign name (e.g. Supply Houses — Demand Radar Apr 2026)"
                  className="bg-[#0a1628] border-white/10 text-white" />
                <select value={segment} onChange={e => setSegment(e.target.value as Segment)}
                  className="bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white">
                  {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <Input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Subject line (printed on fax header)"
                className="bg-[#0a1628] border-white/10 text-white" />
              <textarea value={messageHtml} onChange={e => setMessageHtml(e.target.value)}
                placeholder="Message HTML body (multi-offer footer + landing URL auto-injected at send time)"
                rows={8}
                className="w-full bg-[#0a1628] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono" />
              <Button onClick={createCampaign} disabled={busy}
                className="bg-[#00d4ff] text-[#0a1628] font-bold hover:bg-[#00b8e0]">
                {busy ? "…" : "Save Draft"}
              </Button>
            </CardContent>
          </Card>

          {/* Campaign list */}
          <Card className="bg-[#0f1f35] border-white/10">
            <CardHeader><CardTitle className="text-sm text-white/70 uppercase tracking-wide">Campaigns</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {campaigns.length === 0 && <p className="text-white/40 text-center py-6">No campaigns yet.</p>}
              {campaigns.map(c => {
                const logs = sendLogs[c.id] || [];
                const stats = {
                  sent: logs.filter(l => l.status === "sent").length,
                  failed: logs.filter(l => l.status === "failed").length,
                  skipped: logs.filter(l => l.status === "skipped_opt_out").length,
                };
                const isExpanded = expandedLog === c.id;
                return (
                  <div key={c.id} className="border border-white/10 rounded-lg p-3 bg-[#0a1628]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-semibold text-white">{c.name}</div>
                        <div className="text-xs text-white/50 mt-0.5">
                          {c.target_segment} · {new Date(c.created_at).toLocaleDateString()}
                        </div>
                        {c.last_error && (
                          <div className="text-[11px] text-red-300 mt-1">⚠️ {c.last_error}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={STATUS_BADGE[c.status] || STATUS_BADGE.draft}>{c.status}</Badge>
                        <span className="text-xs text-white/60">{c.total_sent || 0} sent · ${(c.total_cost || 0).toFixed(2)}</span>
                        <Button size="sm" variant="outline" onClick={() => diagnose(c.id)} disabled={diagnosing === c.id}
                          className="text-xs h-7">
                          🔍 {diagnosing === c.id ? "…" : "Diagnose"}
                        </Button>
                        {stats.failed > 0 && (
                          <Button size="sm" variant="outline" onClick={() => resendFailed(c.id)} disabled={resending === c.id}
                            className="text-xs h-7 border-amber-500/40 text-amber-300">
                            🔁 {resending === c.id ? "…" : `Resend ${stats.failed} Failed`}
                          </Button>
                        )}
                        {c.status === "draft" || c.status === "failed" ? (
                          <Button size="sm" onClick={() => sendCampaign(c.id)} disabled={sending === c.id}
                            className="bg-[#00d4ff] text-[#0a1628] font-bold text-xs h-7 hover:bg-[#00b8e0]">
                            {sending === c.id ? "…" : "📠 Send"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {logs.length > 0 && (
                      <button onClick={() => setExpandedLog(isExpanded ? null : c.id)}
                        className="mt-3 flex items-center gap-1 text-xs text-white/60 hover:text-white">
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Send Log ({logs.length}) — {stats.sent} sent · {stats.failed} failed · {stats.skipped} opt-out
                      </button>
                    )}

                    {isExpanded && logs.length > 0 && (
                      <div className="mt-3 max-h-72 overflow-y-auto border-t border-white/10 pt-2">
                        <table className="w-full text-[11px]">
                          <thead className="text-white/40 uppercase text-left">
                            <tr><th className="px-2 py-1">Business</th><th className="px-2 py-1">Fax</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Sinch ID / Error</th><th className="px-2 py-1">When</th></tr>
                          </thead>
                          <tbody>
                            {logs.map((l: any) => (
                              <tr key={l.id} className="border-t border-white/5">
                                <td className="px-2 py-1">{l.business_name}</td>
                                <td className="px-2 py-1 font-mono text-white/70">{l.fax_number}</td>
                                <td className="px-2 py-1"><Badge className={STATUS_BADGE[l.status] || "bg-white/10"}>{l.status}</Badge></td>
                                <td className="px-2 py-1 text-white/50 max-w-[260px] truncate">{l.phaxio_id || l.error_message || "—"}</td>
                                <td className="px-2 py-1 text-white/40">{l.sent_at ? new Date(l.sent_at).toLocaleString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Conversions ── */}
        <TabsContent value="conversions" className="space-y-4">
          <Card className="bg-[#0f1f35] border-white/10">
            <CardHeader>
              <CardTitle className="text-sm text-white/70 uppercase tracking-wide">Fax Landing Page Conversions</CardTitle>
            </CardHeader>
            <CardContent>
              {conversions.length === 0 && (
                <p className="text-white/40 text-center py-6">
                  No conversions yet. Once recipients visit the URL printed on the fax,
                  scans + signups will appear here.
                </p>
              )}
              {conversions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-xs uppercase text-white/40 text-left">
                      <tr>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Event</th>
                        <th className="px-3 py-2">Audience</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Email / Business</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((c: any) => (
                        <tr key={c.id} className="border-t border-white/5">
                          <td className="px-3 py-2 text-white/60 text-xs">{new Date(c.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{c.event}</Badge></td>
                          <td className="px-3 py-2 text-white/70">{c.audience_type || "—"}</td>
                          <td className="px-3 py-2 text-white/70">{c.product_key || "—"}</td>
                          <td className="px-3 py-2 text-white/60 text-xs">{c.email || c.business_name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
