/**
 * AdminPostcardCampaigns — DWA Admin tab
 * View scraped prospects, generate AI copy, preview postcards,
 * send via Lob, track conversions.
 *
 * HONESTY UPDATE 2026-04-20:
 * - Per-campaign Send Log panel (live Lob status per postcard)
 * - Diagnose button (dry-run: shows match counts + Lob API health)
 * - Resend Failed button (re-runs failed prospects from send_log)
 * - Live tracking stats: queued · in transit · delivered · returned · cost
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, RefreshCw, FileText, BarChart3, Users, MapPin, Stethoscope, ChevronDown, ChevronUp, Search, Eye } from "lucide-react";
import PostcardAssetDebugPanel from "./PostcardAssetDebugPanel";

type AudienceType = "healthcare-agency" | "trades-agency" | "nursing-home" | "contractor" | "supply-house";

const AUDIENCE_OPTIONS: { value: AudienceType; label: string; color: string }[] = [
  { value: "healthcare-agency", label: "Healthcare Staffing Agency", color: "text-emerald-400" },
  { value: "trades-agency", label: "Trades Staffing Agency", color: "text-blue-400" },
  { value: "nursing-home", label: "Nursing Home / Facility", color: "text-emerald-400" },
  { value: "contractor", label: "HVAC / Plumbing / Electrical", color: "text-blue-400" },
  { value: "supply-house", label: "Supply House / Distributor", color: "text-cyan-400" },
];

const COUNTIES = ["Wayne", "Oakland", "Macomb", "Kent", "Ingham", "Washtenaw", "Genesee", "Kalamazoo", "Grand Traverse", "Saginaw", "Muskegon"];

const STATUS_BADGE: Record<string, string> = {
  queued: "bg-gray-500/20 text-gray-300",
  rendered: "bg-gray-500/20 text-gray-300",
  processed: "bg-blue-500/20 text-blue-300",
  in_transit: "bg-amber-500/20 text-amber-300",
  delivered: "bg-emerald-500/20 text-emerald-400",
  returned: "bg-red-500/20 text-red-400",
  rerouted: "bg-orange-500/20 text-orange-300",
  failed: "bg-red-500/20 text-red-400",
};

export default function AdminPostcardCampaigns() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [sendLogs, setSendLogs] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [enrichingAddr, setEnrichingAddr] = useState(false);
  const [deepScraping, setDeepScraping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [selectedCounty, setSelectedCounty] = useState("Wayne");
  const [selectedAudience, setSelectedAudience] = useState<AudienceType>("healthcare-agency");
  const [finding, setFinding] = useState(false);
  const [previewAudience, setPreviewAudience] = useState<AudienceType>("healthcare-agency");
  const [previewCity, setPreviewCity] = useState("Metro Detroit");
  const [previewRecipient, setPreviewRecipient] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [p, c, cv, sl] = await Promise.all([
      supabase.from("postcard_prospects" as any).select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("postcard_campaigns" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("postcard_conversions" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("postcard_send_log" as any).select("*").order("sent_at", { ascending: false }).limit(2000),
    ]);
    setProspects((p.data as any[]) || []);
    setCampaigns((c.data as any[]) || []);
    setConversions((cv.data as any[]) || []);

    // Group send logs by campaign_id
    const grouped: Record<string, any[]> = {};
    ((sl.data as any[]) || []).forEach((row: any) => {
      const cid = row.campaign_id || "_unassigned";
      if (!grouped[cid]) grouped[cid] = [];
      grouped[cid].push(row);
    });
    setSendLogs(grouped);
    setLoading(false);
  };

  const runScraper = async () => {
    setScraping(true);
    toast.info("Running business scraper...");
    const { data, error } = await supabase.functions.invoke("lara-business-scraper");
    setScraping(false);
    if (error) { toast.error("Scraper failed: " + error.message); }
    else { toast.success(`${data?.new_prospects || 0} new prospects found`); loadData(); }
  };

  const enrichAddresses = async () => {
    setEnrichingAddr(true);
    toast.info("Enriching addresses for existing prospects...");
    const { data, error } = await supabase.functions.invoke("enrich-postcard-addresses", {
      body: { limit: 20 },
    });
    setEnrichingAddr(false);
    if (error) { toast.error("Enrichment failed: " + error.message); }
    else { toast.success(`${data?.enriched || 0}/${data?.total || 0} addresses found (${data?.hit_rate || "0%"})`); loadData(); }
  };

  const runDeepScraper = async () => {
    setDeepScraping(true);
    toast.info("Running LARA deep scrape (verified addresses only)...");
    const { data, error } = await supabase.functions.invoke("lara-accela-scraper", {
      body: { county: selectedCounty.toLowerCase() },
    });
    setDeepScraping(false);
    if (error) { toast.error("Deep scrape failed: " + error.message); }
    else { toast.success(`${data?.new_prospects || 0} new + ${data?.addresses_added_to_existing || 0} addresses added`); loadData(); }
  };

  const generateCopy = async () => {
    setGenerating(true);
    toast.info(`Generating ${selectedAudience} copy for ${selectedCounty} County...`);
    const { data, error } = await supabase.functions.invoke("generate-postcard-copy", {
      body: { county: selectedCounty, audience_type: selectedAudience },
    });
    setGenerating(false);
    if (error) { toast.error("Copy generation failed: " + error.message); }
    else { toast.success(`${data?.variants?.length || 1} copy variant(s) generated`); loadData(); }
  };

  const sendPostcards = async (campaignId: string) => {
    setSending(campaignId);
    toast.info("Sending postcards via Lob...");
    const { data, error } = await supabase.functions.invoke("send-postcards", {
      body: { campaign_id: campaignId },
    });
    setSending(null);
    if (error) {
      toast.error("Send failed: " + error.message);
    } else if (!data?.success) {
      toast.error(`❌ ${data?.error || "Zero postcards sent"}`);
    } else {
      toast.success(`✅ ${data?.sent || 0} sent · ${data?.failed || 0} failed`);
    }
    loadData();
  };

  const diagnose = async (campaignId: string) => {
    setDiagnosing(campaignId);
    const { data, error } = await supabase.functions.invoke("send-postcards", {
      body: { campaign_id: campaignId, dry_run: true },
    });
    setDiagnosing(null);
    if (error) { toast.error("Diagnose failed: " + error.message); return; }

    const lines = [
      `📍 ${data.campaign_county} County`,
      `   ${data.prospects_in_county} prospects total`,
      `   ✅ ${data.ready_to_mail} ready to mail`,
      `   ⚠️ ${data.no_address} have no address`,
      `   ✉️ ${data.already_sent} already sent`,
      ``,
      `🔑 Lob API: ${data.lob_api_ok ? "✅ Working" : "❌ FAILED"}`,
      data.lob_error ? `   Error: ${data.lob_error.substring(0, 120)}` : ``,
      ``,
      `💰 Month so far: ${data.month_sent_so_far} sent · ${data.month_remaining} remaining of cap`,
      `💸 If sent now: $${data.estimated_cost_if_sent}`,
    ].filter(Boolean).join("\n");

    toast.message("Diagnose result", { description: lines, duration: 30000 });
    console.log("[Diagnose]", data);
  };

  const resendFailed = async (campaignId: string) => {
    const failedRows = (sendLogs[campaignId] || []).filter((r: any) => r.status === "failed");
    if (!failedRows.length) { toast.info("No failed sends to resend"); return; }
    if (!confirm(`Resend ${failedRows.length} failed postcards? Cost: $${(failedRows.length * 0.85).toFixed(2)}`)) return;

    setResending(campaignId);
    const prospect_ids = failedRows.map((r: any) => r.prospect_id).filter(Boolean);
    const { data, error } = await supabase.functions.invoke("send-postcards", {
      body: { campaign_id: campaignId, prospect_ids },
    });
    setResending(null);
    if (error) { toast.error("Resend failed: " + error.message); }
    else { toast.success(`Resend: ${data?.sent || 0} sent · ${data?.failed || 0} failed`); loadData(); }
  };

  // Map UI audience → scraper audience_type so we can search prospects right inside this tab.
  const SCRAPER_AUDIENCE: Record<AudienceType, string> = {
    "healthcare-agency": "healthcare_staffing",
    "trades-agency":     "trades_staffing",
    "nursing-home":      "nursing_home",
    "contractor":        "trades_staffing",
    "supply-house":      "supply_house",
  };

  const findProspects = async () => {
    setFinding(true);
    toast.info(`Searching for ${selectedAudience} in ${selectedCounty} County...`);
    const { data, error } = await supabase.functions.invoke("targeting-prospect-scraper", {
      body: {
        audience_type: SCRAPER_AUDIENCE[selectedAudience],
        county: selectedCounty,
        limit: 50,
        mode: "postcard",
      },
    });
    setFinding(false);
    if (error) { toast.error("Search failed: " + error.message); return; }
    toast.success(`Found ${data?.found || 0} · Added ${data?.postcard_prospects_added || 0} new postcard-ready prospects`);
    loadData();
  };

  // Shared preview HTML — kept visually close to what Lob mails.
  // ONE QR code → /postcard?audience=...&utm_campaign=preview
  const previewHTML = useMemo(() => {
    const variant = AUDIENCE_OPTIONS.find(a => a.value === previewAudience)!;
    const accent = previewAudience === "supply-house" ? "#06b6d4" : previewAudience.includes("healthcare") || previewAudience === "nursing-home" ? "#10b981" : "#3b82f6";
    const offer = previewAudience === "supply-house" ? "FREE MONTH — DEMAND RADAR" : "FREE 10 NAMES";
    const headline = previewAudience === "supply-house" ? "Know Who's Buying" : previewAudience === "nursing-home" ? "Struggling to Find Nurses?" : variant.label.includes("Healthcare") ? "We Find Licensed Nurses" : "We Find Licensed Techs";
    const sub = previewAudience === "supply-house" ? "Before They Call" : previewAudience === "nursing-home" ? "We Find Them First." : "Before Anyone Else";
    const qrUrl = `https://detroitwebagent.com/postcard?audience=${previewAudience}&utm_campaign=preview&city=${previewCity.toLowerCase().replace(/\s+/g, "-")}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrUrl)}`;
    const secondary = previewAudience === "supply-house"
      ? [["🔧","Talent Radar — Trades"],["🛠️","FieldDesk"],["📞","Missed Call Catch"]]
      : previewAudience.includes("healthcare") || previewAudience === "nursing-home"
        ? [["🔧","Talent Radar — Trades"],["🛠️","FieldDesk"],["📞","Missed Call Catch"]]
        : [["🏥","Talent Radar — Healthcare"],["🛠️","FieldDesk"],["📞","Missed Call Catch"]];

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',system-ui,sans-serif;background:#1a1a1a;padding:20px;}
.card{width:6.25in;height:4.25in;background:#0d1117;color:#e6edf3;display:flex;overflow:hidden;border-radius:4px;}
</style></head><body>
<div class="card">
  <div style="flex:1;padding:0.5in 0.45in 0.4in;display:flex;flex-direction:column;justify-content:space-between;">
    <div>
      <div style="font-size:7px;color:#484f58;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:4px;">${previewCity.toUpperCase()}</div>
      ${previewRecipient ? `<div style="font-size:8px;color:#484f58;margin-bottom:6px;">For: ${previewRecipient}</div>` : ""}
      <div style="font-size:22px;font-weight:900;line-height:1.15;letter-spacing:-0.5px;margin-bottom:10px;">${headline}<br><span style="color:${accent};">${sub}</span></div>
      <div style="font-size:9.5px;color:#8b949e;line-height:1.55;margin-bottom:12px;">We invented a way to surface the people and signals your competitors miss. Verified. Free to try. No card.</div>
      <div style="display:inline-block;background:${accent}15;border:1.5px solid ${accent}40;color:${accent};font-size:9px;font-weight:800;padding:5px 12px;border-radius:4px;letter-spacing:0.5px;">${offer}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:8px 10px;">
      <img src="https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/6z5o71kv_19405.jpg" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1.5px solid #30363d;" alt="Matt">
      <div style="font-size:8.5px;color:#8b949e;line-height:1.4;">
        <strong style="color:#e6edf3;font-size:9px;">Matt Michels</strong> — Founder<br>
        Don't believe it works? Text me.<br>
        I'll call you personally and prove it.<br>
        <span style="color:${accent};font-weight:700;font-size:10px;">(313) 992-1219</span>
      </div>
    </div>
  </div>
  <div style="width:1.9in;background:#161b22;border-left:3px solid ${accent};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.3in 0.18in;gap:8px;">
    <img src="https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/1dhqg3eh_25239.png" style="width:48px;height:48px;border-radius:50%;border:1.5px solid #30363d;" alt="DWA">
    <div style="font-size:8px;color:#8b949e;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Scan to claim</div>
    <img src="${qrImg}" width="118" height="118" style="border-radius:8px;border:2px solid #30363d;" alt="QR">
    <div style="font-size:9.5px;color:${accent};font-weight:800;text-align:center;line-height:1.1;">${offer.includes("MONTH") ? "FREE MONTH" : "FREE 10 NAMES"}</div>
    <div style="width:100%;border-top:1px dashed #30363d;padding-top:6px;display:flex;flex-direction:column;gap:3px;">
      <div style="font-size:6.5px;color:#484f58;text-transform:uppercase;letter-spacing:0.8px;text-align:center;font-weight:700;margin-bottom:2px;">+ 3 More Free Tools</div>
      ${secondary.map(s => `<div style="display:flex;align-items:center;gap:5px;font-size:7.5px;color:#8b949e;line-height:1.2;"><span style="font-size:9px;">${s[0]}</span><span>${s[1]}</span></div>`).join("")}
    </div>
    <div style="font-size:6.5px;color:#484f58;text-align:center;">detroitwebagent.com</div>
  </div>
</div>
</body></html>`;
  }, [previewAudience, previewCity, previewRecipient]);

  const totalSent = campaigns.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0);
  const totalDelivered = campaigns.reduce((sum: number, c: any) => sum + (c.delivered_count || 0), 0);
  const totalCost = campaigns.reduce((sum: number, c: any) => sum + (c.total_cost_cents || 0), 0) / 100;
  const totalConversions = conversions.filter((c: any) => c.event === "paid").length;
  const prospectsByCounty = (county: string) => prospects.filter((p: any) => p.county?.toLowerCase() === county.toLowerCase());
  const unsentByCounty = (county: string) => prospects.filter((p: any) => p.county?.toLowerCase() === county.toLowerCase() && !p.postcard_sent_at && p.address_line1);
  // Filter prospects by BOTH county and the campaign's audience_type so the
  // recipient count matches what send-postcards will actually mail.
  const unsentForCampaign = (c: any) => prospects.filter((p: any) =>
    p.county?.toLowerCase() === (c.county || "").toLowerCase()
    && !p.postcard_sent_at
    && p.address_line1
    && (!c.audience_type || p.audience_type === c.audience_type)
  );

  // Auto-flag obvious copy/audience mismatches before mailing wrong businesses.
  // Healthcare/nursing campaigns must NOT contain trades terms (and vice versa).
  const TRADES_TERMS = /\b(HVAC|plumbing|plumber|electrical|electrician|tradespeople|tradesmen|boiler|roofing|roofer)\b/i;
  const HEALTHCARE_TERMS = /\b(nurse|nurses|nursing|CNA|LPN|RN|caregiver|home health|assisted living)\b/i;
  const detectCopyMismatch = (c: any): string | null => {
    if (!c.audience_type || !c.copy_front) return null;
    const text = `${c.copy_front} ${c.copy_back || ""}`;
    const isHealthcare = ["nursing-home", "healthcare-agency"].includes(c.audience_type);
    const isTrades = ["contractor", "trades-agency"].includes(c.audience_type);
    if (isHealthcare && TRADES_TERMS.test(text)) return "Copy mentions trades (HVAC/plumbing/etc.) but audience is healthcare — regenerate.";
    if (isTrades && HEALTHCARE_TERMS.test(text)) return "Copy mentions nursing/healthcare but audience is trades — regenerate.";
    return null;
  };

  // Group campaigns by audience for the new grouped layout.
  const AUDIENCE_GROUPS: { key: AudienceType; emoji: string; label: string }[] = [
    { key: "nursing-home",       emoji: "🏥", label: "Nursing Homes" },
    { key: "healthcare-agency",  emoji: "🩺", label: "Healthcare Staffing" },
    { key: "contractor",         emoji: "🔧", label: "Trades (HVAC / Plumbing / Electrical)" },
    { key: "trades-agency",      emoji: "🛠️", label: "Trades Staffing" },
    { key: "supply-house",       emoji: "📦", label: "Supply Houses" },
  ];
  const audienceLabel = (a?: string) => AUDIENCE_OPTIONS.find(o => o.value === a)?.label || a || "Unspecified";

  const regenerateCopy = async (campaignId: string, audience: string, county: string) => {
    if (!audience) { toast.error("Campaign has no audience_type — cannot regenerate"); return; }
    setGenerating(true);
    toast.info(`Regenerating ${audience} copy for ${county}...`);
    const { data, error } = await supabase.functions.invoke("generate-postcard-copy", {
      body: { county, audience_type: audience, replace_campaign_id: campaignId },
    });
    setGenerating(false);
    if (error) { toast.error("Regenerate failed: " + error.message); return; }
    // The edge function inserts new variants; copy the first variant's text into THIS draft.
    const newCopy = data?.variants?.[0];
    if (newCopy?.copy_front) {
      const { error: upErr } = await supabase
        .from("postcard_campaigns" as any)
        .update({ copy_front: newCopy.copy_front, copy_back: newCopy.copy_back, last_error: null })
        .eq("id", campaignId);
      if (upErr) toast.error("Saved variants but failed to update draft: " + upErr.message);
      else toast.success("✅ Copy regenerated for this draft");
    } else {
      toast.message("New variants generated — pick one from the list");
    }
    loadData();
  };

  const campaignStats = (campaignId: string) => {
    const logs = sendLogs[campaignId] || [];
    return {
      total: logs.length,
      queued: logs.filter((r: any) => ["queued", "rendered", "processed"].includes(r.delivery_status)).length,
      inTransit: logs.filter((r: any) => r.delivery_status === "in_transit").length,
      delivered: logs.filter((r: any) => r.delivery_status === "delivered").length,
      returned: logs.filter((r: any) => r.delivery_status === "returned").length,
      failed: logs.filter((r: any) => r.status === "failed").length,
      cost: logs.reduce((s: number, r: any) => s + (r.cost_cents || 0), 0) / 100,
    };
  };
  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-[#00d4ff]" />
            <div>
              <div className="text-2xl font-bold text-white">{prospects.length}</div>
              <div className="text-[10px] text-gray-400 uppercase">Prospects</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="h-5 w-5 text-orange-400" />
            <div>
              <div className="text-2xl font-bold text-white">{totalSent}</div>
              <div className="text-[10px] text-gray-400 uppercase">Sent via Lob</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="text-2xl font-bold text-white">{totalDelivered}</div>
              <div className="text-[10px] text-gray-400 uppercase">Delivered</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            <div>
              <div className="text-2xl font-bold text-white">{totalConversions}</div>
              <div className="text-[10px] text-gray-400 uppercase">Paid Conversions</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-amber-400" />
            <div>
              <div className="text-2xl font-bold text-white">${totalCost.toFixed(2)}</div>
              <div className="text-[10px] text-gray-400 uppercase">Spent on Lob</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide font-semibold block mb-1">Audience Type</label>
            <select value={selectedAudience} onChange={e => setSelectedAudience(e.target.value as AudienceType)} className="px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-white text-sm min-w-[200px]">
              {AUDIENCE_OPTIONS.map(a => <option key={a.value} value={a.value} className="bg-gray-900">{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide font-semibold block mb-1">County</label>
            <select value={selectedCounty} onChange={e => setSelectedCounty(e.target.value)} className="px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-white text-sm">
              {COUNTIES.map(c => <option key={c} value={c} className="bg-gray-900">{c} County</option>)}
            </select>
          </div>
          <Button onClick={runScraper} disabled={scraping} size="sm" className="bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30">
            <RefreshCw className={`w-3 h-3 mr-1 ${scraping ? "animate-spin" : ""}`} /> {scraping ? "Scraping..." : "Run Scraper"}
          </Button>
          <Button onClick={runDeepScraper} disabled={deepScraping} size="sm" className="bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30">
            <RefreshCw className={`w-3 h-3 mr-1 ${deepScraping ? "animate-spin" : ""}`} /> {deepScraping ? "Deep scraping..." : "Deep Scrape"}
          </Button>
          <Button onClick={enrichAddresses} disabled={enrichingAddr} size="sm" className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30">
            <MapPin className={`w-3 h-3 mr-1 ${enrichingAddr ? "animate-pulse" : ""}`} /> {enrichingAddr ? "Enriching..." : "Enrich Addresses"}
          </Button>
          <Button onClick={generateCopy} disabled={generating} size="sm" className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
            <FileText className="w-3 h-3 mr-1" /> {generating ? "Generating..." : "Generate Copy"}
          </Button>
        </div>
        <p className="text-white/20 text-[10px]">
          {prospects.filter((p: any) => p.address_line1).length}/{prospects.length} have addresses
          &middot; {unsentByCounty(selectedCounty).length} ready in {selectedCounty} County
        </p>
      </div>

      <Tabs defaultValue="find" className="w-full">
        <TabsList className="bg-white/5 flex-wrap h-auto">
          <TabsTrigger value="find">🎯 Find Prospects</TabsTrigger>
          <TabsTrigger value="prospects">📋 Prospects ({prospects.length})</TabsTrigger>
          <TabsTrigger value="campaigns">📮 Campaigns ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="preview">🖨️ Print Preview</TabsTrigger>
          <TabsTrigger value="conversions">📊 Conversions ({conversions.length})</TabsTrigger>
        </TabsList>

        {/* Find Prospects Tab — search any audience + county, write to postcard_prospects */}
        <TabsContent value="find">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base mb-1">Search for postcard prospects</h3>
                <p className="text-white/50 text-xs">Pick an audience + county above. Results get scored, deduped, and added to <code className="text-cyan-400">postcard_prospects</code> ready for a campaign.</p>
              </div>
              <div className="bg-black/30 border border-white/5 rounded p-3 text-xs text-white/70">
                <div><strong className="text-white">Audience:</strong> {AUDIENCE_OPTIONS.find(a => a.value === selectedAudience)?.label}</div>
                <div><strong className="text-white">County:</strong> {selectedCounty}</div>
                <div><strong className="text-white">Source:</strong> {SCRAPER_AUDIENCE[selectedAudience]} (CMS / NPI / Sonar)</div>
              </div>
              <Button onClick={findProspects} disabled={finding} className="bg-cyan-500 text-[#0a1628] hover:bg-cyan-400 font-bold">
                <Search className={`w-4 h-4 mr-2 ${finding ? "animate-pulse" : ""}`} />
                {finding ? "Searching..." : `Find ${AUDIENCE_OPTIONS.find(a => a.value === selectedAudience)?.label} in ${selectedCounty} County`}
              </Button>
              <div className="text-[11px] text-white/40">
                💡 Use <strong>supply-house</strong> to surface distributors for Demand Radar mailings.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Print Preview Tab — visual QA before live Lob send */}
        <TabsContent value="preview">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wide block mb-1">Audience</label>
                  <select value={previewAudience} onChange={e => setPreviewAudience(e.target.value as AudienceType)} className="w-full bg-[#161b22] border border-[#30363d] text-white text-sm rounded px-3 py-2">
                    {AUDIENCE_OPTIONS.map(a => <option key={a.value} value={a.value} className="bg-gray-900">{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wide block mb-1">City</label>
                  <Input value={previewCity} onChange={e => setPreviewCity(e.target.value)} className="bg-[#161b22] border-[#30363d] text-white text-sm" />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wide block mb-1">Recipient (optional)</label>
                  <Input value={previewRecipient} onChange={e => setPreviewRecipient(e.target.value)} placeholder="Acme Staffing" className="bg-[#161b22] border-[#30363d] text-white text-sm" />
                </div>
              </div>
              <div className="text-[11px] text-white/40">
                <Eye className="w-3 h-3 inline mr-1" /> Preview only — does not send. Live sends from the <strong>Campaigns</strong> tab use the same template.
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-4 overflow-auto">
                <iframe srcDoc={previewHTML} style={{ width: "6.5in", height: "4.5in", border: "none" }} title="Postcard preview" />
              </div>
            </CardContent>
          </Card>

          {/* Asset debug + actual-mail preview — single source of truth */}
          <div className="mt-4">
            <PostcardAssetDebugPanel
              audience={previewAudience}
              city={previewCity}
              recipient={previewRecipient}
            />
          </div>
        </TabsContent>

        {/* Campaigns Tab — now with Send Log + Diagnose + Resend */}
        <TabsContent value="campaigns">
          <div className="space-y-3">
            {campaigns.map((c: any) => {
              const stats = campaignStats(c.id);
              const logs = sendLogs[c.id] || [];
              const isExpanded = expandedLog === c.id;
              const recipientCount = unsentByCounty(c.county || selectedCounty).length;
              const estCost = (recipientCount * 0.85).toFixed(2);

              return (
                <Card key={c.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-[#00d4ff]/20 text-[#00d4ff] text-xs">{c.county} County</Badge>
                        {c.audience_type && <Badge variant="outline" className="text-xs">{c.audience_type}</Badge>}
                        <Badge variant="outline" className={`text-xs ${
                          c.status === "mailed" ? "border-emerald-500 text-emerald-400" :
                          c.status === "failed" ? "border-red-500 text-red-400" :
                          "border-white/20"
                        }`}>{c.status}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => diagnose(c.id)} disabled={diagnosing === c.id} className="text-xs h-7">
                          🔍 {diagnosing === c.id ? "Checking..." : "Diagnose"}
                        </Button>
                        {stats.failed > 0 && (
                          <Button size="sm" variant="outline" onClick={() => resendFailed(c.id)} disabled={resending === c.id} className="text-xs h-7 border-amber-500/40 text-amber-300">
                            🔁 {resending === c.id ? "Resending..." : `Resend ${stats.failed} Failed`}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Honest stat strip */}
                    {stats.total > 0 && (
                      <div className="flex flex-wrap gap-3 text-[11px] mb-3 bg-black/30 rounded-md p-2.5 border border-white/5">
                        <span className="text-gray-400">Sent: <strong className="text-white">{stats.total}</strong></span>
                        <span className="text-gray-400">Queued: <strong className="text-gray-200">{stats.queued}</strong></span>
                        <span className="text-amber-300">In transit: <strong>{stats.inTransit}</strong></span>
                        <span className="text-emerald-400">Delivered: <strong>{stats.delivered}</strong></span>
                        <span className="text-red-400">Returned: <strong>{stats.returned}</strong></span>
                        {stats.failed > 0 && <span className="text-red-400">Failed: <strong>{stats.failed}</strong></span>}
                        <span className="text-gray-400 ml-auto">Cost: <strong className="text-amber-300">${stats.cost.toFixed(2)}</strong></span>
                      </div>
                    )}

                    {c.last_error && (
                      <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2 mb-2">
                        ❌ Last error: {c.last_error}
                      </div>
                    )}

                    {c.copy_front && (
                      <div className="mb-2">
                        <span className="text-[10px] text-white/30 uppercase">Front: </span>
                        <span className="text-sm text-white/70">{c.copy_front}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mb-3">QR → {c.qr_url}</div>

                    {c.status === "draft" && (
                      <div className="space-y-2 mb-3">
                        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                          💰 Will mail to <strong>{recipientCount}</strong> {recipientCount === 1 ? "address" : "addresses"} at $0.85 each = <strong>${estCost}</strong>
                          <div className="text-[10px] text-amber-200/70 mt-1">Tip: Click Diagnose first to verify Lob API + match counts before sending.</div>
                        </div>
                        <Button size="sm" onClick={() => sendPostcards(c.id)} disabled={sending === c.id || recipientCount === 0} className="bg-emerald-500 text-white hover:bg-emerald-600">
                          <Send className="w-3 h-3 mr-1" /> {sending === c.id ? "Sending..." : `Confirm & Send $${estCost}`}
                        </Button>
                      </div>
                    )}

                    {/* Send Log expandable panel */}
                    {logs.length > 0 && (
                      <div className="mt-3 border-t border-white/5 pt-3">
                        <button
                          onClick={() => setExpandedLog(isExpanded ? null : c.id)}
                          className="flex items-center gap-1 text-xs text-[#00d4ff] hover:text-cyan-300 font-semibold uppercase tracking-wide"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Send Log ({logs.length})
                        </button>
                        {isExpanded && (
                          <div className="mt-2 max-h-72 overflow-y-auto">
                            <table className="w-full text-[11px]">
                              <thead className="sticky top-0 bg-[#0a1628]">
                                <tr className="text-gray-500 text-left">
                                  <th className="p-1.5">Business</th>
                                  <th className="p-1.5">City</th>
                                  <th className="p-1.5">Lob ID</th>
                                  <th className="p-1.5">Status</th>
                                  <th className="p-1.5">Sent</th>
                                  <th className="p-1.5">Delivered</th>
                                  <th className="p-1.5 text-right">Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {logs.map((r: any) => (
                                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                                    <td className="p-1.5 text-white/80 truncate max-w-[140px]">{r.business_name || "—"}</td>
                                    <td className="p-1.5 text-gray-400">{r.city || "—"}</td>
                                    <td className="p-1.5">
                                      {r.lob_id ? (
                                        <a href={`https://dashboard.lob.com/postcards/${r.lob_id}`} target="_blank" rel="noopener" className="text-[#00d4ff] hover:underline font-mono text-[10px]">
                                          {r.lob_id.substring(0, 14)}…
                                        </a>
                                      ) : <span className="text-gray-600 text-[10px]">—</span>}
                                    </td>
                                    <td className="p-1.5">
                                      <Badge className={`text-[10px] ${STATUS_BADGE[r.delivery_status] || STATUS_BADGE[r.status] || "bg-gray-500/20 text-gray-300"}`}>
                                        {r.status === "failed" ? "failed" : (r.delivery_status || "queued")}
                                      </Badge>
                                    </td>
                                    <td className="p-1.5 text-gray-400 text-[10px]">{r.sent_at ? new Date(r.sent_at).toLocaleDateString() : "—"}</td>
                                    <td className="p-1.5 text-gray-400 text-[10px]">{r.delivered_at ? new Date(r.delivered_at).toLocaleDateString() : "—"}</td>
                                    <td className="p-1.5 text-right text-amber-300">${((r.cost_cents || 0) / 100).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {campaigns.length === 0 && (
              <p className="text-gray-500 text-center py-8">No campaigns yet. Select audience + county and generate copy.</p>
            )}
          </div>
        </TabsContent>

        {/* Prospects Tab */}
        <TabsContent value="prospects">
          <div className="space-y-2">
            {COUNTIES.map(county => {
              const cp = prospectsByCounty(county);
              const unsent = unsentByCounty(county);
              if (cp.length === 0) return null;
              return (
                <Card key={county} className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex justify-between items-center">
                      <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#00d4ff]" /> {county} County</span>
                      <span className="text-xs text-gray-400">{cp.length} total &middot; <span className="text-emerald-400">{unsent.length} ready</span></span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left p-1">Business</th>
                          <th className="text-left p-1">City</th>
                          <th className="text-left p-1">License</th>
                          <th className="text-left p-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cp.slice(0, 30).map((p: any) => (
                          <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                            <td className="p-1 font-medium text-white/80">{p.business_name}</td>
                            <td className="p-1 text-gray-400">{p.city || "—"}</td>
                            <td className="p-1 text-gray-400">{(p.license_types || []).join(", ") || "—"}</td>
                            <td className="p-1">
                              {p.postcard_sent_at ? (
                                <Badge variant="secondary" className="text-[10px] bg-emerald-500/20 text-emerald-400">Sent</Badge>
                              ) : p.address_line1 ? (
                                <Badge variant="outline" className="text-[10px] border-green-500 text-green-400">Ready</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-400">No Address</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              );
            })}
            {prospects.length === 0 && (
              <p className="text-gray-500 text-center py-8">No prospects yet. Run the scraper to find businesses.</p>
            )}
          </div>
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions">
          <div className="space-y-2">
            {conversions.map((cv: any) => (
              <div key={cv.id} className="flex justify-between items-center bg-white/5 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className={
                    cv.event === "paid" ? "bg-green-500/20 text-green-400" :
                    cv.event === "trial_signup" ? "bg-cyan-500/20 text-cyan-400" :
                    cv.event === "checkout_started" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-blue-500/20 text-blue-400"
                  }>
                    {cv.event === "paid" ? "Paid" : cv.event === "trial_signup" ? "Trial" : cv.event === "checkout_started" ? "Checkout" : "QR Scan"}
                  </Badge>
                  <span className="text-gray-400">{cv.county || "—"} {cv.county ? "County" : ""}</span>
                  {cv.email && <span className="text-gray-500 text-xs">{cv.email}</span>}
                </div>
                <span className="text-xs text-gray-500">{new Date(cv.created_at).toLocaleString()}</span>
              </div>
            ))}
            {conversions.length === 0 && (
              <p className="text-gray-500 text-center py-8">No conversions yet. Send postcards first.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
