// AdminScannerHub — single-pane view of every scanner & enrichment function.
// Shows last run, 24h yield, source list, and a manual "Run now" trigger.
// Lets you instantly see which scanner is broken or starved for sources.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type ScannerDef = {
  fn: string;
  label: string;
  category: "Trade Radar" | "Mortgage" | "TechAlert" | "Contractor" | "Marketplace" | "Misc";
  sources: string[];
  table?: string;        // table to count rows from for yield
  recentColumn?: string; // timestamp column (default created_at)
  cron?: string;
};

const SCANNERS: ScannerDef[] = [
  // Trade Radar (11 verticals — single function, vertical param)
  ...["roofing","hvac","plumbing","electrical","pest_control","gutters","exterior","tree","restoration","demo_junk","foundation"].map((v) => ({
    fn: "trade-radar-scanner",
    label: `Trade Radar — ${v}`,
    category: "Trade Radar" as const,
    sources: ["BSEED permits","Detroit ArcGIS","NOAA storm","FEMA","Zillow FSBO","CFPB HMDA","SeeClickFix","Drought Monitor","Census ACS","Wayne+Oakland GIS"],
    table: "trade_radar_leads",
    cron: "8am ET daily",
  })),
  // Mortgage Radar
  { fn: "mortgage-radar-scanner", label: "Mortgage Radar Scanner", category: "Mortgage",
    sources: ["BSEED permits","SOS filings","FSBO listings","Probate filings","FEMA HMGP","CourtListener Ch.13","DLBA","Assessor sales","Realtor.com price drops","Wayne+Oakland deeds"],
    table: "mortgage_radar_leads", cron: "8am ET daily" },
  { fn: "mortgage-radar-enrich", label: "Mortgage Radar Enrich", category: "Mortgage",
    sources: ["Sonar AI","PDL Person Search","Hunter (waterfall)"],
    table: "mortgage_radar_leads" },
  // TechAlert
  { fn: "techalert-prospect-hunter", label: "TechAlert Prospect Hunter", category: "TechAlert",
    sources: ["Sonar (job boards)","GitHub","SEC EDGAR","USPTO","SAM.gov","BLS","Eventbrite","USASpending","LinkedIn","OSHA","LARA","NLRB","CFPB","CourtListener Ch.7","Detroit Certified Contractors","Open Trade Biz","City Contracts","Multifamily Construction","LARA Expirations","Demo Contractors","One Billion Dollar"],
    table: "techalert_prospect_targets", cron: "6am ET daily" },
  { fn: "techalert-enrich", label: "TechAlert Enrich (gold standard)", category: "TechAlert",
    sources: ["Apollo Org","Apollo People","Google Places","10-stage email waterfall","Aggregator scrub","Enterprise blocklist"],
    table: "techalert_prospect_targets", cron: "7am ET daily" },
  // Contractor
  { fn: "contractor-prospector", label: "Contractor Prospector", category: "Contractor",
    sources: ["Google Places","DataForSEO Local Pack","prospector_targets registry"],
    table: "contractor_outreach_prospects" },
  { fn: "channel-prospector", label: "Channel Prospector (Fax/Postcard/SMS)", category: "Contractor",
    sources: ["Google Places","DataForSEO","prospector_targets"],
    table: "outreach_leads" },
  { fn: "contractor-outreach-enrich", label: "Contractor Outreach Enrich", category: "Contractor",
    sources: ["Hunter","Apollo Org Enrich","Apollo Org Search","Apollo People","Google Places","Firecrawl","Pattern guess"],
    table: "contractor_outreach_prospects" },
  { fn: "contractor-outreach-enrich-backfill", label: "Contractor Enrich Backfill", category: "Contractor",
    sources: ["DLQ retries (7-day age-out)"],
    table: "enrichment_dead_letter" },
  { fn: "outreach-leads-enrich", label: "Outreach Leads Enrich", category: "Contractor",
    sources: ["Apollo","Hunter","Firecrawl","Google Places","Aggregator scrub"],
    table: "outreach_leads", cron: "11am ET daily" },
  { fn: "dwa-v4-roofing-enrich", label: "Roofing Prospect Enrich", category: "Contractor",
    sources: ["Apollo","Google Places","Hunter","Firecrawl"],
    table: "roofing_prospects" },
  // Marketplace
  { fn: "marketplace-lead-equity-enrich", label: "Marketplace Equity Enrich", category: "Marketplace",
    sources: ["Zillow","Realtor.com","County assessor"],
    table: "marketplace_prospects" },
  { fn: "marketplace-lead-free-enrich", label: "Marketplace Free Enrich", category: "Marketplace",
    sources: ["Public records","FSBO scrape"],
    table: "marketplace_prospects" },
  { fn: "marketplace-lead-gov-enrich", label: "Marketplace Gov Enrich", category: "Marketplace",
    sources: ["FEMA","HUD","USPS"],
    table: "marketplace_prospects" },
  { fn: "find-lo-prospects", label: "LO Prospect Hunter", category: "Marketplace",
    sources: ["Apollo (mixed people)","MI MLO seed list"],
    table: "marketplace_prospects" },
  // Misc / radars
  { fn: "hire-alert-scanner", label: "Hire Alert Scanner", category: "Misc",
    sources: ["Job boards"], table: "hire_alert_candidates" },
  { fn: "lara-fast-scanner", label: "LARA Fast Scanner", category: "Misc",
    sources: ["LARA license API"] },
  { fn: "accela-permit-scanner", label: "Accela Permit Scanner", category: "Misc",
    sources: ["Accela permit feeds"] },
  { fn: "permit-watch-scanner", label: "Permit Watch", category: "Misc",
    sources: ["BSEED","Wayne County","Oakland County"] },
  { fn: "new-business-radar", label: "New Business Radar", category: "Misc",
    sources: ["LARA new LLC filings"] },
  { fn: "demand-radar-enhanced-scan", label: "Demand Radar", category: "Misc",
    sources: ["Industry signal feeds"] },
  { fn: "growth-radar-enhanced-scan", label: "Growth Radar", category: "Misc",
    sources: ["Funding + hiring signals"] },
];

type Heartbeat = {
  agent_name: string;
  last_beat: string;
  status: string | null;
  metadata: any;
};

export default function AdminScannerHub() {
  const [hbs, setHbs] = useState<Record<string, Heartbeat>>({});
  const [yields, setYields] = useState<Record<string, number>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const fns = Array.from(new Set(SCANNERS.map((s) => s.fn)));
    const tables = Array.from(new Set(SCANNERS.map((s) => s.table).filter(Boolean) as string[]));

    const { data: hbData } = await supabase
      .from("agent_heartbeats" as any)
      .select("agent_name, last_beat, status, metadata")
      .in("agent_name", fns);

    const map: Record<string, Heartbeat> = {};
    (hbData ?? []).forEach((h: any) => { map[h.agent_name] = h; });
    setHbs(map);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const yieldMap: Record<string, number> = {};
    await Promise.all(tables.map(async (t) => {
      const { count } = await (supabase.from(t as any) as any)
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      yieldMap[t] = count ?? 0;
    }));
    setYields(yieldMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function run(fn: string) {
    setRunning(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: {} });
      if (error) throw error;
      toast.success(`${fn}: ${JSON.stringify(data).slice(0, 120)}`);
      load();
    } catch (e: any) {
      toast.error(`${fn} failed: ${e?.message ?? e}`);
    } finally {
      setRunning(null);
    }
  }

  const filtered = useMemo(
    () => SCANNERS.filter((s) =>
      !filter ||
      s.label.toLowerCase().includes(filter.toLowerCase()) ||
      s.fn.toLowerCase().includes(filter.toLowerCase()) ||
      s.sources.join(" ").toLowerCase().includes(filter.toLowerCase())),
    [filter],
  );

  const byCategory = useMemo(() => {
    const out: Record<string, ScannerDef[]> = {};
    filtered.forEach((s) => {
      out[s.category] = out[s.category] || [];
      out[s.category].push(s);
    });
    return out;
  }, [filtered]);

  function badge(s: ScannerDef): { color: string; label: string } {
    const hb = hbs[s.fn];
    if (!hb) return { color: "bg-zinc-700 text-zinc-300", label: "no run logged" };
    const ageHr = (Date.now() - new Date(hb.last_beat).getTime()) / 3_600_000;
    const yld = s.table ? (yields[s.table] ?? 0) : -1;
    if (ageHr > 48) return { color: "bg-red-700 text-white", label: `stale ${ageHr.toFixed(0)}h` };
    if (s.table && yld === 0 && ageHr > 24) return { color: "bg-amber-700 text-white", label: "0 yield 24h" };
    return { color: "bg-emerald-700 text-white", label: "healthy" };
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/dwa-admin" className="flex items-center gap-2 text-cyan-400 hover:underline">
            <ArrowLeft size={16} /> Back to DWA Admin
          </Link>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Refresh
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-black">Scanner & Enrichment Hub</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Single pane for every search/scanner/enrichment function. Yields are 24h row counts on the
            target table; "no run logged" means the heartbeat never fired (function is dead or unscheduled).
          </p>
        </div>

        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, function, or source"
          className="bg-zinc-900 border-zinc-700 max-w-md"
        />

        {Object.entries(byCategory).map(([cat, items]) => (
          <Card key={cat} className="bg-zinc-900 border-zinc-800 p-4">
            <h2 className="text-lg font-bold mb-3">{cat} <span className="text-xs text-zinc-500">({items.length})</span></h2>
            <div className="space-y-2">
              {items.map((s) => {
                const hb = hbs[s.fn];
                const yld = s.table ? (yields[s.table] ?? 0) : null;
                const b = badge(s);
                return (
                  <div key={`${s.fn}-${s.label}`} className="grid grid-cols-12 gap-3 items-start bg-zinc-950 border border-zinc-800 rounded p-3 text-xs">
                    <div className="col-span-3">
                      <div className="font-bold text-white">{s.label}</div>
                      <div className="text-cyan-400 font-mono text-[10px]">{s.fn}</div>
                      {s.cron && <div className="text-zinc-500 text-[10px] mt-0.5">⏱ {s.cron}</div>}
                    </div>
                    <div className="col-span-2">
                      <Badge className={`${b.color} text-[10px]`}>
                        {b.label.includes("healthy") ? <CheckCircle2 size={10} className="mr-1" /> : <AlertTriangle size={10} className="mr-1" />}
                        {b.label}
                      </Badge>
                      {hb && (
                        <div className="text-zinc-500 text-[10px] mt-1">
                          {new Date(hb.last_beat).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="col-span-1 text-center">
                      {yld !== null && (
                        <>
                          <div className="text-2xl font-black text-cyan-400">{yld}</div>
                          <div className="text-[9px] text-zinc-500">rows / 24h</div>
                        </>
                      )}
                    </div>
                    <div className="col-span-5">
                      <div className="text-zinc-400 text-[10px] mb-1">SOURCES ({s.sources.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {s.sources.map((src) => (
                          <span key={src} className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">{src}</span>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button size="sm" variant="outline" disabled={running === s.fn} onClick={() => run(s.fn)}>
                        {running === s.fn ? <Loader2 className="animate-spin" size={12} /> : "Run"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
