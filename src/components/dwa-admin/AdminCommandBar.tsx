import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  validatePrompt,
  validateRecipient,
  validateRegenerateParams,
  validateQueuePayload,
} from "@/lib/validateCommandInputs";

type Draft = {
  to_email?: string;
  to_phone?: string;
  to_name?: string;
  subject?: string;
  body: string;
  _skip?: boolean;
  _tone?: string;
  _angle?: string;
  _regenerating?: boolean;
};
type StepLog = { step: number; tool: string; ok: boolean; count?: number; error?: string; preview?: any[] };
type RiskLevel = "ok" | "warn" | "block";
type RunResult = {
  ok?: boolean;
  log_id?: string;
  reasoning?: string;
  output_format?: string;
  steps?: StepLog[];
  data_rows?: any[];
  drafts?: Draft[] | null;
  partial?: boolean;
  cost_usd?: number;
  aborted?: boolean;
  reason?: string;
  error?: string;
  blocked?: boolean;
  needs_confirm?: boolean;
  risk?: RiskLevel;
  risk_reasons?: string[];
  result_summary?: any;
};
type HistoryRow = {
  id: string;
  prompt: string;
  total_cost_usd: number | null;
  rows_returned: number | null;
  created_at: string;
  is_test: boolean;
  result_summary: any;
  user_action?: string | null;
};
type TestRow = {
  product: string;
  prompt: string;
  status: "idle" | "running" | "pass" | "fail";
  detail?: string;
  cost?: number;
};

const RECENT_KEY = "dwa_admin_command_recent_v1";
const QUICK_PROMPTS = [
  "How many electrician leads do we have, broken down by city",
  "Top 10 Demand Radar signals this week",
  "Match 5 plumbing leads to 10 buyers and draft bulk emails",
  "Find 5 nursing homes with low staffing and draft Talent Radar pitches",
  "Find 5 HVAC shops 3-15 techs and draft FieldDesk pitches",
  "Who texted us in the last 7 days that I never replied to",
];
const TONES = ["direct", "warm", "urgent", "curious"];
const TEST_PRODUCTS: TestRow[] = [
  { product: "Demand Radar",      prompt: "Find 3 high-confidence demand radar signals and draft outreach to one buyer per signal", status: "idle" },
  { product: "Talent Radar",      prompt: "Find 3 hot Talent Radar candidates and draft pitches to matching clients", status: "idle" },
  { product: "Contractor Leads",  prompt: "Find 3 unclaimed plumbing leads and draft 5 buyer pitches", status: "idle" },
  { product: "FieldDesk",         prompt: "Find 3 HVAC shops and draft FieldDesk pitches", status: "idle" },
  { product: "Missed Call Catch", prompt: "Find 3 small businesses with no website and draft Missed Call Catch pitches", status: "idle" },
];

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function productKeyFromPrompt(p: string): string {
  const lc = p.toLowerCase();
  if (lc.includes("demand")) return "demand_radar";
  if (lc.includes("talent") || lc.includes("nursing") || lc.includes("candidate")) return "talent_radar";
  if (lc.includes("contractor") || lc.includes("plumb") || lc.includes("electric") || lc.includes("hvac")) return "contractor_leads";
  if (lc.includes("fielddesk") || lc.includes("dispatch")) return "fielddesk";
  if (lc.includes("missed call") || lc.includes("no website")) return "missed_call_catch";
  return "contractor_leads";
}

export default function AdminCommandBar() {
  const isMobile = useIsMobile();
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ prompt: string; reasons: string[] } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState({ reasoning: false, data: false, drafts: true, history: false, test: false });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [queuing, setQueuing] = useState(false);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [diff, setDiff] = useState<{ original: any; replay: any } | null>(null);
  const [tests, setTests] = useState<TestRow[]>(TEST_PRODUCTS);
  const [testRunning, setTestRunning] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const raw = safeLocalStorage.getItem(RECENT_KEY);
    if (raw) try { setRecent(JSON.parse(raw)); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 120);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (result?.drafts && Array.isArray(result.drafts)) {
      setDrafts(result.drafts.map((d) => ({ ...d, _skip: false, _tone: "direct", _angle: "" })));
      setOpen((o) => ({ ...o, reasoning: false, data: false, drafts: true }));
    } else if (result) {
      setDrafts([]);
      setOpen((o) => ({ ...o, reasoning: !!result.reasoning, data: !!result.data_rows?.length, drafts: false }));
    }
  }, [result]);

  const pushRecent = (p: string) => {
    const next = [p, ...recent.filter((r) => r !== p)].slice(0, 10);
    setRecent(next);
    safeLocalStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const callCommand = useCallback(async (body: any): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("admin-command", { body });
    if (error) throw new Error(error.message);
    return data;
  }, []);

  // Two-phase run: preview → (block/warn/ok) → run
  const run = useCallback(async (text?: string, opts?: { confirmed?: boolean; isTest?: boolean; replayOf?: string }) => {
    const q = (text ?? prompt).trim();
    if (!q || running) return null;

    // Client-side guard: stop bad prompts before they hit the edge function.
    const promptCheck = validatePrompt(q);
    if (promptCheck.ok === false) {
      setResult({ error: promptCheck.reason, blocked: true, risk: "block", risk_reasons: [promptCheck.reason] });
      return null;
    }

    setRunning(true);
    setResult(null);
    setQueueMsg(null);
    setDiff(null);
    if (!opts?.isTest) pushRecent(q);

    try {
      // Phase 1: preview (skip if already confirmed)
      if (!opts?.confirmed) {
        const preview = await callCommand({ action: "preview", prompt: q });
        if (preview?.risk === "block") {
          setResult({
            blocked: true,
            risk: "block",
            risk_reasons: preview.risk_reasons || [],
            reasoning: preview.reasoning,
            error: undefined,
          } as RunResult);
          return null;
        }
        if (preview?.risk === "warn") {
          setPendingConfirm({ prompt: q, reasons: preview.risk_reasons || [] });
          return null;
        }
      }

      // Phase 2: run
      const data = await callCommand({
        action: "run",
        prompt: q,
        confirmed: !!opts?.confirmed,
        is_test: !!opts?.isTest,
        replay_of_log_id: opts?.replayOf || null,
      });
      setResult(data as RunResult);
      return data as RunResult;
    } catch (e: any) {
      setResult({ error: e?.message || "Request failed" });
      return null;
    } finally {
      setRunning(false);
      setPendingConfirm(null);
    }
  }, [prompt, running, callCommand]);

  const queue = async (selectedOnly: boolean) => {
    const toQueue = drafts
      .filter((d) => !d._skip && (!selectedOnly || (d as any)._sel))
      .filter((d) => !!d.to_email && !!d.body)
      .map(({ _skip, _tone, _angle, _regenerating, ...rest }) => rest);
    if (toQueue.length === 0) {
      setQueueMsg("No emails to queue (skipped or no email address).");
      return;
    }
    setQueuing(true);
    setQueueMsg(null);
    try {
      const data = await callCommand({ action: "queue", queue_drafts: toQueue, log_id: result?.log_id });
      if ((data as any)?.ok) setQueueMsg(`✅ Queued ${(data as any).queued} drafts to approval (10-min delay).`);
      else setQueueMsg(`❌ ${(data as any)?.error || "Queue failed"}`);
    } catch (e: any) {
      setQueueMsg(`❌ ${e?.message || "Queue failed"}`);
    } finally {
      setQueuing(false);
    }
  };

  const copyAll = () => {
    const text = drafts
      .filter((d) => !d._skip)
      .map((d, i) => `--- ${i + 1}. To: ${d.to_email || d.to_phone || "—"} ${d.to_name ? `(${d.to_name})` : ""}\nSubject: ${d.subject || ""}\n\n${d.body}\n`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => setQueueMsg("📋 Copied all drafts."));
  };

  const updateDraft = (i: number, patch: Partial<Draft>) => {
    setDrafts((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const regenerateOne = async (i: number) => {
    const d = drafts[i];
    if (!d || d._regenerating) return;
    const productKey = productKeyFromPrompt(prompt || (history[0]?.prompt ?? ""));
    updateDraft(i, { _regenerating: true });
    try {
      const data = await callCommand({
        action: "regenerate",
        recipient: { to_email: d.to_email, to_phone: d.to_phone, to_name: d.to_name },
        product: productKey,
        tone: d._tone || "direct",
        angle: d._angle || null,
        channel: d.to_phone && !d.to_email ? "sms" : "email",
      });
      if ((data as any)?.ok && (data as any).draft) {
        const nd = (data as any).draft;
        updateDraft(i, {
          subject: nd.subject ?? d.subject,
          body: nd.body ?? d.body,
          to_email: nd.to_email ?? d.to_email,
          to_name: nd.to_name ?? d.to_name,
          _regenerating: false,
        });
      } else {
        updateDraft(i, { _regenerating: false });
        setQueueMsg(`❌ Regenerate failed: ${(data as any)?.error || "unknown"}`);
      }
    } catch (e: any) {
      updateDraft(i, { _regenerating: false });
      setQueueMsg(`❌ ${e?.message || "Regenerate failed"}`);
    }
  };

  // ── History ──
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await callCommand({ action: "history" });
      setHistory(((data as any)?.history || []).filter((r: HistoryRow) => !r.is_test));
    } catch (e) {
      // no-op
    } finally {
      setHistoryLoading(false);
    }
  };

  const replayCommand = async (row: HistoryRow) => {
    const original = row.result_summary || {
      drafts_count: 0, data_rows_count: row.rows_returned || 0, steps_count: 0, cost_usd: row.total_cost_usd || 0,
    };
    const newResult = await run(row.prompt, { confirmed: true, replayOf: row.id });
    if (newResult?.result_summary) {
      setDiff({ original, replay: newResult.result_summary });
    }
  };

  // ── Test mode ──
  const runOneTest = async (idx: number): Promise<boolean> => {
    setTests((arr) => arr.map((t, i) => i === idx ? { ...t, status: "running", detail: undefined } : t));
    try {
      // preview
      const preview = await callCommand({ action: "preview", prompt: TEST_PRODUCTS[idx].prompt });
      if (preview?.risk === "block") throw new Error(`Blocked at preview: ${(preview.risk_reasons || []).join(", ")}`);
      // run
      const runRes = await callCommand({
        action: "run",
        prompt: TEST_PRODUCTS[idx].prompt,
        confirmed: true,
        is_test: true,
      });
      if ((runRes as any)?.error) throw new Error((runRes as any).error);
      const ds = (runRes as any)?.drafts || [];
      if (!Array.isArray(ds) || ds.length === 0) throw new Error("No drafts generated");
      // simulate edit (mutate first draft body in memory only)
      const edited = { ...ds[0], body: (ds[0].body || "") + " [test edit]" };
      // dry-run queue
      const q = await callCommand({
        action: "queue",
        queue_drafts: [edited, ...ds.slice(1)].map((d: any) => ({ to_email: d.to_email || "test@example.com", subject: d.subject, body: d.body })),
        dry_run: true,
        log_id: (runRes as any)?.log_id,
      });
      if (!(q as any)?.ok) throw new Error("Dry-run queue failed");
      const detail = `${ds.length} drafts · edit applied · ${(q as any).validated} validated · $${(runRes as any).cost_usd?.toFixed(4) || "0.01"}`;
      setTests((arr) => arr.map((t, i) => i === idx ? { ...t, status: "pass", detail, cost: (runRes as any).cost_usd } : t));
      return true;
    } catch (e: any) {
      setTests((arr) => arr.map((t, i) => i === idx ? { ...t, status: "fail", detail: e?.message || "Unknown failure" } : t));
      return false;
    }
  };

  const runAllTests = async () => {
    if (testRunning) return;
    setTestRunning(true);
    setTests(TEST_PRODUCTS.map((t) => ({ ...t, status: "idle" as const })));
    for (let i = 0; i < TEST_PRODUCTS.length; i++) {
      await runOneTest(i);
    }
    setTestRunning(false);
  };

  // ───────── render ─────────
  const stickyTop = isMobile ? "top-12" : "top-14";
  const useDrawer = isMobile;

  return (
    <div className="mb-6 pb-[env(safe-area-inset-bottom,0)]">
      {/* Sticky bar */}
      <div className={`sticky ${stickyTop} z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-[#0a1628]/95 backdrop-blur border-b border-[#00d4ff]/20 ${collapsed ? "shadow-[0_4px_16px_rgba(0,212,255,0.08)]" : ""}`}>
        {collapsed ? (
          <button
            onClick={() => { setCollapsed(false); setTimeout(() => taRef.current?.focus(), 50); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="w-full flex items-center gap-2 text-left text-sm text-white/70 hover:text-white min-h-[44px] px-3 rounded-lg bg-white/5 border border-white/10"
          >
            <span className="text-lg">🧠</span>
            <span>Ask the agent…</span>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-white/40">AI Command</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setOpen((o) => ({ ...o, test: !o.test })); }}
                  className="text-[11px] px-2 py-1 rounded border border-white/15 text-white/60 hover:text-white min-h-[28px]"
                >
                  🧪 Test Mode
                </button>
                <button
                  onClick={() => { setOpen((o) => ({ ...o, history: !o.history })); if (!history.length) loadHistory(); }}
                  className="text-[11px] px-2 py-1 rounded border border-white/15 text-white/60 hover:text-white min-h-[28px]"
                >
                  📜 History
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xl mt-2">🧠</span>
              <textarea
                ref={taRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
                placeholder="Ask the agent… e.g. ‘Find 10 plumbing leads and draft emails to 10 buyers’"
                rows={2}
                className="flex-1 min-w-0 bg-[#061018] border border-white/15 rounded-lg px-3 py-2 text-base text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#00d4ff]/60"
              />
              <button
                onClick={() => run()}
                disabled={running || !prompt.trim()}
                className="shrink-0 min-h-[44px] px-3 sm:px-4 rounded-lg bg-[#00d4ff] text-[#0a1628] text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {running ? "…" : "Run"}
              </button>
            </div>
            {/* Recent + quick chips */}
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
              {(recent.length ? recent : QUICK_PROMPTS).slice(0, 6).map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setPrompt(p); run(p); }}
                  className="shrink-0 snap-start text-[11px] px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-[#00d4ff]/40 whitespace-nowrap min-h-[32px]"
                  title={p}
                >
                  {p.length > 38 ? p.slice(0, 36) + "…" : p}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pending confirm banner (warn) */}
      {pendingConfirm && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <div className="font-semibold mb-1">⚠️ Heads up before running</div>
          <ul className="text-xs list-disc pl-5 space-y-0.5 mb-2">
            {pendingConfirm.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => run(pendingConfirm.prompt, { confirmed: true })}
              disabled={running}
              className="min-h-[44px] px-3 rounded-lg bg-amber-400 text-[#0a1628] text-xs font-bold disabled:opacity-40"
            >
              Proceed
            </button>
            <button
              onClick={() => setPendingConfirm(null)}
              className="min-h-[44px] px-3 rounded-lg border border-white/20 text-xs text-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Test Mode Panel */}
      {open.test && (
        <div className="mt-3 rounded-lg border border-purple-400/30 bg-purple-400/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-purple-200">🧪 End-to-End Test Mode</span>
            <button
              onClick={runAllTests}
              disabled={testRunning}
              className="min-h-[36px] px-3 rounded bg-purple-400 text-[#0a1628] text-xs font-bold disabled:opacity-40"
            >
              {testRunning ? "Running…" : "▶ Run All"}
            </button>
          </div>
          <div className="space-y-1.5">
            {tests.map((t, i) => (
              <div key={t.product} className="rounded border border-white/10 bg-white/[0.02] p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {t.status === "idle" && "⚪"}
                    {t.status === "running" && "🟡"}
                    {t.status === "pass" && "✅"}
                    {t.status === "fail" && "❌"}
                  </span>
                  <span className="text-white/90 font-medium flex-1 min-w-0 truncate">{t.product}</span>
                  <button
                    onClick={() => runOneTest(i)}
                    disabled={testRunning}
                    className="text-[10px] px-2 py-1 rounded border border-white/15 text-white/60 hover:text-white min-h-[28px]"
                  >
                    Run
                  </button>
                </div>
                {t.detail && (
                  <div className={`mt-1 pl-7 text-[11px] ${t.status === "pass" ? "text-emerald-300/80" : "text-red-300/80"}`}>
                    {t.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Panel */}
      {open.history && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white/90">📜 Recent commands</span>
            <button onClick={loadHistory} className="text-[11px] text-[#00d4ff]/70 hover:text-[#00d4ff] min-h-[28px] px-2">
              {historyLoading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
          {history.length === 0 && !historyLoading && (
            <p className="text-xs text-white/40">No previous commands.</p>
          )}
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {history.slice(0, 10).map((h) => {
              const sum = h.result_summary || {};
              return (
                <div key={h.id} className="rounded border border-white/10 bg-white/[0.02] p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-white/80 line-clamp-2 break-words">{h.prompt}</div>
                      <div className="text-[10px] text-white/40 mt-1 flex flex-wrap gap-x-2">
                        <span>{timeAgo(h.created_at)}</span>
                        <span>· ${(h.total_cost_usd || 0).toFixed(4)}</span>
                        <span>· {sum.drafts_count || 0} drafts</span>
                        <span>· {sum.data_rows_count ?? h.rows_returned ?? 0} rows</span>
                      </div>
                    </div>
                    <button
                      onClick={() => replayCommand(h)}
                      disabled={running}
                      className="shrink-0 text-[11px] px-2 py-1 rounded border border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/10 min-h-[32px]"
                    >
                      🔁 Replay
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {diff && (
            <div className="mt-2 rounded border border-[#00d4ff]/30 bg-[#00d4ff]/5 p-2 text-[11px] text-white/80">
              <div className="font-semibold text-[#00d4ff] mb-1">Replay diff vs original</div>
              <DiffStrip original={diff.original} replay={diff.replay} />
            </div>
          )}
        </div>
      )}

      {/* Running progress */}
      {running && (
        <div className="mt-3 rounded-lg border border-[#00d4ff]/30 bg-[#00d4ff]/5 p-3 text-sm text-[#00d4ff] flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-[#00d4ff] rounded-full animate-pulse" />
          🧠 Planning + executing…
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-3 space-y-2 min-h-[120px]">
          {result.blocked && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
              <div className="font-semibold mb-1">🚫 Blocked: outside DWA whitelist</div>
              <ul className="text-xs list-disc pl-5 space-y-0.5">
                {(result.risk_reasons || []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              <p className="text-[11px] text-red-200/70 mt-2">No tools were executed. Refine your prompt and try again.</p>
            </div>
          )}
          {result.error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              ❌ {result.error}
            </div>
          )}
          {result.aborted && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              ⚠️ Aborted: {result.reason}
            </div>
          )}
          {result.partial && !result.error && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
              ⚠️ Partial result — one or more steps failed. Output below is what we got.
            </div>
          )}

          {/* Step pills */}
          {result.steps && result.steps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.steps.map((s) => (
                <span
                  key={s.step}
                  className={`text-[11px] px-2 py-1 rounded-full border ${
                    s.ok
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-red-400/30 bg-red-400/10 text-red-300"
                  }`}
                  title={s.error || ""}
                >
                  {s.ok ? "✓" : "✗"} {s.tool}{typeof s.count === "number" ? ` (${s.count})` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Reasoning accordion */}
          {result.reasoning && (
            <Accordion title="🧠 Reasoning" open={open.reasoning} onToggle={() => setOpen((o) => ({ ...o, reasoning: !o.reasoning }))}>
              <p className="text-sm text-white/70">{result.reasoning}</p>
            </Accordion>
          )}

          {/* Data accordion */}
          {result.data_rows && result.data_rows.length > 0 && (
            <Accordion
              title={`📊 Data (${result.data_rows.length} rows)`}
              open={open.data}
              onToggle={() => setOpen((o) => ({ ...o, data: !o.data }))}
            >
              <div className="space-y-2">
                {result.data_rows.slice(0, 25).map((row, i) => (
                  <div key={i} className="rounded-md bg-white/5 border border-white/10 p-2.5 text-xs text-white/80">
                    {Object.entries(row).slice(0, 8).map(([k, v]) => (
                      <div key={k} className="flex flex-col xs:flex-row gap-0.5 xs:gap-2">
                        <span className="text-white/40 shrink-0 sm:min-w-[80px]">{k}:</span>
                        <span className="break-all">{v == null ? "—" : String(v).slice(0, 200)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {result.data_rows.length > 25 && (
                  <p className="text-xs text-white/40">… and {result.data_rows.length - 25} more</p>
                )}
              </div>
            </Accordion>
          )}

          {/* Drafts accordion */}
          {drafts.length > 0 && (
            <Accordion
              title={`📧 ${drafts.length} drafts ready`}
              open={open.drafts}
              onToggle={() => setOpen((o) => ({ ...o, drafts: !o.drafts }))}
              defaultOpen
            >
              <div className="space-y-2">
                {drafts.map((d, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      d._skip ? "border-white/5 bg-white/[0.02] opacity-50" : "border-[#00d4ff]/20 bg-[#00d4ff]/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-white/40">To</div>
                        <div className="text-sm text-white truncate">
                          {d.to_email || d.to_phone || "—"} {d.to_name && <span className="text-white/50">· {d.to_name}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => updateDraft(i, { _skip: !d._skip })}
                        className="shrink-0 text-[11px] px-3 py-1 rounded border border-white/15 text-white/60 hover:text-white min-h-[44px]"
                      >
                        {d._skip ? "Restore" : "Skip"}
                      </button>
                    </div>

                    {d.subject && <div className="text-sm text-white font-semibold mb-1 break-words">{d.subject}</div>}
                    <div className="text-xs text-white/70 whitespace-pre-wrap break-words line-clamp-6">{d.body}</div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => useDrawer ? setEditIdx(i) : setEditIdx(i)}
                        className="text-[11px] px-3 py-1 rounded border border-white/15 text-white/70 hover:text-white min-h-[44px]"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => setPreviewIdx(i)}
                        className="text-[11px] px-3 py-1 rounded border border-white/15 text-white/70 hover:text-white min-h-[44px]"
                      >
                        👁 Preview
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(`Subject: ${d.subject || ""}\n\n${d.body}`)}
                        className="text-[11px] px-3 py-1 rounded border border-white/15 text-white/70 hover:text-white min-h-[44px]"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-2 pb-[env(safe-area-inset-bottom,0)]">
                <button
                  onClick={() => queue(false)}
                  disabled={queuing}
                  className="w-full sm:w-auto min-h-[44px] px-4 rounded-lg bg-[#00d4ff] text-[#0a1628] text-sm font-bold disabled:opacity-40"
                >
                  {queuing ? "Queuing…" : `📤 Queue All (${drafts.filter((d) => !d._skip).length})`}
                </button>
                <button
                  onClick={copyAll}
                  className="w-full sm:w-auto min-h-[44px] px-4 rounded-lg border border-white/20 text-sm text-white/80 hover:text-white"
                >
                  📋 Copy All
                </button>
              </div>
              {queueMsg && <div className="mt-2 text-xs text-white/70">{queueMsg}</div>}
            </Accordion>
          )}

          {/* No-draft completion */}
          {!drafts.length && !result.error && !result.aborted && !result.blocked && result.steps && result.steps.length > 0 && (
            <div className="text-xs text-white/40">
              ✅ Done in {result.steps.length} step{result.steps.length === 1 ? "" : "s"} · ${result.cost_usd?.toFixed(4) || "0.01"}
            </div>
          )}
        </div>
      )}

      {/* Edit drawer */}
      {editIdx !== null && drafts[editIdx] && (
        <BottomDrawer title="Edit draft" onClose={() => setEditIdx(null)}>
          <EditDrawerContent
            draft={drafts[editIdx]}
            onChange={(patch) => updateDraft(editIdx, patch)}
            onRegenerate={() => regenerateOne(editIdx)}
            onDone={() => setEditIdx(null)}
          />
        </BottomDrawer>
      )}

      {/* Preview drawer */}
      {previewIdx !== null && drafts[previewIdx] && (
        <BottomDrawer title="Preview email" onClose={() => setPreviewIdx(null)}>
          <PreviewDrawerContent draft={drafts[previewIdx]} />
        </BottomDrawer>
      )}
    </div>
  );
}

// ───────── sub-components ─────────

function Accordion({
  title, open, onToggle, children, defaultOpen,
}: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-white/90 min-h-[44px]"
      >
        <span>{title}</span>
        <span className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function BottomDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/70" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl bg-[#0a1628] border-t sm:border border-[#00d4ff]/30 max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom,0)]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white">{title}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl min-h-[44px] min-w-[44px]">×</button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">{children}</div>
      </div>
    </div>
  );
}

function EditDrawerContent({
  draft, onChange, onRegenerate, onDone,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onRegenerate: () => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-white/40">Tone</div>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t}
              onClick={() => onChange({ _tone: t })}
              className={`text-[11px] px-3 py-1.5 rounded-full border min-h-[36px] ${
                (draft._tone || "direct") === t
                  ? "border-[#00d4ff] bg-[#00d4ff]/15 text-[#00d4ff]"
                  : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          value={draft._angle || ""}
          onChange={(e) => onChange({ _angle: e.target.value })}
          placeholder="Angle (e.g. ‘lead with their recent permit’)"
          className="w-full bg-[#061018] border border-white/15 rounded px-2 py-2 text-sm text-white placeholder:text-white/30"
        />
        <button
          onClick={onRegenerate}
          disabled={draft._regenerating}
          className="w-full min-h-[44px] px-3 rounded bg-[#00d4ff]/15 border border-[#00d4ff]/40 text-[#00d4ff] text-xs font-bold disabled:opacity-40"
        >
          {draft._regenerating ? "Regenerating…" : "🔄 Regenerate this one"}
        </button>
      </div>

      {draft.subject !== undefined && (
        <input
          value={draft.subject || ""}
          onChange={(e) => onChange({ subject: e.target.value })}
          className="w-full bg-[#061018] border border-white/15 rounded px-3 py-2 text-base text-white"
          placeholder="Subject"
        />
      )}
      <textarea
        value={draft.body}
        onChange={(e) => onChange({ body: e.target.value })}
        rows={10}
        className="w-full bg-[#061018] border border-white/15 rounded px-3 py-2 text-base text-white resize-y min-h-[200px]"
      />
      <button
        onClick={onDone}
        className="w-full min-h-[48px] px-4 rounded-lg bg-[#00d4ff] text-[#0a1628] text-sm font-bold"
      >
        Done
      </button>
    </div>
  );
}

function PreviewDrawerContent({ draft }: { draft: Draft }) {
  return (
    <div className="space-y-3">
      <div className="rounded border border-white/10 bg-white/[0.02] p-3 text-xs space-y-1">
        <div><span className="text-white/40">To: </span><span className="text-white break-all">{draft.to_email || draft.to_phone || "—"}</span></div>
        {draft.to_name && <div><span className="text-white/40">Name: </span><span className="text-white">{draft.to_name}</span></div>}
        <div><span className="text-white/40">From: </span><span className="text-white">matt@detroitwebagent.com</span></div>
      </div>
      {draft.subject && (
        <div className="rounded border border-white/10 p-3 bg-white/[0.02]">
          <div className="text-[10px] uppercase text-white/40 mb-1">Subject</div>
          <div className="text-base font-semibold text-white break-words">{draft.subject}</div>
        </div>
      )}
      <div className="rounded border border-white/10 p-4 bg-white text-[#0a1628]">
        <div className="whitespace-pre-wrap break-words text-sm">{draft.body}</div>
        <hr className="my-3 border-black/10" />
        <div className="text-xs text-black/60">
          Matt Michels — Detroit Web Agency<br />
          (313) 992-1219 · matt@detroitwebagent.com
        </div>
      </div>
    </div>
  );
}

function DiffStrip({ original, replay }: { original: any; replay: any }) {
  const cost1 = Number(original?.cost_usd || 0);
  const cost2 = Number(replay?.cost_usd || 0);
  const costDelta = cost1 > 0 ? Math.round(((cost2 - cost1) / cost1) * 100) : 0;
  const drafts1 = original?.drafts_count ?? 0;
  const drafts2 = replay?.drafts_count ?? 0;
  const steps1 = original?.steps_count ?? 0;
  const steps2 = replay?.steps_count ?? 0;
  const top1: string[] = original?.top_recipients || [];
  const top2: string[] = replay?.top_recipients || [];
  const changed = top1.filter((r, i) => top2[i] !== r).length;
  const sameLabel = (a: number, b: number) => a === b ? "same" : (b > a ? `+${b - a}` : `${b - a}`);
  return (
    <div className="space-y-0.5">
      <div>Cost: ${cost1.toFixed(4)} → ${cost2.toFixed(4)} {costDelta !== 0 && <span className={costDelta < 0 ? "text-emerald-300" : "text-amber-300"}>({costDelta > 0 ? "+" : ""}{costDelta}%)</span>}</div>
      <div>Drafts: {drafts1} → {drafts2} ({sameLabel(drafts1, drafts2)})</div>
      <div>Steps: {steps1} → {steps2} ({sameLabel(steps1, steps2)})</div>
      <div>Top recipient changed: {changed} of {Math.max(top1.length, top2.length)}</div>
    </div>
  );
}
