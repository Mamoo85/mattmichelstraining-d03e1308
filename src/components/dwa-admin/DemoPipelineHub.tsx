import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Booking = {
  id: string;
  created_at: string;
  slot_date: string | null;
  slot_time: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  offer_pitched: string | null;
  deal_value_usd: number | null;
};

const OUTCOMES = ["scheduled", "showed", "no_show", "won", "lost", "follow_up"] as const;
const OFFERS = ["bundle_499", "fielddesk_only", "missed_call_only", "custom"] as const;

export default function DemoPipelineHub() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("demo_bookings" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<Booking>) => {
    setSavingId(id);
    try {
      const { error } = await supabase.functions.invoke("update-demo-outcome", {
        body: { booking_id: id, ...patch },
      });
      if (error) throw error;
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    } catch (e: any) {
      alert("Save failed: " + (e?.message || e));
    } finally {
      setSavingId(null);
    }
  };

  const stats = {
    total: rows.length,
    won: rows.filter((r) => r.outcome === "won").length,
    revenue: rows.filter((r) => r.outcome === "won").reduce((s, r) => s + Number(r.deal_value_usd || 0), 0),
    no_show: rows.filter((r) => r.outcome === "no_show").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg p-3">
          <div className="text-xs text-white/50">Bookings</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg p-3">
          <div className="text-xs text-white/50">Won</div>
          <div className="text-2xl font-bold text-emerald-400">{stats.won}</div>
        </div>
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg p-3">
          <div className="text-xs text-white/50">Revenue</div>
          <div className="text-2xl font-bold text-[#00d4ff]">${stats.revenue.toFixed(0)}</div>
        </div>
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg p-3">
          <div className="text-xs text-white/50">No-shows</div>
          <div className="text-2xl font-bold text-red-400">{stats.no_show}</div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Demo Pipeline</h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <div className="font-semibold">{r.company || r.name || r.email}</div>
                <div className="text-xs text-white/50">
                  {r.email} · {r.phone || "no phone"} · {r.slot_date} {r.slot_time}
                </div>
                <div className="text-xs text-white/40 mt-1">Source: {r.source || "—"}</div>
              </div>
              {r.outcome && (
                <Badge variant={r.outcome === "won" ? "default" : "secondary"}>
                  {r.outcome}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <select
                value={r.outcome || ""}
                onChange={(e) => update(r.id, { outcome: e.target.value })}
                className="bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-sm"
              >
                <option value="">— outcome —</option>
                {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select
                value={r.offer_pitched || ""}
                onChange={(e) => update(r.id, { offer_pitched: e.target.value })}
                className="bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-sm"
              >
                <option value="">— offer —</option>
                {OFFERS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                type="number"
                placeholder="Deal $"
                value={r.deal_value_usd ?? ""}
                onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, deal_value_usd: e.target.value ? Number(e.target.value) : null } : x))}
                onBlur={(e) => update(r.id, { deal_value_usd: e.target.value ? Number(e.target.value) : null })}
                className="bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-sm"
              />
            </div>
            <textarea
              placeholder="Notes..."
              defaultValue={r.outcome_notes || ""}
              onBlur={(e) => update(r.id, { outcome_notes: e.target.value })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-sm"
              rows={2}
            />
            {savingId === r.id && <div className="text-xs text-[#00d4ff] mt-1">Saving…</div>}
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <div className="text-center text-white/40 py-8">No bookings yet.</div>
        )}
      </div>
    </div>
  );
}
