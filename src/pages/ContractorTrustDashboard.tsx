import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import LeadProbabilityCard from "@/components/contractor/LeadProbabilityCard";
import FreeBoostCard from "@/components/contractor/FreeBoostCard";

interface Contractor {
  id: string;
  business_name: string;
  trade: string;
  city: string;
  free_dead_leads_used: number;
  free_dead_leads_quota: number;
  email: string;
}

export default function ContractorTrustDashboard() {
  const { token } = useParams();
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data: c, error } = await (supabase as any)
          .from("contractor_clients")
          .select("id, business_name, trade, city, free_dead_leads_used, free_dead_leads_quota, email")
          .or(`roi_token.eq.${token},id.eq.${token}`)
          .maybeSingle();
        if (error || !c) { setErr("Dashboard not found."); return; }
        setContractor(c as Contractor);

        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const [{ data: ld }, { data: bd }] = await Promise.all([
          (supabase as any).from("contractor_leads").select("id, created_at, project_description").eq("contractor_id", (c as any).id).gte("created_at", since),
          (supabase as any).from("contractor_lead_boosts").select("*").eq("contractor_id", (c as any).id).order("created_at", { ascending: false }).limit(5),
        ]);
        setLeads(((ld as any[]) || []));
        setBoosts(((bd as any[]) || []));
      } catch (e: any) { setErr(e?.message || "Load failed"); }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen bg-[#0a1628] text-white p-8">Loading…</div>;
  if (err || !contractor) return <div className="min-h-screen bg-[#0a1628] text-white p-8">{err || "Not found"}</div>;

  const leadsCount = leads.length;

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <SEOHead title={`${contractor.business_name} — Lead Dashboard`} description="Your DWA Contractor Lead Network dashboard." />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <header>
          <p className="text-[#00d4ff] text-xs uppercase tracking-[0.2em] font-bold">DWA Smart Ad Placement</p>
          <h1 className="text-3xl font-black mt-1">{contractor.business_name}</h1>
          <p className="text-white/60 text-sm">{contractor.trade} · {contractor.city}, MI</p>
        </header>

        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="Leads (30d)" value={String(leadsCount)} />
          <Stat label="Free Boost" value={`${contractor.free_dead_leads_used}/${contractor.free_dead_leads_quota}`} />
          <Stat label="Plan" value="$399/mo" />
        </div>

        <FreeBoostCard
          contractorId={contractor.id}
          used={contractor.free_dead_leads_used}
          quota={contractor.free_dead_leads_quota}
        />

        <LeadProbabilityCard
          contractorId={contractor.id}
          email={contractor.email}
          leadsLast30={leadsCount}
        />

        <section className="bg-[#0d1f3c] border border-white/10 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-3">Recent Leads</h2>
          {leads.length === 0 ? (
            <p className="text-white/50 text-sm">No leads yet — Google ads typically take 3-5 days to prime. Your free boost is filling the gap above.</p>
          ) : (
            <ul className="space-y-2">
              {leads.slice(0, 8).map((l) => (
                <li key={l.id} className="bg-[#0a1628] rounded-lg p-3 text-sm flex justify-between">
                  <span className="text-white/80 truncate">{l.project_description || "Lead"}</span>
                  <span className="text-white/40 text-xs">{new Date(l.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {boosts.length > 0 && (
          <section className="bg-[#0d1f3c] border border-white/10 rounded-xl p-5">
            <h2 className="text-lg font-bold mb-3">Boost History</h2>
            <ul className="space-y-2 text-sm">
              {boosts.map((b) => (
                <li key={b.id} className="flex justify-between text-white/70">
                  <span>${b.boost_amount} {b.boost_type === "recurring" ? "/mo" : "one-time"}</span>
                  <span className="text-white/40">{new Date(b.created_at).toLocaleDateString()} · {b.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="text-white/40 text-xs text-center pt-4">
          DWA · Built for Metro Detroit trades · (313) 992-1219<br />
          Probabilities derived from industry benchmarks (Suparev 2026) + DWA internal data. Lead Boost includes a management fee — see <a href="/terms" className="underline">Terms</a>.
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d1f3c] border border-white/10 rounded-lg p-4">
      <div className="text-[#00d4ff] text-2xl font-black">{value}</div>
      <div className="text-white/50 text-xs uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}
