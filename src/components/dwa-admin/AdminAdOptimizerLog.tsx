import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LogRow {
  id: string;
  contractor_id: string;
  old_budget: number | null;
  new_budget: number;
  reason: string;
  agent: string;
  created_at: string;
  contractor_clients?: { business_name: string };
}

export default function AdminAdOptimizerLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("contractor_ad_budget_log")
      .select("*, contractor_clients(business_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(((data as any[]) || []) as LogRow[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runNow() {
    setRunning(true);
    try {
      const { error } = await (supabase.functions as any).invoke("dwa-ad-optimizer", { body: {} });
      if (error) throw error;
      await load();
    } catch (e: any) { alert(e?.message || e); }
    finally { setRunning(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🤖 Ad Optimizer Log</h1>
          <p className="text-white/50 text-sm mt-1">Smart Ad Budget Agent — runs every 6h. Last 100 adjustments.</p>
        </div>
        <button onClick={runNow} disabled={running} className="bg-[#00d4ff] text-[#0a1628] font-bold py-2 px-4 rounded text-sm disabled:opacity-50">
          {running ? "Running…" : "▶ Run Now"}
        </button>
      </div>

      {loading && <div className="text-white/50">Loading…</div>}

      <div className="bg-[#0d1f3c] border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0a1628] text-white/60 text-xs uppercase">
            <tr>
              <th className="text-left p-3">When</th>
              <th className="text-left p-3">Contractor</th>
              <th className="text-right p-3">Old → New</th>
              <th className="text-left p-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 text-white/60 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3 text-white">{r.contractor_clients?.business_name || r.contractor_id}</td>
                <td className="p-3 text-right text-[#00d4ff] font-bold">${r.old_budget ?? 0} → ${r.new_budget}</td>
                <td className="p-3 text-white/70 text-xs">{r.reason}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-white/40">No adjustments yet. Click Run Now.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
