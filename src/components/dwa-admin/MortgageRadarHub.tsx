import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Home, Play, RefreshCw, Users, MapPin } from "lucide-react";

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
  signal_type: string;
  signal_source: string;
  score: number;
  signal_date: string | null;
  created_at: string;
};

export default function MortgageRadarHub() {
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, l] = await Promise.all([
      (supabase.from as any)("mortgage_radar_clients").select("*").order("created_at", { ascending: false }),
      (supabase.from as any)("mortgage_radar_leads").select("id, address, city, zip, signal_type, signal_source, score, signal_date, created_at").order("created_at", { ascending: false }).limit(50),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Home className="w-6 h-6 text-[#00d4ff]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Mortgage Radar</h1>
          <p className="text-sm text-[#94a3b8]">Pre-trigger mortgage lead intelligence — FCRA-clean public records pipeline</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={runScanner} disabled={scanning} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
            <Play className="w-3 h-3 mr-1" /> {scanning ? "Scanning…" : "Run scanner"}
          </Button>
          <Button onClick={sendDigest} variant="outline" className="border-[#1e3a5f] text-white hover:bg-[#1e3a5f]/40">
            <RefreshCw className="w-3 h-3 mr-1" /> Send weekly digest
          </Button>
        </div>
      </div>

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
          <p className="text-xs uppercase tracking-widest text-[#00d4ff] mb-1">Hot leads (9–10)</p>
          <p className="text-3xl font-extrabold text-white">{leads.filter(l => l.score >= 9).length}</p>
        </CardContent></Card>
      </div>

      <Card className="bg-[#0a1628] border-[#1e3a5f]">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#00d4ff]" /> Loan Officer Roster</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-[#94a3b8]">Loading…</p> : clients.length === 0 ? (
            <p className="text-[#94a3b8] text-sm">No clients yet. Send the /mortgage-radar link to your brother to onboard the founder seat.</p>
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
                  <th className="py-2">Address</th><th>ZIP</th><th>Signal</th><th>Source</th><th>Score</th><th>Date</th>
                </tr></thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.id} className="border-t border-[#1e3a5f]">
                      <td className="py-2 text-white">{l.address || "—"}</td>
                      <td className="text-[#94a3b8]">{l.zip || "—"}</td>
                      <td className="text-[#cbd5e1]">{l.signal_type.replace(/_/g, " ")}</td>
                      <td className="text-[#94a3b8]">{l.signal_source}</td>
                      <td className={l.score >= 9 ? "text-[#00d4ff] font-bold" : "text-white"}>{l.score}</td>
                      <td className="text-[#64748b]">{l.signal_date || new Date(l.created_at).toISOString().slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
