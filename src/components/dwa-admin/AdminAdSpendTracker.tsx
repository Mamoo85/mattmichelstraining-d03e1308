import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  contractor_id: string;
  business_name: string;
  trade: string;
  spend_usd: number;
  recommended_budget_next_30d: number;
  leads_delivered: number;
  margin: number;
}

export default function AdminAdSpendTracker() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const month = new Date();
      const monthKey = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-01`;

      const { data: spend } = await (supabase as any)
        .from("contractor_ad_spend")
        .select("contractor_id, spend_usd, recommended_budget_next_30d, leads_delivered, contractor_clients(business_name, trade)")
        .eq("month", monthKey);

      const r: Row[] = ((spend as any[]) || []).map((s) => ({
        contractor_id: s.contractor_id,
        business_name: s.contractor_clients?.business_name || "?",
        trade: s.contractor_clients?.trade || "?",
        spend_usd: Number(s.spend_usd || 0),
        recommended_budget_next_30d: Number(s.recommended_budget_next_30d || 0),
        leads_delivered: s.leads_delivered || 0,
        margin: 399 - Number(s.spend_usd || 0) - 10, // -$10 SMS/infra
      }));
      setRows(r);
      setLoading(false);
    })();
  }, []);

  const totalSpend = rows.reduce((a, r) => a + r.spend_usd, 0);
  const totalMargin = rows.reduce((a, r) => a + r.margin, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">💰 Ad Spend Tracker (Internal)</h1>
        <p className="text-white/50 text-sm mt-1">DWA-internal margin tracker. Never shown to contractors.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Active Contractors" value={String(rows.length)} />
        <Stat label="MTD Ad Spend" value={`$${totalSpend.toFixed(0)}`} />
        <Stat label="MTD Gross Margin" value={`$${totalMargin.toFixed(0)}`} />
      </div>

      {loading && <div className="text-white/50">Loading…</div>}

      <div className="bg-[#0d1f3c] border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0a1628] text-white/60 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Contractor</th>
              <th className="text-left p-3">Trade</th>
              <th className="text-right p-3">Leads</th>
              <th className="text-right p-3">Spend MTD</th>
              <th className="text-right p-3">Recommended</th>
              <th className="text-right p-3">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contractor_id} className="border-t border-white/5">
                <td className="p-3 text-white">{r.business_name}</td>
                <td className="p-3 text-white/60">{r.trade}</td>
                <td className="p-3 text-right text-[#00d4ff] font-bold">{r.leads_delivered}</td>
                <td className="p-3 text-right text-white/80">${r.spend_usd.toFixed(0)}</td>
                <td className="p-3 text-right text-amber-400">${r.recommended_budget_next_30d.toFixed(0)}</td>
                <td className={`p-3 text-right font-bold ${r.margin >= 100 ? "text-emerald-400" : r.margin >= 0 ? "text-amber-400" : "text-red-400"}`}>${r.margin.toFixed(0)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-white/40">No spend data yet. Run dwa-ad-optimizer or wait for the 6h cron.</td></tr>
            )}
          </tbody>
        </table>
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
