import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Play } from "lucide-react";

type Status = "idle" | "running" | "ok" | "fail";
type Result = { status: Status; detail?: string };

const TIERS = ["core", "pro", "enterprise"] as const;

export default function BuyerRadarQAChecklist() {
  const [r, setR] = useState<Record<string, Result>>({});

  const set = (k: string, v: Result) => setR((p) => ({ ...p, [k]: v }));

  const checkTables = async () => {
    set("tables", { status: "running" });
    try {
      const [a, b, c] = await Promise.all([
        supabase.from("buyer_radar_rfqs" as any).select("id", { count: "exact", head: true }),
        supabase.from("buyer_radar_accounts" as any).select("id", { count: "exact", head: true }),
        supabase.from("buyer_radar_custom_requests" as any).select("id", { count: "exact", head: true }),
      ]);
      const errs = [a.error, b.error, c.error].filter(Boolean);
      if (errs.length) throw errs[0];
      set("tables", { status: "ok", detail: `RFQs: ${a.count ?? 0} · Accounts: ${b.count ?? 0} · Custom requests: ${c.count ?? 0}` });
    } catch (e: any) {
      set("tables", { status: "fail", detail: e?.message || "table query failed" });
    }
  };

  const checkRecentRfqs = async () => {
    set("recent-rfqs", { status: "running" });
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("buyer_radar_rfqs" as any)
        .select("id", { count: "exact", head: true })
        .gte("detected_at", since);
      if (error) throw error;
      set("recent-rfqs", { status: "ok", detail: `${count ?? 0} RFQs detected in last 24h` });
    } catch (e: any) {
      set("recent-rfqs", { status: "fail", detail: e?.message });
    }
  };

  const runScanner = async () => {
    set("scanner", { status: "running" });
    try {
      const { data, error } = await supabase.functions.invoke("rfq-bid-scanner");
      if (error) throw error;
      const sam = data?.sam?.inserted ?? 0;
      const sonar = data?.sonar?.inserted ?? 0;
      set("scanner", { status: "ok", detail: `SAM.gov: ${sam} · Sonar: ${sonar}` });
    } catch (e: any) {
      set("scanner", { status: "fail", detail: e?.message });
    }
  };

  const checkSignals = async () => {
    set("signals", { status: "running" });
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("industry_pulse_signals" as any)
        .select("id", { count: "exact", head: true })
        .gte("detected_at", since);
      if (error) throw error;
      set("signals", { status: "ok", detail: `${count ?? 0} signals in last 7 days` });
    } catch (e: any) {
      set("signals", { status: "fail", detail: e?.message });
    }
  };

  const checkCheckout = async (tier: typeof TIERS[number]) => {
    const k = `checkout-${tier}`;
    set(k, { status: "running" });
    try {
      const { data, error } = await supabase.functions.invoke("create-buyer-radar-checkout", {
        body: { email: "qa+buyer-radar@detroitwebagent.com", company_name: "QA Test", tier, vertical: "steel" },
      });
      if (error) throw error;
      if (!data?.url || !data.url.includes("stripe")) throw new Error("no Stripe URL returned");
      set(k, { status: "ok", detail: `Stripe URL generated (${data.url.slice(0, 60)}…)` });
    } catch (e: any) {
      set(k, { status: "fail", detail: e?.message });
    }
  };

  const checkWebhookLogs = async () => {
    set("webhook", { status: "running" });
    try {
      const { data, error } = await supabase
        .from("system_comms_log" as any)
        .select("id,created_at")
        .ilike("body", "%buyer_radar%")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const last = (data as any[])?.[0]?.created_at;
      set("webhook", { status: "ok", detail: last ? `Last buyer_radar webhook log: ${new Date(last).toLocaleString()}` : "No webhook logs found yet (expected if no live signups)" });
    } catch (e: any) {
      set("webhook", { status: "fail", detail: e?.message });
    }
  };

  const checkPages = async () => {
    set("pages", { status: "running" });
    try {
      const urls = ["/buyer-radar", "/buyer-radar/demo", "/buyer-radar/pricing", "/my-buyer-radar"];
      // Just confirm routes resolve via fetch HEAD on production origin
      const origin = window.location.origin;
      const results = await Promise.all(urls.map(async (u) => {
        try {
          const res = await fetch(`${origin}${u}`, { method: "HEAD" });
          return { u, ok: res.ok };
        } catch { return { u, ok: false }; }
      }));
      const failed = results.filter((x) => !x.ok).map((x) => x.u);
      if (failed.length === 0) set("pages", { status: "ok", detail: `All ${urls.length} pages reachable` });
      else set("pages", { status: "fail", detail: `Failed: ${failed.join(", ")}` });
    } catch (e: any) {
      set("pages", { status: "fail", detail: e?.message });
    }
  };

  const runAll = async () => {
    await Promise.all([
      checkTables(), checkRecentRfqs(), checkSignals(),
      ...TIERS.map((t) => checkCheckout(t)),
      checkWebhookLogs(), checkPages(),
    ]);
  };

  const Row = ({ id, label, run }: { id: string; label: string; run: () => void }) => {
    const res = r[id] || { status: "idle" as Status };
    return (
      <div className="flex items-center justify-between gap-3 py-3 border-b border-[#1e3a5f]/60">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {res.status === "ok" && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
          {res.status === "fail" && <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />}
          {res.status === "running" && <Loader2 className="w-5 h-5 text-[#00d4ff] animate-spin flex-shrink-0" />}
          {res.status === "idle" && <div className="w-5 h-5 rounded-full border border-[#1e3a5f] flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{label}</p>
            {res.detail && <p className="text-xs text-[#94a3b8] truncate">{res.detail}</p>}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={res.status === "running"} className="border-[#1e3a5f] text-white hover:bg-[#0a1628]">
          <Play className="w-3 h-3 mr-1" /> Run
        </Button>
      </div>
    );
  };

  return (
    <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">🛡️ Buyer Radar — Pre-Meeting QA</h2>
          <p className="text-xs text-[#94a3b8]">Run before any sales meeting. Read-only checks; no production data is mutated.</p>
        </div>
        <Button onClick={runAll} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
          Run All
        </Button>
      </div>
      <div>
        <Row id="tables"        label="DB tables exist (rfqs, accounts, custom requests)" run={checkTables} />
        <Row id="recent-rfqs"   label="RFQs detected in last 24h" run={checkRecentRfqs} />
        <Row id="scanner"       label="Run RFQ scanner now" run={runScanner} />
        <Row id="signals"       label="Industry pulse signals (last 7d)" run={checkSignals} />
        {TIERS.map((t) => (
          <Row key={t} id={`checkout-${t}`} label={`Stripe checkout — ${t}`} run={() => checkCheckout(t)} />
        ))}
        <Row id="webhook"       label="Webhook logs reference buyer_radar" run={checkWebhookLogs} />
        <Row id="pages"         label="All Buyer Radar pages reachable" run={checkPages} />
      </div>
    </div>
  );
}
