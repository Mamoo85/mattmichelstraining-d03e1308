import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Hammer, Play, RefreshCw, Users, MapPin, Zap, Loader2, Send, Activity, Filter } from "lucide-react";

const ALL_VERTICALS = [
  "roofing", "hvac", "plumbing", "electrical", "pest_control",
  "gutters", "exterior", "tree", "restoration", "demo_junk", "foundation",
] as const;

type Vertical = typeof ALL_VERTICALS[number];

const VERTICAL_LABELS: Record<Vertical, string> = {
  roofing: "Roofing", hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
  pest_control: "Pest Control", gutters: "Gutters", exterior: "Exterior",
  tree: "Tree Service", restoration: "Restoration", demo_junk: "Demo/Junk", foundation: "Foundation",
};

const VERTICAL_COLORS: Record<Vertical, string> = {
  roofing: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  hvac: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  plumbing: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  electrical: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  pest_control: "bg-green-500/10 text-green-400 border-green-500/30",
  gutters: "bg-teal-500/10 text-teal-400 border-teal-500/30",
  exterior: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  tree: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  restoration: "bg-red-500/10 text-red-400 border-red-500/30",
  demo_junk: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  foundation: "bg-stone-500/10 text-stone-400 border-stone-500/30",
};

type Lead = {
  id: string;
  vertical: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  signal_type: string;
  signal_source: string | null;
  score: number;
  signal_date: string | null;
  status: string | null;
  street_view_url: string | null;
  created_at: string;
  suggested_opener: string | null;
};

type Client = {
  id: string;
  email: string;
  vertical: string;
  business_name: string | null;
  contact_name: string | null;
  zip_codes: string[] | null;
  active: boolean;
  created_at: string;
};

type AreaSignal = {
  id: string;
  vertical: string;
  scope: string;
  scope_value: string;
  signal_type: string;
  signal_detail: string;
  score: number;
  expires_at: string | null;
  created_at: string;
};

type Stats = {
  total_leads: number;
  by_vertical: Record<string, number>;
  top_sources: Array<{ source: string; count: number }>;
};

export default function TradeRadarHub() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [areaSignals, setAreaSignals] = useState<AreaSignal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanVertical, setScanVertical] = useState<Vertical | "all">("all");
  const [filterVertical, setFilterVertical] = useState<Vertical | "all">("all");
  const [sendingDigest, setSendingDigest] = useState(false);
  const [activeTab, setActiveTab] = useState<"leads" | "area" | "clients" | "sources">("leads");

  const load = async () => {
    setLoading(true);
    try {
      const [leadsRes, clientsRes, areaRes] = await Promise.all([
        (supabase.from as any)("trade_radar_leads")
          .select("id, vertical, address, city, zip, signal_type, signal_source, score, signal_date, status, street_view_url, suggested_opener, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        (supabase.from as any)("trade_radar_clients")
          .select("id, email, vertical, business_name, contact_name, zip_codes, active, created_at")
          .order("created_at", { ascending: false }),
        (supabase.from as any)("trade_radar_area_signals")
          .select("id, vertical, scope, scope_value, signal_type, signal_detail, score, expires_at, created_at")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      const leadsData: Lead[] = leadsRes.data || [];
      setLeads(leadsData);
      setClients(clientsRes.data || []);
      setAreaSignals(areaRes.data || []);

      // Build stats
      const byVertical: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};
      for (const l of leadsData) {
        byVertical[l.vertical] = (byVertical[l.vertical] || 0) + 1;
        if (l.signal_source) sourceCounts[l.signal_source] = (sourceCounts[l.signal_source] || 0) + 1;
      }
      const topSources = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([source, count]) => ({ source, count }));
      setStats({ total_leads: leadsData.length, by_vertical: byVertical, top_sources: topSources });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runScanner = async () => {
    setScanning(true);
    try {
      const body = scanVertical === "all" ? { vertical: "all" } : { vertical: scanVertical };
      const { data, error } = await supabase.functions.invoke("trade-radar-scanner", { body });
      if (error) throw error;
      const total = data?.results ? Object.values(data.results as Record<string, { inserted: number }>).reduce((s: number, v) => s + (v?.inserted || 0), 0) : 0;
      toast.success(`Scanner complete — ${total} new leads across ${scanVertical === "all" ? "all verticals" : scanVertical}`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scanner failed");
    } finally {
      setScanning(false);
    }
  };

  const sendDigest = async () => {
    setSendingDigest(true);
    try {
      const { data, error } = await supabase.functions.invoke("trade-radar-am-digest");
      if (error) throw error;
      toast.success(`Digest sent to ${data?.digests_sent ?? data?.sent ?? 0} clients`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Digest failed");
    } finally {
      setSendingDigest(false);
    }
  };

  const filteredLeads = filterVertical === "all" ? leads : leads.filter(l => l.vertical === filterVertical);

  const scoreColor = (score: number) => {
    if (score >= 9) return "text-red-400";
    if (score >= 7) return "text-orange-400";
    if (score >= 5) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Hammer className="w-6 h-6 text-orange-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Trade Radar</h2>
            <p className="text-white/50 text-xs">11 verticals · {leads.length} leads · {clients.length} clients</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={sendDigest}
            disabled={sendingDigest}
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            {sendingDigest ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Send AM Digest
          </Button>
        </div>
      </div>

      {/* Scanner controls */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-white/70 text-sm">Run scanner:</span>
            <select
              value={scanVertical}
              onChange={e => setScanVertical(e.target.value as Vertical | "all")}
              className="bg-white/10 border border-white/20 text-white text-sm rounded px-2 py-1"
            >
              <option value="all">All Verticals</option>
              {ALL_VERTICALS.map(v => (
                <option key={v} value={v}>{VERTICAL_LABELS[v]}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={runScanner}
              disabled={scanning}
              className="bg-orange-500 hover:bg-orange-400 text-white"
            >
              {scanning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
              {scanning ? "Scanning…" : "Run Now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-4">
              <div className="text-2xl font-black text-white">{stats.total_leads}</div>
              <div className="text-white/50 text-xs">Total Leads</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-4">
              <div className="text-2xl font-black text-white">{clients.filter(c => c.active).length}</div>
              <div className="text-white/50 text-xs">Active Clients</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-4">
              <div className="text-2xl font-black text-white">{areaSignals.length}</div>
              <div className="text-white/50 text-xs">Area Signals</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-4">
              <div className="text-2xl font-black text-white">{ALL_VERTICALS.length}</div>
              <div className="text-white/50 text-xs">Verticals Live</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vertical breakdown */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          {ALL_VERTICALS.map(v => (
            <button
              key={v}
              onClick={() => setFilterVertical(filterVertical === v ? "all" : v)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                filterVertical === v ? VERTICAL_COLORS[v] + " ring-1 ring-current" : "border-white/15 text-white/50 hover:border-white/30"
              }`}
            >
              {VERTICAL_LABELS[v]} <span className="opacity-70">({stats.by_vertical[v] || 0})</span>
            </button>
          ))}
          {filterVertical !== "all" && (
            <button
              onClick={() => setFilterVertical("all")}
              className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/50 hover:border-white/30"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-white/10">
        {(["leads", "area", "clients", "sources"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-white/50 hover:text-white/70"
            }`}
          >
            {tab === "area" ? "Area Signals" : tab === "sources" ? "Data Sources" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Leads tab */}
      {activeTab === "leads" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-3">
            <Filter className="w-3 h-3" />
            Showing {filteredLeads.length} leads{filterVertical !== "all" ? ` for ${VERTICAL_LABELS[filterVertical as Vertical]}` : ""}
          </div>
          {loading ? (
            <div className="text-white/40 text-sm text-center py-8">Loading leads…</div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-white/40 text-sm text-center py-8">No leads yet — run the scanner to populate.</div>
          ) : (
            filteredLeads.map(lead => (
              <div key={lead.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${VERTICAL_COLORS[lead.vertical as Vertical] || "border-white/20 text-white/60"}`}>
                        {VERTICAL_LABELS[lead.vertical as Vertical] || lead.vertical}
                      </span>
                      <span className="text-white font-medium text-sm truncate">{lead.address || "Unknown address"}</span>
                      {lead.zip && <span className="text-white/40 text-xs">{lead.zip}</span>}
                    </div>
                    <div className="text-white/50 text-xs mb-1">
                      {lead.signal_type} · {lead.signal_source || "unknown source"} · {lead.signal_date?.slice(0, 10) || ""}
                    </div>
                    {lead.suggested_opener && (
                      <div className="text-white/40 text-xs italic truncate">{lead.suggested_opener.slice(0, 120)}…</div>
                    )}
                    {lead.street_view_url && (
                      <a
                        href={lead.street_view_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 text-xs hover:underline mt-1 inline-block"
                      >
                        Street View →
                      </a>
                    )}
                  </div>
                  <div className={`text-2xl font-black shrink-0 ${scoreColor(lead.score)}`}>
                    {lead.score}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Area Signals tab */}
      {activeTab === "area" && (
        <div className="space-y-2">
          {loading ? (
            <div className="text-white/40 text-sm text-center py-8">Loading…</div>
          ) : areaSignals.length === 0 ? (
            <div className="text-white/40 text-sm text-center py-8">No area signals yet.</div>
          ) : (
            areaSignals.map(sig => (
              <div key={sig.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${VERTICAL_COLORS[sig.vertical as Vertical] || "border-white/20 text-white/60"}`}>
                        {VERTICAL_LABELS[sig.vertical as Vertical] || sig.vertical}
                      </span>
                      <span className="text-white/60 text-xs">{sig.scope}: {sig.scope_value}</span>
                    </div>
                    <div className="text-white/70 text-sm">{sig.signal_type}</div>
                    <div className="text-white/40 text-xs mt-0.5 line-clamp-2">{sig.signal_detail}</div>
                  </div>
                  <div className={`text-xl font-black shrink-0 ${scoreColor(sig.score)}`}>{sig.score}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Clients tab */}
      {activeTab === "clients" && (
        <div className="space-y-2">
          {loading ? (
            <div className="text-white/40 text-sm text-center py-8">Loading…</div>
          ) : clients.length === 0 ? (
            <div className="text-white/40 text-sm text-center py-8">No clients enrolled yet.</div>
          ) : (
            clients.map(c => (
              <div key={c.id} className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${c.active ? "bg-white/5 border-white/10" : "bg-white/2 border-white/5 opacity-50"}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${VERTICAL_COLORS[c.vertical as Vertical] || "border-white/20 text-white/60"}`}>
                      {VERTICAL_LABELS[c.vertical as Vertical] || c.vertical}
                    </span>
                    <span className="text-white font-medium text-sm">{c.business_name || c.contact_name || c.email}</span>
                  </div>
                  <div className="text-white/40 text-xs">{c.email} · {c.zip_codes?.length || 0} ZIPs</div>
                </div>
                <div className={`text-xs font-bold px-2 py-0.5 rounded ${c.active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                  {c.active ? "Active" : "Inactive"}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Data Sources tab */}
      {activeTab === "sources" && (
        <div className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Top Signal Sources (from current leads)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.top_sources.length ? (
                <div className="space-y-2">
                  {stats.top_sources.map(s => (
                    <div key={s.source} className="flex items-center justify-between">
                      <span className="text-white/70 text-sm font-mono">{s.source}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full"
                            style={{ width: `${Math.min(100, (s.count / (stats.top_sources[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-white/40 text-xs w-8 text-right">{s.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/40 text-sm">No leads yet — run scanner first.</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Detroit ArcGIS Sources (Active)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-white/60 font-mono">
                {[
                  "bseed_building_permits", "bseed_trades_permits", "bseed_rental_registrations",
                  "bseed_vacant_property_registrations", "bseed_demolition_permits",
                  "bseed_occupancy_certificates", "bseed_active_residential_compliance_certificates",
                  "bseed_active_commercial_compliance_certificates", "bseed_presale_inspections",
                  "bseed_building_permit_plan_reviews", "bseed_lead_clearance_reports",
                  "bseed_demolition_inspections", "acceptance_certificates",
                  "bseed_building_rental_compliance_public_view",
                  "blight_tickets", "DLBA_Owned_Properties", "DLBA_For_Sale",
                  "dlba_auction_sales", "dlba_own_it_now_sales", "dlba_project_sales",
                  "dlba_vacant_land_program_sales",
                  "Completed_Residential_Demolitions", "Demo_Pipeline",
                  "Demolitions_under_Contract", "Commercial_Demolitions",
                  "Demolition_Post_Abatement_Verification_Reports",
                  "ARPA_Blight_Remediation_Industrial_and_Commercial_Completed_EDD",
                  "Fire_Incidents", "Fire_Inspections",
                  "Historic_District_Violations", "national_register_of_historic_places",
                  "assessor_property_sales_view", "tentative_assessment_roll_2026",
                  "multifamily_housing_construction_sites", "existing_multifamily_housing_sites",
                  "energy_water_benchmarking_ordinance_-_buildings",
                  "ROW_Permits", "Residential_Inspections_(combined)",
                  "development_opportunities_city_real_estate_buildings",
                  "development_opportunities_city_real_estate_land",
                  "Commercial_Properties_for_Sale",
                ].map(src => (
                  <div key={src} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    {src}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">External API Sources (Active)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-white/60 font-mono">
                {[
                  "NOAA NWS Alerts (weather.gov)", "NOAA SPC Day-1 Outlook",
                  "NOAA CDO Historical Hail (NOAA_API_KEY)", "FEMA Disaster Declarations",
                  "OpenFEMA NFIP Flood Claims", "USGS Streamflow",
                  "USGS Earthquake Feed", "NOAA Drought Monitor",
                  "SPC Storm Wind CSV (58+ mph)", "SPC Storm Hail CSV",
                  "Census ACS Housing Age (by ZIP)", "CFPB Home Improvement Loans",
                  "CFPB Refi Loans", "SeeClickFix 311 (water/sewer keywords)",
                  "SeeClickFix 311 (flood/foundation keywords)",
                  "Wayne County GIS Parcel", "Oakland County GIS Parcel",
                ].map(src => (
                  <div key={src} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    {src}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
