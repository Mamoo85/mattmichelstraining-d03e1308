import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

type Row = {
  id: string;
  caller_number: string | null;
  city: string | null;
  voicemail_transcript: string | null;
  text_sent: string | null;
  reply_received: string | null;
  status: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  "in-progress": "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  resolved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

export default function AdminMissedCallLeads() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("missed_call_captures")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markResolved = async (id: string) => {
    await supabase.from("missed_call_captures").update({ status: "resolved" }).eq("id", id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "resolved" } : r)));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">📞 Missed Call Leads</h2>
          <p className="text-white/60 text-sm">Captures from the DWA work line — voicemail + text auto-response.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-sm text-white">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60"><Loader2 className="animate-spin" size={16} /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No missed calls captured yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70 text-left">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Caller</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Voicemail</th>
                <th className="px-3 py-2">Text Sent</th>
                <th className="px-3 py-2">Reply</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = (r.status || "new").toLowerCase();
                const cls = STATUS_STYLES[status] || STATUS_STYLES.new;
                const vm = (r.voicemail_transcript || "").slice(0, 60);
                return (
                  <tr key={r.id} className="border-t border-white/5 text-white/80">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.caller_number || "—"}</td>
                    <td className="px-3 py-2">{r.city || "—"}</td>
                    <td className="px-3 py-2 max-w-xs">{vm}{(r.voicemail_transcript?.length || 0) > 60 ? "…" : ""}</td>
                    <td className="px-3 py-2 text-xs text-white/60">{r.text_sent ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.reply_received ? r.reply_received.slice(0, 40) : "—"}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>{status}</span></td>
                    <td className="px-3 py-2">
                      {status !== "resolved" && (
                        <button onClick={() => markResolved(r.id)} className="text-xs px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/40">
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
