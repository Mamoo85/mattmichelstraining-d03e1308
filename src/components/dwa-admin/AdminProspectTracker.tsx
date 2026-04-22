import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Prospect = {
  id: string;
  phone: string;
  name: string | null;
  business: string | null;
  city: string | null;
  trade: string | null;
  link_token: string;
  notes: string | null;
  clicked_at: string | null;
  signup_started_at: string | null;
  account_created_at: string | null;
  profile_completed_at: string | null;
  paid_at: string | null;
  status: string;
  created_at: string;
  nudge_sent_at: string | null;
  nudge_count: number | null;
  last_nudge_sid: string | null;
  last_nudge_status: string | null;
  last_nudge_error: string | null;
  nudge_retry_count: number | null;
};

type DraftRow = {
  id: string;
  phone: string;
  status: string;
  metadata: any;
  created_at: string;
};

const NUDGE_TEMPLATE = (trackedUrl: string, city: string | null, trade: string | null) => {
  const where = city ? ` in ${city}` : "";
  const what = trade ? ` ${trade} ` : " ";
  return `Hey — Matt with Detroit Web Agency. We send exclusive${what}leads to contractors${where} (no shared leads, no contracts). Quick look: ${trackedUrl} — reply STOP to opt out.`;
};

type FilterKey = "all" | "active" | "stalled" | "converted";
type ViewMode = "cards" | "grid";
type SortKey = "last_contact" | "status" | "nudge_count";

const STEPS = [
  { key: "clicked_at", label: "Clicked" },
  { key: "account_created_at", label: "Account" },
  { key: "profile_completed_at", label: "Profile" },
  { key: "paid_at", label: "Paid" },
] as const;

function timeAgo(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function lastActivity(p: Prospect): { label: string; iso: string } | null {
  const events = [
    { iso: p.paid_at, label: "paid" },
    { iso: p.profile_completed_at, label: "completed profile" },
    { iso: p.account_created_at, label: "created account" },
    { iso: p.clicked_at, label: "clicked link" },
    { iso: p.nudge_sent_at, label: "nudge sent" },
  ].filter((e) => e.iso) as { iso: string; label: string }[];
  if (!events.length) return null;
  events.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());
  return events[0];
}

function lastContactIso(p: Prospect): string {
  const last = lastActivity(p);
  return last ? last.iso : p.created_at;
}

function isStalled(p: Prospect): boolean {
  if (p.status !== "active") return false;
  if (p.paid_at) return false;
  return Date.now() - new Date(lastContactIso(p)).getTime() > 24 * 60 * 60 * 1000;
}

function isDead(p: Prospect): boolean {
  return p.status === "dead" || p.status === "dead_undeliverable";
}

function deliveryBadge(p: Prospect): { label: string; cls: string } | null {
  const s = p.last_nudge_status;
  if (!s) return null;
  if (s === "delivered") return { label: "✓ delivered", cls: "text-emerald-300 border-emerald-400/40" };
  if (s === "sent") return { label: "✓ sent", cls: "text-emerald-300/80 border-emerald-400/30" };
  if (s === "queued") return { label: "⏳ queued", cls: "text-[#00d4ff] border-[#00d4ff]/40" };
  if (s === "undelivered") return { label: "✗ undelivered", cls: "text-amber-300 border-amber-400/40" };
  if (s === "failed") return { label: "✗ failed", cls: "text-red-300 border-red-400/40" };
  return { label: s, cls: "text-white/60 border-white/15" };
}

export default function AdminProspectTracker() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Prospect[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<ViewMode>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("prospect_tracker_view") : null;
    return saved === "grid" ? "grid" : "cards";
  });
  const [sortKey, setSortKey] = useState<SortKey>("last_contact");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", business: "", city: "", trade: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("prospect_tracker_view", view);
  }, [view]);

  async function load() {
    const [{ data: pData }, { data: dData }] = await Promise.all([
      supabase.from("prospect_nudges").select("*").order("created_at", { ascending: false }),
      supabase
        .from("sms_reply_drafts")
        .select("id, phone, status, metadata, created_at")
        .eq("status", "pending"),
    ]);
    if (pData) setRows(pData as Prospect[]);
    if (dData) setDrafts(dData as DraftRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch1 = supabase
      .channel("prospect_nudges_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_nudges" }, () => load())
      .subscribe();
    const ch2 = supabase
      .channel("sms_reply_drafts_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_reply_drafts" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, []);

  // Map prospect_id → pending draft
  const pendingByProspect = useMemo(() => {
    const m = new Map<string, DraftRow>();
    for (const d of drafts) {
      const pid = d.metadata?.prospect_id as string | undefined;
      if (pid && d.metadata?.source === "prospect_nudge") m.set(pid, d);
    }
    return m;
  }, [drafts]);

  const filtered = useMemo(() => {
    const f = rows.filter((p) => {
      if (filter === "all") return true;
      if (filter === "active") return p.status === "active" && !p.paid_at;
      if (filter === "stalled") return isStalled(p);
      if (filter === "converted") return !!p.paid_at || p.status === "converted";
      return true;
    });
    const sorted = [...f].sort((a, b) => {
      if (sortKey === "last_contact") {
        return new Date(lastContactIso(b)).getTime() - new Date(lastContactIso(a)).getTime();
      }
      if (sortKey === "nudge_count") return (b.nudge_count ?? 0) - (a.nudge_count ?? 0);
      // status: active → stalled → converted → dead
      const rank = (p: Prospect) =>
        isDead(p) ? 4 : !!p.paid_at || p.status === "converted" ? 3 : isStalled(p) ? 2 : 1;
      return rank(a) - rank(b);
    });
    return sorted;
  }, [rows, filter, sortKey]);

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter((p) => p.status === "active" && !p.paid_at).length,
    stalled: rows.filter(isStalled).length,
    converted: rows.filter((p) => !!p.paid_at || p.status === "converted").length,
  }), [rows]);

  async function copyLink(token: string) {
    const url = `https://detroitwebagent.com/r/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  }

  async function sendNudge(p: Prospect) {
    if (pendingByProspect.has(p.id)) {
      toast({ title: "Already awaiting your Y", description: "A draft is already pending for this prospect." });
      return;
    }
    const trackedUrl = `https://detroitwebagent.com/r/${p.link_token}`;
    const body = NUDGE_TEMPLATE(trackedUrl, p.city, p.trade);

    // 1. Insert pending draft
    const { data: draft, error: dErr } = await supabase
      .from("sms_reply_drafts")
      .insert({
        phone: p.phone,
        draft_body: body,
        status: "pending",
        metadata: { source: "prospect_nudge", prospect_id: p.id, template: "dwa_prospect_nudge" },
      })
      .select("id")
      .single();

    if (dErr || !draft) {
      toast({ title: "Draft failed", description: dErr?.message || "Unknown error", variant: "destructive" });
      return;
    }

    // 2. Ask Matt to approve via SMS
    const { error: aErr } = await supabase.functions.invoke("prospect-nudge-request-approval", {
      body: { draft_id: (draft as any).id },
    });
    if (aErr) {
      toast({ title: "Approval text failed", description: aErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "📋 Approval requested", description: `Matt will get a Y/N text for ${p.phone}` });
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("prospect_nudges").update({ status }).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else toast({ title: `Marked ${status}` });
  }

  async function addProspect(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.trim()) {
      toast({ title: "Phone required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("prospect_nudges").insert({
      phone: form.phone.trim(),
      name: form.name.trim() || null,
      business: form.business.trim() || null,
      city: form.city.trim() || null,
      trade: form.trade.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Add failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Prospect added" });
      setForm({ phone: "", name: "", business: "", city: "", trade: "", notes: "" });
      setShowAdd(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📍 Prospect Tracker</h1>
          <p className="text-white/50 text-sm mt-1">Live status of nudged contractor prospects.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-white/15 overflow-hidden">
            <button
              onClick={() => setView("cards")}
              className={`px-3 py-1.5 text-xs ${view === "cards" ? "bg-[#00d4ff] text-[#0a1628]" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
            >
              🗂 Cards
            </button>
            <button
              onClick={() => setView("grid")}
              className={`px-3 py-1.5 text-xs ${view === "grid" ? "bg-[#00d4ff] text-[#0a1628]" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
            >
              📊 Grid
            </button>
          </div>
          <Button
            onClick={() => setShowAdd((v) => !v)}
            className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80"
          >
            {showAdd ? "Cancel" : "+ Add Prospect"}
          </Button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={addProspect}
          className="rounded-lg border border-white/10 bg-white/5 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <Input placeholder="Phone (required) e.g. +17346207178" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-[#0a1628] border-white/20 text-white" />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0a1628] border-white/20 text-white" />
          <Input placeholder="Business" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} className="bg-[#0a1628] border-white/20 text-white" />
          <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-[#0a1628] border-white/20 text-white" />
          <Input placeholder="Trade (electrical, hvac, plumbing…)" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} className="bg-[#0a1628] border-white/20 text-white" />
          <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-[#0a1628] border-white/20 text-white" />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting} className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80">
              {submitting ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {(["all", "active", "stalled", "converted"] as FilterKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-wide border transition ${
              filter === k
                ? "bg-[#00d4ff] text-[#0a1628] border-[#00d4ff]"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            }`}
          >
            {k} <span className="opacity-70">({counts[k]})</span>
          </button>
        ))}
        {view === "grid" && (
          <div className="ml-auto flex items-center gap-2 text-xs text-white/60">
            Sort:
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-[#0a1628] border border-white/15 text-white rounded px-2 py-1"
            >
              <option value="last_contact">Last Contact</option>
              <option value="status">Status</option>
              <option value="nudge_count">Nudge Count</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-white/40 text-sm">Loading prospects…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/50 text-sm">
          No prospects in this view.
        </div>
      ) : view === "grid" ? (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="text-left p-2">Phone · City</th>
                <th className="text-left p-2">Trade</th>
                <th className="text-left p-2">Last Contact</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Nudges</th>
                <th className="text-left p-2">Delivery</th>
                <th className="text-right p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stalled = isStalled(p);
                const dead = isDead(p);
                const converted = !!p.paid_at || p.status === "converted";
                const status = converted ? "converted" : dead ? "dead" : stalled ? "stalled" : "active";
                const statusCls = converted
                  ? "text-emerald-300"
                  : dead
                  ? "text-white/40"
                  : stalled
                  ? "text-amber-300"
                  : "text-[#00d4ff]";
                const dot = converted ? "🟢" : dead ? "🔴" : stalled ? "🟠" : "🟢";
                const delivery = deliveryBadge(p);
                const pendingDraft = pendingByProspect.get(p.id);
                return (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 text-white">
                      <div className="font-medium">{p.phone}</div>
                      <div className="text-white/50 text-xs">{p.city || "—"}</div>
                    </td>
                    <td className="p-2 text-white/80">{p.trade || "—"}</td>
                    <td className="p-2 text-white/70 text-xs">{timeAgo(lastContactIso(p)) || "—"}</td>
                    <td className={`p-2 text-xs ${statusCls}`}>
                      {dot} {status}
                    </td>
                    <td className="p-2 text-white/80 text-xs">{p.nudge_count ?? 0}×</td>
                    <td className="p-2 text-xs">
                      {delivery ? (
                        <span className={`px-1.5 py-0.5 rounded border ${delivery.cls}`}>{delivery.label}</span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {pendingDraft ? (
                        <span className="text-amber-300 text-[10px] uppercase tracking-wide">⏳ Awaiting Y</span>
                      ) : (
                        <Button
                          onClick={() => sendNudge(p)}
                          size="sm"
                          disabled={dead}
                          className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80 disabled:opacity-40 h-7 px-2 text-xs"
                        >
                          📤 Send Next
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const last = lastActivity(p);
            const stalled = isStalled(p);
            const converted = !!p.paid_at || p.status === "converted";
            const dead = isDead(p);
            const delivery = deliveryBadge(p);
            const pendingDraft = pendingByProspect.get(p.id);
            return (
              <div
                key={p.id}
                className={`rounded-lg border p-4 bg-white/5 ${
                  dead
                    ? "border-white/5 opacity-60"
                    : converted
                    ? "border-emerald-400/40"
                    : stalled
                    ? "border-amber-400/40"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {p.phone}{" "}
                      <span className="text-white/40 font-normal">
                        · {[p.city, p.trade].filter(Boolean).join(" ") || "no details"}
                      </span>
                    </div>
                    {(p.name || p.business) && (
                      <div className="text-white/60 text-sm truncate">
                        {[p.name, p.business].filter(Boolean).join(" — ")}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${
                      converted
                        ? "border-emerald-400/40 text-emerald-300"
                        : dead
                        ? "border-white/10 text-white/40"
                        : stalled
                        ? "border-amber-400/40 text-amber-300"
                        : "border-[#00d4ff]/40 text-[#00d4ff]"
                    }`}
                  >
                    {converted ? "converted" : dead ? p.status : stalled ? "stalled" : "active"}
                  </span>
                </div>

                {/* 4-step progress */}
                <div className="mt-4 flex items-center gap-1">
                  {STEPS.map((s, i) => {
                    const done = !!(p as any)[s.key];
                    return (
                      <div key={s.key} className="flex items-center flex-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                            done
                              ? "bg-emerald-400 text-[#0a1628]"
                              : stalled && i === 0
                              ? "bg-amber-400/30 text-amber-200 border border-amber-400/60"
                              : "bg-white/10 text-white/40 border border-white/15"
                          }`}
                          title={s.label}
                        >
                          {done ? "✓" : i + 1}
                        </div>
                        {i < STEPS.length - 1 && (
                          <div
                            className={`h-0.5 flex-1 mx-1 ${
                              done && (p as any)[STEPS[i + 1].key] ? "bg-emerald-400" : done ? "bg-emerald-400/40" : "bg-white/10"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wide text-white/40">
                  {STEPS.map((s) => (
                    <span key={s.key} className="flex-1 text-center">
                      {s.label}
                    </span>
                  ))}
                </div>

                <div className="mt-3 text-xs text-white/50">
                  {last ? (
                    <>
                      Last activity: <span className="text-white/80">{last.label}</span> {timeAgo(last.iso)}
                    </>
                  ) : (
                    <>No activity yet · seeded {timeAgo(p.created_at)}</>
                  )}
                </div>

                {p.nudge_sent_at && (
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40 flex-wrap">
                    <span>📤 Last nudge: {timeAgo(p.nudge_sent_at)}</span>
                    {(p.nudge_count ?? 0) > 1 && <span>· sent {p.nudge_count}×</span>}
                    {delivery && (
                      <span className={`px-1.5 py-0.5 rounded border ${delivery.cls}`}>{delivery.label}</span>
                    )}
                    {(p.nudge_retry_count ?? 0) > 0 && (
                      <span className="text-amber-300/80">· {p.nudge_retry_count} retry</span>
                    )}
                  </div>
                )}

                {pendingDraft && (
                  <div className="mt-2 inline-block text-[11px] px-2 py-0.5 rounded border border-amber-400/40 text-amber-300">
                    ⏳ Awaiting your Y · sent {timeAgo(pendingDraft.created_at)}
                  </div>
                )}

                {p.notes && (
                  <div className="mt-2 text-xs text-white/60 italic border-l-2 border-white/10 pl-2">{p.notes}</div>
                )}

                <div className="mt-4 flex gap-2 flex-wrap">
                  <Button
                    onClick={() => sendNudge(p)}
                    size="sm"
                    disabled={dead || !!pendingDraft}
                    className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80 disabled:opacity-40"
                  >
                    📤 {pendingDraft ? "Awaiting Y…" : p.nudge_sent_at ? "Send again" : "Send nudge SMS"}
                  </Button>
                  <Button
                    onClick={() => copyLink(p.link_token)}
                    size="sm"
                    variant="outline"
                    className="border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/10"
                  >
                    Copy tracked link
                  </Button>
                  {!dead && !converted && (
                    <Button
                      onClick={() => setStatus(p.id, "dead")}
                      size="sm"
                      variant="outline"
                      className="border-white/15 text-white/60 hover:bg-white/5"
                    >
                      Mark dead
                    </Button>
                  )}
                  {dead && (
                    <Button
                      onClick={() => setStatus(p.id, "active")}
                      size="sm"
                      variant="outline"
                      className="border-white/15 text-white/60 hover:bg-white/5"
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
