import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Home, Play, RefreshCw, Users, MapPin, Sparkles, Copy, Send, ExternalLink } from "lucide-react";
import LeadSalesOutreachHub from "./LeadSalesOutreachHub";

type Client = {
  id: string;
  email: string;
  business_name: string | null;
  contact_name: string | null;
  nmls_number: string | null;
  zip_codes: string[] | null;
  is_founder: boolean;
  active: boolean;
  created_at: string;
};

type Lead = {
  id: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  signal_type: string;
  signal_source: string;
  score: number;
  signal_date: string | null;
  created_at: string;
};

const ONBOARD_URL = "https://detroitwebagent.com/mortgage-radar";

export default function MortgageRadarHub() {
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [trace, setTrace] = useState<Array<Record<string, unknown>> | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, l] = await Promise.all([
      (supabase.from as any)("mortgage_radar_clients").select("*").order("created_at", { ascending: false }),
      (supabase.from as any)("mortgage_radar_leads")
        .select("id, address, city, zip, full_name, phone, email, signal_type, signal_source, score, signal_date, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setClients(c.data || []);
    setLeads(l.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runScanner = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("mortgage-radar-scanner");
      if (error) throw error;
      toast.success(`Scanner complete — ${data?.inserted ?? 0} new leads, ${data?.alerts_queued ?? 0} alerts queued`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scanner failed");
    } finally {
      setScanning(false);
    }
  };

  const sendDigest = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("mortgage-radar-digest");
      if (error) throw error;
      toast.success(`Digest sent to ${data?.digests_sent ?? 0} clients`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Digest failed");
    }
  };

  const enrichAll = async () => {
    setEnrichingAll(true);
    setTrace(null);
    try {
      const { data, error } = await supabase.functions.invoke("mortgage-radar-enrich", { body: { limit: 10 } });
      if (error) throw error;
      toast.success(`Enriched ${data?.enriched ?? 0} of ${data?.processed ?? 0} leads`);
      setTrace(data?.trace || []);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setEnrichingAll(false);
    }
  };

  const enrichOne = async (id: string) => {
    setEnrichingId(id);
    setTrace(null);
    try {
      const { data, error } = await supabase.functions.invoke("mortgage-radar-enrich", { body: { lead_id: id } });
      if (error) throw error;
      const hit = (data?.enriched ?? 0) > 0;
      toast[hit ? "success" : "info"](hit ? "Lead enriched" : "No enrichment data found");
      setTrace(data?.trace || []);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setEnrichingId(null);
    }
  };

  const copyOnboardLink = async () => {
    const message = `Hey — built you the Mortgage Radar founder seat. Free for you.\n\nSign up here: ${ONBOARD_URL}\n\nIt scans Metro Detroit public records (FSBO, foreclosure notices, estate sales, BSEED permits, SBA approvals) for in-market borrowers in your ZIPs and emails you a weekly digest. FCRA-clean — no trigger leads, no credit-bureau data.`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Onboarding message copied — text it to your brother");
    } catch {
      toast.error("Copy failed — link: " + ONBOARD_URL);
    }
  };

  const missingInfo = (l: Lead) => !l.full_name || !l.phone || !l.email;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Home className="w-6 h-6 text-[#00d4ff]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Mortgage Radar</h1>
          <p className="text-sm text-[#94a3b8]">Pre-trigger mortgage lead intelligence — FCRA-clean public records pipeline</p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button onClick={runScanner} disabled={scanning} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
            <Play className="w-3 h-3 mr-1" /> {scanning ? "Scanning…" : "Run scanner"}
          </Button>
          <Button onClick={enrichAll} disabled={enrichingAll} className="bg-amber-500 text-black hover:bg-amber-400 font-bold">
            <Sparkles className="w-3 h-3 mr-1" /> {enrichingAll ? "Enriching…" : "Enrich top 10"}
          </Button>
          <Button onClick={sendDigest} variant="outline" className="border-[#1e3a5f] text-white hover:bg-[#1e3a5f]/40">
            <RefreshCw className="w-3 h-3 mr-1" /> Send weekly digest
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-[#0a1628] to-[#0a2440] border-[#00d4ff]/40">
        <CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <Send className="w-5 h-5 text-[#00d4ff] shrink-0" />
          <div className="flex-1 min-w-[240px]">
            <p className="text-white font-bold text-sm">Onboard your brother (founder seat)</p>
            <p className="text-[#94a3b8] text-xs break-all">{ONBOARD_URL}</p>
          </div>
          <Button onClick={copyOnboardLink} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
            <Copy className="w-3 h-3 mr-1" /> Copy SMS
          </Button>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-5">
          <p className="text-xs uppercase tracking-widest text-[#00d4ff] mb-1">Active LOs</p>
          <p className="text-3xl font-extrabold text-white">{clients.filter(c => c.active).length}</p>
        </CardContent></Card>
        <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-5">
          <p className="text-xs uppercase tracking-widest text-[#00d4ff] mb-1">Total leads (recent)</p>
          <p className="text-3xl font-extrabold text-white">{leads.length}</p>
        </CardContent></Card>
        <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-5">
          <p className="text-xs uppercase tracking-widest text-[#00d4ff] mb-1">Enriched / total</p>
          <p className="text-3xl font-extrabold text-white">
            {leads.filter(l => !missingInfo(l)).length}<span className="text-[#64748b] text-lg">/{leads.length}</span>
          </p>
        </CardContent></Card>
      </div>

      <Card className="bg-[#0a1628] border-[#1e3a5f]">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#00d4ff]" /> Loan Officer Roster</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-[#94a3b8]">Loading…</p> : clients.length === 0 ? (
            <p className="text-[#94a3b8] text-sm">No clients yet. Click "Copy SMS" above and text the onboarding message to your brother.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[#00d4ff] text-left text-xs uppercase tracking-widest">
                  <th className="py-2">LO</th><th>Brokerage</th><th>NMLS</th><th>ZIPs</th><th>Founder</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-t border-[#1e3a5f]">
                      <td className="py-2 text-white">{c.contact_name || c.email}</td>
                      <td className="text-[#cbd5e1]">{c.business_name || "—"}</td>
                      <td className="text-[#cbd5e1]">{c.nmls_number || "—"}</td>
                      <td className="text-[#94a3b8]">{(c.zip_codes || []).join(", ") || "—"}</td>
                      <td>{c.is_founder ? <span className="text-[#00d4ff]">★</span> : "—"}</td>
                      <td>{c.active ? <span className="text-green-400">active</span> : <span className="text-[#64748b]">paused</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#0a1628] border-[#1e3a5f]">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-[#00d4ff]" /> Recent Leads (top 50)</CardTitle></CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-[#94a3b8] text-sm">No leads yet. Click "Run scanner" to fetch live signals from BSEED + other public sources.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[#00d4ff] text-left text-xs uppercase tracking-widest">
                  <th className="py-2">Address</th><th>Owner</th><th>Phone / Email</th><th>ZIP</th><th>Signal</th><th>Score</th><th></th>
                </tr></thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.id} className="border-t border-[#1e3a5f]">
                      <td className="py-2 text-white">{l.address || "—"}</td>
                      <td className="text-[#cbd5e1]">{l.full_name || <span className="text-[#64748b]">—</span>}</td>
                      <td className="text-[#cbd5e1] text-xs">
                        {l.phone || <span className="text-[#64748b]">no phone</span>}
                        <br />
                        {l.email || <span className="text-[#64748b]">no email</span>}
                      </td>
                      <td className="text-[#94a3b8]">{l.zip || "—"}</td>
                      <td className="text-[#cbd5e1]">{l.signal_type.replace(/_/g, " ")}</td>
                      <td className={l.score >= 9 ? "text-[#00d4ff] font-bold" : "text-white"}>{l.score}</td>
                      <td>
                        {missingInfo(l) && (
                          <Button
                            size="sm"
                            onClick={() => enrichOne(l.id)}
                            disabled={enrichingId === l.id}
                            className="h-7 px-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 border border-amber-500/40"
                          >
                            <Sparkles className="w-3 h-3 mr-1" /> {enrichingId === l.id ? "…" : "Enrich"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {trace && trace.length > 0 && (
        <Card className="bg-[#0a1628] border-[#1e3a5f]">
          <CardHeader><CardTitle className="text-white text-sm">Last enrichment trace</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-[#94a3b8] text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(trace, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {/* ── Test Dashboard Links ── */}
      <Card className="bg-[#0a1628] border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-white text-sm flex items-center gap-2">
            🧪 Your Test Dashboards — experience every product as a customer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { label: "Contractor — HVAC",       url: "/my-contractor-leads?token=matt-test-hvac-roi-token-00000001" },
              { label: "Contractor — Roofing",    url: "/my-contractor-leads?token=matt-test-roofing-roi-token-000001" },
              { label: "Contractor — Plumbing",   url: "/my-contractor-leads?token=matt-test-plumbing-roi-token-00001" },
              { label: "Contractor — Electrical", url: "/my-contractor-leads?token=matt-test-electrical-roi-token-0001" },
              { label: "Contractor — General",    url: "/my-contractor-leads?token=matt-test-general-roi-token-000001" },
              { label: "TechAlert",               url: "/my-techalert?token=matt-test-techalert-dashboard-0001" },
              { label: "FieldDesk (dispatch)",    url: "/field-service/dispatch?demo=1" },
              { label: "FieldDesk (tech app)",    url: "/field-service/tech?demo=1" },
              { label: "Mortgage Radar",          url: "/mortgage-radar" },
            ].map(({ label, url }) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#1e3a5f] bg-[#0d1f35] text-sm text-white hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors"
              >
                <span>{label}</span>
                <ExternalLink className="w-3 h-3 text-[#64748b] shrink-0" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── LO Outreach Hub ── */}
      <Card className="bg-[#0a1628] border-[#1e3a5f]">
        <CardContent className="p-6">
          <LeadSalesOutreachHub />
        </CardContent>
      </Card>
    </div>
  );
}
