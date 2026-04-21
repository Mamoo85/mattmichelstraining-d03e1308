import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BlockRow {
  id: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  domain: string | null;
  reason: string;
  source_table: string | null;
  source_agent: string | null;
  blocked_until: string | null;
  created_at: string;
}

const REASON_COLORS: Record<string, string> = {
  paying_client: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  manual_client_protection: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  recent_outreach: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  replied: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  opted_out: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

export default function AdminOutreachBlocklist() {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [stats, setStats] = useState({ total: 0, forever: 0, expiring7d: 0, byReason: {} as Record<string, number> });

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("outreach_blocklist" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (err) {
      console.error("[AdminOutreachBlocklist] load error:", err);
      setError(err.message || "Failed to load blocklist");
      setLoading(false);
      return;
    }
    const list = ((data as any[]) || []) as BlockRow[];
    setRows(list);
    setLastLoaded(new Date());

    const now = Date.now();
    const wk = now + 7 * 86400000;
    const byReason: Record<string, number> = {};
    let forever = 0, expiring7d = 0;
    for (const r of list) {
      byReason[r.reason] = (byReason[r.reason] || 0) + 1;
      if (!r.blocked_until) forever++;
      else {
        const t = new Date(r.blocked_until).getTime();
        if (t > now && t < wk) expiring7d++;
      }
    }
    setStats({ total: list.length, forever, expiring7d, byReason });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.business_name || "").toLowerCase().includes(s)
      || (r.email || "").toLowerCase().includes(s)
      || (r.phone || "").includes(s)
      || (r.domain || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 text-white">
      <div>
        <h2 className="text-2xl font-bold text-[#00d4ff]">🛡️ Outreach Blocklist</h2>
        <p className="text-sm text-white/60 mt-1">
          Paying clients = blocked forever. Cold-contacted prospects = blocked for 90 days. No one gets pitched twice.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-xs text-white/50 uppercase">Total Blocked</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <div className="text-xs text-emerald-300/70 uppercase">Permanent (Clients)</div>
          <div className="text-2xl font-bold text-emerald-300">{stats.forever}</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="text-xs text-amber-300/70 uppercase">Expiring &lt;7d</div>
          <div className="text-2xl font-bold text-amber-300">{stats.expiring7d}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-xs text-white/50 uppercase">Reasons</div>
          <div className="text-xs mt-1 space-y-0.5">
            {Object.entries(stats.byReason).map(([r, n]) => (
              <div key={r} className="flex justify-between"><span className="text-white/60">{r}</span><span className="font-semibold text-white">{n}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by business, email, phone, domain…"
          className="flex-1 bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#00d4ff]/60"
        />
        <button onClick={load} className="px-4 py-2 bg-[#00d4ff]/20 border border-[#00d4ff]/40 rounded-md text-sm text-[#00d4ff] hover:bg-[#00d4ff]/30">
          ↻ Refresh
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase text-white/50">
              <tr>
                <th className="text-left px-3 py-2">Business / Identifier</th>
                <th className="text-left px-3 py-2">Reason</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-left px-3 py-2">Blocked Until</th>
                <th className="text-left px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={5} className="text-center text-white/40 py-8">Loading…</td></tr>)}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center text-white/40 py-8">No blocks match.</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2">
                    <div className="font-medium text-white">{r.business_name || "—"}</div>
                    <div className="text-xs text-white/50">
                      {[r.email, r.phone, r.domain].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${REASON_COLORS[r.reason] || "bg-white/10 text-white/70 border-white/20"}`}>
                      {r.reason}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-white/60">{r.source_agent || r.source_table || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.blocked_until ? (
                      <span className="text-amber-300">{new Date(r.blocked_until).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">Forever</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/50">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
