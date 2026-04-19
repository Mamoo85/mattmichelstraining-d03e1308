import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, RefreshCw, Trash2, Eye, Zap, Loader2, Building2,
  Mail, Phone, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import { CandidateDetailModal } from "./CandidateDetailModal";

interface Cand {
  id: string;
  name: string | null;
  full_name: string | null;
  license_type: string | null;
  license_number: string | null;
  city: string | null;
  state: string | null;
  source: string;
  status: string | null;
  phone: string | null;
  email: string | null;
  linkedin_url: string | null;
  current_employer: string | null;
  score: number | null;
  data_completeness: number | null;
  is_company_name: boolean | null;
  first_seen_at: string;
  enriched_at: string | null;
}

type FilterKey = "all" | "has_phone" | "has_email" | "no_contact" | "companies" | "high_score";

const PAGE_SIZE = 50;

export function CandidateWorkbench() {
  const [rows, setRows] = useState<Cand[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(0);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    let q = (supabase as any)
      .from("hire_alert_candidates")
      .select(
        "id,name,full_name,license_type,license_number,city,state,source,status,phone,email,linkedin_url,current_employer,score,data_completeness,is_company_name,first_seen_at,enriched_at",
        { count: "exact" }
      );

    // Filters
    if (filter === "has_phone") q = q.not("phone", "is", null).neq("phone", "");
    else if (filter === "has_email") q = q.not("email", "is", null).neq("email", "");
    else if (filter === "no_contact") q = q.is("phone", null).is("email", null);
    else if (filter === "companies") q = q.eq("is_company_name", true);
    else if (filter === "high_score") q = q.gte("score", 7);

    // Search across name / license_type / city / source
    if (search.trim()) {
      const s = search.trim().replace(/[%]/g, "");
      q = q.or(
        `full_name.ilike.%${s}%,name.ilike.%${s}%,license_type.ilike.%${s}%,city.ilike.%${s}%,source.ilike.%${s}%,current_employer.ilike.%${s}%,license_number.ilike.%${s}%`
      );
    }

    q = q.order("first_seen_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const { data, count, error } = await q;
    if (error) toast.error("Load failed: " + error.message);
    else {
      setRows((data as Cand[]) || []);
      setTotal(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if (page !== 0) setPage(0);
      else load();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const setBusy = (id: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const quickEnrich = async (c: Cand) => {
    setBusy(c.id, true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-candidate-manual", {
        body: { candidate_id: c.id },
      });
      if (error) throw new Error(error.message || "Enrich failed");
      const d = data as { fields_added?: string[]; hits?: Record<string, { ok: boolean }>; error?: string };
      if (d.error) throw new Error(d.error);
      const added = d.fields_added || [];
      if (added.length === 0) {
        toast.info(`No new fields for ${c.full_name || c.name} — sources tried: ${Object.keys(d.hits || {}).join(", ")}`);
      } else {
        toast.success(`+${added.length} fields: ${added.join(", ")}`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Enrich failed");
    } finally {
      setBusy(c.id, false);
    }
  };

  const deepEnrich = async (c: Cand) => {
    setBusy(c.id, true);
    try {
      const { error } = await supabase.functions.invoke("candidate-deep-enrich", {
        body: { candidate_id: c.id, force: true },
      });
      if (error) throw new Error(error.message || "Deep enrich failed");
      toast.success("Deep enrich queued — refresh in ~30s");
      setTimeout(load, 8000);
    } catch (e: any) {
      toast.error(e.message || "Deep enrich failed");
    } finally {
      setBusy(c.id, false);
    }
  };

  const markCompany = async (c: Cand) => {
    if (!confirm(`Flag "${c.full_name || c.name}" as a company name? It will be hidden from clients.`)) return;
    const { error } = await (supabase as any).from("hire_alert_candidates")
      .update({ is_company_name: true }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Flagged as company"); load(); }
  };

  const remove = async (c: Cand) => {
    if (!confirm(`Delete "${c.full_name || c.name}" permanently?`)) return;
    const { error } = await (supabase as any).from("hire_alert_candidates").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const counts = useMemo(() => {
    const c = { phone: 0, email: 0, none: 0, co: 0 };
    for (const r of rows) {
      if (r.phone) c.phone++;
      if (r.email) c.email++;
      if (!r.phone && !r.email) c.none++;
      if (r.is_company_name) c.co++;
    }
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      {detailId && <CandidateDetailModal candidateId={detailId} onClose={() => setDetailId(null)} />}

      {/* Header / actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, license type, city, source, employer…"
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
          />
        </div>
        <Button size="sm" variant="outline" onClick={load} className="border-white/15 text-white/70 hover:text-white">
          <RefreshCw size={13} className="mr-1" /> Refresh
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {([
          ["all", `All (${total})`],
          ["has_phone", "📞 Has phone"],
          ["has_email", "✉ Has email"],
          ["no_contact", "🚫 No contact"],
          ["high_score", "🔥 Score ≥ 7"],
          ["companies", "🏢 Companies"],
        ] as [FilterKey, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setPage(0); setFilter(k); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === k ? "bg-amber-500 text-white" : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mini summary on current page */}
      <div className="text-xs text-white/40 flex flex-wrap gap-3">
        <span>Page {page + 1} of {totalPages}</span>
        <span>·</span>
        <span><Phone className="inline" size={11} /> {counts.phone}</span>
        <span><Mail className="inline" size={11} /> {counts.email}</span>
        <span>🚫 {counts.none}</span>
        <span>🏢 {counts.co}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/3">
            <tr className="border-b border-white/10">
              <th className="text-left px-3 py-2 text-white/40 font-semibold">Name</th>
              <th className="text-left px-3 py-2 text-white/40 font-semibold hidden md:table-cell">Trade / License</th>
              <th className="text-left px-3 py-2 text-white/40 font-semibold hidden sm:table-cell">City</th>
              <th className="text-left px-3 py-2 text-white/40 font-semibold hidden lg:table-cell">Source</th>
              <th className="text-center px-3 py-2 text-white/40 font-semibold">Contact</th>
              <th className="text-center px-3 py-2 text-white/40 font-semibold hidden sm:table-cell">Score</th>
              <th className="text-right px-3 py-2 text-white/40 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-12 text-center text-white/40">
                <Loader2 size={18} className="inline animate-spin mr-2" /> Loading…
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-12 text-center text-white/40">No candidates match.</td></tr>
            ) : rows.map((c) => {
              const busy = busyIds.has(c.id);
              return (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-3 py-2">
                    <div className="text-white font-semibold">{c.full_name || c.name || "—"}</div>
                    {c.current_employer && (
                      <div className="text-white/40 text-[10px] flex items-center gap-1">
                        <Building2 size={9} /> {c.current_employer}
                      </div>
                    )}
                    {c.is_company_name && (
                      <Badge className="text-[9px] py-0 mt-1 bg-red-500/15 text-red-400 border-red-500/30">company</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="text-white/70">{c.license_type || "—"}</div>
                    {c.license_number && <div className="text-white/30 text-[10px] font-mono">{c.license_number}</div>}
                  </td>
                  <td className="px-3 py-2 text-white/60 hidden sm:table-cell">{c.city || "—"}</td>
                  <td className="px-3 py-2 text-white/40 hidden lg:table-cell capitalize">{c.source}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {c.phone ? <Phone size={11} className="text-emerald-400" /> : <Phone size={11} className="text-white/15" />}
                      {c.email ? <Mail size={11} className="text-emerald-400" /> : <Mail size={11} className="text-white/15" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center hidden sm:table-cell">
                    <span className={`font-bold ${(c.score ?? 0) >= 7 ? "text-emerald-400" : (c.score ?? 0) >= 5 ? "text-amber-400" : "text-white/40"}`}>
                      {c.score ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => quickEnrich(c)}
                        disabled={busy}
                        title="Quick enrich (PDL + Hunter + Sonar)"
                        className="p-1.5 rounded hover:bg-amber-500/15 text-white/40 hover:text-amber-400 transition-colors disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      </button>
                      <button
                        onClick={() => deepEnrich(c)}
                        disabled={busy}
                        title="Deep enrich (full waterfall — slower)"
                        className="p-1.5 rounded hover:bg-cyan-500/15 text-white/40 hover:text-cyan-400 transition-colors disabled:opacity-50 hidden sm:inline"
                      >
                        <Sparkles size={12} />
                      </button>
                      <button
                        onClick={() => setDetailId(c.id)}
                        title="View full detail"
                        className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                      >
                        <Eye size={12} />
                      </button>
                      {!c.is_company_name && (
                        <button
                          onClick={() => markCompany(c)}
                          title="Mark as company name (hide from clients)"
                          className="p-1.5 rounded hover:bg-orange-500/15 text-white/40 hover:text-orange-400 transition-colors hidden sm:inline"
                        >
                          <Building2 size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => remove(c)}
                        title="Delete permanently"
                        className="p-1.5 rounded hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/40">
          {total > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}` : "0 results"}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm" variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="border-white/15 text-white/60 disabled:opacity-30"
          >
            <ChevronLeft size={13} /> Prev
          </Button>
          <Button
            size="sm" variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="border-white/15 text-white/60 disabled:opacity-30"
          >
            Next <ChevronRight size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}
