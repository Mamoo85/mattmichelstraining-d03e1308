import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  contractorId: string;
  email: string;
  leadsLast30: number;
}

const TIERS = [
  { boost: 0,   pct: 65, leads: "5+",  label: "Base $399/mo Plan",  current: true },
  { boost: 100, pct: 80, leads: "8+",  label: "Boost +$100" },
  { boost: 300, pct: 90, leads: "12+", label: "Boost +$300" },
];

export default function LeadProbabilityCard({ contractorId, email, leadsLast30 }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [recurring, setRecurring] = useState(true);

  async function buyBoost(amount: number) {
    setBusy(amount);
    try {
      const { data, error } = await (supabase.functions as any).invoke("create-lead-boost-checkout", {
        body: { contractor_id: contractorId, email, boost_amount: amount, recurring },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      alert(`Checkout failed: ${e?.message || e}`);
    } finally { setBusy(null); }
  }

  return (
    <section className="bg-[#0d1f3c] border border-[#00d4ff]/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Lead Probability — Next 30 Days</h2>
        <label className="text-xs text-white/60 flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="accent-[#00d4ff]" />
          Monthly recurring
        </label>
      </div>
      <p className="text-white/60 text-sm mb-4">
        You've delivered {leadsLast30} lead{leadsLast30 === 1 ? "" : "s"} in the last 30 days. Boost ad reach to raise probability.
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        {TIERS.map((t) => (
          <div key={t.boost} className={`rounded-lg p-4 border ${t.current ? "bg-[#0a1628] border-[#00d4ff]/40" : "bg-[#0a1628]/60 border-white/10"}`}>
            <div className="text-[#00d4ff] text-3xl font-black">{t.pct}%</div>
            <div className="text-white/80 text-sm mt-1">chance of <strong>{t.leads} leads/mo</strong></div>
            <div className="text-white/40 text-xs mt-2">{t.label}</div>
            {t.boost > 0 && (
              <button
                onClick={() => buyBoost(t.boost)}
                disabled={busy === t.boost}
                className="w-full mt-3 bg-[#00d4ff] text-[#0a1628] font-bold py-2 rounded text-sm disabled:opacity-50"
              >
                {busy === t.boost ? "…" : `Boost +$${t.boost}${recurring ? "/mo" : ""}`}
              </button>
            )}
            {t.current && <div className="mt-3 text-center text-xs text-white/50">✓ Active</div>}
          </div>
        ))}
      </div>

      <p className="text-white/40 text-[10px] mt-4">
        Boost spend includes a 20% management fee covering ad platform setup, optimization, and reporting. Cancel anytime. Probabilities are estimates based on industry benchmarks + DWA internal data.
      </p>
    </section>
  );
}
