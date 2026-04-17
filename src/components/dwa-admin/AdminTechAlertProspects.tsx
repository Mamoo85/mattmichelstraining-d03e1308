import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Prospect {
  id: string;
  company_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  role: string | null;
  days_posted: number | null;
  repost_count: number;
  open_roles_count: number;
  is_boiler: boolean;
  score: number;
  source_url: string | null;
  source_label: string | null;
  status: string;
  created_at: string;
}

const STATUS_FILTERS = ["all", "new", "emailed", "postcarded", "replied", "closed"];

export default function AdminTechAlertProspects() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [drafting, setDrafting] = useState<Prospect | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("techalert_prospect_targets" as never)
      .select("*")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data as unknown as Prospect[]) || []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function runHunter() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("techalert-prospect-hunter", { body: {} });
      if (error) throw error;
      toast.success(`Hunter complete — ${data?.inserted ?? 0} new, ${data?.updated ?? 0} updated`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hunter failed");
    } finally {
      setRunning(false);
    }
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase
      .from("techalert_prospect_targets" as never)
      .update({ status, last_contacted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">🎯 TechAlert Prospect Hunter</h1>
          <p className="text-white/50 text-sm">Shops actively hiring techs — perfect TechAlert prospects.</p>
        </div>
        <Button onClick={runHunter} disabled={running} className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80 font-bold">
          {running ? "Running…" : "🚀 Run Hunter Now"}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded text-xs font-semibold ${filter === s ? "bg-[#00d4ff] text-[#0a1628]" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
          >
            {s} {s !== "all" && `(${rows.filter((r) => r.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/60 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Score</th>
              <th className="text-left p-3">Company</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">City</th>
              <th className="text-left p-3">Signal</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center text-white/40 p-8">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-white/40 p-8">No prospects. Click "Run Hunter Now" to scan.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-3">
                  <span className={`px-2 py-1 rounded font-bold text-xs ${r.score >= 6 ? "bg-red-500/20 text-red-300" : r.score >= 4 ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/60"}`}>
                    {r.score}
                  </span>
                </td>
                <td className="p-3 text-white">
                  <div className="font-semibold">{r.company_name}</div>
                  {r.source_url && (
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-[#00d4ff] text-xs hover:underline">
                      view posting →
                    </a>
                  )}
                </td>
                <td className="p-3 text-white/80 text-xs">
                  {r.role}
                  {r.is_boiler && <span className="ml-1 text-amber-300">🔥</span>}
                </td>
                <td className="p-3 text-white/60 text-xs">{r.city || "—"}</td>
                <td className="p-3 text-white/60 text-xs">
                  {r.days_posted ? `${r.days_posted}d posted` : ""}
                  {r.repost_count > 0 && <span className="ml-1 text-amber-300">↻{r.repost_count}</span>}
                  {r.open_roles_count > 1 && <span className="ml-1 text-red-300">+{r.open_roles_count} roles</span>}
                </td>
                <td className="p-3">
                  <span className="text-xs text-white/60">{r.status}</span>
                </td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setDrafting(r)} className="text-xs bg-[#00d4ff]/20 text-[#00d4ff] hover:bg-[#00d4ff]/30 px-2 py-1 rounded">📧 Draft</button>
                    <button onClick={() => setStatus(r.id, "postcarded")} className="text-xs bg-white/10 text-white/70 hover:bg-white/20 px-2 py-1 rounded">📮 Postcard</button>
                    <button onClick={() => setStatus(r.id, "closed")} className="text-xs text-white/40 hover:text-white/70 px-2 py-1">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drafting && (
        <DraftModal prospect={drafting} onClose={() => setDrafting(null)} onSent={() => { void setStatus(drafting.id, "emailed"); setDrafting(null); }} />
      )}
    </div>
  );
}

// COLD EMAIL DRAFT — TCPA-safe copy-paste only.
// CRITICAL: Never reference licensing databases, scraping, job boards, or any
// data source name. We are "a Detroit-area hiring monitoring service."
function DraftModal({ prospect, onClose, onSent }: { prospect: Prospect; onClose: () => void; onSent: () => void }) {
  const roleLabel = (prospect.role || "tech").replace(/_/g, " ");
  const subject = `Quick question about your ${roleLabel} opening`;
  const cityBit = prospect.city ? ` in ${prospect.city}` : "";

  const body = `Hi —

Saw you've had a ${roleLabel} role open${cityBit}${prospect.days_posted && prospect.days_posted > 14 ? ` for about ${prospect.days_posted} days` : ""}. Filling licensed-trade roles in Metro Detroit is brutal right now — most shops we talk to are spending $500–1,500/month on Indeed and ZipRecruiter without seeing results.

We run a Detroit-area hiring monitoring service. The second a licensed ${roleLabel} becomes available in your area, you get a text. No per-hire fees, no job-board posting fees. $149/month flat.

If you want to see who's available in your zip this week, hit reply and I'll send a sample.

— Matt
Detroit Web Agency
(313) 992-1219`;

  const postcard = `Still looking for a ${roleLabel}?

Stop paying Indeed forever.

We text you the moment a licensed ${roleLabel} becomes available in your area. $149/mo flat. No per-hire fees.

See this week's available techs:
detroitwebagent.com/hire-alert

— Detroit Web Agency · (313) 992-1219`;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied — paste into Gmail / your CRM`);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0d1f3c] border border-[#00d4ff]/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">📧 Draft for {prospect.company_name}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-white/60 uppercase mb-1">Email Subject</p>
            <div className="bg-[#0a1628] border border-white/10 rounded p-3 text-white text-sm cursor-pointer" onClick={() => copy(subject, "Subject")}>{subject}</div>
          </div>

          <div>
            <p className="text-xs text-white/60 uppercase mb-1">Email Body</p>
            <pre className="bg-[#0a1628] border border-white/10 rounded p-3 text-white text-sm whitespace-pre-wrap font-sans cursor-pointer" onClick={() => copy(body, "Email")}>{body}</pre>
          </div>

          <div>
            <p className="text-xs text-white/60 uppercase mb-1">Postcard Variant</p>
            <pre className="bg-[#0a1628] border border-white/10 rounded p-3 text-white text-sm whitespace-pre-wrap font-sans cursor-pointer" onClick={() => copy(postcard, "Postcard copy")}>{postcard}</pre>
          </div>

          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-3">
            ⚠️ Copy-paste only. Send from your own inbox / queue postcard manually. Never auto-blast.
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={onSent} className="flex-1 bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80 font-bold">Mark as Emailed</Button>
            <Button onClick={onClose} variant="outline" className="border-white/20 text-white">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
