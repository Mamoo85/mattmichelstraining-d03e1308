import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Contractor {
  id: string;
  business_name: string;
  email: string;
  phone: string;
  trade: string;
  city: string;
  active: boolean | null;
  onboarded_at: string | null;
  roi_token: string | null;
  free_dead_leads_quota: number;
  created_at: string;
  stripe_customer_id: string | null;
}

export default function AdminContractorOnboarding() {
  const [list, setList] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("contractor_clients")
      .select("id, business_name, email, phone, trade, city, active, onboarded_at, roi_token, free_dead_leads_quota, created_at, stripe_customer_id")
      .order("created_at", { ascending: false })
      .limit(50);
    setList(((data as any[]) || []) as Contractor[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function checkReadiness(c: Contractor): { ready: boolean; reason?: string } {
    if (!(c as any).stripe_customer_id) return { ready: false, reason: "⏳ Waiting for Stripe payment — no contractor_clients row provisioned yet (or manual insert without stripe_customer_id). Welcome SMS blocked." };
    if (c.active === false) return { ready: false, reason: "⛔ Contractor marked inactive." };
    if (!c.phone) return { ready: false, reason: "⚠️ Phone missing on contractor row." };
    return { ready: true };
  }

  async function fireWelcome(id: string, idx: number) {
    const c = list.find((x) => x.id === id);
    if (c) {
      const r = checkReadiness(c);
      if (!r.ready) { alert(r.reason); return; }
    }
    setBusyId(id + idx);
    try {
      const { data, error } = await (supabase.functions as any).invoke("contractor-welcome-sequence", {
        body: { contractor_id: id, message_index: idx },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        alert(`Blocked: ${(data as any).message || (data as any).error}`);
        return;
      }
      alert(`Sent welcome message #${idx + 1}`);
    } catch (e: any) {
      alert(`Failed: ${e?.message || e}`);
    } finally { setBusyId(null); }
  }

  async function generateKeywords(c: Contractor) {
    setBusyId(c.id + "kw");
    try {
      const { data, error } = await (supabase.functions as any).invoke("google-ads-keyword-builder", {
        body: { trade: c.trade, city: c.city, business_name: c.business_name },
      });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${c.business_name}-google-ads.json`;
      a.click();
    } catch (e: any) {
      alert(`Failed: ${e?.message || e}`);
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">🤝 New Contractor Onboarding</h1>
        <p className="text-white/50 text-sm mt-1">Walk new contractors through setup. Each box = 10-min check.</p>
      </div>

      {loading && <div className="text-white/50">Loading…</div>}

      <div className="space-y-3">
        {list.map((c) => {
          const portalUrl = `https://detroitwebagent.com/contractor-portal/${c.roi_token || c.id}`;
          const intakeUrl = `https://detroitwebagent.com/dead-lead-intake?cid=${c.id}`;
          return (
            <div key={c.id} className="bg-[#0d1f3c] border border-white/10 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-white">{c.business_name}</div>
                  <div className="text-white/50 text-xs">{c.trade} · {c.city} · {c.email} · {c.phone}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${c.active ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                  {c.active ? "Active" : "Pending"}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-[#0a1628] rounded p-2 text-white/60">
                  ✅ Stripe payment {c.active ? "cleared" : "pending"}
                </div>
                <div className="bg-[#0a1628] rounded p-2 text-white/60">
                  📍 Trade + city: {c.trade} / {c.city}
                </div>
                <div className="bg-[#0a1628] rounded p-2 text-white/60 truncate">
                  🔗 Portal: <a href={portalUrl} className="text-[#00d4ff]">{portalUrl}</a>
                </div>
                <div className="bg-[#0a1628] rounded p-2 text-white/60 truncate">
                  ♻️ Intake: <a href={intakeUrl} className="text-[#00d4ff]">{intakeUrl}</a>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => fireWelcome(c.id, 0)} disabled={busyId === c.id + 0} className="bg-[#00d4ff] text-[#0a1628] font-bold py-1 px-3 rounded text-xs disabled:opacity-50">Send Welcome 1</button>
                <button onClick={() => fireWelcome(c.id, 1)} disabled={busyId === c.id + 1} className="bg-white/10 text-white py-1 px-3 rounded text-xs disabled:opacity-50">Send Welcome 2</button>
                <button onClick={() => fireWelcome(c.id, 2)} disabled={busyId === c.id + 2} className="bg-white/10 text-white py-1 px-3 rounded text-xs disabled:opacity-50">Send Welcome 3</button>
                <button onClick={() => generateKeywords(c)} disabled={busyId === c.id + "kw"} className="bg-emerald-500/20 text-emerald-400 py-1 px-3 rounded text-xs disabled:opacity-50">📋 Generate Google Ads</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
