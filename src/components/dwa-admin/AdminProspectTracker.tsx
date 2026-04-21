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
};

const NUDGE_TEMPLATE = (trackedUrl: string, city: string | null, trade: string | null) => {
  const where = city ? ` in ${city}` : "";
  const what = trade ? ` ${trade} ` : " ";
  return `Hey — Matt with Detroit Web Agency. We send exclusive${what}leads to contractors${where} (no shared leads, no contracts). Quick look: ${trackedUrl} — reply STOP to opt out.`;
};

type FilterKey = "all" | "active" | "stalled" | "converted";

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
  ].filter((e) => e.iso) as { iso: string; label: string }[];
  if (!events.length) return null;
  events.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());
  return events[0];
}

function isStalled(p: Prospect): boolean {
  if (p.status !== "active") return false;
  if (p.paid_at) return false;
  const last = lastActivity(p);
  const ref = last ? last.iso : p.created_at;
  return Date.now() - new Date(ref).getTime() > 24 * 60 * 60 * 1000;
}

export default function AdminProspectTracker() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", business: "", city: "", trade: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("prospect_nudges")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as Prospect[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("prospect_nudges_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_nudges" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      if (filter === "all") return true;
      if (filter === "active") return p.status === "active" && !p.paid_at;
      if (filter === "stalled") return isStalled(p);
      if (filter === "converted") return !!p.paid_at || p.status === "converted";
      return true;
    });
  }, [rows, filter]);

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
    const trackedUrl = `https://detroitwebagent.com/r/${p.link_token}`;
    const body = NUDGE_TEMPLATE(trackedUrl, p.city, p.trade);
    const confirmMsg = `Send tracked nudge SMS to ${p.phone}?\n\n${body}`;
    if (!window.confirm(confirmMsg)) return;
    const { data, error } = await supabase.functions.invoke("dwa-send-sms", {
      body: { to: p.phone, body, product: "dwa_prospect_nudge" },
    });
    if (error || !data?.success) {
      toast({
        title: "Send failed",
        description: error?.message || data?.error || "Unknown error",
        variant: "destructive",
      });
      return;
    }
    const { error: upErr } = await supabase
      .from("prospect_nudges")
      .update({
        nudge_sent_at: new Date().toISOString(),
        nudge_count: (p.nudge_count ?? 0) + 1,
      })
      .eq("id", p.id);
    if (upErr) {
      toast({ title: "Sent, but log failed", description: upErr.message, variant: "destructive" });
    } else {
      toast({ title: "Nudge sent ✓", description: p.phone });
    }
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("prospect_nudges").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Marked ${status}` });
    }
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
        <Button
          onClick={() => setShowAdd((v) => !v)}
          className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80"
        >
          {showAdd ? "Cancel" : "+ Add Prospect"}
        </Button>
      </div>

      {showAdd && (
        <form
          onSubmit={addProspect}
          className="rounded-lg border border-white/10 bg-white/5 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <Input
            placeholder="Phone (required) e.g. +17346207178"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="bg-[#0a1628] border-white/20 text-white"
          />
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-[#0a1628] border-white/20 text-white"
          />
          <Input
            placeholder="Business"
            value={form.business}
            onChange={(e) => setForm({ ...form, business: e.target.value })}
            className="bg-[#0a1628] border-white/20 text-white"
          />
          <Input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="bg-[#0a1628] border-white/20 text-white"
          />
          <Input
            placeholder="Trade (electrical, hvac, plumbing…)"
            value={form.trade}
            onChange={(e) => setForm({ ...form, trade: e.target.value })}
            className="bg-[#0a1628] border-white/20 text-white"
          />
          <Input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="bg-[#0a1628] border-white/20 text-white"
          />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting} className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80">
              {submitting ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      )}

      <div className="flex gap-2 flex-wrap">
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
      </div>

      {loading ? (
        <div className="text-white/40 text-sm">Loading prospects…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/50 text-sm">
          No prospects in this view.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const last = lastActivity(p);
            const stalled = isStalled(p);
            const converted = !!p.paid_at || p.status === "converted";
            const dead = p.status === "dead";
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
                    {converted ? "converted" : dead ? "dead" : stalled ? "stalled" : "active"}
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
                  <div className="mt-1 text-[11px] text-white/40">
                    📤 Last nudge: {timeAgo(p.nudge_sent_at)}
                    {(p.nudge_count ?? 0) > 1 && <span className="ml-1">· sent {p.nudge_count}×</span>}
                  </div>
                )}

                {p.notes && (
                  <div className="mt-2 text-xs text-white/60 italic border-l-2 border-white/10 pl-2">{p.notes}</div>
                )}

                <div className="mt-4 flex gap-2 flex-wrap">
                  <Button
                    onClick={() => sendNudge(p)}
                    size="sm"
                    disabled={dead}
                    className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/80 disabled:opacity-40"
                  >
                    📤 {p.nudge_sent_at ? "Send again" : "Send nudge SMS"}
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
