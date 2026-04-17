import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function AdminTheWire() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("wire_subscribers" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setSubs((data as any[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runDigest() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("wire-morning-digest", {});
      if (error) throw error;
      alert(`✅ Digest run complete. Sent: ${data?.sent || 0} of ${data?.total_subs || 0} subs.`);
    } catch (e: any) {
      alert("Failed: " + e.message);
    } finally {
      setRunning(false);
    }
  }

  const active = subs.filter(s => s.active && s.subscription_status === "active").length;
  const mrr = active * 99;

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">📡 The Wire</h2>
          <p className="text-white/50 text-sm mt-1">Contractor leads marketplace · $99/mo subscription · 7am ET morning digest</p>
        </div>
        <button onClick={runDigest} disabled={running}
          className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] rounded font-bold text-sm disabled:opacity-50">
          {running ? "Sending…" : "▶ Run Digest Now"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0f1f35] border border-white/10 rounded-lg p-4">
          <div className="text-xs text-white/40 uppercase tracking-wider">Total Subs</div>
          <div className="text-2xl font-black mt-1">{subs.length}</div>
        </div>
        <div className="bg-[#0f1f35] border border-[#00d4ff]/30 rounded-lg p-4">
          <div className="text-xs text-[#00d4ff] uppercase tracking-wider">Active</div>
          <div className="text-2xl font-black mt-1">{active}</div>
        </div>
        <div className="bg-[#0f1f35] border border-emerald-500/30 rounded-lg p-4">
          <div className="text-xs text-emerald-400 uppercase tracking-wider">MRR</div>
          <div className="text-2xl font-black mt-1">${mrr}</div>
        </div>
      </div>

      <div className="bg-[#0f1f35] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left text-xs uppercase text-white/40">
              <th className="px-4 py-2">Business</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Trades</th>
              <th className="px-4 py-2">Cities</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last Digest</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-white/30">Loading…</td></tr>}
            {!loading && subs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30">No subscribers yet. Share /the-wire to onboard.</td></tr>
            )}
            {subs.map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.business_name || "—"}</div>
                  <div className="text-xs text-white/40">{s.contact_name} · {s.phone}</div>
                </td>
                <td className="px-4 py-3 text-white/70 text-xs">{s.email}</td>
                <td className="px-4 py-3 text-xs text-white/60">{(s.trades || []).join(", ") || "all"}</td>
                <td className="px-4 py-3 text-xs text-white/60">{(s.cities || []).join(", ") || "all"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    s.subscription_status === "active" ? "bg-emerald-500/20 text-emerald-300"
                    : s.subscription_status === "canceled" ? "bg-red-500/20 text-red-300"
                    : "bg-white/10 text-white/60"
                  }`}>{s.subscription_status || "pending"}</span>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs">
                  {s.last_digest_sent_at ? new Date(s.last_digest_sent_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
